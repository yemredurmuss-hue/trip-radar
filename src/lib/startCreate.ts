// "Gezimi oluştur" (spec §2): the trip made from the interview, step by step, each step real work that the
// generating screen ticks as it finishes. Built only from what the rest of the board already uses: the trip
// record, stays and flights said the way the chat says them (planned.ts planToSave, so the board shows the
// nights split by city and the flights as plans), who goes (trip.travellers), the style words (trip.style), and
// the interview as the trip's chat. What it makes for the flights and stays are places to fill, never choices
// (trip.startGuide.placeholders). Every step can run again: the trip made in step 1 is reused (the state keeps
// its id) and a plan said again updates the one before (planToSave), so "Tekrar dene" never makes anything twice.
import { mergeWants, wantsFromStart, type TripWants } from "./travelWants";
import { db, getSettings, listItems, listMessages, listPreferences, newId, notifyChanged } from "./db";
import { L, withLang } from "./i18n";
import { EMPTY_METRICS, formatDateRange, nightsBetween } from "./items";
import { ALL_PLANNED_KINDS, checkPlanned, guardKind, planToSave } from "./planned";
import { cityKeyOf } from "./plan";
import type { PlannedInput } from "./planned";
import { cardsAfter, hasMust, prepAdded, startPlaybook, startPlaybookObj, tripIntentOf, withMusts } from "./playbooks";
import { styleKeyFor } from "./startBoard";
import { suggestionsReview } from "./startHooks";
import { creationOf, dative, historyRows, isPlaceholder, missingInfo, namesToAsk, narrowPlaceholders, pbEffects, pbWants, placeholderPrint, readyText, spineChoices, spineSummary, wantText, whoText, type Creation, type StartCtx, type StartState } from "./startTrip";
import { withTravellers } from "./tripSettings";
import { uniqueTitle } from "./trips";
import type { Item, ItemPart, Trip } from "./types";

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
    // The nights of a kind's own: on the boat ⛴, in the camp ⛺, in the van 🚐.
    const own = c.stayAs ? { boat: "⛴", camp: "⛺", vehicle: "🚐" }[c.stayAs.kind as "boat" | "camp" | "vehicle"] : null;
    const marked = stops.map((x) =>
      it?.kind === "event" && cityKeyOf(x) === cityKeyOf(it.place) ? `${x} 🎪` : own && (c.stayAs!.city == null || cityKeyOf(x) === cityKeyOf(c.stayAs!.city)) ? `${own} ${x}` : x,
    );
    const way = [...(s.from && !c.road && c.travel.length ? [s.from] : []), ...marked].join(" → ");
    const nights = c.dates ? nightsBetween(c.dates.start, c.dates.end) : 0;
    return [way, nights ? L(`${nights} gece`, `${nights} night${nights === 1 ? "" : "s"}`) : ""].filter(Boolean).join(" · ");
  });
}

/** The plan said back before it is made (spec 2026-10-07 §C): the route, the days, who, what it is for, what must hold. */
export interface PlanSummary {
  rows: { label: string; value: string }[];
  musts: string[];
}

/** The short plan shown while it counts down: only what is known; null until the destination is. */
export function planSummary(s: StartState, ctx: Pick<StartCtx, "myName">): PlanSummary | null {
  return withLang(s.lang, () => {
    const c = creationOf(s);
    if (!c) return null;
    const rows: PlanSummary["rows"] = [{ label: L("Rota", "Route"), value: genSubLine(s, c) }];
    if (c.dates) rows.push({ label: L("Tarih", "Dates"), value: `${formatDateRange(c.dates.start, c.dates.end)}${c.approxStart ? L(" (yaklaşık)", " (approx.)") : ""}` });
    if (s.who) rows.push({ label: L("Kişi", "Who"), value: whoText(s.who, ctx.myName) });
    const intent = tripIntentOf(s);
    const concept = intent?.label ?? (s.intent && s.intent.kind !== "place" ? s.intent.name : null);
    if (concept) rows.push({ label: L("Konsept", "Concept"), value: `${concept}${s.playbook?.focus === "only" ? L(" · yalnız bu deneyim", " · this experience only") : ""}` });
    return { rows, musts: intent?.musts?.map((m) => m.text) ?? [] };
  });
}

/** What one step needs besides the interview. */
export interface StepEnv {
  now?: () => number;
  /** The chat's provider (its turns are stored in its own format); read from the settings when not given. */
  provider?: "gemini" | "anthropic";
}

/** The start's intent on top of what the trip already had (null: nothing known). */
const startWants = (s: StartState, had?: TripWants | null): TripWants | null => mergeWants(had, mergeWants(wantsFromStart(s), pbWants(s)));

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
        // The intent said at the start (the money level, who goes, the kind of stay), over what the trip had.
        ...(startWants(s, existing.wants) ? { wants: startWants(s, existing.wants) } : {}),
        confirmedDates: c.dates,
        startGuide: { ...(existing.startGuide ?? { createdAt: now() }), road: c.road || undefined, approxStart: c.approxStart, way: c.way ?? undefined, dayTrip: c.dayTrip || undefined, routeDraft: c.routeDraft || undefined },
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
      // The intent said at the start: "Ekonomik", who goes, the kind of stay (travelWants.ts); every suggestion reads it.
      ...(startWants(s) ? { wants: startWants(s) } : {}),
      heroImage: null,
      startGuide: { createdAt: now(), ...(c.road ? { road: true } : {}), ...(c.approxStart ? { approxStart: c.approxStart } : {}), ...(c.way ? { way: c.way } : {}), ...(c.dayTrip ? { dayTrip: true } : {}), ...(c.routeDraft ? { routeDraft: true } : {}) },
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
    const pb = T(() => playbookCards(s, c));
    // A stay of its own the kind asks for takes its nights out of the city's stay (carveSpecialStays); one the traveller
    // asked for in words is already carved (splitSpecialStays), so the model's card for that city isn't made again.
    const plan = pb.plan.filter((x) => !askedThere(s, x));
    const carved = T(() => carveSpecialStays(shapedBase(s, c, [...pb.travel, ...plan]).stays, plan));
    await sayAll(tripId, carved.stays, c, now, T);
    await sayAll(tripId, plan.filter((x) => !carved.used.includes(x)), c, now, T);
    // The preparation list's lines are the traveller's to tick, never places to fill (said again, each is the same one).
    await sayAll(tripId, pb.prep, c, now, T, false);
  } else if (id === "travel") {
    await dropPlaceholders(tripId, (i) => i.category === "flight" || i.category === "transport");
    // The flights (or the car), then the playbook's transfer from where they land (to the festival site, the resort).
    const pb = T(() => playbookCards(s, c));
    await sayAll(tripId, [...T(() => shapedBase(s, c, [...pb.travel, ...pb.plan])).travel, ...pb.travel], c, now, T);
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
      // The spine said back, ending on the one question that shapes it most (omurga 2026-10-31).
      for (const row of T(() => historyRows(s.messages, spineSummary(c, s), provider, tripId, spineChoices(c, s)))) await d.put("messages", { ...row, id: newId() });
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

/**
 * The start's places to fill take the city the trip narrowed to (startTrip.narrowPlaceholders: "İstanbul → Mısır" becomes
 * "İstanbul → Şarm El-Şeyh" once its records name Şarm), still places to fill. Run after the chat's tools and an added offer.
 */
export async function narrowStart(tripId: string): Promise<number> {
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip?.startGuide?.placeholders) return 0;
  const made = narrowPlaceholders(trip, await listItems(tripId));
  if (!made.items.length) return 0;
  for (const item of made.items) await d.put("items", { ...item, updatedAt: Date.now() });
  await change(tripId, (t) => ({ ...t, startGuide: { createdAt: t.startGuide?.createdAt ?? Date.now(), ...t.startGuide, placeholders: { ...t.startGuide?.placeholders, ...made.prints } } }));
  return made.items.length;
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
async function sayAll(tripId: string, said: ShapedInput[], c: Creation, now: () => number, T: <R>(fn: () => R) => R = (fn) => fn(), placeholder = true): Promise<Item[]> {
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
    const placed = placedFor(item, c, raw.part);
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
export function playbookCards(s: StartState, c: Creation): { travel: ShapedInput[]; plan: ShapedInput[]; prep: PlannedInput[] } {
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
    return { travel: extra, plan: wantedCards(s, c, []), prep: [] };
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
    .map(({ ref: _ref, ...x }): ShapedInput => x)
    .map((x) => (privateRide && x.kind === "transfer" ? { ...x, title: x.title && !/özel|private/i.test(x.title) ? `${ride} · ${x.title}` : ride } : x));
  const moving = (x: PlannedInput) => x.kind === "transfer" || x.kind === "taxi" || x.kind.endsWith("_rental") || x.kind === "ferry";
  const prep = [...p.prep(), ...prepAdded(effects)].map((title): PlannedInput => ({ kind: "prep", date: null, end_date: null, time: null, from: null, to: null, city: null, title, booked: false, note: null }));
  const ringed = closeRing(cards, c);
  const plan = ringed.filter((x) => !moving(x));
  return { travel: ringed.filter(moving), plan: [...plan, ...wantedCards(s, c, plan)], prep };
}

/** The ways between an airport and the stay a card can be (a transfer, a taxi, a bus, a train, a ferry): one day each. */
const AIRPORT_WAYS = new Set(["transfer", "taxi", "bus", "train", "ferry"]);

/**
 * The ring closes (omurga 2026-10-31, Emre: "20 Şubat dönüş uçağı var ama 20 Şubat transfer yok"): a way in from the
 * airport the kind made (the model's "Havalimanı–şehir merkezi otobüsü") means a way back to it on the day home, the same
 * kind of way, when none was made. Never on a road trip, never without the flights home.
 */
function closeRing(cards: ShapedInput[], c: Creation): ShapedInput[] {
  const flights = c.travel.filter((t) => t.kind === "flight");
  if (c.road || flights.length < 2) return cards;
  const first = c.dates?.start ?? flights[0].date;
  const last = c.dates?.end ?? flights.at(-1)!.date;
  if (!first || !last) return cards;
  const oneDay = (x: ShapedInput) => AIRPORT_WAYS.has(x.kind) && !x.end_date;
  const into = cards.find((x) => oneDay(x) && x.date === first);
  if (!into || cards.some((x) => oneDay(x) && x.date === last)) return cards;
  const back: ShapedInput = {
    ...into, date: last, from: into.to, to: into.from,
    title: into.title ? L(`Dönüş · ${into.title}`, `Back · ${into.title}`) : null,
    ...(into.part ? { part: { ...into.part, ref: `${into.part.ref}-back` } } : {}),
  };
  return [...cards, back];
}

/**
 * The activities the traveller plainly asked for ("bir gün husky turu"), each a card on its city (omurga 2026-10-31): on its
 * day when said and within the trip, under their own words; one the kind's playbook already makes is not made twice.
 */
function wantedCards(s: StartState, c: Creation, made: readonly PlannedInput[]): ShapedInput[] {
  const key = (t: string | null | undefined) => (t ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
  return (s.wanted ?? []).flatMap((w): ShapedInput[] => {
    const what = key(w.what);
    if (made.some((m) => key(m.title).includes(what) || (key(m.title) && what.includes(key(m.title))))) return [];
    const stay = (w.city ? c.stays.find((x) => cityKeyOf(x.city) === cityKeyOf(w.city)) : null) ?? c.stays[0] ?? null;
    const day = w.day && c.dates && w.day >= c.dates.start && w.day <= c.dates.end ? w.day : null;
    const title = w.what.charAt(0).toLocaleUpperCase("tr") + w.what.slice(1);
    return [{ kind: "activity", date: day, end_date: null, time: null, from: null, to: null, city: w.city ?? stay?.city ?? null, title, booked: false, note: null }];
  });
}

/** A plan to say with the part of the trip's spine it stands for (gezi biçimi), kept on the record it makes (Item.part). */
export type ShapedInput = PlannedInput & { part?: ItemPart };

/** The word of a stay of the trip's own kind ("Tekne", "Kamp", "Karavan"). */
const stayWord = (kind: string): string => (kind === "boat" ? L("Tekne", "Boat") : kind === "camp" ? L("Kamp", "Camp") : kind === "vehicle" ? L("Karavan", "Camper van") : L("Konaklama", "Stay"));

/** Whether a stay is at a place (no place: all of them). */
const atPlace = (x: PlannedInput, place: string | null | undefined) => !place || cityKeyOf(x.city) === cityKeyOf(place);

/**
 * The stays and the way there as the trip's shape makes them (gezi biçimi, spec §1.4), each with its part: the nights a
 * package covers (a festival's camp by its ticket, a retreat's by its programme: "Dahil"), the nights of the trip's own
 * kind (a boat, a camp, a cabin) holding what their package covers (the transfer, the dives), a road trip's car covering
 * the drives between the cities (D10). A hotel and a flight stay as they are.
 */
export function shapedBase(s: StartState, c: Creation, cards: ShapedInput[]): { stays: ShapedInput[]; travel: ShapedInput[] } {
  const ownKind = (x: PlannedInput) => Boolean(c.stayAs && (c.stayAs.city == null || cityKeyOf(x.city) === cityKeyOf(c.stayAs.city)));
  // What the nights hold: the cards covered by "stay" (a boat's transfer and dives, a resort's seaplane).
  const held = cards.filter((x) => x.part?.by === "stay");
  const firstHeld = c.stays.findIndex((x) => atPlace(x, held[0]?.city ?? held[0]?.to));
  const stays = c.stays.map((x, i): ShapedInput => {
    const own = ownKind(x);
    // The event's own nights are the ticket's only as its camp (a hotel by the site, answered so, is a stay to find).
    const cover = cards.find((k) => k.part?.covers?.some((v) => (v === "stay:event" ? own && s.intent?.kind === "event" && atPlace(x, s.intent.place) : v === "stay" && atPlace(x, k.city))));
    const holds = held.length && (own || i === Math.max(firstHeld, 0)) ? held.map((k) => k.part!.ref) : [];
    if (!cover && !own && !holds.length) return x;
    const part: ItemPart = { ref: "stay", section: "stay", frame: "stay" };
    if (own && c.stayAs) part.word = c.stayAs.word ?? stayWord(c.stayAs.kind);
    if (cover?.part) part.by = cover.part.ref;
    if (holds.length) part.covers = holds;
    return { ...x, part };
  });
  // A road trip's car (the start's road mode): it covers the drives between the cities over its days.
  const travel = c.travel.map((x): ShapedInput => (c.road && x.kind === "car_rental" ? { ...x, part: { ref: "car", section: "transport", frame: "ticket", word: L("Araç", "Car"), covers: ["legs"] } } : x));
  return { stays, travel };
}

const DAY_MS = 86_400_000;
const plusDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

/** A model card for a stay of its own in a city where the traveller's own words already carved one (s.specialStays). */
const askedThere = (s: StartState, k: ShapedInput) =>
  isOwnStay(k) && (s.specialStays ?? []).some((sp) => !k.city || cityKeyOf(sp.city) === cityKeyOf(k.city));

/** A stay of its own the trip's kind asks for (a glass cabin's night, a ryokan): its own box, nothing covers it or is held. */
const isOwnStay = (k: ShapedInput) => k.kind !== "stay" && k.part?.section === "stay" && k.part.frame === "stay" && !k.part.by && !k.part.covers?.length;

/**
 * Stays of their own the kind asks for take their nights out of the city's stay (omurga 2026-10-31, Emre: Tromsø'nun oteli
 * 5 geceyi tuttu, "1 gece cam tavanlı kulübe" aynı geceye ayrı kart oldu): one night unless its days say more, on its own
 * day or its city's first night; the stay goes on around it. One with no nights to take (no dates, another city) stays a
 * card (`used` says which became stays). Pure.
 */
export function carveSpecialStays(stays: ShapedInput[], cards: ShapedInput[]): { stays: ShapedInput[]; used: ShapedInput[] } {
  let out = [...stays];
  const used: ShapedInput[] = [];
  for (const k of cards.filter(isOwnStay)) {
    const at = out.findIndex((x) => x.kind === "stay" && x.date && x.end_date && (!k.city || cityKeyOf(x.city) === cityKeyOf(k.city)) && (!k.date || (k.date >= x.date && k.date < x.end_date)));
    if (at < 0) continue;
    const x = out[at];
    const start = k.date ?? x.date!;
    const n = k.date && k.end_date && k.end_date > k.date ? Math.round((Date.parse(k.end_date) - Date.parse(k.date)) / DAY_MS) : 1;
    // A card spread over the whole stay (the model's "stay" anchor) says no nights of its own: it takes none.
    if (n >= Math.round((Date.parse(x.end_date!) - Date.parse(x.date!)) / DAY_MS)) continue;
    const end = plusDays(start, n) < x.end_date! ? plusDays(start, n) : x.end_date!;
    const own: ShapedInput = { ...k, kind: "stay", city: k.city ?? x.city, date: start, end_date: end };
    const parts = [
      ...(start > x.date! ? [{ ...x, end_date: start }] : []),
      own,
      ...(end < x.end_date! ? [{ ...x, date: end }] : []),
    ];
    out = [...out.slice(0, at), ...parts, ...out.slice(at + 1)];
    used.push(k);
  }
  return { stays: out, used };
}

/** A record as the start places it: with the stop's country (flights leave home, so they keep none), how many go, its part. */
function placedFor(item: Item, c: Creation, part?: ItemPart): Item {
  const people = c.travellers?.count ?? null;
  const country = item.category !== "flight" ? c.countries[cityKeyOf(item.city) ?? ""] : undefined;
  // A night on the boat, in the camp, in the van (a model-made playbook's own stay): that kind, never a hotel to find.
  const own = c.stayAs && item.category === "stay" && (c.stayAs.city == null || cityKeyOf(item.city) === cityKeyOf(c.stayAs.city)) ? c.stayAs.kind : null;
  return {
    ...item,
    ...(own ? { metrics: { ...(item.metrics ?? EMPTY_METRICS), stayKind: own } } : {}),
    // A camp or a caravan a ticket covers (a festival's own nights) has nothing to book: set aside like an idea
    // (booking.setAside). Any other camp is a place to book (D3: never "alındı" by itself; H4).
    ...((own === "camp" || own === "vehicle") && part?.by && item.noBooking == null ? { noBooking: item.updatedAt } : {}),
    ...(part ? { part } : {}),
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
      ...(startWants(s) ? { wants: startWants(s) } : {}),
      heroImage: null,
      startGuide: { createdAt: now, ...(c.road ? { road: true } : {}), ...(c.way ? { way: c.way } : {}), ...(c.dayTrip ? { dayTrip: true } : {}), ...(c.routeDraft ? { routeDraft: true } : {}) },
      ...(c.parents ? { placeParents: c.parents } : {}),
      ...(people && typeof people !== "string" ? { travellers: people.travellers } : {}),
      ...(intent ? { intent } : {}),
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(trip, withMusts(trip, intent));
    const items: Item[] = [];
    const plan = pb.plan.filter((x) => !askedThere(s, x));
    const base = shapedBase(s, c, [...pb.travel, ...plan]);
    const carved = carveSpecialStays(base.stays, plan);
    // The playbook's cards after what every trip has (none for a classic trip).
    for (const raw of [...carved.stays, ...base.travel, ...pb.travel, ...plan.filter((x) => !carved.used.includes(x)), ...pb.prep] as ShapedInput[]) {
      const input = guardKind(raw);
      if (checkPlanned(input, ALL_PLANNED_KINDS)) continue;
      const { item } = planToSave(input, items, trip.id, `start-preview-${items.length}`, now);
      items.push(placedFor(item, c, raw.part));
    }
    return { trip, items };
  });
}
