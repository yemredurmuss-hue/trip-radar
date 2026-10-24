// What one option's card says in the drawer (onay paketi 2026-10-21, docs/mockups/paket-ucus-konaklama 4, 9, 16): its score
// as three parts (Yorum · Özellik · Fiyat, from the decision's own weighted parts, never made up), the sort's weights in the
// head, five labelled slots always in the same order so the cards compare at a glance (a stay: Kahvaltı, İptal, Merkez,
// Puan, Kaynak; a flight: Bagaj, El bagajı, İade, Varış, Kaynak; a rental: Sigorta, İptal, Teslim, Puan, Kaynak), what its
// reviews praise and fault, "Neden 91?" from the parts, and a flight's day band (istenen gün, a day later). A fact the
// record doesn't hold reads "bilinmiyor" in grey (C19). Pure: app/plan/v82/IntentDrawer.tsx draws it.
import { DEFAULT_LEVELS, levelFor, type Part } from "./decision";
import { L } from "./i18n";
import { shortDay } from "./ideas";
import { formatPrice, isoDate } from "./items";
import { dative } from "./prepDays";
import { weekdayLong } from "./railDates";
import { AMENITY_EN, type Category, type CriterionId, type Item, type PriorityLevel, type Trip } from "./types";

export type ScoreGroup = "reviews" | "features" | "price";

/** Each criterion's part of the three: what guests say, what it has, what it costs. */
const GROUP_OF: Readonly<Record<CriterionId, ScoreGroup>> = {
  price: "price",
  rating: "reviews",
  details: "reviews",
  ai: "reviews",
  comfort: "reviews",
  clean: "reviews",
  quiet: "reviews",
  bed: "reviews",
  location: "features",
  cancellation: "features",
  amenities: "features",
  duration: "features",
  stops: "features",
  schedule: "features",
  baggage: "features",
  data: "features",
  validity: "features",
  view: "features",
  space: "features",
  breakfast: "features",
  access: "features",
  safety: "features",
};
const GROUPS: readonly ScoreGroup[] = ["reviews", "features", "price"];
export const groupLabel = (g: ScoreGroup, long = false): string =>
  g === "reviews" ? (long ? L("Yorumlar", "Reviews") : L("Yorum", "Reviews")) : g === "features" ? (long ? L("Özellikler", "Features") : L("Özellik", "Features")) : L("Fiyat", "Price");

type PartLike = Pick<Part, "criterion" | "weight" | "s">;

/** The sort's weights as three shares of 100 (the decision's own weights, added up by group); empty with no weights. */
export function weightShares(parts: readonly PartLike[]): { group: ScoreGroup; share: number }[] {
  const total = parts.reduce((n, p) => n + Math.max(0, p.weight), 0);
  if (!total) return [];
  return GROUPS.map((group) => ({ group, share: Math.round((100 * parts.filter((p) => GROUP_OF[p.criterion] === group).reduce((n, p) => n + Math.max(0, p.weight), 0)) / total) })).filter((g) => g.share > 0);
}

/** One option's three parts, 0–100: each the weighted mean of its known sub-scores; a part nothing is known of is left out. */
export function scoreParts(parts: readonly PartLike[]): { group: ScoreGroup; value: number }[] {
  return GROUPS.flatMap((group) => {
    const known = parts.filter((p) => GROUP_OF[p.criterion] === group && p.weight > 0 && p.s != null);
    const w = known.reduce((n, p) => n + p.weight, 0);
    return w ? [{ group, value: Math.round((100 * known.reduce((n, p) => n + p.weight * (p.s ?? 0), 0)) / w) }] : [];
  });
}

/** "Neden 84?": the weightiest parts it does well and badly on ("Güçlü: Fiyat, Aktarma. Zayıf: Saatler."); null when none stand out. */
export function partsWhy(parts: readonly Pick<Part, "label" | "weight" | "s">[]): string | null {
  const known = parts.filter((p) => p.weight > 0 && p.s != null).sort((a, b) => b.weight - a.weight);
  const good = known.filter((p) => (p.s ?? 0) >= 0.75).slice(0, 2).map((p) => p.label);
  const bad = known.filter((p) => (p.s ?? 1) <= 0.4).slice(0, 2).map((p) => p.label);
  const out = [good.length ? L(`Güçlü: ${good.join(", ")}.`, `Strong: ${good.join(", ")}.`) : null, bad.length ? L(`Zayıf: ${bad.join(", ")}.`, `Weak: ${bad.join(", ")}.`) : null].filter(Boolean);
  return out.length ? out.join(" ") : null;
}

/** "1. sırada" / "#1". */
export const placeText = (place: number): string => L(`${place}. sırada`, `#${place}`);

// --- the five slots ------------------------------------------------------------------------------------------------------

export type SlotTone = "ok" | "warn" | "dim" | "link";
export type SlotIcon = "food" | "undo" | "pin" | "star" | "link" | "bag" | "cabin" | "gate" | "shield" | "key" | "clock";
export interface CardSlot {
  key: string;
  label: string;
  value: string;
  tone: SlotTone;
  icon: SlotIcon;
}

const unknown = (key: string, label: string, icon: SlotIcon): CardSlot => ({ key, label, value: L("bilinmiyor", "unknown"), tone: "dim", icon });
/** What the record's own words say (its highlights, concerns, summary, detail), lower-cased for a pattern. */
const words = (i: Item) => [...(i.highlights ?? []), ...(i.concerns ?? []), i.summary, i.optionDetail, i.reviewSummary].filter(Boolean).join(" \n ");
const said = (i: Item, re: RegExp): RegExpMatchArray | null => words(i).match(re);
const inConcerns = (i: Item, re: RegExp) => (i.concerns ?? []).some((c) => re.test(c));

const dayUntil = (iso: string | null | undefined): string | null => {
  const d = isoDate(iso?.slice(0, 10));
  if (!d) return null;
  const [n, m] = shortDay(d).split(" ");
  return L(`${n} ${dative(m ?? "")} dek`, `until ${shortDay(d)}`);
};

function cancelSlot(i: Item, flight: boolean): CardSlot {
  const label = flight ? L("İade", "Refund") : L("İptal", "Cancellation");
  const type = i.metrics?.cancellationType ?? "unknown";
  if (type === "free") return { key: "cancel", label: L("Ücretsiz iptal", "Free cancellation"), value: dayUntil(i.cancellation?.freeUntil) ?? L("var", "yes"), tone: "ok", icon: "undo" };
  if (type === "non_refundable") return { key: "cancel", label, value: L("İade yok", "No refund"), tone: "warn", icon: "undo" };
  if (type === "partial") return { key: "cancel", label, value: L("İade ücretli", "Fee to refund"), tone: "warn", icon: "undo" };
  if (i.cancellation?.freeUntil) return { key: "cancel", label: L("Ücretsiz iptal", "Free cancellation"), value: dayUntil(i.cancellation.freeUntil) ?? "", tone: "ok", icon: "undo" };
  return unknown("cancel", label, "undo");
}

function sourceSlot(i: Item, brand: string | null): CardSlot {
  const name = brand ?? i.provider;
  return name ? { key: "source", label: L("Kaynak", "Source"), value: name, tone: i.url ? "link" : "dim", icon: "link" } : unknown("source", L("Kaynak", "Source"), "link");
}

function ratingSlot(i: Item): CardSlot {
  const r = i.rating;
  if (r?.value == null) return unknown("rating", L("Puan", "Rating"), "star");
  const n = r.value.toLocaleString(L("tr", "en"), { maximumFractionDigits: 1 });
  return { key: "rating", label: L("Puan", "Rating"), value: `${n} / ${r.scale ?? 10}`, tone: "dim", icon: "star" };
}

const NO_BREAKFAST = /kahvaltı (yok|dahil değil)|kahvaltısız|no breakfast|room only|breakfast not included/i;
const BREAKFAST = /kahvaltı dahil|kahvaltı (çeşitli|var)|breakfast included|free breakfast/i;

/** A stay: Kahvaltı · İptal · Merkez · Puan · Kaynak. */
export function staySlots(i: Item, brand: string | null): CardSlot[] {
  const label = L("Kahvaltı", "Breakfast");
  const food: CardSlot = i.metrics?.amenities?.some((a) => AMENITY_EN[a] === "breakfast included") || said(i, BREAKFAST)
    ? { key: "food", label, value: L("Dahil", "Included"), tone: "ok", icon: "food" }
    : said(i, NO_BREAKFAST)
      ? { key: "food", label, value: L("Yok", "None"), tone: "warn", icon: "food" }
      : unknown("food", label, "food");
  const km = i.metrics?.distanceToCenterKm;
  const walk = (i.nearby ?? []).find((n) => !n.airport && n.mode === "walk");
  const centre: CardSlot = km != null
    ? { key: "centre", label: L("Merkez", "Centre"), value: km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString(L("tr", "en"), { maximumFractionDigits: 1 })} km`, tone: km <= 1.5 ? "ok" : km >= 3 ? "warn" : "dim", icon: "pin" }
    : walk
      ? { key: "centre", label: walk.name, value: L(`${walk.minutes} dk yürüme`, `${walk.minutes} min walk`), tone: walk.minutes <= 15 ? "ok" : "dim", icon: "pin" }
      : i.location?.area
        ? { key: "centre", label: L("Semt", "Area"), value: i.location.area, tone: "dim", icon: "pin" }
        : unknown("centre", L("Merkez", "Centre"), "pin");
  return [food, cancelSlot(i, false), centre, ratingSlot(i), sourceSlot(i, brand)];
}

/** A flight: Bagaj · El bagajı · İade · Varış · Kaynak. */
export function flightSlots(i: Item, brand: string | null): CardSlot[] {
  const bagLabel = L("Bagaj", "Bag");
  const bagKg = said(i, /(\d{2})\s?kg (?:bagaj|checked|bag)/i)?.[1];
  const bag = i.metrics?.checkedBagIncluded;
  const checked: CardSlot = bag === true
    ? { key: "bag", label: bagLabel, value: bagKg ? `${bagKg} kg` : L("Dahil", "Included"), tone: "ok", icon: "bag" }
    : bag === false
      ? { key: "bag", label: bagLabel, value: L("Bagaj yok", "No bag"), tone: "warn", icon: "bag" }
      : unknown("bag", bagLabel, "bag");
  const cabinKg = said(i, /(?:el bagaj[ıi]|cabin bag|carry-on)\D{0,6}(\d{1,2})\s?kg|(\d{1,2})\s?kg (?:el bagaj|cabin|carry-on)/i);
  const cabinLabel = L("El bagajı", "Cabin bag");
  const cabin: CardSlot = cabinKg
    ? { key: "cabin", label: cabinLabel, value: `${cabinKg[1] ?? cabinKg[2]} kg`, tone: inConcerns(i, /el bagaj|cabin|carry-on/i) ? "warn" : "ok", icon: "cabin" }
    : unknown("cabin", cabinLabel, "cabin");
  const to = i.flight?.to ?? null;
  const terminal = to ? said(i, new RegExp(`${to}\\s*(?:·|-)?\\s*(T\\d)`, "i"))?.[1] ?? null : null;
  const gate: CardSlot = to ? { key: "gate", label: L("Varış", "Arrives"), value: terminal ? `${to} · ${terminal.toUpperCase()}` : to, tone: "dim", icon: "gate" } : unknown("gate", L("Varış", "Arrives"), "gate");
  return [checked, cabin, cancelSlot(i, true), gate, sourceSlot(i, brand)];
}

const hoursText = (m: number) => (m < 60 ? L(`${m} dk`, `${m} min`) : m % 60 ? L(`${Math.floor(m / 60)} sa ${m % 60} dk`, `${Math.floor(m / 60)} hr ${m % 60} min`) : L(`${m / 60} sa`, `${m / 60} hr`));

/** A train, a bus, a boat: Kalkış · Varış · Süre · İade · Kaynak (a bag says nothing on a train). */
export function waySlots(i: Item, brand: string | null): CardSlot[] {
  const end = (key: string, label: string, place: string | null | undefined): CardSlot => (place ? { key, label, value: place, tone: "dim", icon: "gate" } : unknown(key, label, "gate"));
  const mins = i.metrics?.durationMinutes;
  const length: CardSlot = mins ? { key: "length", label: L("Süre", "Length"), value: hoursText(mins), tone: "dim", icon: "clock" } : unknown("length", L("Süre", "Length"), "clock");
  return [end("from", L("Kalkış", "Leaves"), i.flight?.from), end("to", L("Varış", "Arrives"), i.flight?.to), length, cancelSlot(i, true), sourceSlot(i, brand)];
}

/** A rental (a scooter, a car, a camper): Sigorta · İptal · Teslim · Puan · Kaynak. */
export function rentalSlots(i: Item, brand: string | null): CardSlot[] {
  const label = L("Sigorta", "Insurance");
  const cover: CardSlot = said(i, /sigorta (dahil|var)|insurance included|kasko dahil/i)
    ? { key: "cover", label, value: L("Dahil", "Included"), tone: "ok", icon: "shield" }
    : said(i, /sigorta (yok|ek ücret)|no insurance|insurance extra/i)
      ? { key: "cover", label, value: L("Ek ücretli", "Extra"), tone: "warn", icon: "shield" }
      : unknown("cover", label, "shield");
  const place = i.location?.area ?? i.city;
  const pick: CardSlot = said(i, /otele (getir|teslim)|hotel delivery|delivered to (your|the) hotel/i)
    ? { key: "pick", label: L("Teslim", "Pick-up"), value: L("Otele", "To the hotel"), tone: "ok", icon: "key" }
    : place
      ? { key: "pick", label: L("Teslim", "Pick-up"), value: place, tone: "dim", icon: "key" }
      : unknown("pick", L("Teslim", "Pick-up"), "key");
  return [cover, cancelSlot(i, false), pick, ratingSlot(i), sourceSlot(i, brand)];
}

// --- what the reviews say ------------------------------------------------------------------------------------------------

/** "Yorumlardan": what it's praised and faulted for (the page's highlights and concerns, the reviews' topics), at most three each. */
export function prosCons(i: Item, topics: readonly { label: string; up: boolean }[] = [], max = 3): { pros: string[]; cons: string[]; count: number | null } | null {
  const uniq = (list: string[]) => [...new Set(list.map((t) => t.trim()).filter(Boolean))].slice(0, max);
  const pros = uniq([...(i.highlights ?? []), ...topics.filter((t) => t.up).map((t) => t.label)]);
  const cons = uniq([...(i.concerns ?? []), ...topics.filter((t) => !t.up).map((t) => t.label)]);
  if (!pros.length && !cons.length) return null;
  return { pros, cons, count: i.rating?.count ?? null };
}

export const reviewsHead = (count: number | null): string =>
  count ? L(`Yorumlardan · ${count.toLocaleString("tr")} yorum`, `From reviews · ${count.toLocaleString("en")} reviews`) : L("Yorumlardan", "From reviews");

// --- a flight's day band -------------------------------------------------------------------------------------------------

const daysApart = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** A day's band over its flights: the tile (day, month), "2 Nisan, Cuma", "istenen gün · 3 seçenek" or "bir gün sonra". */
export function dayBand(day: string, asked: string | null, count: number): { n: string; month: string; title: string; note: string; asked: boolean; off: number } {
  const [n, month] = shortDay(day).split(" ");
  const long = new Date(`${day}T12:00:00Z`).toLocaleDateString(L("tr-TR", "en-GB"), { day: "numeric", month: "long", timeZone: "UTC" });
  const off = asked ? daysApart(asked, day) : 0;
  const away = off === 0 ? L("istenen gün", "the day asked") : off === 1 ? L("bir gün sonra", "a day later") : off === -1 ? L("bir gün önce", "a day earlier") : off > 0 ? L(`${off} gün sonra`, `${off} days later`) : L(`${-off} gün önce`, `${-off} days earlier`);
  return { n: n ?? "", month: month ?? "", title: `${long}, ${weekdayLong(day)}`, note: `${asked ? `${away} · ` : ""}${L(`${count} seçenek`, `${count} option${count > 1 ? "s" : ""}`)}`, asked: asked != null && off === 0, off };
}

// --- how fresh the price is ----------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/**
 * Kaçırdıklarımız 4: "2 gün önce" when the price was read more than two days ago (to refresh it), and what it was before when
 * it fell since ("Dün €71'di"); nothing when it's fresh and never fell.
 */
export function priceAge(i: Pick<Item, "price" | "priceHistory">, now: number): { ago: string | null; was: string | null } {
  const at = i.price?.observedAt ?? 0;
  const days = at > 1_000_000_000_000 ? Math.floor((now - at) / DAY_MS) : 0;
  const ago = days >= 2 ? L(`${days} gün önce`, `${days} days ago`) : null;
  const amount = i.price?.amount;
  const before = [...(i.priceHistory ?? [])].filter((h) => h.observedAt < at && h.currency === i.price.currency).sort((a, b) => b.observedAt - a.observedAt)[0];
  if (amount == null || !before || before.amount <= amount) return { ago, was: null };
  const back = Math.floor((now - before.observedAt) / DAY_MS);
  const money = formatPrice(before.amount, before.currency);
  const when = back <= 1 ? L("Dün", "Yesterday") : L(`${back} gün önce`, `${back} days ago`);
  // ("€71 idi": the suffix would follow how the number is read, so the word stands apart)
  return { ago, was: L(`${when} ${money} idi`, `${when} it was ${money}`) };
}

// --- the Pano's side-by-side view ----------------------------------------------------------------------------------------

/**
 * Which columns are best (green) and worst (amber) on a row of the comparison: only among the known, only when they differ;
 * a tie for best is green on each (they are equally good), the worst likewise.
 */
export function extremes(values: readonly (number | null)[], higherIsBetter = true): { best: Set<number>; worst: Set<number> } {
  const known = values.flatMap((v, i) => (v == null ? [] : [{ v, i }]));
  if (known.length < 2) return { best: new Set(), worst: new Set() };
  const top = higherIsBetter ? Math.max(...known.map((k) => k.v)) : Math.min(...known.map((k) => k.v));
  const low = higherIsBetter ? Math.min(...known.map((k) => k.v)) : Math.max(...known.map((k) => k.v));
  if (top === low) return { best: new Set(), worst: new Set() };
  return { best: new Set(known.filter((k) => k.v === top).map((k) => k.i)), worst: new Set(known.filter((k) => k.v === low).map((k) => k.i)) };
}

// --- people or rooms changed -------------------------------------------------------------------------------------------

/**
 * Kaçırdıklarımız (kişi ya da oda değişince): an option priced for a different number of people than now go (its page said
 * 2, the trip is 3 now): its price is for them, not for today's party; null when it matches or the page didn't say.
 */
export function guestGap(item: Pick<Item, "guests" | "price">, people: number): { was: number; now: number } | null {
  const was = item.guests?.adults;
  if (was == null || was <= 0 || people <= 0 || was === people || item.price?.amount == null) return null;
  return { was, now: people };
}

/** "2 kişi için fiyat" (an option's), "Bu oda 3 kişiye uygun mu?" (the chosen stay's). */
export const guestGapText = (g: { was: number; now: number }, chosen: boolean): string =>
  chosen ? L(`Bu oda ${g.now} kişiye uygun mu? Sayfada ${g.was} kişi`, `Does this room fit ${g.now}? The page says ${g.was}`) : L(`fiyat ${g.was} kişi için, yeniden ara`, `priced for ${g.was}, search again`);

/** "Ücretsiz iptal 20 Mar'a dek" on a booking still free to cancel (its strip, beside Takvime ekle); null once past or unsaid. */
export function freeCancelText(item: Pick<Item, "cancellation">, today: string): string | null {
  const free = isoDate(item.cancellation?.freeUntil?.slice(0, 10));
  if (!free || free < today) return null;
  return L(`Ücretsiz iptal ${dayUntil(free)}`, `Free cancellation ${dayUntil(free)}`);
}

/**
 * "Ayarla" (onay paketi 2026-10-22, Kalan öneriler): the sort's three weights as dials, 0–4, 2 each group's own default.
 * A dial sets the levels of its group's criteria for this category (the decision's own: decision.withPriorities), each
 * scaled from its default, so the order on the cards changes at once and is kept for the trip.
 */
export const DIAL_MAX = 4;

const groupCriteria = (category: Category, group: ScoreGroup): [CriterionId, number][] =>
  (Object.entries(DEFAULT_LEVELS[category]) as [CriterionId, number][]).filter(([c, d]) => d > 0 && GROUP_OF[c] === group);

/** Where a group's dial stands for a trip: its criteria's levels against their defaults (2 = as they are by default). */
export function groupDial(trip: Trip, category: Category, group: ScoreGroup): number {
  const cs = groupCriteria(category, group);
  if (!cs.length) return 0;
  // (the dial whose levels are nearest the trip's own, its default on a tie)
  const off = (dial: number) => cs.reduce((n, [c, d]) => n + Math.abs(Math.max(0, Math.min(4, Math.round((d * dial) / 2))) - levelFor(trip, category, c)), 0);
  return [2, 0, 1, 3, 4].reduce((best, dial) => (off(dial) < off(best) ? dial : best), 2);
}

/** The levels a group's dial sets on its criteria. */
export function dialLevels(category: Category, group: ScoreGroup, dial: number): { criterion: CriterionId; level: PriorityLevel; category: Category }[] {
  return groupCriteria(category, group).map(([criterion, d]) => ({ criterion, level: Math.max(0, Math.min(4, Math.round((d * dial) / 2))) as PriorityLevel, category }));
}

export type WeightPreset = "balanced" | "price" | "reviews" | "location";

/** A preset's levels ("Fiyat önce": price at the top), null for "Dengeli" (back to the defaults). */
export function presetLevels(category: Category, preset: WeightPreset): { criterion: CriterionId; level: PriorityLevel; category: Category }[] | null {
  if (preset === "balanced") return null;
  const top: CriterionId[] = preset === "price" ? ["price"] : preset === "reviews" ? ["rating", "comfort", "details"] : ["location"];
  return top.filter((c) => DEFAULT_LEVELS[category][c] !== undefined).map((criterion) => ({ criterion, level: 4 as PriorityLevel, category }));
}

export const presetLabel = (p: WeightPreset): string =>
  p === "balanced" ? L("Dengeli", "Balanced") : p === "price" ? L("Fiyat önce", "Price first") : p === "reviews" ? L("Yorumlar önce", "Reviews first") : L("Konum önce", "Location first");
