// "Gezimi oluştur" (spec §2): the trip made from the interview, step by step, each step real work that the
// generating screen ticks as it finishes. Built only from what the rest of the board already uses: the trip
// record, stays and flights said the way the chat says them (planned.ts planToSave, so the board shows the
// nights split by city and the flights as plans), who goes (trip.travellers), the style words (trip.style), and
// the interview as the trip's chat. What it makes for the flights and stays are places to fill, never choices
// (trip.startGuide.placeholders). Every step can run again: the trip made in step 1 is reused (the state keeps
// its id) and a plan said again updates the one before (planToSave), so "Tekrar dene" never makes anything twice.
import { db, getSettings, listItems, listMessages, listPreferences, newId, notifyChanged } from "./db";
import { L, withLang } from "./i18n";
import { nightsBetween } from "./items";
import { checkPlanned, guardKind, planToSave } from "./planned";
import { cityKeyOf } from "./plan";
import { styleKeyFor } from "./startBoard";
import { suggestionsReview } from "./startHooks";
import { creationOf, dative, historyRows, isPlaceholder, missingInfo, placeholderPrint, readyText, wantText, type Creation, type StartState } from "./startTrip";
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

/**
 * The steps for this interview, in order, in the chat's language; the suggestions only when their review is there.
 * Each says, once done, what it really wrote ("Koh Phangan'a 31 gece yazıldı", "İstanbul ⇄ Koh Samui uçuşları için
 * yer açıldı", "2 kişi · Dingin, Romantik").
 */
export function stepsFor(s: StartState, c: Creation): StepPlan[] {
  return withLang(s.lang, () => {
    const stays = c.stays;
    const nightsOf = (x: { date: string | null; end_date: string | null }) => (x.date && x.end_date ? nightsBetween(x.date, x.end_date) : 0);
    const routeDone = !c.dates
      ? L(`${dative(stays[0]?.city ?? "")} konaklama yeri açıldı; geceler tarihle gelir`, `Room made for a stay in ${stays[0]?.city ?? ""}; the nights come with the dates`)
      : stays.length > 1
        ? s.route?.source === "circuit"
          ? // Honest about what it used (rev 3): the classic circuit when the model's wasn't there.
            L(`Klasik rota çizildi: ${stays.map((x) => `${x.city} ${nightsOf(x)} gece`).join(" → ")}`, `Classic route drawn: ${stays.map((x) => `${x.city} ${nightsOf(x)} nights`).join(" → ")}`)
          : L(`Rota çizildi: ${stays.map((x) => `${x.city} ${nightsOf(x)} gece`).join(" → ")}`, `Route drawn: ${stays.map((x) => `${x.city} ${nightsOf(x)} nights`).join(" → ")}`)
        : L(`${dative(stays[0]?.city ?? "")} ${nightsOf(stays[0])} gece yazıldı`, `${nightsOf(stays[0])} night${nightsOf(stays[0]) === 1 ? "" : "s"} written for ${stays[0]?.city ?? ""}`);
    const arrive = c.travel[0]?.to ?? "";
    const n = c.travellers?.count ?? null;
    const people = [n ? L(`${n} kişi`, n === 1 ? "1 person" : `${n} people`) : "", wantText(s)].filter(Boolean).join(" · ");
    const steps: StepPlan[] = [
      { id: "trip", running: L("Gezi kaydı açılıyor…", "Opening the trip…"), done: L(`Gezi açıldı: ${c.title}`, `Trip opened: ${c.title}`) },
      { id: "route", running: L("Geceler duraklara bölünüyor…", "Splitting the nights by stop…"), done: routeDone },
      c.road
        ? { id: "travel", running: L("Araç için yer açılıyor…", "Making room for the car…"), done: L(`Araç kiralama yeri açıldı: ${c.travel[0]?.city ?? ""}`, `Room made for a car rental: ${c.travel[0]?.city ?? ""}`) }
        : {
            id: "travel", running: L("Uçuşlar için yer açılıyor…", "Making room for the flights…"),
            done: s.from ? L(`${s.from} ⇄ ${arrive} uçuşları için yer açıldı`, `Room made for the ${s.from} ⇄ ${arrive} flights`) : L(`${arrive} uçuşları için yer açıldı`, `Room made for the flights to ${arrive}`),
          },
      { id: "people", running: L("Kişi ve tarz yazılıyor…", "Writing down who and what…"), done: people || L("Sohbet geziye taşındı", "The chat moved to the trip") },
    ];
    if (suggestionsReview()) steps.push({ id: "suggestions", running: L("Öneriler hazırlanıyor…", "Preparing suggestions…"), done: L("Öneriler bölümlerinde", "Suggestions are in their sections") });
    return steps;
  });
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
  // In the chat's language, whatever the board's (its title, the records' names, the closing line, the step words).
  const T = <R,>(fn: () => R): R => withLang(s.lang, fn);
  const c = T(() => creationOf(s));
  if (!c) throw new Error(T(() => L("Nereye gidileceği gerekli.", "Where to go is needed.")));
  const d = await db();
  if (id === "trip") {
    const existing = s.tripId ? await d.get("trips", s.tripId) : undefined;
    if (existing) {
      await d.put("trips", {
        ...existing,
        confirmedDates: c.dates,
        startGuide: { ...(existing.startGuide ?? { createdAt: now() }), road: c.road || undefined, approxStart: c.approxStart },
        lang: s.lang,
        ...(c.parents && !existing.placeParents ? { placeParents: c.parents } : {}),
        updatedAt: now(),
      });
      notifyChanged();
      return { tripId: existing.id };
    }
    const trips = await d.getAll("trips");
    const trip: Trip = {
      id: newId(),
      title: T(() => uniqueTitle(c.title, c.dates?.start ?? null, trips)),
      confirmedDates: c.dates,
      budget: null,
      heroImage: null,
      startGuide: { createdAt: now(), ...(c.road ? { road: true } : {}), ...(c.approxStart ? { approxStart: c.approxStart } : {}) },
      // The conversation's language: the trip's chat and its suggestions go on in it.
      lang: s.lang,
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
  if (!tripId || !(await d.get("trips", tripId))) throw new Error(T(() => L("Gezi kaydı bulunamadı.", "The trip record wasn't found.")));
  let done: string | undefined;
  if (id === "route") {
    // Made again (another route after "Sohbete dön"): the stays made before and never touched go first.
    await dropPlaceholders(tripId, (i) => i.category === "stay");
    await sayAll(tripId, c.stays, c, now, T);
  } else if (id === "travel") {
    await dropPlaceholders(tripId, (i) => i.category === "flight" || i.category === "transport");
    await sayAll(tripId, c.travel, c, now, T);
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
      // What wasn't said is asked there, in the same conversation (item 4).
      for (const row of T(() => historyRows(s.messages, readyText(c, missingInfo(s)), provider, tripId))) await d.put("messages", { ...row, id: newId() });
    }
  } else if (id === "suggestions") {
    const review = suggestionsReview();
    if (review) {
      const n = await review(tripId);
      done = T(() => (n > 0 ? L(`${n} öneri bölümlerinde`, `${n} suggestion${n === 1 ? "" : "s"} in their sections`) : L("Şimdilik öneri yok", "No suggestions for now")));
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

/** The places the start made before and the traveller never touched (isPlaceholder), of this kind: removed. */
async function dropPlaceholders(tripId: string, kind: (i: Item) => boolean): Promise<void> {
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip?.startGuide?.placeholders) return;
  const gone = (await listItems(tripId)).filter((i) => kind(i) && isPlaceholder(trip, i));
  if (!gone.length) return;
  for (const i of gone) await d.delete("items", i.id);
  await change(tripId, (t) => ({
    ...t,
    startGuide: { createdAt: t.startGuide?.createdAt ?? Date.now(), ...t.startGuide, placeholders: Object.fromEntries(Object.entries(t.startGuide?.placeholders ?? {}).filter(([id]) => !gone.some((g) => g.id === id))) },
  }));
}

/**
 * Plans said for the trip, each the way the chat's plan_item saves it (checked first; a wrong one stops the step),
 * with the stop's country and how many go; each kept as a place to fill (not a choice) on the trip.
 */
async function sayAll(tripId: string, said: Creation["stays"], c: Creation, now: () => number, T: <R>(fn: () => R) => R = (fn) => fn()): Promise<Item[]> {
  const d = await db();
  const saved: Item[] = [];
  for (const raw of said) {
    const input = guardKind(raw);
    const problem = T(() => checkPlanned(input));
    if (problem) throw new Error(problem);
    const items = await listItems(tripId);
    // Made one after another (the flight there before the flight home: dating them later reads this order).
    const { item } = T(() => planToSave(input, items, tripId, newId(), now() + saved.length));
    const placed = placedFor(item, c);
    await d.put("items", placed);
    saved.push(placed);
    // Kept as a place to fill as soon as it's saved (a later one failing leaves none of these looking chosen).
    await change(tripId, (t) => ({
      ...t,
      startGuide: { createdAt: t.startGuide?.createdAt ?? now(), ...t.startGuide, placeholders: { ...t.startGuide?.placeholders, [placed.id]: placeholderPrint(placed) } },
    }));
  }
  return saved;
}

/** A record as the start places it: with the stop's country (flights leave home, so they keep none) and how many go. */
function placedFor(item: Item, c: Creation): Item {
  const people = c.travellers?.count ?? null;
  const country = item.category !== "flight" ? c.countries[cityKeyOf(item.city) ?? ""] : undefined;
  return {
    ...item,
    // The flag, the weather, the visa, the minis.
    ...(country && !item.countryCode ? { countryCode: country.code, country: item.country ?? country.name } : {}),
    // How many travel, on the plans themselves (the search links read it from there).
    ...(people && item.guests.adults == null ? { guests: { ...item.guests, adults: people } } : {}),
  };
}

/**
 * What "Oluştur" would write, in memory only and never stored (item 7): the trip and its stays and flights, so the
 * rules' suggestions can be worked out while the chat goes on. Null until the destination is known.
 */
export function wouldMake(s: StartState, now = Date.now()): { trip: Trip; items: Item[] } | null {
  return withLang(s.lang, () => {
    const c = creationOf(s);
    if (!c) return null;
    const people = c.travellers ? withTravellers(undefined, { add: c.travellers.names, ...(c.travellers.count ? { count: c.travellers.count } : {}) }) : null;
    const trip: Trip = {
      id: "start-preview",
      title: c.title,
      confirmedDates: c.dates,
      budget: null,
      heroImage: null,
      startGuide: { createdAt: now, ...(c.road ? { road: true } : {}) },
      ...(c.parents ? { placeParents: c.parents } : {}),
      ...(people && typeof people !== "string" ? { travellers: people.travellers } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const items: Item[] = [];
    for (const raw of [...c.stays, ...c.travel]) {
      const input = guardKind(raw);
      if (checkPlanned(input)) continue;
      const { item } = planToSave(input, items, trip.id, `start-preview-${items.length}`, now);
      items.push(placedFor(item, c));
    }
    return { trip, items };
  });
}
