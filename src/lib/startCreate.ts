// "Gezimi oluştur" (spec §2): the trip made from the interview, step by step, each step real work that the
// generating screen ticks as it finishes. Built only from what the rest of the board already uses: the trip
// record, stays and flights said the way the chat says them (planned.ts planToSave, so the board shows the
// nights split by city and the flights as plans), who goes (trip.travellers), the style words (trip.style), and
// the interview as the trip's chat. What it makes for the flights and stays are places to fill, never choices
// (trip.startGuide.placeholders). Every step can run again: the trip made in step 1 is reused (the state keeps
// its id) and a plan said again updates the one before (planToSave), so "Tekrar dene" never makes anything twice.
import { db, getSettings, listItems, listMessages, listPreferences, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import { checkPlanned, guardKind, planToSave } from "./planned";
import { cityKeyOf } from "./plan";
import { styleKeyFor } from "./startBoard";
import { suggestionsReview } from "./startHooks";
import { creationOf, historyRows, placeholderPrint, readyText, routeText, stopsOf, whoText, wantText, type Creation, type StartState } from "./startTrip";
import { withTravellers } from "./tripSettings";
import { uniqueTitle } from "./trips";
import type { Item, Trip } from "./types";

export type StepId = "trip" | "route" | "travel" | "people" | "suggestions";

export interface StepPlan {
  id: StepId;
  /** While it runs ("Rota çiziliyor…"). */
  running: string;
  /** Once done ("Rota çizildi: Ubud 12 gece → Canggu 10 gece"). */
  done: string;
}

/** The steps for this interview, in order; the suggestions only when their review is there. */
export function stepsFor(s: StartState, c: Creation): StepPlan[] {
  const stops = stopsOf(s);
  const routeLine = stops.length > 1 ? stops.map((x) => `${x.city} ${x.nights} ${L("gece", "nights")}`).join(" → ") : routeText({ stops, arrive: null, leave: null, confirmed: true, source: "single" });
  const arrive = c.travel[0]?.to ?? "";
  const people = [whoText(s.who, null), wantText(s)].filter(Boolean).join(" · ");
  const steps: StepPlan[] = [
    { id: "trip", running: L("Gezi kaydı açılıyor…", "Opening the trip…"), done: L(`Gezi açıldı: ${c.title}`, `Trip opened: ${c.title}`) },
    { id: "route", running: L("Geceler duraklara bölünüyor…", "Splitting the nights by stop…"), done: L(`Rota çizildi: ${routeLine}`, `Route drawn: ${routeLine}`) },
    c.road
      ? { id: "travel", running: L("Araç için yer açılıyor…", "Making room for the car…"), done: L(`Araç kiralama yeri açıldı: ${c.travel[0]?.city ?? ""}`, `Room made for a car rental: ${c.travel[0]?.city ?? ""}`) }
      : {
          id: "travel", running: L("Uçuşlar için yer açılıyor…", "Making room for the flights…"),
          done: s.from ? L(`Uçuşlar için yer açıldı: ${s.from} ⇄ ${arrive}`, `Room made for the flights: ${s.from} ⇄ ${arrive}`) : L(`Uçuşlar için yer açıldı: ${arrive}`, `Room made for the flights: ${arrive}`),
        },
    { id: "people", running: L("Kişi ve tarz yazılıyor…", "Writing down who and what…"), done: people ? L(`Kişi ve tarz: ${people}`, `Who and what: ${people}`) : L("Sohbet geziye taşındı", "The chat moved to the trip") },
  ];
  if (suggestionsReview()) steps.push({ id: "suggestions", running: L("Öneriler hazırlanıyor…", "Preparing suggestions…"), done: L("Öneriler bölümlerinde", "Suggestions are in their sections") });
  return steps;
}

/** What one step needs besides the interview. */
export interface StepEnv {
  now?: () => number;
  /** The chat's provider (its turns are stored in its own format); read from the settings when not given. */
  provider?: "gemini" | "anthropic";
}

/** What a step did: the trip's id (step "trip" makes it), and its line when it has its own words ("3 öneri"). */
export interface StepResult {
  tripId: string;
  done?: string;
}

/** Runs one step; the caller keeps step "trip"'s id on the state before the next step. */
export async function runStep(id: StepId, s: StartState, env: StepEnv = {}): Promise<StepResult> {
  const now = env.now ?? Date.now;
  const c = creationOf(s);
  if (!c) throw new Error(L("Nereye ve ne zaman gerekli.", "Where and when are needed."));
  const d = await db();
  if (id === "trip") {
    const existing = s.tripId ? await d.get("trips", s.tripId) : undefined;
    if (existing) {
      await d.put("trips", {
        ...existing,
        confirmedDates: c.dates,
        startGuide: existing.startGuide ?? { createdAt: now(), ...(c.road ? { road: true } : {}) },
        ...(c.parents && !existing.placeParents ? { placeParents: c.parents } : {}),
        updatedAt: now(),
      });
      notifyChanged();
      return { tripId: existing.id };
    }
    const trips = await d.getAll("trips");
    const trip: Trip = {
      id: newId(),
      title: uniqueTitle(c.title, c.dates.start, trips),
      confirmedDates: c.dates,
      budget: null,
      heroImage: null,
      startGuide: { createdAt: now(), ...(c.road ? { road: true } : {}) },
      // Ubud, Canggu and Uluwatu are Bali's: the hero says Bali without asking the model.
      ...(c.parents ? { placeParents: c.parents } : {}),
      createdAt: now(),
      updatedAt: now(),
    };
    await d.put("trips", trip);
    notifyChanged();
    return { tripId: trip.id };
  }
  const tripId = s.tripId;
  if (!tripId || !(await d.get("trips", tripId))) throw new Error(L("Gezi kaydı bulunamadı.", "The trip record wasn't found."));
  let done: string | undefined;
  if (id === "route") {
    await sayAll(tripId, c.stays, c, now);
  } else if (id === "travel") {
    await sayAll(tripId, c.travel, c, now);
  } else if (id === "people") {
    const items = await listItems(tripId);
    const prefs = await listPreferences(tripId);
    await change(tripId, (t) => {
      let next: Trip = { ...t };
      // Who goes: the names said and how many (the hero's travellers card, the budget per person, the AI review).
      if (c.travellers) {
        const out = withTravellers(t.travellers, { add: c.travellers.names, ...(c.travellers.count ? { count: c.travellers.count } : {}) });
        if (typeof out !== "string") next = { ...next, travellers: out.travellers };
      }
      // The style words picked, under the key the hero asks for (so they show at once and aren't asked again).
      if (c.styles.length) next = { ...next, style: { key: styleKeyFor(next, items, prefs), ids: c.styles } };
      return next;
    });
    // The interview becomes the trip's chat, once (a retry finds it there).
    const messages = await listMessages(tripId);
    if (!messages.some((m) => m.role !== "event")) {
      const provider = env.provider ?? (await getSettings()).provider;
      for (const row of historyRows(s.messages, readyText(c), provider, tripId)) await d.put("messages", { ...row, id: newId() });
    }
  } else if (id === "suggestions") {
    const review = suggestionsReview();
    if (review) {
      const n = await review(tripId);
      done = n > 0 ? L(`${n} öneri bölümlerinde`, `${n} suggestion${n === 1 ? "" : "s"} in their sections`) : L("Şimdilik öneri yok", "No suggestions for now");
    }
  }
  notifyChanged();
  return { tripId, done };
}

/** The trip changed as stored now. */
async function change(tripId: string, fn: (t: Trip) => Trip): Promise<void> {
  const d = await db();
  const tx = d.transaction("trips", "readwrite");
  const t = await tx.store.get(tripId);
  if (t) await tx.store.put(fn(t));
  await tx.done;
}

/**
 * Plans said for the trip, each the way the chat's plan_item saves it (checked first; a wrong one stops the step),
 * with the stop's country and how many go; each kept as a place to fill (not a choice) on the trip.
 */
async function sayAll(tripId: string, said: Creation["stays"], c: Creation, now: () => number): Promise<Item[]> {
  const d = await db();
  const saved: Item[] = [];
  const people = c.travellers?.count ?? null;
  for (const raw of said) {
    const input = guardKind(raw);
    const problem = checkPlanned(input);
    if (problem) throw new Error(problem);
    const items = await listItems(tripId);
    const { item } = planToSave(input, items, tripId, newId(), now());
    // The stop's country (flights leave home, so they keep none): the flag, the weather, the visa, the minis.
    const country = item.category !== "flight" ? c.countries[cityKeyOf(item.city) ?? ""] : undefined;
    const placed: Item = {
      ...item,
      ...(country && !item.countryCode ? { countryCode: country.code, country: item.country ?? country.name } : {}),
      // How many travel, on the plans themselves (the search links read it from there).
      ...(people && item.guests.adults == null ? { guests: { ...item.guests, adults: people } } : {}),
    };
    await d.put("items", placed);
    saved.push(placed);
  }
  await change(tripId, (t) => ({
    ...t,
    startGuide: {
      createdAt: t.startGuide?.createdAt ?? now(),
      ...t.startGuide,
      placeholders: { ...t.startGuide?.placeholders, ...Object.fromEntries(saved.map((i) => [i.id, placeholderPrint(i)])) },
    },
  }));
  return saved;
}
