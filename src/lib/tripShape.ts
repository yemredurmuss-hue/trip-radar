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
  /** What's chosen or booked there ("Jardim Stay", "TAP · Lizbon → İstanbul"); null while it's still to find. */
  name: string | null;
  /** A stay's days: the first night and the morning it ends (the city's tip says them). */
  range?: { start: string; end: string };
}

export interface JourneyHop {
  mode: JourneyMode;
  /** How long the way takes, when a flight's hours or the chosen way say ("11 sa", "1,5 sa" under the line). */
  minutes: number | null;
}

/** A flight's or a way's minutes: what was read, else its hours (gate to gate). */
const minutesOf = (i: Item | null | undefined): number | null => {
  // Only for a way chosen or booked: an option's hours aren't the trip's.
  if (!i || (i.status !== "chosen" && i.status !== "booked")) return null;
  const read = i.metrics?.durationMinutes;
  if (read) return read;
  const [d, a] = [i.flight?.departure, i.flight?.arrival];
  if (!d || !a) return null;
  const m = Math.round((Date.parse(a) - Date.parse(d)) / 60000);
  return m > 0 && m < 48 * 60 ? m : null;
};

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
      if (!last.name && b.kind !== "open") last.name = b.item.name;
      const nights = Number(last.sub.match(/\d+/)?.[0] ?? 0) + b.nights;
      last.sub = L(`${nights} gece`, `${nights} night${nights === 1 ? "" : "s"}`);
      last.stage = last.stage === "open" || stage === "open" ? "open" : last.stage === "chosen" || stage === "chosen" ? "chosen" : "booked";
      ranges[ranges.length - 1].end = b.range.end;
      continue;
    }
    stays.push({ key: `stay:${b.range.start}`, city, sub: L(`${b.nights} gece`, `${b.nights} night${b.nights === 1 ? "" : "s"}`), kind: "stay", stage, name: b.kind !== "open" ? b.item.name : null });
    ranges.push({ start: b.range.start, end: b.range.end });
  }
  if (!stays.length) return null;
  stays.forEach((s, n) => (s.range = { ...ranges[n] }));
  // The ends: the flight in (on or before the first night) and out (on or after the last morning), chosen or booked first.
  const flights = flightsOf(items);
  const first = ranges[0].start;
  const lastDay = ranges.at(-1)!.end;
  const pick = (list: Item[]) => list.find((f) => f.status === "booked") ?? list.find((f) => f.status === "chosen") ?? list[0];
  const inbound = pick(flights.filter((f) => f.flight!.departure!.slice(0, 10) <= first));
  const outbound = pick(flights.filter((f) => f.flight!.departure!.slice(0, 10) >= lastDay));
  const stops: JourneyStop[] = [];
  if (inbound?.flight?.from) stops.push({ key: "start", city: cityOfAirport(inbound.flight.from), sub: formatDateRange(inbound.flight.departure!.slice(0, 10), null), kind: "end", stage: stageOfFlight(inbound), name: inbound.status === "saved" ? null : inbound.name });
  stops.push(...stays);
  if (outbound?.flight?.to) stops.push({ key: "end", city: cityOfAirport(outbound.flight.to), sub: formatDateRange(outbound.flight.departure!.slice(0, 10), null), kind: "end", stage: stageOfFlight(outbound), name: outbound.status === "saved" ? null : outbound.name });
  // The way between two stops: a flight that day, else the transfer's way, else a line with no mark.
  const hops: JourneyHop[] = [];
  for (let n = 0; n < stops.length - 1; n++) {
    const a = stops[n];
    const b = stops[n + 1];
    if (a.kind === "end" || b.kind === "end") {
      hops.push({ mode: "flight", minutes: minutesOf(a.kind === "end" ? inbound : outbound) });
      continue;
    }
    const day = ranges[stays.indexOf(b)]?.start ?? null;
    const flown = flights.some((f) => f.flight!.departure!.slice(0, 10) === day);
    const leg = legs.find((l) => l.date === day && (l.kind === "move" || l.kind === "change"));
    const mode = flown ? "flight" : leg?.mode ? (MODE_OF[leg.mode] ?? "other") : leg?.options.some((o) => o.category === "flight") ? "flight" : "train";
    const way = flown ? flights.find((f) => f.flight!.departure!.slice(0, 10) === day) : leg?.options.find((o) => o.status === "booked" || o.status === "chosen");
    hops.push({ mode, minutes: minutesOf(way) });
  }
  return { stops, hops };
}
