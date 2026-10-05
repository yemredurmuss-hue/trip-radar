// Fikirler (docs/mockups/2026-10-05-fikirler-v1.html): what needs no booking — a restaurant, a walk, a
// market, a sunset — city by city. A line typed in the quick box becomes one (a restaurant when its words
// say food), it can be put on a day (a restaurant on a meal too) and then shows as a thin line in the
// day-by-day view, ticked off once done, or moved to the bookings when it turns out to need a ticket.
// Pure, except the writes at the end. No model call anywhere here.
import { isIdea, looksBookable } from "./booking";
import { addEvent, db, notifyChanged } from "./db";
import { L, locale } from "./i18n";
import { capitalize, liveLabels, num } from "./i18nText";
import { isoDate } from "./items";
import { cityKeyOf, sameCity, type DateRange, type Plan } from "./plan";
import { plannedItem } from "./planned";
import type { Item, MealSlot } from "./types";

export type IdeaFilter = "all" | "food" | "todo";
/** A to-do's icon (fikirler-v1 symbols), chosen from its words; "star" for anything else. */
export type IdeaIcon = "camera" | "sun" | "route" | "bag" | "book" | "star";

export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEALS = liveLabels({ breakfast: ["sabah", "breakfast"], lunch: ["öğle", "lunch"], dinner: ["akşam", "dinner"] });
export const mealLabel = (m: MealSlot): string => MEALS[m];

export const isFoodIdea = (i: Item): boolean => i.category === "food";

export interface IdeaGroup {
  key: string;
  /** null: "Şehri belli değil" (always last). */
  city: string | null;
  /** The nights spent there ("Porto 8–11 Ekim"); null for a city the plan doesn't stay in. */
  range: DateRange | null;
  food: Item[];
  todos: Item[];
}

const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);

/**
 * The ideas by city, in the order the trip goes (the stays' cities), then cities the plan doesn't stay
 * in, then those with no city. Restaurants and to-dos apart; a to-do done goes to the bottom of its list.
 */
export function groupIdeas(items: Item[], plan: Pick<Plan, "stayBlocks">, filter: IdeaFilter = "all"): IdeaGroup[] {
  const groups: IdeaGroup[] = [];
  const find = (city: string) => groups.find((g) => g.city && sameCity(g.city, city));
  for (const b of plan.stayBlocks) {
    if (!b.city) continue;
    const g = find(b.city);
    if (g?.range) g.range = { start: minDate(g.range.start, b.range.start), end: maxDate(g.range.end, b.range.end) };
    else groups.push({ key: `city:${cityKeyOf(b.city)}`, city: b.city, range: { ...b.range }, food: [], todos: [] });
  }
  const nowhere: IdeaGroup = { key: "city:none", city: null, range: null, food: [], todos: [] };
  for (const i of items.filter(isIdea).sort((a, b) => a.createdAt - b.createdAt)) {
    let g = i.city ? find(i.city) : nowhere;
    if (!g) {
      g = { key: `city:${cityKeyOf(i.city)}`, city: i.city, range: null, food: [], todos: [] };
      groups.push(g);
    }
    (isFoodIdea(i) ? g.food : g.todos).push(i);
  }
  groups.push(nowhere);
  for (const g of groups) g.todos.sort((a, b) => Number(Boolean(a.doneAt)) - Number(Boolean(b.doneAt)));
  return groups
    .map((g) => ({ ...g, food: filter === "todo" ? [] : g.food, todos: filter === "food" ? [] : g.todos }))
    .filter((g) => g.food.length || g.todos.length);
}

const FOOD =
  /restoran|restaurant|lokanta|kafe|cafe|café|kahve|coffee|meyhane|taverna|tasca|bistro|brasserie|yemek|kahvaltı|brunch|pastane|pastelaria|patisserie|fırın|bakery|dondurma|gelato|francesinha|pastel de nata|pizza|sushi|burger|tapas|şarap barı|wine bar|(^|\s)bar(\s|$)/i;

/** A quick line: a restaurant when it speaks of eating or drinking, else a to-do. */
export const quickKind = (text: string): "food" | "todo" => (FOOD.test(text) ? "food" : "todo");

const ICONS: [RegExp, IdeaIcon][] = [
  [/fotoğraf|foto\b|photo|kamera|camera/i, "camera"],
  [/gün batımı|gün doğumu|sunset|sunrise|manzara|seyir|viewpoint|miradouro/i, "sun"],
  [/yürüyüş|yürü|hike|hiking|trek|levada|patika|rota|walk|\d+\s?km/i, "route"],
  [/pazar|market|mercado|alışveriş|shopping|çarşı|mağaza|dükkan/i, "bag"],
  [/müze|museum|museu|kitap|book|kütüphane|library|livraria|galeri|gallery/i, "book"],
];
/** The to-do's icon from its words: a photo, a sunrise or sunset, a walk, a market, a museum or books, else a star. */
export function ideaIcon(item: Pick<Item, "name" | "summary">): IdeaIcon {
  const text = [item.name, item.summary].filter(Boolean).join(" ");
  return ICONS.find(([re]) => re.test(text))?.[1] ?? "star";
}

const words = (s: string) =>
  ` ${s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** The trip's city the line names ("Porto'da pazar" → Porto), the longest name first; null when none. */
export function cityInText(text: string, cities: string[]): string | null {
  const said = words(text);
  const sorted = [...new Set(cities.filter(Boolean))].sort((a, b) => b.length - a.length);
  return sorted.find((c) => said.includes(` ${words(c).trim()}`)) ?? null;
}

/** The text folded like `words` (case, accents, ı), one entry per folded character with where it began. */
function folded(text: string): { text: string; at: number[] } {
  let out = "";
  const at: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = ch.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
    for (const c of f) {
      out += c;
      at.push(i);
    }
    i += ch.length;
  }
  at.push(i);
  return { text: out, at };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The quick line's title without the city it names, which the card already says: "Porto'da Dom Luís
 * köprüsünden gün batımı" → "Dom Luís köprüsünden gün batımı". The city goes with its 'da/'de/'ta/'te,
 * 'dan/'den/'tan/'ten (da/de/dan/den without the apostrophe) and a comma after it; said bare, only when a
 * comma or the end follows ("Porto, Ribeira"), never another form ("Porto'nun", "Porto şarabı"). As typed
 * when no trip city is named or nothing would be left.
 */
export function ideaTitle(text: string, cities: string[]): string {
  const title = text.replace(/\s+/g, " ").trim();
  const city = cityInText(title, cities);
  if (!city) return title;
  const f = folded(title);
  const name = escapeRe(folded(city).text.trim());
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${name}(?:['’][dt][ae]n?|d[ae]n?)?)(?=$|[^\\p{L}\\p{N}'’])`, "gu");
  for (const m of f.text.matchAll(re)) {
    const start = m.index! + m[1].length;
    let end = start + m[2].length;
    const suffixed = m[2].length > folded(city).text.trim().length;
    const after = f.text.slice(end);
    const comma = /^\s*,/.test(after);
    if (!suffixed && !comma && after.trim() !== "") continue;
    end += (after.match(/^\s*,?\s*/)?.[0].length ?? 0);
    const rest = (title.slice(0, f.at[start]) + " " + title.slice(f.at[end]))
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, "");
    return rest ? capitalize(rest) : title;
  }
  return title;
}

/** The record a quick line makes: a saved idea (no booking), in the city it names, no day yet. */
export function quickIdea(text: string, cities: string[], tripId: string, id: string, now: number): Item | null {
  const said = text.replace(/\s+/g, " ").trim();
  if (!said) return null;
  const city = cityInText(said, cities);
  const title = ideaTitle(said, cities);
  const made = plannedItem(
    { kind: quickKind(title) === "food" ? "food" : "todo", date: null, end_date: null, time: null, from: null, to: null, city, title, booked: false, note: null },
    tripId,
    id,
    now,
  );
  return { ...made, status: "saved", booking: "none" };
}

export interface DayChoice {
  date: string;
  city: string | null;
  /** "8 Eki Per" */
  label: string;
}

/** "8 Eki" */
export const shortDay = (date: string): string => new Date(`${date}T12:00:00Z`).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "UTC" });

const addDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** The trip's days for "+ Güne ekle", each with the city slept in that night (the last day: the last city). */
export function dayChoices(plan: Pick<Plan, "range" | "stayBlocks">): DayChoice[] {
  if (!plan.range) return [];
  const out: DayChoice[] = [];
  const last = plan.stayBlocks.at(-1)?.city ?? null;
  for (let d = plan.range.start; d <= plan.range.end; d = addDay(d)) {
    const city = plan.stayBlocks.find((b) => b.range.start <= d && d < b.range.end)?.city ?? (d === plan.range.end ? last : null);
    const weekday = new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
    out.push({ date: d, city, label: `${shortDay(d)} ${weekday}` });
  }
  return out;
}

/** The day chip once put on a day: "8 Eki", a restaurant with its meal "8 Eki akşam"; null without a day. */
export function dayChip(item: Item): string | null {
  const d = isoDate(item.dates.start);
  if (!d) return null;
  return item.meal ? `${shortDay(d)} ${mealLabel(item.meal)}` : shortDay(d);
}

/** "Yapıldı · 12 Eki" */
export const doneText = (item: Item): string | null =>
  item.doneAt ? L(`Yapıldı · ${shortDay(new Date(item.doneAt).toISOString().slice(0, 10))}`, `Done · ${shortDay(new Date(item.doneAt).toISOString().slice(0, 10))}`) : null;

/** A restaurant card's grey line: what it is (as much as the page said) and its rating ("Francesinha · ★ 4,5"). */
export function foodLine(item: Item): string | null {
  const what = item.optionDetail ?? (item.summary && item.summary.length <= 40 ? item.summary : null);
  const star = item.rating.value != null ? `★ ${num(item.rating.value)}` : null;
  return [what, star].filter(Boolean).join(" · ") || null;
}

/** A to-do's grey line: done, a ticket it turns out to need, else what was said about it. */
export function todoLine(item: Item): { text: string | null; promote: boolean } {
  const done = doneText(item);
  if (done) return { text: done, promote: false };
  if (looksBookable(item)) return { text: L("Giriş bileti gerekiyor", "Needs an entry ticket"), promote: true };
  return { text: item.summary || item.statusNote || null, promote: false };
}

// --- writes ---------------------------------------------------------------------------------------------

async function change(item: Item, next: (fresh: Item) => Item, event: string): Promise<Item> {
  const d = await db();
  const fresh = (await d.get("items", item.id)) ?? item;
  const saved = { ...next(fresh), updatedAt: Date.now() };
  await d.put("items", saved);
  await addEvent(item.tripId, event);
  notifyChanged();
  return saved;
}

/** The quick box: adds the line as an idea (null when it's empty). */
export async function addIdea(tripId: string, text: string, cities: string[], id: string, now = Date.now()): Promise<Item | null> {
  const made = quickIdea(text, cities, tripId, id, now);
  if (!made) return null;
  await (await db()).put("items", made);
  await addEvent(tripId, L(`${made.name} fikirlere eklendi`, `${made.name} added to ideas`));
  notifyChanged();
  return made;
}

/**
 * "+ Güne ekle" (and the day chip): puts it on a day, a restaurant on a meal; null takes it off its day.
 * A time said with it moves to the new day; without a day it has none.
 */
export function onDay(item: Item, date: string | null, meal: MealSlot | null): Item {
  const time = item.flight?.departure?.slice(11, 16) ?? null;
  const { meal: _was, ...rest } = item;
  return {
    ...rest,
    dates: { start: date, end: null, source: "user" },
    ...(item.flight ? { flight: { ...item.flight, departure: date && time ? `${date}T${time}` : null } } : {}),
    ...(date && meal ? { meal } : {}),
  };
}
export const setIdeaDay = (item: Item, date: string | null, meal: MealSlot | null) =>
  change(
    item,
    (fresh) => onDay(fresh, date, meal),
    date ? L(`${item.name} ${shortDay(date)} gününe eklendi`, `${item.name} put on ${shortDay(date)}`) : L(`${item.name} günden çıkarıldı`, `${item.name} taken off its day`),
  );

/** The tick: done ("Yapıldı · 12 Eki") or not. */
export const setDone = (item: Item, done: boolean, now = Date.now()) =>
  change(
    item,
    (fresh) => {
      const { doneAt: _was, ...rest } = fresh;
      return done ? { ...fresh, doneAt: now } : rest;
    },
    done ? L(`${item.name} yapıldı`, `${item.name} done`) : L(`${item.name} yapılmadı olarak geri alındı`, `${item.name} marked as not done`),
  );

/**
 * "Rezerve edileceklere taşı": it needs a ticket after all; it goes to the Plan and counts as a booking.
 * A to-do becomes a thing to do with a ticket (an activity), so the Plan doesn't call it "Yapılacak".
 */
export const asBooking = (item: Item): Item =>
  item.plannedKind === "todo" ? { ...item, plannedKind: "activity", category: "activity", booking: "needed" } : { ...item, booking: "needed" };
export const moveToBookings = (item: Item) =>
  change(item, asBooking, L(`${item.name} rezerve edileceklere taşındı`, `${item.name} moved to bookings`));
