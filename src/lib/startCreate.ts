// "Gezimi oluştur" (spec §2): the trip made from the interview, step by step, each step real work that the
// generating screen ticks as it finishes. Built only from what the rest of the board already uses: the trip
// record, stays and flights said the way the chat says them (planned.ts planToSave, so the board shows the
// nights split by city and the flights as plans), a note on the trip, and the interview as the trip's chat.
// Every step can run again: the trip made in step 1 is reused (the state keeps its id) and a plan said again
// updates the one before (planToSave), so "Tekrar dene" never makes a second trip or a second stay.
import { db, getSettings, listItems, listMessages, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import { checkPlanned, guardKind, planToSave } from "./planned";
import { suggestionsReview } from "./startHooks";
import { creationOf, historyRows, readyText, routeText, stopsOf, whoText, wantText, type Creation, type StartState } from "./startTrip";
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
      ? { id: "travel", running: L("Araç için yer açılıyor…", "Making room for the car…"), done: L(`Araç kiralama yeri açıldı: ${c.travel[0]?.city ?? ""}`, `Car rental planned: ${c.travel[0]?.city ?? ""}`) }
      : {
          id: "travel", running: L("Uçuşlar için yer açılıyor…", "Making room for the flights…"),
          done: s.from ? L(`Uçuşlar için yer açıldı: ${s.from} ⇄ ${arrive}`, `Flights planned: ${s.from} ⇄ ${arrive}`) : L(`Uçuşlar için yer açıldı: ${arrive}`, `Flights planned: ${arrive}`),
        },
    { id: "people", running: L("Kişi ve tarz yazılıyor…", "Writing down who and what…"), done: people ? L(`Kişi ve tarz: ${people}`, `Who and what: ${people}`) : L("Sohbet geziye taşındı", "The chat moved to the trip") },
  ];
  if (suggestionsReview()) steps.push({ id: "suggestions", running: L("Öneriler hazırlanıyor…", "Preparing suggestions…"), done: L("Öneriler bölümlerinde", "Suggestions are in their sections") });
  return steps;
}

/** What one step needs besides the interview. */
export interface StepEnv {
  myName: string | null;
  now?: () => number;
  /** The chat's provider (its turns are stored in its own format); read from the settings when not given. */
  provider?: "gemini" | "anthropic";
}

/** Runs one step; step "trip" returns the trip's id (kept on the state by the caller before the next step). */
export async function runStep(id: StepId, s: StartState, env: StepEnv): Promise<string | null> {
  const now = env.now ?? Date.now;
  const c = creationOf(s, { myName: env.myName });
  if (!c) throw new Error(L("Nereye ve ne zaman gerekli.", "Where and when are needed."));
  const d = await db();
  if (id === "trip") {
    const existing = s.tripId ? await d.get("trips", s.tripId) : undefined;
    if (existing) {
      await d.put("trips", { ...existing, confirmedDates: c.dates, startGuide: existing.startGuide ?? { createdAt: now(), road: c.road || undefined }, updatedAt: now() });
      notifyChanged();
      return existing.id;
    }
    const trips = await d.getAll("trips");
    const trip: Trip = {
      id: newId(),
      title: uniqueTitle(c.title, c.dates.start, trips),
      confirmedDates: c.dates,
      budget: null,
      heroImage: null,
      startGuide: { createdAt: now(), ...(c.road ? { road: true } : {}) },
      createdAt: now(),
      updatedAt: now(),
    };
    await d.put("trips", trip);
    notifyChanged();
    return trip.id;
  }
  const tripId = s.tripId;
  if (!tripId || !(await d.get("trips", tripId))) throw new Error(L("Gezi kaydı bulunamadı.", "The trip record wasn't found."));
  if (id === "route") {
    await sayAll(tripId, c.stays, c.people, now);
  } else if (id === "travel") {
    await sayAll(tripId, c.travel, c.people, now);
  } else if (id === "people") {
    if (c.note) {
      const prefs = await d.getAll("preferences");
      if (!prefs.some((p) => p.tripId === tripId && p.text === c.note)) await d.put("preferences", { id: newId(), tripId, text: c.note, createdAt: now() });
    }
    // The interview becomes the trip's chat, once (a retry finds it there).
    const messages = await listMessages(tripId);
    if (!messages.some((m) => m.role !== "event")) {
      const provider = env.provider ?? (await getSettings()).provider;
      for (const row of historyRows(s.messages, readyText(c), provider, tripId)) await d.put("messages", { ...row, id: newId() });
    }
  } else if (id === "suggestions") {
    const review = suggestionsReview();
    if (review) await review(tripId);
  }
  notifyChanged();
  return tripId;
}

/** Plans said for the trip, each the way the chat's plan_item saves it (checked first; a wrong one stops the step). */
async function sayAll(tripId: string, said: Creation["stays"], people: number | null, now: () => number): Promise<Item[]> {
  const d = await db();
  const saved: Item[] = [];
  for (const raw of said) {
    const input = guardKind(raw);
    const problem = checkPlanned(input);
    if (problem) throw new Error(problem);
    const items = await listItems(tripId);
    const { item } = planToSave(input, items, tripId, newId(), now());
    // How many travel, on the plans themselves (the hero's "2 kişi" and the search links read it from there).
    const withPeople = people && item.guests.adults == null ? { ...item, guests: { ...item.guests, adults: people } } : item;
    await d.put("items", withPeople);
    saved.push(withPeople);
  }
  return saved;
}
