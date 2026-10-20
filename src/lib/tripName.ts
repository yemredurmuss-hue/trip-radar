// The trip's title, the way a traveller would name it (2026-10-19, Emre): how long, where, and what kind of trip, in
// their own words. "7 Günlük Hurgada Dalış Gezisi", "15 Günlük Bali Balayı", "Lizbon Hafta Sonu Kaçamağı". The kind is
// the model's title_theme when it reads right (no place, no number, a few words), else the rules' from what the start
// chat already knows (its playbook, the way there, who goes, the styles). Nothing not known is said: no length when
// none was said, no year (the dates are on the card).
import { L } from "./i18n";
import { startPlaybook } from "./playbooks";
import { normWords } from "./startEvents";
import type { StartState } from "./startTrip";

/** Longer than this, the theme word goes first, then the length. */
export const TITLE_MAX = 42;

export type TitleState = Pick<StartState, "where" | "intent"> & Partial<Pick<StartState, "messages" | "duration" | "who" | "styles" | "way" | "dayTrip" | "playbook" | "route">>;

/** Each word's first letter capital, in the title's language ("dalış gezisi" → "Dalış Gezisi"). */
const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase(L("tr", "en")) + w.slice(1) : w))
    .join(" ");

/** "AfrikaBurn 2027" → "AfrikaBurn": the year is the card's dates' to say. */
const withoutYear = (name: string) => name.replace(/\s+(19|20)\d{2}$/, "").trim();

/** The place part: the event's name, a theme's place, or where they go (the country said first, as the old title). */
function placeOf(s: TitleState): string {
  const it = s.intent;
  if (it?.kind === "event") return withoutYear(it.name);
  if (it?.kind === "place") return `${it.name} ${it.place}`.trim();
  const here = (s.where?.within || s.where?.place || it?.place || "").trim();
  // P9 (F08): a trip named by one city ("Porto") whose route goes on to another is named by both ("Porto ve Lizbon"),
  // by its country with more stops; a region, a country or a theme said (Bali, Japonya, kiraz çiçekleri) keeps its name.
  const stops = [...new Set((s.route?.stops ?? []).map((x) => x.city.trim()).filter(Boolean))];
  const plain = (a: string) => normWords(a).join(" ");
  if (!it && stops.length >= 2 && stops.some((x) => plain(x) === plain(here))) {
    if (stops.length === 2) return L(`${stops[0]} ve ${stops[1]}`, `${stops[0]} and ${stops[1]}`);
    if (s.where?.country) return s.where.country;
  }
  return here;
}

/** "7 Günlük", "3 Haftalık"; null with no length said (and no event dates to count). */
function lengthOf(s: TitleState, days: number | null): string | null {
  const d = s.duration;
  if (d?.unit === "day") return L(`${d.n} Günlük`, `${d.n}-Day`);
  if (d?.unit === "night") return L(`${d.n + 1} Günlük`, `${d.n + 1}-Day`);
  if (d?.unit === "week") return L(`${d.n} Haftalık`, `${d.n}-Week`);
  if (d?.unit === "month") return L(`${d.n} Aylık`, `${d.n}-Month`);
  if (!d && days && days > 1) return L(`${days} Günlük`, `${days}-Day`);
  return null;
}

/** About how many days, for the short ones ("a getaway"). */
function dayCount(s: TitleState, days: number | null): number | null {
  const d = s.duration;
  if (!d) return days;
  return d.unit === "day" ? d.n : d.unit === "night" ? d.n + 1 : d.unit === "weekend" ? 2 : d.unit === "week" ? d.n * 7 : 30 * d.n;
}

/**
 * The model's title theme, checked: one to three words, no number, never the place or the event again ("Bali Balayı"
 * for Bali would say Bali twice). Null when it doesn't read as one.
 */
export function cleanTheme(raw: string | null | undefined, place: string): string | null {
  const t = (raw ?? "").replace(/["“”«»().,;:!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 28 || /\d/.test(t)) return null;
  const words = t.split(" ");
  if (words.length > 3) return null;
  const own = new Set(normWords(place));
  if (normWords(t).some((w) => own.has(w))) return null;
  // P9 (F08): "Şehir Turu" reads as one tour to buy, not the trip.
  if (normWords(t).some((w) => w === "turu" || w === "tour")) return null;
  return titleCase(t);
}

type Noun = "trip" | "getaway" | "adventure" | "holiday";
const NOUN: Record<Noun, () => string> = {
  trip: () => L("Gezisi", "Trip"),
  getaway: () => L("Kaçamağı", "Getaway"),
  adventure: () => L("Macerası", "Adventure"),
  holiday: () => L("Tatili", "Holiday"),
};

/** The rules' ending when the model gave none: [the theme word, or null; the noun]. */
function rulesEnding(s: TitleState, short: boolean): [string | null, string] {
  const it = s.intent;
  // A theme (Kuzey Işıkları, Kiraz Çiçekleri): its name is the theme.
  if (it?.kind === "theme") return [it.name, NOUN.trip()];
  if (it?.kind === "place") return [null, ""];
  switch (startPlaybook({ intent: s.intent, messages: s.messages ?? [], playbook: s.playbook })) {
    case "honeymoon":
      return [null, L("Balayı", "Honeymoon")];
    case "festival":
      return it?.kind === "event" && /fest/i.test(it.name) ? [null, L("Deneyimi", "Experience")] : [L("Festival", "Festival"), L("Deneyimi", "Experience")];
    case "ski":
      return [L("Kayak", "Ski"), NOUN.holiday()];
    case "cruise":
      return [null, L("Kruvaziyeri", "Cruise")];
    case "wellness":
      return [L("Wellness", "Wellness"), L("Tatili", "Retreat")];
    case "road":
      return [null, L("Yol Macerası", "Road Trip")];
  }
  if (s.way === "car") return [null, L("Yol Macerası", "Road Trip")];
  if (s.way === "train") return [L("Tren", "Rail"), NOUN.trip()];
  const styles = s.styles ?? [];
  // An event's days are short because the event is: never "a getaway" (Holi).
  const noun: Noun = short && !it ? "getaway" : styles.some((x) => x === "adventure" || x === "active") ? "adventure" : styles.some((x) => x === "beach" || x === "calm" || x === "luxury") ? "holiday" : "trip";
  const who = s.who?.kind;
  if (who === "family") return [L("Aile", "Family"), NOUN[noun]()];
  if (who === "friends") return [L("Arkadaş", "Friends"), NOUN[noun]()];
  if (who === "partner" && styles.includes("romantic")) return [L("Romantik", "Romantic"), NOUN[noun]()];
  const first = styles.find((x) => x in STYLE_WORD);
  return [first ? STYLE_WORD[first]!() : null, NOUN[noun]()];
}

/** A style as the title's theme word (the ones its noun already says, adventure or calm, say nothing more). */
const STYLE_WORD: Partial<Record<string, () => string>> = {
  culture: () => L("Kültür", "Culture"),
  food: () => L("Gastronomi", "Food"),
  nature: () => L("Doğa", "Nature"),
  beach: () => L("Deniz", "Beach"),
  nightlife: () => L("Eğlence", "Party"),
  luxury: () => L("Lüks", "Luxury"),
  city: () => L("Şehir", "City"),
};

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/**
 * The trip's title from what the start chat knows. `days`: the event's own days when no length was said (its dates
 * come with it).
 */
export function tripName(s: TitleState, days: number | null = null): string {
  const place = placeOf(s);
  const weekend = s.duration?.unit === "weekend";
  const dayTrip = Boolean(s.dayTrip);
  const n = dayCount(s, days);
  const short = weekend || dayTrip || (n != null && n <= 3);
  const model = cleanTheme(s.playbook?.titleTheme, place);
  const [word, noun] = model ? [null, model] : rulesEnding(s, short);

  if (!place) return join([word, noun]) || L("Yeni gezi", "New trip");
  if (dayTrip) return join([place, word, L("Günübirlik Gezisi", "Day Trip")]);
  // P9 (F56): "bu cuma … 3 gecelik kaçamak" is a weekend getaway by its words, whatever its nights are written as.
  const said = (s.messages ?? []).filter((m) => m.role === "user").map((m) => m.text).join(" ");
  const saidWeekend = n != null && n <= 4 && /hafta ?sonu|weekend|\bcuma\b|friday/i.test(said);
  const saidGetaway = n != null && n <= 5 && /ka[çc]amak|getaway/i.test(said);
  if (weekend || saidWeekend) return join([place, L("Hafta Sonu", "Weekend"), model ?? NOUN.getaway()]);
  if (saidGetaway && !model) return join([place, word, NOUN.getaway()]);

  const length = lengthOf(s, days);
  // Too long: the theme word goes, then the length; the place and the kind always stay.
  for (const parts of [[length, place, word, noun], [length, place, noun], [place, word, noun], [place, noun]]) {
    const t = join(parts);
    if (t.length <= TITLE_MAX) return t;
  }
  return join([place, noun]);
}
