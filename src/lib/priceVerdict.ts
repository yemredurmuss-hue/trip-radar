// A flight's fare judged on its card (spec 2026-10-19 SerpApi, items 2 and 4): the `offers` function's `kind=price` gives
// Google Flights' usual range for one person on the route and day, and the last weeks' lowest a day (else the fares the
// function recorded itself). The card's own fare, one person's in euros, is set against that range: "Fiyat düşük",
// "Fiyat normal", "Fiyat yüksek". Nothing is guessed: another currency, no range or no fare, and the pill isn't drawn
// (with a history only, it opens the history). Pure: the card asks through offerSources.
import { L } from "./i18n";
import { num } from "./i18nText";
import { shortDay } from "./ideas";
import type { Item } from "./types";

export interface PriceInsight {
  low: number | null;
  high: number | null;
  lowest: number | null;
  level: "low" | "typical" | "high" | null;
  /** [ms, euros] a day, oldest first. */
  history: [number, number][];
  source: "google" | "log";
  currency: "EUR";
}

export interface PriceAsk {
  from: string;
  to: string;
  day: string;
}

const pos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** What the function answered, kept only when well-formed. */
export function validInsight(v: unknown): PriceInsight | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const low = pos(r.low) ? r.low : null;
  const high = pos(r.high) ? r.high : null;
  const history = (Array.isArray(r.history) ? r.history : []).filter((p): p is [number, number] => Array.isArray(p) && pos(p[0]) && pos(p[1])).slice(-120);
  const ranged = low != null && high != null && low <= high;
  if (!ranged && history.length < 5) return null;
  const level = r.level === "low" || r.level === "typical" || r.level === "high" ? r.level : null;
  return { low: ranged ? low : null, high: ranged ? high : null, lowest: pos(r.lowest) ? r.lowest : null, level, history, source: r.source === "log" ? "log" : "google", currency: "EUR" };
}

const IATA = /^[A-Z]{3}$/;

/** A flight worth judging: by air, its two airports and its day known, not bought, not gone. */
export function priceAsk(item: Pick<Item, "category" | "flight" | "status">, today: string): PriceAsk | null {
  if (item.category !== "flight" || item.status === "booked" || item.status === "dismissed") return null;
  const f = item.flight;
  const from = f?.from?.toUpperCase() ?? "", to = f?.to?.toUpperCase() ?? "";
  const day = f?.departure?.slice(0, 10) ?? "";
  if (!IATA.test(from) || !IATA.test(to) || from === to || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today) return null;
  return { from, to, day };
}

/** One person's fare in euros as the card has it; null in another currency or when it isn't known. */
export function fareEach(item: Pick<Item, "price" | "guests">): number | null {
  const p = item.price;
  if (p.amount == null || p.amount <= 0 || (p.currency ?? "").toUpperCase() !== "EUR") return null;
  if (p.scope === "per_person") return p.amount;
  if (p.scope === "total") return p.amount / Math.max(1, item.guests.adults ?? 1);
  return null;
}

const eur = (n: number) => `€${num(Math.round(n))}`;

export type VerdictTone = "low" | "typical" | "high" | "history";
export interface Verdict {
  tone: VerdictTone;
  /** The pill: "↓ Fiyat düşük · normali €110–200". */
  pill: string;
  /** Under the history: "Bu fiyat iyi: rota için normal €110–200, kartta €74." */
  sentence: string | null;
}

/** The card's fare set against Google's usual range; with no range, a history to open; null when neither. */
export function verdictOf(each: number | null, i: PriceInsight): Verdict | null {
  if (i.low != null && i.high != null && each != null) {
    const range = `${eur(i.low)}–${num(Math.round(i.high))}`;
    if (each < i.low) return { tone: "low", pill: L(`↓ Fiyat düşük · normali ${range}`, `↓ Low fare · usually ${range}`), sentence: L(`Bu fiyat iyi: bu rota için normal ${range}, kartta ${eur(each)}.`, `A good fare: ${range} is usual on this route, this one is ${eur(each)}.`) };
    if (each > i.high) return { tone: "high", pill: L(`↑ Fiyat yüksek · normali ${range}`, `↑ High fare · usually ${range}`), sentence: L(`Bu fiyat bu rota için yüksek: normal ${range}, kartta ${eur(each)}.`, `High for this route: ${range} is usual, this one is ${eur(each)}.`) };
    return { tone: "typical", pill: L(`Fiyat normal · ${range}`, `Usual fare · ${range}`), sentence: L(`Bu fiyat bu rota için normal aralıkta (${range}).`, `A usual fare for this route (${range}).`) };
  }
  if (i.history.length >= 5) return { tone: "history", pill: L("Fiyat geçmişi", "Fare history"), sentence: null };
  return null;
}

/** "3 hafta önce €118 → bugün €74" (the history's first and last), or null under two points. */
export function historySentence(i: PriceInsight, now: number): string | null {
  if (i.history.length < 2) return null;
  const [t0, p0] = i.history[0];
  const [, p1] = i.history[i.history.length - 1];
  const days = Math.max(1, Math.round((now - t0) / 864e5));
  const ago = days >= 14 ? L(`${Math.round(days / 7)} hafta önce`, `${Math.round(days / 7)} weeks ago`) : L(`${days} gün önce`, `${days} days ago`);
  return L(`${ago} ${eur(p0)} → şimdi ${eur(p1)}`, `${ago} ${eur(p0)} → now ${eur(p1)}`);
}

/**
 * The history drawn in a w×h box: the line's points, Google's usual range as a band, the last point, and the card's own
 * fare as a level (`mark`, its y; the history is Google's lowest, which the card's fare from another source can beat).
 */
export function historyDrawing(i: PriceInsight, w: number, h: number, mark: number | null = null): { points: string; band: { y: number; h: number } | null; last: { x: number; y: number }; mark: number | null; labelLow: number; labelHigh: number } | null {
  if (i.history.length < 2) return null;
  const prices = i.history.map(([, p]) => p);
  const lo = Math.min(...prices, i.low ?? Infinity, mark ?? Infinity), hi = Math.max(...prices, i.high ?? -Infinity, mark ?? -Infinity);
  const pad = Math.max(1, (hi - lo) * 0.12);
  const min = lo - pad, max = hi + pad;
  const t0 = i.history[0][0], t1 = i.history[i.history.length - 1][0];
  const x = (t: number) => (t1 === t0 ? w : ((t - t0) / (t1 - t0)) * w);
  const y = (p: number) => h - ((p - min) / (max - min)) * h;
  const pts = i.history.map(([t, p]) => `${x(t).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const band = i.low != null && i.high != null ? { y: y(i.high), h: y(i.low) - y(i.high) } : null;
  const [lt, lp] = i.history[i.history.length - 1];
  return { points: pts, band, last: { x: x(lt), y: y(lp) }, mark: mark != null && mark > 0 ? y(mark) : null, labelLow: Math.round(min + pad), labelHigh: Math.round(max - pad) };
}

// --- the day either side (spec 2026-10-19 SerpApi, item 5): the shared flight search's cheapest a day, ±3 days ------

export interface DayFare {
  day: string;
  /** One person's cheapest that day, euros. */
  price: number;
}

/** What the server sent: days in order, each once, a price over zero. */
export function validDays(v: unknown): DayFare[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: DayFare[] = [];
  for (const r of v as Record<string, unknown>[]) {
    if (typeof r?.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !pos(r.price) || seen.has(r.day)) continue;
    seen.add(r.day);
    out.push({ day: r.day, price: Math.round(r.price) });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 7);
}

export interface DayBar {
  day: string;
  label: string;
  price: number;
  /** Its height, 0.15–1 of the tallest. */
  share: number;
  chosen: boolean;
  cheapest: boolean;
}

/** The days as bars: the card's day marked, the cheapest marked; none under three days. */
export function dayBars(days: readonly DayFare[], chosen: string): DayBar[] {
  if (days.length < 3) return [];
  const max = Math.max(...days.map((d) => d.price));
  const min = Math.min(...days.map((d) => d.price));
  return days.map((d) => ({ day: d.day, label: shortDay(d.day), price: d.price, share: Math.max(0.15, d.price / max), chosen: d.day === chosen, cheapest: d.price === min }));
}

/** "Seçtiğin gün en ucuz", "9 Eki €19 daha ucuz", or the cheapest day when the card's isn't among them. */
export function daysSentence(days: readonly DayFare[], chosen: string): string | null {
  if (days.length < 3) return null;
  const min = Math.min(...days.map((d) => d.price));
  const best = days.find((d) => d.price === min)!;
  const mine = days.find((d) => d.day === chosen);
  if (mine && mine.price === min) return L("Seçtiğin gün bu haftanın en ucuzu", "Your day is the week's cheapest");
  if (mine) return L(`${shortDay(best.day)} ${eur(mine.price - min)} daha ucuz`, `${shortDay(best.day)} is ${eur(mine.price - min)} cheaper`);
  return L(`En ucuz gün ${shortDay(best.day)}, ${eur(min)}`, `The cheapest day is ${shortDay(best.day)}, ${eur(min)}`);
}
