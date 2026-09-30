// Thousands of random trips through the whole pipeline (plan → transfers → timeline → decisions →
// cards → assistant state), checking what must hold for any trip: nothing crashes, every saved item
// shows exactly once somewhere on the board, keys are unique, nights add up, the order is the order of
// the trip, and no card says "NaN" or "undefined". Seeded, so a failure names a trip that reproduces.
import { describe, expect, it } from "vitest";
import { planState, tripState } from "../src/lib/assistant";
import { cardFacts, whyLines } from "../src/lib/cardFacts";
import { decideTrip, makeContext } from "../src/lib/decision";
import { EMPTY_METRICS, nightsBetween } from "../src/lib/items";
import { buildLegs, type Leg } from "../src/lib/legs";
import { buildPlan, liveGroups } from "../src/lib/plan";
import { plannedItem, type PlannedKind } from "../src/lib/planned";
import { budgetBar, decisionProgress } from "../src/lib/progress";
import { prosConsFor } from "../src/lib/proscons";
import { journeySteps } from "../src/lib/journey";
import { buildTimeline, nightsKey } from "../src/lib/timeline";
import { rolesOf, valueCard, budgetState } from "../src/lib/value";
import type { Item, ItemStatus, LegChoice, Trip } from "../src/lib/types";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const day = (base: string, n: number) => new Date(Date.parse(`${base}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const CITIES = [
  { name: "Porto", aliases: ["Porto", "Oporto"], geo: { lat: 41.15, lng: -8.61 }, iata: "OPO" },
  { name: "Lizbon", aliases: ["Lizbon", "Lisbon", "Lisboa"], geo: { lat: 38.72, lng: -9.14 }, iata: "LIS" },
  { name: "Funchal", aliases: ["Funchal", "Madeira"], geo: { lat: 32.65, lng: -16.91 }, iata: "FNC" },
  { name: "Madrid", aliases: ["Madrid"], geo: { lat: 40.42, lng: -3.7 }, iata: "MAD" },
];
const STATUSES: ItemStatus[] = ["saved", "saved", "saved", "chosen", "booked", "dismissed"];

function scenario(seed: number) {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const chance = (p: number) => r() < p;
  // Trips cross months and years sometimes.
  const start = pick(["2026-10-07", "2026-12-29", "2027-02-26", "2026-03-30"]);
  const length = 1 + Math.floor(r() * 12);
  const trip: Trip = {
    id: "t",
    title: "Gezi",
    confirmedDates: chance(0.6) ? { start, end: day(start, length) } : null,
    budget: chance(0.3) ? { amount: 500 + Math.floor(r() * 3000), currency: "EUR" } : null,
    heroImage: null,
    createdAt: 1,
    updatedAt: 1,
  };
  let seq = 0;
  const base = (over: Partial<Item>): Item => ({
    id: `i${seed}-${++seq}`,
    tripId: "t",
    captureIds: [],
    key: chance(0.7) ? `site:${seq}` : null,
    category: "stay",
    needKey: "stay:x",
    name: `Item ${seq}`,
    provider: pick([null, "Booking.com", "Airbnb", "Pegasus", "CP"]),
    summary: "",
    optionDetail: chance(0.3) ? "Deluxe" : null,
    url: chance(0.5) ? `https://www.example.com/p/${seq}` : null,
    imageUrl: null,
    city: null,
    country: null,
    countryCode: "PT",
    location: { address: null, area: chance(0.4) ? "Baixa" : null, approximate: false },
    dates: { start: null, end: null, source: "page" },
    guests: { adults: pick([null, 1, 2, 3]), children: null, rooms: 1 },
    price: {
      amount: chance(0.85) ? Math.round(20 + r() * 900) : null,
      currency: pick(["EUR", "EUR", "EUR", "USD", "TRY", null]),
      scope: pick(["total", "total", "per_night", "per_person", "unknown"] as const),
      taxesIncluded: "yes",
      source: "page",
      observedAt: 1,
    },
    priceHistory: [],
    cancellation: { summary: chance(0.5) ? "Ücretsiz iptal" : null, freeUntil: null, source: "page" },
    rating: chance(0.6) ? { value: Math.round(r() * 100) / 10, scale: pick([5, 10]), count: Math.floor(r() * 2000), source: "page" } : { value: null, scale: null, count: null, source: "none" },
    flight: null,
    metrics: { ...EMPTY_METRICS, durationMinutes: chance(0.5) ? Math.floor(30 + r() * 600) : null },
    geo: null,
    highlights: chance(0.3) ? ["Merkezi"] : [],
    concerns: chance(0.3) ? ["Küçük oda"] : [],
    reviewSummary: null,
    missing: [],
    status: pick(STATUSES),
    statusNote: null,
    createdAt: seq,
    updatedAt: seq,
    ...over,
  });
  const items: Item[] = [];
  // A route through 1-3 cities, sometimes back to one already visited (Porto → Lizbon → Porto).
  const route = Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(CITIES));
  let cursor = chance(0.2) ? day(start, -1) : start;
  for (const city of route) {
    const nights = 1 + Math.floor(r() * 5);
    const options = 1 + Math.floor(r() * 4);
    for (let o = 0; o < options; o++) {
      const shift = chance(0.3) ? Math.floor(r() * 3) - 1 : 0;
      const undated = chance(0.12);
      const s = day(cursor, shift);
      const e = day(cursor, nights + (chance(0.2) ? Math.floor(r() * 3) - 1 : 0));
      items.push(
        base({
          category: "stay",
          needKey: `stay:${city.name.toLowerCase()}`,
          name: `${city.name} stay ${o}`,
          city: pick(city.aliases),
          geo: chance(0.5) ? { lat: city.geo.lat + (r() - 0.5) * 0.05, lng: city.geo.lng + (r() - 0.5) * 0.05, source: "page" } : null,
          dates: undated ? { start: null, end: null, source: "none" } : { start: s, end: chance(0.03) ? s : e, source: "url" },
          metrics: { ...EMPTY_METRICS, stayKind: pick([undefined, "hotel_room", "apartment"] as const), bedrooms: chance(0.3) ? 1 + Math.floor(r() * 3) : null },
        }),
      );
    }
    cursor = day(cursor, nights);
  }
  // Flights in and out (sometimes the same need key both ways), between cities, and a day trip.
  const home = "IST";
  const flight = (from: string, to: string, d: string, over: Partial<Item> = {}) =>
    base({
      category: "flight",
      needKey: over.needKey ?? `flight:${from}-${to}`.toLowerCase(),
      name: `Flight ${from}-${to} ${d}`,
      city: to,
      dates: { start: d, end: null, source: "page" },
      flight: {
        from,
        to,
        departure: chance(0.8) ? `${d}T${String(Math.floor(r() * 24)).padStart(2, "0")}:${pick(["00", "30", "45"])}` : null,
        arrival: chance(0.7) ? `${chance(0.2) ? day(d, 1) : d}T${String(Math.floor(r() * 24)).padStart(2, "0")}:10` : null,
        carrier: null,
        flightNumber: null,
        stops: pick([null, 0, 1]),
      },
      ...over,
    });
  if (chance(0.8)) for (let n = 0; n < 1 + Math.floor(r() * 3); n++) items.push(flight(home, route[0].iata, day(start, Math.floor(r() * 3) - 1)));
  if (chance(0.7)) {
    const sameKey = chance(0.4);
    for (let n = 0; n < 1 + Math.floor(r() * 2); n++) {
      items.push(flight(route.at(-1)!.iata, home, day(cursor, Math.floor(r() * 3) - 1), sameKey ? { needKey: `flight:${home}-${route[0].iata}`.toLowerCase() } : {}));
    }
  }
  if (route.length > 1 && chance(0.6)) items.push(flight(route[0].iata, route[1].iata, day(start, 2 + Math.floor(r() * 3))));
  if (chance(0.2)) items.push(flight(null as unknown as string, null as unknown as string, day(start, 3)));
  // Transport: a train, an airport transfer, a car rental, an undated one.
  if (chance(0.5)) items.push(base({ category: "transport", needKey: "transport:x", name: "CP Alfa Pendular train", city: route[0].name, dates: { start: day(start, 3), end: null, source: "page" }, flight: { from: "Porto Campanhã", to: "Lisboa", departure: `${day(start, 3)}T13:00`, arrival: null, carrier: null, flightNumber: null, stops: 0 } }));
  if (chance(0.5)) items.push(base({ category: "transport", needKey: "transport:x", name: "Airport transfer", city: pick([route[0].name, null]), dates: { start: start, end: null, source: "page" } }));
  if (chance(0.4)) items.push(base({ category: "transport", needKey: "transport:car", name: "Araç kiralama Sixt", city: route.at(-1)!.name, dates: chance(0.8) ? { start: day(start, 2), end: day(start, 5), source: "page" } : { start: null, end: null, source: "none" } }));
  // Places, eSIMs.
  for (let n = 0; n < Math.floor(r() * 5); n++) {
    items.push(base({ category: pick(["activity", "food", "other"] as const), needKey: "activity:x", name: `Place ${n}`, city: pick(route).name, dates: chance(0.5) ? { start: day(start, Math.floor(r() * (length + 4)) - 2), end: null, source: "page" } : { start: null, end: null, source: "none" } }));
  }
  if (chance(0.4)) for (let n = 0; n < 2; n++) items.push(base({ category: "esim", needKey: "esim:pt", name: `eSIM ${n}`, metrics: { ...EMPTY_METRICS, dataGb: 5 + n * 5, validityDays: 7 } }));
  // Plans said in the chat.
  const said = (kind: PlannedKind, over: Partial<Parameters<typeof plannedItem>[0]>) =>
    plannedItem({ kind, date: start, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: chance(0.3), note: null, ...over }, "t", `chat-${seed}-${++seq}`, 1);
  if (chance(0.3)) items.push(said("flight", { date: start, from: "İstanbul", to: route[0].name }));
  if (chance(0.3) && route.length > 1) items.push(said("flight", { date: day(start, 3), from: route[0].name, to: route[1].name }));
  if (chance(0.2)) items.push(said("car_rental", { date: day(start, 1), end_date: day(start, 4), city: route.at(-1)!.name }));
  if (chance(0.2)) items.push(said("stay", { date: start, end_date: day(start, 2), city: route[0].name }));
  if (chance(0.2)) items.push(said("activity", { date: day(start, 1), city: route[0].name, title: "Fado" }));
  // A second stay said for nights inside or across the first, a ticket for a day with nowhere yet, a taxi, an eSIM.
  if (chance(0.15)) items.push(said("stay", { date: day(start, 1), end_date: day(start, pick([2, 3, 4])), city: pick([route[0].name, route.at(-1)!.name]) }));
  if (chance(0.15)) items.push(said("flight", { date: day(start, pick([0, 3, length])) }));
  if (chance(0.2)) items.push(said("taxi", { date: pick([start, day(start, 3), day(start, length)]), from: "Otel", to: "Havalimanı", city: pick([route[0].name, null]) }));
  if (chance(0.15)) items.push(said("esim", { date: null, city: pick([null, route[0].name]) }));
  // What the traveller said about transfers.
  if (chance(0.3)) {
    const legs: Record<string, LegChoice> = {};
    legs[`${start}:arrival:${route[0].name.toLowerCase()}`] = { mode: pick(["metro", "taxi", null] as const), booked: chance(0.3), note: null, updatedAt: 1 };
    trip.legs = legs;
  }
  return { trip, items };
}

/** Every place an item can show on the board, and how many times it does. */
function shown(items: Item[], plan: ReturnType<typeof buildPlan>, timeline: ReturnType<typeof buildTimeline>, hiddenLegs: Leg[] = []) {
  const seen = new Map<string, string[]>();
  const add = (i: Item, where: string) => seen.set(i.id, [...(seen.get(i.id) ?? []), where]);
  // A hidden transfer's options wait with it under "Gizlenenler".
  hiddenLegs.forEach((l) => l.options.forEach((i) => add(i, "hidden")));
  if (timeline.entries.length) {
    for (const e of timeline.entries) {
      if (e.kind === "stay") {
        if (e.block.kind === "booked") [e.block.item, ...(e.block.clashes ?? [])].forEach((i) => add(i, "stay-booked"));
        else for (const g of e.block.groups) g.items.forEach((i) => add(i, `stay:${g.key}`));
        // A stay said for nights a booking cuts through marks the nights on both sides of it.
        if (e.block.kind !== "booked" && e.block.slot && !seen.get(e.block.slot.id)?.includes("stay-slot")) add(e.block.slot, "stay-slot");
      } else if (e.kind === "travel") e.travel?.items.forEach((i) => add(i, `travel:${e.role}`));
      else if (e.kind === "plan") e.items.forEach((i) => add(i, "plan"));
      else if (e.kind === "rental") e.group.items.forEach((i) => add(i, "rental"));
      else if (e.kind === "day") {
        e.items.forEach((i) => add(i, "day"));
        e.legs.forEach((l) => l.options.forEach((i) => add(i, "leg")));
      }
      else if (e.kind === "leg") e.leg.options.forEach((i) => add(i, "leg"));
    }
  }
  plan.looseStays.forEach((g) => g.items.forEach((i) => add(i, "loose")));
  timeline.unplaced.forEach((g) => g.items.forEach((i) => add(i, "unplaced")));
  timeline.undated.forEach((i) => add(i, "undated"));
  plan.groups.filter((g) => g.category === "esim").forEach((g) => g.items.forEach((i) => add(i, "esim")));
  plan.closed.forEach(({ item }) => add(item, "closed"));
  return seen;
}

const RUNS = Number(process.env.SCENARIOS ?? 3000);
const bad = /NaN|undefined|null|\[object/;

describe("any trip", () => {
  it(`holds up for ${RUNS} random trips`, () => {
    const problems: string[] = [];
    const note = (seed: number, what: string) => problems.length < 60 && problems.push(`seed ${seed}: ${what}`);
    for (let seed = 1; seed <= RUNS; seed++) {
      const { trip, items } = scenario(seed);
      try {
        const plan = buildPlan(trip, items);
        // Half the trips also carry what the traveller said about each transfer (any mode, arranged or not).
        if (seed % 2) {
          const r = rng(seed * 7919);
          const modes = [null, "flight", "train", "bus", "ferry", "metro", "taxi", "transfer", "car", "walk"] as const;
          trip.legs = Object.fromEntries(
            buildLegs(plan, trip)
              .filter(() => r() < 0.6)
              .map((l) => [l.key, { mode: modes[Math.floor(r() * modes.length)], booked: r() < 0.3, note: r() < 0.2 ? "not" : null, updatedAt: 1 }]),
          );
        }
        const legs = buildLegs(plan, trip);
        // Some transfers and empty nights said not needed ("Gerek yok").
        const hr = rng(seed * 104729);
        const hidden = new Set([
          ...legs.filter(() => hr() < 0.2).map((l) => `leg:${l.key}`),
          ...plan.stayBlocks.filter((b) => b.kind === "open" && hr() < 0.3).map((b) => nightsKey(b.range)),
        ]);
        const timeline = buildTimeline(plan, legs, items, hidden);
        const hiddenLegs = legs.filter((l) => l.kind !== "move" && hidden.has(`leg:${l.key}`));
        const onLine = new Set(timeline.entries.flatMap((e) => (e.kind === "leg" ? [e.leg.key] : e.kind === "day" ? e.legs.map((l) => l.key) : e.kind === "travel" && e.leg ? [e.leg.key] : [])));
        for (const l of hiddenLegs) if (onLine.has(l.key)) note(seed, `hidden transfer ${l.key} still on the line`);
        for (const l of legs.filter((l) => l.kind === "move")) if (!onLine.has(l.key)) note(seed, `move ${l.key} missing from the line`);

        // Nights add up and the stretches cover the trip without gaps.
        const n = plan.nights;
        if (n.booked + n.chosen + n.open !== n.total) note(seed, `nights ${JSON.stringify(n)}`);
        for (let b = 1; b < plan.stayBlocks.length; b++) {
          if (plan.stayBlocks[b].range.start !== plan.stayBlocks[b - 1].range.end) note(seed, "stay blocks not contiguous");
        }

        // Every saved item shows once (a chosen stay's group card is its one place); dismissed ones don't.
        const seen = shown(items, plan, timeline, hiddenLegs);
        for (const i of items) {
          const where = seen.get(i.id) ?? [];
          if (i.status === "dismissed") {
            if (where.some((w) => w !== "closed")) note(seed, `dismissed ${i.name} shown at ${where}`);
            continue;
          }
          if (!where.length) note(seed, `${i.category} "${i.name}" (${i.status}, ${i.dates.start}→${i.dates.end}) is nowhere`);
          else if (new Set(where).size !== where.length || where.length > 1) note(seed, `${i.category} "${i.name}" shows ${where.length}×: ${where}`);
        }

        // Keys are unique (they are React keys and storage keys).
        const dup = (keys: string[], what: string) => {
          const d = keys.filter((k, x) => keys.indexOf(k) !== x);
          if (d.length) note(seed, `duplicate ${what}: ${d[0]}`);
        };
        dup(legs.map((l) => l.key), "leg key");
        dup(timeline.entries.map((e) => e.key), "entry key");
        dup(timeline.sections.map((s) => s.key), "section key");
        dup(liveGroups(plan).map((g) => g.key), "group key");
        dup(liveGroups(plan).flatMap((g) => g.items.map((i) => i.id)), "item in two groups");

        // The order of the board is the order of the trip.
        for (let x = 1; x < timeline.entries.length; x++) {
          const [a, b] = [timeline.entries[x - 1], timeline.entries[x]];
          // The transfer to the first stay comes before it even when the flight lands after the first night.
          const arrivalLeg = a.kind === "leg" && a.leg.kind === "arrival"; // an overnight trip lands after the first night
          if (b.date < a.date && !(a.kind === "travel" && a.role === "arrival") && !arrivalLeg) note(seed, `order: ${a.kind}${a.kind === "leg" ? `(${a.leg.kind})` : ""} ${a.date} before ${b.kind}${b.kind === "travel" ? `(${b.role})` : ""} ${b.date}`);
        }
        for (const l of legs) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date) || !l.statusText || bad.test(l.statusText + l.from.label + l.to.label + l.notes.join(" "))) {
            note(seed, `leg ${l.key}: ${l.statusText} ${l.from.label} → ${l.to.label} ${l.notes.join(" ")}`);
          }
        }

        // Decisions exist for every open need, with sane scores.
        const ctx = makeContext(trip, items, { rates: { base: "EUR", rates: { USD: 1.1, TRY: 40 }, fetchedAt: 1 } as never, today: "2026-09-29" });
        const decisions = decideTrip(items, ctx);
        for (const g of liveGroups(plan)) {
          const d = decisions.get(g.key);
          if (!d) {
            note(seed, `no decision for ${g.key}`);
            continue;
          }
          for (const o of d.options) if (o.score != null && (o.score < 0 || o.score > 100 || Number.isNaN(o.score))) note(seed, `score ${o.score}`);
          rolesOf(d);
          valueCard(d, ctx, budgetState(plan, items, ctx));
          for (const i of g.items) {
            const f = cardFacts(i, d, ctx);
            const text = [f.title, f.subtitle, f.price?.text, f.price?.label, f.price?.perNight, f.status?.text, ...f.pros.map((p) => p.text), ...f.cons.map((c) => c.text)].filter((x) => x != null).join(" | ");
            if (/NaN|undefined|\[object|Infinity/.test(text)) note(seed, `card ${i.name}: ${text}`);
            whyLines(i, d, ctx.currency);
            prosConsFor(i, d, ctx.listings, ctx);
          }
        }
        // Cards for everything else on the board.
        for (const i of items) {
          const f = cardFacts(i, undefined, ctx);
          if (/NaN|undefined|Infinity/.test(JSON.stringify(f))) note(seed, `card (no decision) ${i.name}: ${JSON.stringify(f.price)}`);
        }

        // Where the decisions stand and what it costs: counts add up, no NaN, each open one has a place to go.
        const progress = decisionProgress(timeline, items, plan, decisions, "2026-09-29");
        // Every entry is in exactly one block, day on the move or place on the line.
        const placedEntries = timeline.sections.flatMap((x) => (x.kind === "travel" ? [x.entry.key] : x.kind === "journey" ? x.entries.map((e) => e.key) : [...x.stays, ...x.entries].map((e) => e.key)));
        if (placedEntries.length !== timeline.entries.length || new Set(placedEntries).size !== placedEntries.length) note(seed, "sections don't hold every entry once");
        for (const x of timeline.sections) {
          if (x.kind !== "journey") continue;
          const steps = journeySteps(x, undefined);
          if (/NaN|undefined|Infinity/.test(JSON.stringify(steps.map(({ entry, ...rest }) => rest)))) note(seed, `journey steps ${x.key}`);
          if (x.entries.filter((e) => e.kind === "day").length > 1) note(seed, `journey ${x.key} took two days`);
          if (x.journey.dayNo != null && !x.entries.some((e) => e.kind === "day")) note(seed, `journey ${x.key} numbered without its day`);
        }
        // The plan's front has no days: each decided thing of a day is a block of its own, once.
        if (timeline.board.some((x) => x.kind === "journey")) note(seed, "a day on the move on the plan's front");
        const events = timeline.board.flatMap((x) => (x.kind === "city" ? x.entries.filter((e) => e.kind === "event") : []));
        const decidedOnDays = timeline.entries.flatMap((e) => (e.kind === "day" ? e.items.filter((i) => i.status === "chosen" || i.status === "booked") : []));
        if (events.length !== decidedOnDays.length) note(seed, `events ${events.length} ≠ ${decidedOnDays.length}`);
        const kinds = Object.values(progress.count).reduce((a, b) => a + b, 0);
        if (kinds !== progress.todos.length) note(seed, `todo counts ${kinds} ≠ ${progress.todos.length}`);
        if (new Set(progress.todos.map((t) => t.key)).size !== progress.todos.length) note(seed, "todo keys repeat");
        const legKeys = new Set(timeline.entries.flatMap((e) => (e.kind === "leg" ? [e.leg.key] : e.kind === "day" ? e.legs.map((l) => l.key) : [])));
        for (const t of progress.todos) {
          const { item, leg, entry } = t.target;
          const found = (item && items.some((i) => i.id === item)) || (leg && legKeys.has(leg)) || (entry && timeline.entries.some((e) => e.key === entry));
          if (!found || (entry && !timeline.entries.some((e) => e.key === entry))) note(seed, `todo ${t.key} points nowhere`);
        }
        if (/NaN|undefined|Infinity/.test(JSON.stringify(progress))) note(seed, "progress has NaN");
        const money = budgetBar(plan, items, ctx, decisions);
        if ([money.booked, money.chosen, money.open].some((n) => !Number.isFinite(n) || n < 0)) note(seed, `budget ${JSON.stringify(money)}`);

        // What the assistant sees serializes cleanly.
        const state = tripState(trip, items, [], [], null, undefined, { ctx, decisions });
        if (/NaN|Infinity/.test(state)) note(seed, "trip state has NaN");
        planState(plan, trip);
      } catch (error) {
        note(seed, `crash: ${(error as Error).stack?.split("\n").slice(0, 3).join(" / ")}`);
      }
    }
    expect(problems).toEqual([]);
  }, 600_000);
});

it("counts nights across a year end", () => expect(nightsBetween("2026-12-30", "2027-01-02")).toBe(3));
