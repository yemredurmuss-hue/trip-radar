// Where to look next (0.35.11): a search the Plan offers when something is plainly missing. A one-way flight
// with no way home gets "Dönüş bileti ara" (Google Flights, the trip's last city to where it started, on the
// trip's last day); Etkinlikler gets a GetYourGuide search per city. Plain links: nothing is bought or saved,
// no affiliate code. Pure.
import { cityOfAirport } from "./airports";
import { L } from "./i18n";
import { sameCity, type Plan } from "./plan";
import type { Item } from "./types";

const decided = (i: Item) => i.status === "chosen" || i.status === "booked";
const place = (code: string) => cityOfAirport(code);

/**
 * "Dönüş bileti ara": the first decided flight is the way out; when no decided flight goes back to where it
 * started, a search from the trip's last city (else where that flight landed) home, on the trip's last day.
 * Null when there's no flight yet or the way home is there.
 */
export function returnFlightSearch(items: Item[], plan: Pick<Plan, "range" | "stayBlocks">): { label: string; url: string } | null {
  const flights = items
    .filter((i) => i.category === "flight" && decided(i) && i.flight?.from && i.flight?.to)
    .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "").localeCompare(b.flight?.departure ?? b.dates.start ?? ""));
  const out = flights[0];
  if (!out) return null;
  const home = out.flight!.from!;
  const homeCity = place(home);
  if (flights.slice(1).some((f) => f.flight!.to === home || sameCity(place(f.flight!.to!), homeCity))) return null;
  const from = plan.stayBlocks.at(-1)?.city ?? place(out.flight!.to!);
  const date = plan.range?.end ?? null;
  const query = `Flights from ${from} to ${homeCity}${date ? ` on ${date}` : ""} one way`;
  return {
    label: L(`Dönüş bileti ara · ${from} → ${homeCity}`, `Find a flight home · ${from} → ${homeCity}`),
    url: `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`,
  };
}

/** "Porto etkinliklerini ara": a GetYourGuide search for each city of the trip, in the trip's order. */
export function activitySearches(plan: Pick<Plan, "stayBlocks">): { city: string; label: string; url: string }[] {
  const cities: string[] = [];
  for (const b of plan.stayBlocks) if (b.city && !cities.some((c) => sameCity(c, b.city!))) cities.push(b.city);
  return cities.map((city) => ({
    city,
    label: L(`${city} etkinliklerini ara`, `Find things to book in ${city}`),
    url: `https://www.getyourguide.com/s/?q=${encodeURIComponent(city)}`,
  }));
}

