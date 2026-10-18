// What a card's ⓘ balloon says beyond its face (mockup v46 infoBtn): only facts the records already hold, nothing worked out
// or made up. A flight: number, ends, duration, stops, bag, the booking code (on its day only), the terminal and gate once its
// live data is in. A stay: area, rating, cancel terms, note, total. A way of travel: ends, duration, booking, note. All say who
// saved it. A change of city (a leg): the weekday of its day, the city's weather when the hero has it, and the options saved for
// it with their prices. A fact the record doesn't have is left out. Pure.
import { flightNumber } from "../../supabase/functions/flight/shape";
import type { CityWeather } from "./climate";
import { durationText } from "./cardFacts";
import { cancelLineOf, showBookingRef } from "./cardTime";
import type { LegEnds, TransportMode } from "./cardKinds";
import { transportFace, type End } from "./cardView";
import { L, locale } from "./i18n";
import { nStops } from "./i18nText";
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

/** What the ⓘ balloons need from outside the record: the day, who saved it, and what a stay's own card computes. */
export interface PeekCtx {
  today: string;
  /** "Kimden": who saved it (pano.saverName). */
  from: string;
  /** The cities at a trip's ends (cardKinds.legEndsByItem). */
  ends?: LegEnds;
  /** A stay's rating line ("9,0 Muhteşem · 770 yorum") and the whole sum, as its card has them. */
  rating?: string | null;
  total?: string | null;
  /** A stay's fit score (out of 100) as the comparison gives it; its face doesn't show it (mockup v46), the balloon does. */
  fit?: number | null;
}

const row = (label: string, value: string | null | undefined, copy?: string): PeekFact[] => (value ? [{ label, value, ...(copy ? { copy } : {}) }] : []);
const endText = (end: End | null, extra: string | null): string | null =>
  end ? [[end.city, end.time].filter(Boolean).join(" · ") + (end.plus ? ` (+${end.plus.days})` : ""), extra].filter(Boolean).join(" · ") : null;
const terminal = (t: string | null | undefined) => (t ? L(`Terminal ${t}`, `Terminal ${t}`) : null);

/** The booking code, on the day it matters (a flight's PNR waits for its day) and from an older note too. */
const refRows = (item: Item, today: string): PeekFact[] => {
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  return ref && showBookingRef(item, today) ? row(L("Rezervasyon kodu", "Booking code"), ref, ref) : [];
};

/** A flight: its number, both ends, the way it takes, the bag, the booking code (only on its day), what its live data names, and whose it is. */
export function flightPeek(item: Item, ctx: PeekCtx): PeekFact[] {
  const face = transportFace(item, "flight", ctx.ends);
  const live = item.flightLive;
  const number = live?.number ?? flightNumber(item.flight?.flightNumber);
  const stops = item.flight?.stops;
  const minutes = metricsOf(item).durationMinutes ?? live?.minutes ?? null;
  const bag = metricsOf(item).checkedBagIncluded;
  const out = live ? [terminal(live.departure.terminal), live.departure.gate ? L(`Kapı ${live.departure.gate}`, `Gate ${live.departure.gate}`) : null].filter(Boolean).join(" · ") : null;
  const inn = live ? [terminal(live.arrival.terminal), live.arrival.belt ? L(`Bagaj bandı ${live.arrival.belt}`, `Belt ${live.arrival.belt}`) : null].filter(Boolean).join(" · ") : null;
  return [
    ...row(L("Sefer", "Flight"), number ? [live?.airline ?? item.flight?.carrier, number].filter(Boolean).join(" ") : null),
    ...row(L("Kalkış", "Departure"), endText(face.from, out)),
    ...row(L("Varış", "Arrival"), endText(face.to, inn)),
    ...row(L("Süre", "Duration"), minutes ? durationText(minutes) : null),
    ...row(L("Aktarma", "Stops"), stops == null ? null : stops === 0 ? L("Yok", "None") : nStops(stops)),
    ...row(L("Bagaj", "Baggage"), bag == null ? null : bag ? L("Bavul dahil", "Checked bag included") : L("Bavul dahil değil", "No checked bag")),
    ...refRows(item, ctx.today),
    ...row(L("Check-in masası", "Check-in desks"), live?.departure.desk?.replace(/\s*-\s*/, "–")),
    ...row(L("Kimden", "From"), ctx.from),
  ];
}

/** A stay: where it is, what guests said, the cancel terms, the note, the whole sum, and whose it is. */
export function stayPeek(item: Item, ctx: PeekCtx): PeekFact[] {
  return [
    ...row(L("Semt", "Neighbourhood"), item.location.area),
    ...row(L("Puan", "Rating"), ctx.rating),
    ...row(L("Uyum puanı", "Fit score"), ctx.fit != null ? `${ctx.fit} / 100` : null),
    ...row(L("İptal", "Cancellation"), cancelLineOf(item, ctx.today)?.text ?? item.cancellation.summary),
    ...row(L("Not", "Note"), item.statusNote),
    ...row(L("Toplam", "Total"), ctx.total),
    ...refRows(item, ctx.today),
    ...row(L("Kimden", "From"), ctx.from),
  ];
}

/** A way of travel other than a flight (a train, a bus, a ferry, a taxi): both ends, how long, the booking, the note, whose it is. */
export function transferPeek(item: Item, kind: TransportMode | "transport", ctx: PeekCtx): PeekFact[] {
  const face = transportFace(item, kind, ctx.ends);
  const minutes = metricsOf(item).durationMinutes;
  return [
    ...row(L("Kalkış", "Departure"), endText(face.from, null)),
    ...row(L("Varış", "Arrival"), endText(face.to, null)),
    ...row(L("Süre", "Duration"), minutes ? durationText(minutes) : null),
    ...refRows(item, ctx.today).map((f) => ({ ...f, label: L("Rezervasyon", "Booking") })),
    ...row(L("Not", "Note"), item.statusNote),
    ...row(L("Kimden", "From"), ctx.from),
  ];
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
