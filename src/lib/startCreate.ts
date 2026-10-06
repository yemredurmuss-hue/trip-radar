// "Gezimi oluştur" (spec §2): the trip made from the interview, step by step, each step real work that the
// generating screen ticks as it finishes. Built only from what the rest of the board already uses: the trip
// record, stays and flights said the way the chat says them (planned.ts planToSave, so the board shows the
// nights split by city and the flights as plans), who goes (trip.travellers), the style words (trip.style), and
// the interview as the trip's chat. What it makes for the flights and stays are places to fill, never choices
// (trip.startGuide.placeholders). Every step can run again: the trip made in step 1 is reused (the state keeps
// its id) and a plan said again updates the one before (planToSave), so "Tekrar dene" never makes anything twice.
import { db, getSettings, listItems, listMessages, listPreferences, newId, notifyChanged } from "./db";
import { L, withLang } from "./i18n";
import { EMPTY_METRICS, nightsBetween } from "./items";
import { ALL_PLANNED_KINDS, checkPlanned, guardKind, planToSave } from "./planned";
import { cityKeyOf } from "./plan";
import type { PlannedInput } from "./planned";
import { cardsAfter, hasMust, prepAdded, startPlaybook, startPlaybookObj, tripIntentOf, withMusts } from "./playbooks";
import { styleKeyFor } from "./startBoard";
import { suggestionsReview } from "./startHooks";
import { creationOf, dative, historyRows, isPlaceholder, missingInfo, namesToAsk, pbEffects, placeholderPrint, readyText, wantText, type Creation, type StartState } from "./startTrip";
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
    // In the map's order (v5): the trip, the way there (the plane flies), the stays (the stops drop), who goes.
    const steps: StepPlan[] = [
      { id: "trip", running: L("Gezi kaydı açılıyor…", "Opening the trip…"), done: L(`Gezi açıldı: ${c.title}`, `Trip opened: ${c.title}`) },
      c.road
        ? { id: "travel", running: L("Araç için yer açılıyor…", "Making room for the car…"), done: L(`Araç kiralama yeri açıldı: ${c.travel[0]?.city ?? ""}`, `Room made for a car rental: ${c.travel[0]?.city ?? ""}`) }
        : {
            id: "travel", running: L("Uçuşlar için yer açılıyor…", "Making room for the flights…"),
            // None from a place to itself (leaving from the event's gateway city).
            done: !c.travel.length
              ? L(`${s.from ?? ""} çıkışlı: uçuş gerekmiyor`, `Leaving from ${s.from ?? ""}: no flights needed`)
              : s.from ? L(`${s.from} ⇄ ${arrive} uçuşları için yer açıldı`, `Room made for the ${s.from} ⇄ ${arrive} flights`) : L(`${arrive} uçuşları için yer açıldı`, `Room made for the flights to ${arrive}`),
          },
      { id: "route", running: L("Geceler duraklara bölünüyor…", "Splitting the nights by stop…"), done: routeDone },
      { id: "people", running: L("Kişi ve tarz yazılıyor…", "Writing down who and what…"), done: people || L("Sohbet geziye taşındı", "The chat moved to the trip") },
    ];
    if (suggestionsReview()) steps.push({ id: "suggestions", running: L("Öneriler hazırlanıyor…", "Preparing suggestions…"), done: L("Öneriler bölümlerinde", "Suggestions are in their sections") });
    return steps;
  });
}

/**
 * The generating screen's line under its title (v5): where from, the stays in order (a place come back to said again,
 * the event's own marked 🎪), and the nights ("İstanbul → Cape Town → Tankwa Karoo 🎪 → Cape Town · 10 gece").
 */
export function genSubLine(s: StartState, c: Creation): string {
  return withLang(s.lang, () => {
    const it = s.intent;
    const cities = c.stays.map((x) => x.city ?? "").filter(Boolean);
    const stops = cities.filter((x, i) => i === 0 || cityKeyOf(x) !== cityKeyOf(cities[i - 1]));
    const marked = stops.map((x) => (it?.kind === "event" && cityKeyOf(x) === cityKeyOf(it.place) ? `${x} 🎪` : x));
    const way = [...(s.from && !c.road && c.travel.length ? [s.from] : []), ...marked].join(" → ");
    const nights = c.dates ? nightsBetween(c.dates.start, c.dates.end) : 0;
    return [way, nights ? L(`${nights} gece`, `${nights} night${nights === 1 ? "" : "s"}`) : ""].filter(Boolean).join(" · ");
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
      const intent = tripIntentOf(s);
      await d.put("trips", withMusts({
        ...existing,
        ...(intent ? { intent } : {}),
        // A budget a trip kind's answer set, when the trip has none yet (never over one said on the board).
        ...(c.budget && !existing.budget ? { budget: c.budget } : {}),
        confirmedDates: c.dates,
        startGuide: { ...(existing.startGuide ?? { createdAt: now() }), road: c.road || undefined, approxStart: c.approxStart },
        lang: s.lang,
        ...(c.parents && !existing.placeParents ? { placeParents: c.parents } : {}),
        updatedAt: now(),
      }, intent));
      notifyChanged();
      return { tripId: existing.id };
    }
    const trips = await d.getAll("trips");
    const intent = tripIntentOf(s);
    const trip: Trip = {
      id: newId(),
      title: T(() => uniqueTitle(c.title, c.dates?.start ?? null, trips)),
      confirmedDates: c.dates,
      budget: c.budget,
      heroImage: null,
      startGuide: { createdAt: now(), ...(c.road ? { road: true } : {}), ...(c.approxStart ? { approxStart: c.approxStart } : {}) },
      // The conversation's language: the trip's chat and its suggestions go on in it.
      lang: s.lang,
      // Ubud, Canggu and Uluwatu are Bali's: the hero says Bali without asking the model.
      ...(c.parents ? { placeParents: c.parents } : {}),
      // A festival, a ski trip, a honeymoon, a retreat (playbooks/): the suggestions keep to it. None on a classic trip.
      ...(intent ? { intent } : {}),
      createdAt: now(),
      updatedAt: now(),
    };
    // What must hold ("babam merdiven çıkamaz", "mutfak şart"): the stays' requirements and wanted amenities.
    await d.put("trips", withMusts(trip, intent));
    notifyChanged();
    return { tripId: trip.id };
  }
  const tripId = s.tripId;
  if (!tripId || !(await d.get("trips", tripId))) throw new Error(T(() => L("Gezi kaydı bulunamadı.", "The trip record wasn't found.")));
  let done: string | undefined;
  if (id === "route") {
    // Made again (another route after "Sohbete dön"): the stays made before and never touched go first (and the
    // playbook's cards for them: a festival ticket, a ski pass on the days before).
    await dropPlaceholders(tripId, (i) => i.category === "stay" || i.category === "activity");
    await sayAll(tripId, c.stays, c, now, T);
    const pb = T(() => playbookCards(s, c));
    await sayAll(tripId, pb.plan, c, now, T);
    // The preparation list's lines are the traveller's to tick, never places to fill (said again, each is the same one).
    await sayAll(tripId, pb.prep, c, now, T, false);
  } else if (id === "travel") {
    await dropPlaceholders(tripId, (i) => i.category === "flight" || i.category === "transport");
    // The flights (or the car), then the playbook's transfer from where they land (to the festival site, the resort).
    await sayAll(tripId, [...c.travel, ...T(() => playbookCards(s, c)).travel], c, now, T);
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
      for (const row of T(() => historyRows(s.messages, readyText(c, missingInfo(s), namesToAsk(s)), provider, tripId))) await d.put("messages", { ...row, id: newId() });
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
async function sayAll(tripId: string, said: Creation["stays"], c: Creation, now: () => number, T: <R>(fn: () => R) => R = (fn) => fn(), placeholder = true): Promise<Item[]> {
  const d = await db();
  const saved: Item[] = [];
  for (const raw of said) {
    const input = guardKind(raw);
    // The start's own cards may be a kind only the add sheet makes (a camper van rental).
    const problem = T(() => checkPlanned(input, ALL_PLANNED_KINDS));
    if (problem) throw new Error(problem);
    const items = await listItems(tripId);
    // Made one after another (the flight there before the flight home: dating them later reads this order).
    const { item } = T(() => planToSave(input, items, tripId, newId(), now() + saved.length));
    const placed = placedFor(item, c);
    await d.put("items", placed);
    saved.push(placed);
    if (!placeholder) continue;
    // Kept as a place to fill as soon as it's saved (a later one failing leaves none of these looking chosen).
    await change(tripId, (t) => ({
      ...t,
      startGuide: { createdAt: t.startGuide?.createdAt ?? now(), ...t.startGuide, placeholders: { ...t.startGuide?.placeholders, [placed.id]: placeholderPrint(placed) } },
    }));
  }
  return saved;
}

/**
 * What the trip's playbook (playbooks/) adds to what the start makes, in its order: the transfer from where the flight
 * lands (with the flights), the cards for the stay (a festival ticket, a ski pass) and the preparation list's lines.
 * Nothing for a classic trip: it is made exactly as before.
 */
export function playbookCards(s: StartState, c: Creation): { travel: PlannedInput[]; plan: PlannedInput[]; prep: PlannedInput[] } {
  const kind = startPlaybook(s);
  const flight = c.travel.find((x) => x.kind === "flight");
  const intent = tripIntentOf(s);
  // "Özel araç olsun": a car of their own from where the flight lands, whatever the kind (one the playbook opens is
  // said as private instead).
  const privateRide = hasMust(intent, "private_transfer") && !c.road;
  const ride = L("Özel transfer", "Private transfer");
  if (kind === "classic") {
    const first = c.stays[0];
    const extra: PlannedInput[] = privateRide && flight?.to && first?.city
      ? [{ kind: "transfer", date: first.date, end_date: null, time: null, from: flight.to, to: first.city, city: null, title: ride, booked: false, note: null }]
      : [];
    return { travel: extra, plan: [], prep: [] };
  }
  const p = startPlaybookObj(s);
  // The trip kind's answers (the same operations for every kind): cards dropped, marked booked, moved; lines added.
  const effects = pbEffects(s);
  const skeleton = p.skeleton({
    intent: s.intent ?? null,
    dates: c.dates,
    stays: c.stays,
    arrive: c.road ? null : (flight?.to ?? null),
    road: c.road,
    code: s.where?.code ?? s.intent?.code ?? null,
  });
  // (Its name for the operations never goes into the plan.)
  const cards = cardsAfter(skeleton, effects, { dest: s.where?.place ?? "" })
    .map(({ ref: _ref, ...x }): PlannedInput => x)
    .map((x) => (privateRide && x.kind === "transfer" ? { ...x, title: x.title && !/özel|private/i.test(x.title) ? `${ride} · ${x.title}` : ride } : x));
  const moving = (x: PlannedInput) => x.kind === "transfer" || x.kind === "taxi" || x.kind.endsWith("_rental") || x.kind === "ferry";
  const prep = [...p.prep(), ...prepAdded(effects)].map((title): PlannedInput => ({ kind: "prep", date: null, end_date: null, time: null, from: null, to: null, city: null, title, booked: false, note: null }));
  return { travel: cards.filter(moving), plan: cards.filter((x) => !moving(x)), prep };
}

/** A record as the start places it: with the stop's country (flights leave home, so they keep none) and how many go. */
function placedFor(item: Item, c: Creation): Item {
  const people = c.travellers?.count ?? null;
  const country = item.category !== "flight" ? c.countries[cityKeyOf(item.city) ?? ""] : undefined;
  // A night on the boat, in the camp, in the van (a model-made playbook's own stay): that kind, never a hotel to find.
  const own = c.stayAs && item.category === "stay" && (c.stayAs.city == null || cityKeyOf(item.city) === cityKeyOf(c.stayAs.city)) ? c.stayAs.kind : null;
  return {
    ...item,
    ...(own ? { metrics: { ...(item.metrics ?? EMPTY_METRICS), stayKind: own } } : {}),
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
    const intent = tripIntentOf(s);
    const pb = playbookCards(s, c);
    const trip: Trip = {
      id: "start-preview",
      title: c.title,
      confirmedDates: c.dates,
      budget: c.budget,
      heroImage: null,
      startGuide: { createdAt: now,...(c.road ? { road: true } : {}) },
      ...(c.parents ? { placeParents: c.parents } : {}),
      ...(people && typeof people !== "string" ? { travellers: people.travellers } : {}),
      ...(intent ? { intent } : {}),
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(trip, withMusts(trip, intent));
    const items: Item[] = [];
    // The playbook's cards after what every trip has (none for a classic trip).
    for (const raw of [...c.stays, ...c.travel, ...pb.travel, ...pb.plan, ...pb.prep]) {
      const input = guardKind(raw);
      if (checkPlanned(input, ALL_PLANNED_KINDS)) continue;
      const { item } = planToSave(input, items, trip.id, `start-preview-${items.length}`, now);
      items.push(placedFor(item, c));
    }
    return { trip, items };
  });
}
