// The trip's shape (v11, docs/mockups/2026-10-08-japonya-web-v11.html "gezinin şekli"): under the hero, a strip of
// stops — where it starts, each city slept in (its nights), where it ends — with the way between them (plane, train,
// bus…). A stop wears its stage: dashed while something there is still to find, amber chosen, green booked. Pure.
import { cityOfAirport } from "./airports";
import { L } from "./i18n";
import { formatDateRange } from "./items";
import type { Leg } from "./legs";
import { sameCity, type Plan } from "./plan";
import type { Item } from "./types";

export type JourneyStage = "open" | "chosen" | "booked";
export type JourneyMode = "flight" | "train" | "bus" | "car" | "ferry" | "other";

export interface JourneyStop {
  key: string;
  city: string;
  /** "1 Nis" at the ends, "5 gece" for a stay. */
  sub: string;
  kind: "end" | "stay";
  stage: JourneyStage;
}

export interface JourneyHop {
  mode: JourneyMode;
}

const MODE_OF: Record<string, JourneyMode> = { flight: "flight", train: "train", bus: "bus", minibus: "bus", car: "car", taxi: "car", transfer: "car", moto: "car", rv: "car", ferry: "ferry" };

const live = (i: Item) => i.status !== "dismissed";
const flightsOf = (items: Item[]) =>
  items.filter((i) => live(i) && i.category === "flight" && i.flight?.departure).sort((a, b) => a.flight!.departure!.localeCompare(b.flight!.departure!));
const stageOfFlight = (f: Item): JourneyStage => (f.status === "booked" ? "booked" : f.status === "chosen" ? "chosen" : "open");

export function journeyOf(plan: Pick<Plan, "stayBlocks">, legs: Leg[], items: Item[]): { stops: JourneyStop[]; hops: JourneyHop[] } | null {
  // The cities slept in, in order: a city's blocks side by side are one stop.
  const stays: JourneyStop[] = [];
  const ranges: { start: string; end: string }[] = [];
  for (const b of plan.stayBlocks) {
    const city = b.city ?? (b.kind !== "open" ? b.item.city : null);
    if (!city) continue;
    const stage: JourneyStage = b.kind === "booked" ? "booked" : b.kind === "chosen" ? "chosen" : "open";
    const last = stays.at(-1);
    if (last && sameCity(last.city, city)) {
      const nights = Number(last.sub.match(/\d+/)?.[0] ?? 0) + b.nights;
      last.sub = L(`${nights} gece`, `${nights} night${nights === 1 ? "" : "s"}`);
      last.stage = last.stage === "open" || stage === "open" ? "open" : last.stage === "chosen" || stage === "chosen" ? "chosen" : "booked";
      ranges[ranges.length - 1].end = b.range.end;
      continue;
    }
    stays.push({ key: `stay:${b.range.start}`, city, sub: L(`${b.nights} gece`, `${b.nights} night${b.nights === 1 ? "" : "s"}`), kind: "stay", stage });
    ranges.push({ start: b.range.start, end: b.range.end });
  }
  if (!stays.length) return null;
  // The ends: the flight in (on or before the first night) and out (on or after the last morning), chosen or booked first.
  const flights = flightsOf(items);
  const first = ranges[0].start;
  const lastDay = ranges.at(-1)!.end;
  const pick = (list: Item[]) => list.find((f) => f.status === "booked") ?? list.find((f) => f.status === "chosen") ?? list[0];
  const inbound = pick(flights.filter((f) => f.flight!.departure!.slice(0, 10) <= first));
  const outbound = pick(flights.filter((f) => f.flight!.departure!.slice(0, 10) >= lastDay));
  const stops: JourneyStop[] = [];
  if (inbound?.flight?.from) stops.push({ key: "start", city: cityOfAirport(inbound.flight.from), sub: formatDateRange(inbound.flight.departure!.slice(0, 10), null), kind: "end", stage: stageOfFlight(inbound) });
  stops.push(...stays);
  if (outbound?.flight?.to) stops.push({ key: "end", city: cityOfAirport(outbound.flight.to), sub: formatDateRange(outbound.flight.departure!.slice(0, 10), null), kind: "end", stage: stageOfFlight(outbound) });
  // The way between two stops: a flight that day, else the transfer's way, else a line with no mark.
  const hops: JourneyHop[] = [];
  for (let n = 0; n < stops.length - 1; n++) {
    const a = stops[n];
    const b = stops[n + 1];
    if (a.kind === "end" || b.kind === "end") {
      hops.push({ mode: "flight" });
      continue;
    }
    const day = ranges[stays.indexOf(b)]?.start ?? null;
    const flown = flights.some((f) => f.flight!.departure!.slice(0, 10) === day);
    const leg = legs.find((l) => l.date === day && (l.kind === "move" || l.kind === "change"));
    const mode = flown ? "flight" : leg?.mode ? (MODE_OF[leg.mode] ?? "other") : leg?.options.some((o) => o.category === "flight") ? "flight" : "train";
    hops.push({ mode });
  }
  return { stops, hops };
}
