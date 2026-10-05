// Ideas (docs/mockups/2026-10-05-fikirler-v1.html): what needs no booking — a restaurant, a walk, a market, a
// sunset — on the Plan's Yapılacak şeyler and Restoranlar (spec 0.34). A line typed in the quick box becomes
// one (a restaurant when its words say food), it can be put on a day (a restaurant on a meal too) and then
// shows as a thin line in the day-by-day view, ticked off once done, or moved to Etkinlikler when it turns
// out to need a ticket.
// Pure, except the writes at the end. No model call anywhere here.
import { looksBookable } from "./booking";
import { addEvent, db, notifyChanged } from "./db";
import { L, locale } from "./i18n";
import { capitalize, liveLabels, num } from "./i18nText";
import { isoDate } from "./items";
import type { Plan } from "./plan";
import { plannedItem } from "./planned";
import { isPrep } from "./prep";
import type { Item, MealSlot } from "./types";

/** A to-do's icon (fikirler-v1 symbols, and a fork and knife for food), chosen from its words; "star" for anything else. */
export type IdeaIcon = "camera" | "sun" | "route" | "bag" | "book" | "food" | "star";

export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];
const MEALS = liveLabels({ breakfast: ["sabah", "breakfast"], lunch: ["öğle", "lunch"], dinner: ["akşam", "dinner"] });
export const mealLabel = (m: MealSlot): string => MEALS[m];

export const isFoodIdea = (i: Item): boolean => i.category === "food";

const FOOD =
  /restoran|restaurant|lokanta|kafe|cafe|café|kahve|coffee|meyhane|taverna|tasca|bistro|brasserie|yemek|kahvaltı|brunch|pastane|pastelaria|patisserie|fırın|bakery|dondurma|gelato|francesinha|pastel de nata|pizza|sushi|burger|tapas|şarap barı|wine bar|(^|\s)bar(\s|$)/i;

/** A quick line: a restaurant when it speaks of eating or drinking, else a to-do. */
export const quickKind = (text: string): "food" | "todo" => (FOOD.test(text) ? "food" : "todo");

const ICONS: [RegExp, IdeaIcon][] = [
  [/fotoğraf|foto\b|photo|kamera|camera/i, "camera"],
  [/gün batımı|gün doğumu|sunset|sunrise|manzara|seyir|viewpoint|miradouro/i, "sun"],
  [/yürüyüş|yürü|hike|hiking|trek|levada|patika|rota|walk|\d+\s?km/i, "route"],
  [/pazar|market|mercado|alışveriş|shopping|çarşı|mağaza|dükkan|outlet|satın al|\bbuy\b|(^|\s)al(alım|ın)?$/i, "bag"],
  [/müze|museum|museu|kitap|book|kütüphane|library|livraria|galeri|gallery/i, "book"],
  [new RegExp(`${FOOD.source}|lezzet|street food|tadım|tasting|yiyecek`, "i"), "food"],
];
/** The to-do's icon from its words: a photo, a sunrise or sunset, a walk, a market, a museum or books, food, else a star. */
export function ideaIcon(item: Pick<Item, "name" | "summary">): IdeaIcon {
  const text = [item.name, item.summary].filter(Boolean).join(" ");
  return ICONS.find(([re]) => re.test(text))?.[1] ?? "star";
}

/**
 * A to-do from a Maps (or any page) link shows its page's photo instead of the icon (Yapılacak şeyler); a
 * line typed or said in the chat keeps its icon.
 */
export const ideaThumb = (item: Pick<Item, "url" | "imageUrl">): string | null => (item.url && item.imageUrl ? item.imageUrl : null);

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

/**
 * Where an idea stands today (0.35.3): its day while that's still ahead (or it's done, or a table is booked);
 * a day gone by without "Yaptım" puts it back in its city's pool — `returned` says which day it was on. Shown,
 * never written: the record keeps its day.
 */
export function ideaDay(item: Item, today: string): { day: string | null; returned: string | null } {
  const day = isoDate(item.dates.start);
  if (!day || item.doneAt || item.status === "booked" || day >= today) return { day, returned: null };
  return { day: null, returned: day };
}

/** "Yapıldı · 12 Eki" */
export const doneText = (item: Item): string | null =>
  item.doneAt ? L(`Yapıldı · ${shortDay(new Date(item.doneAt).toISOString().slice(0, 10))}`, `Done · ${shortDay(new Date(item.doneAt).toISOString().slice(0, 10))}`) : null;

/** A restaurant card's grey line: what it is and its rating, as much as the page said ("Francesinha · ★ 4,5 (1.204)"); nothing made up. */
export function foodLine(item: Item): string | null {
  const what = item.optionDetail ?? (item.summary && item.summary.length <= 40 ? item.summary : null);
  const reviews = item.rating.count != null && item.rating.count > 0 ? ` (${item.rating.count.toLocaleString(locale())})` : "";
  const star = item.rating.value != null ? `★ ${num(item.rating.value)}${reviews}` : null;
  return [what, star].filter(Boolean).join(" · ") || null;
}

/**
 * Where an idea came from, for its grey line (kategoriler spec): Maps, Instagram (Reels), Pinterest, TikTok,
 * YouTube, a blog, else the site's name; a note typed by hand says "not". Nothing when it can't tell.
 */
export function ideaSource(item: Pick<Item, "url" | "plannedKind">): string | null {
  if (!item.url) return item.plannedKind === "note" ? L("not", "note") : null;
  let url: URL;
  try {
    url = new URL(item.url);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.toLowerCase();
  if (/(^|\.)google\.[a-z.]+$/.test(host) && path.startsWith("/maps")) return "Maps";
  if (host === "maps.app.goo.gl" || host.startsWith("maps.google.") || (host === "goo.gl" && path.startsWith("/maps"))) return "Maps";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return path.startsWith("/reel") ? "Reels" : "Instagram";
  if (/(^|\.)pinterest\.[a-z.]+$/.test(host) || host === "pin.it") return "Pinterest";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) return "YouTube";
  if (/blogspot\.|wordpress\.|medium\.com|substack\.com/.test(host) || /(^|\/)blog(\/|$)/.test(path) || host.startsWith("blog.")) return "blog";
  return host || null;
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
  await addEvent(
    tripId,
    isPrep(made) ? L(`${made.name} Hazırlık'a eklendi`, `${made.name} added to Prep`) : L(`${made.name} fikirlere eklendi`, `${made.name} added to ideas`),
  );
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

/** Moved by hand between Hazırlık (a chore before the trip) and Yapılacak şeyler (something to do there). */
export const setPrep = (item: Item, prep: boolean) =>
  change(
    item,
    (fresh) => ({ ...fresh, prep }),
    prep ? L(`${item.name} Hazırlık'a taşındı`, `${item.name} moved to Prep`) : L(`${item.name} Yapılacak şeyler'e taşındı`, `${item.name} moved to Things to do`),
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
 * "Etkinliklere taşı": it needs a ticket after all; it goes to Etkinlikler and counts as a booking.
 * A to-do becomes a thing to do with a ticket (an activity), so the Plan doesn't call it "Yapılacak".
 */
export const asBooking = (item: Item): Item =>
  item.plannedKind === "todo" ? { ...item, plannedKind: "activity", category: "activity", booking: "needed" } : { ...item, booking: "needed" };
export const moveToBookings = (item: Item) =>
  change(item, asBooking, L(`${item.name} etkinliklere taşındı`, `${item.name} moved to activities`));
