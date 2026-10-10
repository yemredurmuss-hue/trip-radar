// What a card's peek box says beyond its face (docs/mockups/ux-katmanli-arayuz, "Transfer kartı" and "Uçuş kartı"): only
// facts the records already hold, nothing worked out or made up. A flight: the bag, the booking code, the terminal and gate
// once its live data is in. A transfer: the weekday of its day, the city's weather when the hero has it, and the options saved
// for it with their prices. A fact the record doesn't have is left out, and a card with none has no peek. Pure.
import type { CityWeather } from "./climate";
import { durationText } from "./cardFacts";
import { L, locale } from "./i18n";
import { formatPrice, isoDate, metricsOf } from "./items";
import type { Leg } from "./legs";
import { refFromNote } from "./bookingRows";
import type { Item } from "./types";

export interface PeekFact {
  label: string;
  value: string;
  /** What the copy button takes (the booking code). */
  copy?: string;
}

/** A flight's bag, booking code, and the terminals, gate, desks and belt its live data names. */
export function flightPeek(item: Item): PeekFact[] {
  const facts: PeekFact[] = [];
  const bag = metricsOf(item).checkedBagIncluded;
  if (bag != null) facts.push({ label: L("Bagaj", "Baggage"), value: bag ? L("Bavul dahil", "Checked bag included") : L("Bavul dahil değil", "No checked bag") });
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  if (ref) facts.push({ label: L("Rezervasyon kodu", "Booking code"), value: ref, copy: ref });
  const live = item.flightLive;
  if (live) {
    const out = [live.departure.terminal ? L(`Terminal ${live.departure.terminal}`, `Terminal ${live.departure.terminal}`) : null, live.departure.gate ? L(`Kapı ${live.departure.gate}`, `Gate ${live.departure.gate}`) : null].filter(Boolean).join(" · ");
    if (out) facts.push({ label: L("Kalkış", "Departure"), value: out });
    if (live.departure.desk) facts.push({ label: L("Check-in masası", "Check-in desks"), value: live.departure.desk.replace(/\s*-\s*/, "–") });
    const inn = [live.arrival.terminal ? L(`Terminal ${live.arrival.terminal}`, `Terminal ${live.arrival.terminal}`) : null, live.arrival.belt ? L(`Bagaj bandı ${live.arrival.belt}`, `Belt ${live.arrival.belt}`) : null].filter(Boolean).join(" · ");
    if (inn) facts.push({ label: L("Varış", "Arrival"), value: inn });
  }
  return facts;
}

export interface LegPeek {
  /** "Çarşamba · 14 Ekim" */
  day: string | null;
  /** "Lizbon · gündüz 19°, gece 12° · yağışlı gün 1/3" */
  weather: string | null;
  /** The saved options that have a price: its name, the price and how long it takes. */
  options: { name: string; price: string; duration: string | null }[];
}

export const LEG_PEEK_OPTIONS = 4;

/** A transfer's weekday, the destination city's weather when known, and its saved priced options. */
export function legPeek(leg: Leg, weather: CityWeather | null): LegPeek {
  const date = isoDate(leg.date);
  const day = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : null;
  const w = weather
    ? `${weather.city} · ${L(`gündüz ${weather.high}°, gece ${weather.low}°`, `day ${weather.high}°, night ${weather.low}°`)} · ${L(`yağışlı gün ${weather.rainy}/${weather.days}`, `rainy days ${weather.rainy}/${weather.days}`)}`
    : null;
  const options = leg.options
    .filter((o) => o.status !== "dismissed" && o.price.amount != null && o.price.amount > 0)
    .slice(0, LEG_PEEK_OPTIONS)
    .map((o) => {
      const minutes = metricsOf(o).durationMinutes;
      return { name: o.name, price: formatPrice(o.price.amount, o.price.currency), duration: minutes ? durationText(minutes) : null };
    });
  return { day, weather: w, options };
}

/** Whether a transfer's peek has anything to say. */
export const legPeekHasFacts = (p: LegPeek): boolean => Boolean(p.day || p.weather || p.options.length);
