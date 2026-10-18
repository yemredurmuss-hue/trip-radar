// Öneriler (spec docs/superpowers/specs/2026-10-06-oneriler-ve-sohbetle-gezi-design.md §1): a soft card at the top
// of its section — ✨ · title · one sentence why · [Plana ekle] [Gerek yok]. A suggestion is never part of the plan:
// it isn't counted in a section's "3/4", the hero's tallies or Günlük akış (nothing here touches categorize()).
//
// Three sources, one list, deduplicated by key:
//  1. rules (here, pure): worked out from the trip on every render, gone by themselves once resolved; only what the
//     traveller did with one ("Plana ekle", "Gerek yok") is stored;
//  2. the AI review (suggestReview.ts) and 3. the chat's `suggest` tool: stored on the trip as they come.
// "Gerek yok" is for good: a dismissed key never comes back from any source, and a dismissed vehicle, insurance or
// eSIM suggestion keeps its whole topic away, a rule's included (the monthly rental keyed by another main place
// after the places regroup stays gone). Pure: the writes are app/actions.ts.
import { countryOfAirport } from "./airports";
import { esimInCountry } from "./chatBooking";
import type { SectionId } from "./categories";
import { mainPlaces, placesKey, resolveParents, type MainPlace } from "./destinations";
import { countryCodesOf, countryNames } from "./heroInfo";
import { L } from "./i18n";
import { locative } from "./i18nText";
import { formatDateRange, isoDate } from "./items";
import { buildLegs, isHiddenLeg, type Leg } from "./legs";
import { buildPlan, cityKeyOf, type Plan } from "./plan";
import { ALL_PLANNED_KINDS, checkPlanned, plannedItem, type PlannedInput } from "./planned";
import { allowedSuggestions } from "./playbooks";
import { TEMPLATES, type TemplateId } from "./templates";
import { buildTimeline, nightsKey, type Timeline } from "./timeline";
import { ESIM_WORDS, isInsurance } from "./travelKinds";
import type { Item, Listing, Suggestion, SuggestionKind, SuggestionSection, SuggestionState, Trip } from "./types";
import { overlaps, periodOf, vehicleOf } from "./vehicles";

export type { Suggestion, SuggestionKind, SuggestionSection, SuggestionState };

/** Where a suggestion can sit, in the Plan's order (İlham is filled by sending links, never suggested). */
export const SUGGESTION_SECTIONS: readonly SuggestionSection[] = ["flight", "stay", "transport", "activity", "todo", "food", "other"];
export const SUGGESTION_KINDS: readonly SuggestionKind[] = ["add", "warning"];

/** The templates "Plana ekle" may use in each section: the section's own "+ Ekle" tiles (plan/sectionMeta.ts). */
export const SECTION_TEMPLATES: Readonly<Record<SuggestionSection, readonly TemplateId[]>> = {
  flight: ["flight"],
  stay: ["hotel", "home"],
  transport: ["train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike"],
  activity: ["activity"],
  todo: ["todo"],
  food: ["food"],
  other: ["esim", "insurance"],
};
export const SUGGESTION_TEMPLATES: readonly TemplateId[] = [...new Set(Object.values(SECTION_TEMPLATES).flat())];

export const isSuggestionSection = (id: string): id is SuggestionSection => (SUGGESTION_SECTIONS as readonly string[]).includes(id);

/** The section a template's record lands in. */
export const sectionOfTemplate = (id: string): SuggestionSection | null =>
  SUGGESTION_SECTIONS.find((s) => (SECTION_TEMPLATES[s] as readonly string[]).includes(id)) ?? null;

/**
 * What a suggestion is about when only one of it makes sense on a trip: a vehicle for the days, insurance, an eSIM.
 * The same topic from another source (the chat after a rule) isn't shown twice, and one said "Gerek yok" stays gone.
 */
export function topicOf(s: Pick<Suggestion, "template">): "vehicle" | "insurance" | "esim" | null {
  if (s.template === "car" || s.template === "moto" || s.template === "rv") return "vehicle";
  if (s.template === "insurance" || s.template === "esim") return s.template;
  return null;
}

// --- rules -------------------------------------------------------------------------------------------

export interface RuleInput {
  trip: Pick<Trip, "confirmedDates" | "hidden" | "intent">;
  plan: Pick<Plan, "range" | "stayBlocks">;
  items: Item[];
  timeline: Pick<Timeline, "entries">;
  legs: Leg[];
  /** The hero's main places (destinations.ts); the stay cities stand for themselves when empty. */
  mains: MainPlace[];
  /**
   * The traveller's own country (passport, ISO alpha-2), only when they set it in Settings: a trip elsewhere is
   * abroad. Null (never set): the country the first flight leaves from (homeFromFlights); with no such flight,
   * nothing is said about insurance or an eSIM, rather than guess from a default.
   */
  home: string | null;
  today: string;
}

/** A stay in one main place this long or longer suggests renting a vehicle by the month. */
export const LONG_STAY_NIGHTS = 21;
/** A connection between two separately booked flights shorter than this is a warning. */
export const SHORT_LAYOVER_MIN = 60;
/** Countries where getting around by scooter is the usual thing (the monthly rental is a scooter there, else a car). */
const SCOOTER_COUNTRIES = new Set(["ID", "TH", "VN", "KH", "LA", "MY", "PH", "LK", "IN", "TW"]);

const live = (i: Item) => i.status !== "dismissed";
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** A transfer note that says a shuttle is there (legs.ts SHUTTLE, or the traveller's own note). */
const SHUTTLE_NOTE = /havaliman[ıi] servisi|airport shuttle|shuttle|servis var/i;
/** 22:00 to 04:59: a landing at night. */
const atNight = (hhmm: string | null) => !!hhmm && /^\d{2}:\d{2}$/.test(hhmm) && (minutesOf(hhmm) >= 22 * 60 || minutesOf(hhmm) < 5 * 60);

function rule(key: string, section: SuggestionSection, kind: SuggestionKind, title: string, why: string, template?: TemplateId, payload?: Suggestion["payload"]): Suggestion {
  return { key, section, kind, title, why, source: "rule", ...(template ? { template } : {}), ...(payload ? { payload } : {}), createdAt: 0, state: "open" };
}

/**
 * Two flights that look booked apart: saved from different pages, or different captures, or sold by different
 * providers. Two plans said in the chat (no page, no provider) can't be told apart: not a warning then.
 */
function separatelyBooked(a: Item, b: Item): boolean {
  if (a.url && b.url && a.url !== b.url) return true;
  if (a.captureIds.length && b.captureIds.length && !a.captureIds.some((c) => b.captureIds.includes(c))) return true;
  return Boolean(a.provider && b.provider && a.provider.trim().toLowerCase() !== b.provider.trim().toLowerCase());
}

const msOf = (iso: string | null | undefined) => (iso && iso.length >= 16 ? Date.parse(`${iso.slice(0, 16)}:00Z`) : NaN);

/** A flight landing where another flight leaves within 24 h: that airport is a connection, not a place visited. */
function isTransit(f: Item, flights: Item[]): boolean {
  const at = f.flight?.to?.trim().toUpperCase();
  const lands = msOf(f.flight?.arrival);
  if (!at || !Number.isFinite(lands)) return false;
  return flights.some((g) => {
    if (g.id === f.id || g.flight?.from?.trim().toUpperCase() !== at) return false;
    const leaves = msOf(g.flight?.departure);
    return Number.isFinite(leaves) && leaves >= lands && leaves - lands <= 24 * 60 * 60_000;
  });
}

/**
 * Home when no passport was set: the country of the airport the trip's first flight leaves from (SAW, IST → TR).
 * Null when there's no flight with a known airport: nothing is said about going abroad then.
 */
export function homeFromFlights(items: Item[]): string | null {
  const first = items
    .filter((i) => live(i) && i.category === "flight" && i.flight?.from)
    .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "9").localeCompare(b.flight?.departure ?? b.dates.start ?? "9"))[0];
  return countryOfAirport(first?.flight?.from) ?? null;
}

/** The trip's countries other than home: its places' (stays, plans) and where its flights land (connections aside). */
export function foreignCountries(items: Item[], home: string): string[] {
  const own = home.trim().toUpperCase();
  const flights = items.filter((i) => live(i) && i.category === "flight");
  const landed = flights.filter((f) => !isTransit(f, flights)).map((i) => countryOfAirport(i.flight?.to));
  const codes = [...countryCodesOf(items), ...landed.filter((c): c is string => !!c).map((c) => c.toUpperCase())];
  return [...new Set(codes)].filter((c) => /^[A-Z]{2}$/.test(c) && c !== own);
}

/**
 * The rules' suggestions for the trip as it is now (spec §1.1). A short, fixed list; each disappears by itself once
 * what it asks for is on the plan (or the trip is over). Times and numbers in them come from the plan, never guessed.
 */
export function ruleSuggestions({ trip, plan, items, timeline, legs, mains, home, today }: RuleInput): Suggestion[] {
  const range = plan.range ?? trip.confirmedDates ?? null;
  if (range && range.end < today) return [];
  const out: Suggestion[] = [];

  // Flights: two separately booked flights with a short connection.
  const flights = items.filter((i) => live(i) && i.category === "flight" && (i.status === "chosen" || i.status === "booked") && i.flight);
  for (const a of flights) {
    for (const b of flights) {
      const at = a.flight!.to?.trim().toUpperCase();
      if (a.id === b.id || !at || at !== b.flight!.from?.trim().toUpperCase() || !separatelyBooked(a, b)) continue;
      const lands = a.flight!.arrival;
      const leaves = b.flight!.departure;
      if (!lands || !leaves || lands.length < 16 || leaves.length < 16) continue;
      const gap = Math.round((Date.parse(`${leaves.slice(0, 16)}:00Z`) - Date.parse(`${lands.slice(0, 16)}:00Z`)) / 60_000);
      if (!Number.isFinite(gap) || gap < 0 || gap >= SHORT_LAYOVER_MIN) continue;
      out.push(
        rule(
          `rule:short-layover:${a.id}:${b.id}`,
          "flight",
          "warning",
          L(`Kısa aktarma: ${gap} dk (${at})`, `Short layover: ${gap} min (${at})`),
          L(
            `${a.name} ile ${b.name} ayrı biletlerse ilki gecikince bağlantı korunmaz; tek biletse havayolu yeniden yerleştirir.`,
            `If ${a.name} and ${b.name} are separate tickets, a late first flight doesn't protect the connection; on one ticket the airline rebooks you.`,
          ),
        ),
      );
    }
  }

  // Konaklama: open nights, only when the board doesn't already show them as an empty block (never twice).
  const hidden = new Set(trip.hidden ?? []);
  for (const b of plan.stayBlocks) {
    if (b.kind !== "open" || b.groups.length || hidden.has(nightsKey(b.range)) || b.range.end <= today) continue;
    const shown = timeline.entries.some((e) => e.kind === "stay" && !e.skipped && e.block.kind === "open" && e.block.range.start === b.range.start);
    if (shown) continue;
    const where = b.city ? `${b.city} ` : "";
    out.push(
      rule(
        `rule:find-stay:${b.range.start}_${b.range.end}`,
        "stay",
        "add",
        L(`Konaklama bul · ${where}${formatDateRange(b.range.start, b.range.end)}`, `Find a stay · ${where}${formatDateRange(b.range.start, b.range.end)}`),
        L(`Bu ${b.nights} gece için planda kalacak yer yok.`, `There's no place to stay on the plan for these ${b.nights} nights.`),
        "hotel",
        { city: b.city, start: b.range.start, end: b.range.end },
      ),
    );
  }

  // Ulaşım: a landing at night with no transfer planned for it.
  for (const leg of legs) {
    if (leg.kind !== "arrival" || leg.status !== "empty" || !atNight(leg.after) || leg.date < today || isHiddenLeg(leg, trip.hidden)) continue;
    // A rental picked up that day (the car is the way from the airport), or a shuttle the stay's page offers.
    if (items.some((i) => live(i) && vehicleOf(i) && periodOf(i)?.start === leg.date)) continue;
    if (leg.notes.some((n) => SHUTTLE_NOTE.test(n)) || (leg.choice?.note && SHUTTLE_NOTE.test(leg.choice.note))) continue;
    const byAir = (leg.via ?? leg.travel?.mode ?? null) === "flight";
    out.push(
      rule(
        `rule:night-arrival-taxi:${leg.date}`,
        "transport",
        "add",
        byAir ? L("Havalimanı transferi · Taksi", "Airport transfer · Taxi") : L("İstasyon transferi · Taksi", "Station transfer · Taxi"),
        L(
          `Varış ${leg.after}; bu saatte toplu taşıma seyrek olabilir ve transfer henüz planlanmadı.`,
          `You arrive at ${leg.after}; public transport may be sparse then, and no transfer is planned yet.`,
        ),
        "taxi",
        { city: leg.to.city, start: leg.date, time: leg.after },
      ),
    );
  }

  // Ulaşım: a long stay in one place with no vehicle for those days.
  const places = mains.length
    ? mains
    : [...new Map(plan.stayBlocks.filter((b) => b.city).map((b) => [cityKeyOf(b.city), { name: b.city!, members: [b.city!] }])).values()];
  for (const place of places) {
    const keys = new Set([place.name, ...place.members].map(cityKeyOf).filter(Boolean));
    const blocks = plan.stayBlocks.filter((b) => b.city && keys.has(cityKeyOf(b.city)));
    const nights = blocks.reduce((n, b) => n + b.nights, 0);
    if (nights < LONG_STAY_NIGHTS) continue;
    const start = blocks.map((b) => b.range.start).sort()[0];
    const end = blocks.map((b) => b.range.end).sort().at(-1)!;
    if (end <= today) continue;
    const covered = items.some((i) => live(i) && vehicleOf(i) && overlaps(periodOf(i), { start, end }));
    if (covered) continue;
    const country = items.find((i) => live(i) && i.countryCode && i.city && keys.has(cityKeyOf(i.city)))?.countryCode?.toUpperCase();
    out.push(
      rule(
        `rule:monthly-vehicle:${cityKeyOf(place.name)}`,
        "transport",
        "add",
        L("Aylık motor ya da araç kiralama", "A monthly scooter or car rental"),
        L(
          `${nights} gece ${locative(place.name)} kalıyorsun; aylık kiralama günlükten genellikle çok daha ucuzdur.`,
          `You're staying ${nights} nights in ${place.name}; renting by the month is usually much cheaper than by the day.`,
        ),
        country && SCOOTER_COUNTRIES.has(country) ? "moto" : "car",
        { city: place.name, start, end },
      ),
    );
  }

  // Diğer: abroad without travel health insurance, or without an eSIM.
  const own = home ?? homeFromFlights(items);
  const abroad = own ? foreignCountries(items, own) : [];
  if (abroad.length) {
    const names = countryNames(abroad);
    if (!items.some((i) => live(i) && isInsurance(i))) {
      out.push(
        rule(
          "rule:insurance",
          "other",
          "add",
          L("Seyahat sağlık sigortası", "Travel health insurance"),
          L(`Yurt dışına çıkıyorsun (${names.join(", ")}); planda seyahat sağlık sigortası yok.`, `You're going abroad (${names.join(", ")}); there's no travel health insurance on the plan.`),
          "insurance",
          { start: range?.start ?? null, end: range?.end ?? null, title: L("Seyahat sağlık sigortası", "Travel health insurance") },
        ),
      );
    }
    const esim = items.some((i) => live(i) && (i.category === "esim" || i.plannedKind === "esim" || ESIM_WORDS.test(i.name)));
    if (!esim) {
      const title = `eSIM (${names.join(", ")})`;
      out.push(
        rule(
          "rule:esim",
          "other",
          "add",
          title,
          L(`Planda eSIM yok; bir eSIM ile ${locative(names[0])} iner inmez internetin olur.`, `There's no eSIM on the plan; with one you're online as soon as you land in ${names[0]}.`),
          "esim",
          { start: range?.start ?? null, end: range?.end ?? null, title },
        ),
      );
    }
  }

  // What doesn't belong on this kind of trip (playbooks/: no tours on a festival trip) never comes up.
  return sortSuggestions(allowedSuggestions(trip.intent, out));
}

/**
 * The rules for a trip as the board works them out, from the stored trip alone (for the chat, which has no board):
 * the plan, its transfers and front, and the hero's main places (the model's answer kept on the trip when it's for
 * these places, else the guess from addresses and the table of regions).
 */
export function boardRules(trip: Trip, items: Item[], home: string | null, today: string, listings?: Map<string, Listing>): Suggestion[] {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip, listings);
  const timeline = buildTimeline(plan, legs, items, new Set(trip.hidden ?? []));
  const seen = new Map<string, string>();
  for (const b of plan.stayBlocks) if (b.city && !seen.has(cityKeyOf(b.city)!)) seen.set(cityKeyOf(b.city)!, b.city);
  if (!seen.size) for (const i of items) if (live(i) && i.category === "stay" && i.city && !seen.has(cityKeyOf(i.city)!)) seen.set(cityKeyOf(i.city)!, i.city);
  const cities = [...seen.values()];
  const known = trip.placeParents?.key === placesKey(cities) ? trip.placeParents.parents : null;
  const mains = mainPlaces(cities, resolveParents(cities, items, known));
  return ruleSuggestions({ trip, plan, items, timeline, legs, mains, home, today });
}

// --- what's shown, and what the traveller did ---------------------------------------------------------

const ORDER = new Map<string, number>(SUGGESTION_SECTIONS.map((s, i) => [s, i]));
const sortSuggestions = (list: Suggestion[]): Suggestion[] =>
  [...list].sort((a, b) => (ORDER.get(a.section) ?? 99) - (ORDER.get(b.section) ?? 99) || a.createdAt - b.createdAt);

/** The days a suggestion's record would cover (its payload), or null when it says none (it can't be ruled out). */
const payloadPeriod = (s: Suggestion) => periodOf({ dates: { start: s.payload?.start ?? null, end: s.payload?.end ?? null, source: "none" } });

/**
 * What's already on the plan for a suggestion's topic: a live vehicle for its days (a car, a scooter, a campervan:
 * vehicles.ts, the same guard the chat's plan_item has), a policy, an eSIM. Empty when none (or no topic).
 */
export function coveringItems(s: Suggestion, items: readonly Item[]): Item[] {
  const topic = topicOf(s);
  if (topic === "vehicle") {
    const days = payloadPeriod(s);
    return items.filter((i) => live(i) && vehicleOf(i) && overlaps(periodOf(i), days));
  }
  if (topic === "insurance") return items.filter((i) => live(i) && isInsurance(i));
  if (topic === "esim") return items.filter((i) => live(i) && (i.category === "esim" || i.plannedKind === "esim" || ESIM_WORDS.test(i.name)));
  return [];
}

/**
 * The open suggestions on the board: the rules' (unless the traveller already added or dismissed that key, or
 * dismissed its topic) and the stored ones from the AI and the chat (unless a rule covers the same topic, that topic
 * was dismissed, or the plan already has it: a vehicle for those days, a policy, an eSIM).
 */
export function shownSuggestions(stored: readonly Suggestion[] | undefined, rules: readonly Suggestion[], items: readonly Item[] = []): Suggestion[] {
  const list = stored ?? [];
  const acted = new Map(list.map((s) => [s.key, s]));
  const dismissedTopics = new Set(list.filter((s) => s.state === "dismissed").map(topicOf).filter(Boolean));
  const fromRules = rules.filter((r) => (acted.get(r.key)?.state ?? "open") === "open" && !dismissedTopics.has(topicOf(r)));
  const ruleTopics = new Set([...fromRules, ...list.filter((s) => s.source === "rule")].map(topicOf).filter(Boolean));
  const seen = new Set(fromRules.map((r) => r.key));
  const others = list.filter((s) => {
    if (s.source === "rule" || s.state !== "open" || seen.has(s.key)) return false;
    seen.add(s.key);
    const topic = topicOf(s);
    return !(topic && (ruleTopics.has(topic) || dismissedTopics.has(topic) || coveringItems(s, items).length));
  });
  return sortSuggestions([...fromRules, ...others]);
}

/** The shown suggestions by section, for the Plan's headers ("1 öneri") and cards. */
export function bySection(list: readonly Suggestion[]): Partial<Record<SectionId, Suggestion[]>> {
  const out: Partial<Record<SectionId, Suggestion[]>> = {};
  for (const s of list) (out[s.section] ??= []).push(s);
  return out;
}

/** The header's count: "1 öneri", "2 öneri". */
export const suggestionCount = (n: number): string => L(`${n} öneri`, n === 1 ? "1 suggestion" : `${n} suggestions`);

/**
 * The stored list after the traveller acted on a suggestion. A rule's suggestion put back to open is taken out of the
 * list again (the rule shows it while it still holds); an AI or chat suggestion keeps its record with the new state.
 */
export function withState(stored: readonly Suggestion[] | undefined, s: Suggestion, state: SuggestionState, now: number): Suggestion[] {
  const list = [...(stored ?? [])];
  if (s.source === "rule" && state === "open") return list.filter((x) => x.key !== s.key);
  const at = list.findIndex((x) => x.key === s.key);
  const next: Suggestion = { ...(at >= 0 ? list[at] : s), state, stateAt: now };
  if (at >= 0) list[at] = next;
  else list.push(next);
  return list;
}

/** What became of a suggestion handed in (the chat's tool result says it truthfully). */
export type MergeOutcome = "added" | "already_there" | "dismissed_before";

/** New suggestions (AI, chat) into the stored list; a key already there, or a topic dismissed, isn't added again. */
export function mergeIncoming(stored: readonly Suggestion[] | undefined, incoming: readonly Suggestion[]): { list: Suggestion[]; outcomes: MergeOutcome[] } {
  const list = [...(stored ?? [])];
  const outcomes: MergeOutcome[] = [];
  for (const s of incoming) {
    const there = list.find((x) => x.key === s.key);
    const topic = topicOf(s);
    if (there) outcomes.push(there.state === "dismissed" ? "dismissed_before" : "already_there");
    else if (topic && list.some((x) => x.state === "dismissed" && topicOf(x) === topic)) outcomes.push("dismissed_before");
    else {
      list.push({ ...s, state: "open" });
      outcomes.push("added");
    }
  }
  return { list, outcomes };
}

// --- a suggestion said by the model (the chat's tool, the AI review) ---------------------------------------

/** What the model sends: every field a string ("" when it has nothing to say), as the strict schema asks. */
export interface SuggestionInput {
  section: string;
  kind: string;
  title: string;
  why: string;
  template: string;
  city: string;
  start: string;
  end: string;
}

const CLOCK = /(?<!\d)\d{1,2}[:.]\d{2}(?!\d)/;
/** A currency sign anywhere is a price. */
const MONEY_SIGN = /[€$£₺¥฿₹₫₩₱₦₴₽]/u;
/** Words and codes for money: next to a number they're a price ("Rp 500.000", "2 juta", "80 kr", "50 CHF"). */
const MONEY_WORD =
  "eur|euros?|usd|gbp|try|tl|lira(?:s[ıi])?|dolar|dollars?|idr|rp|rupiah|juta|ribu|vnd|dong|đồng|rm|myr|ringgit|inr|rupees?|rs|kr|sek|nok|dkk|chf|frank|francs?|yen|jpy|baht|thb|php|peso|pesos|won|krw|aud|cad|sgd|zar|aed|dirham";
const MONEY_NEAR = new RegExp(`\\d[\\d.,]*\\s*(?:${MONEY_WORD})(?![\\p{L}])|(?<![\\p{L}])(?:${MONEY_WORD})\\s*\\d`, "iu");
/** These read as money even with no number ("birkaç euro", "a few dollars"). */
const MONEY_ALONE = /(?<![\p{L}])(?:euro|euros|dolar|dollars?|lira|rupiah|baht|juta|rupees?|yen)(?![\p{L}])/iu;
const isMoney = (text: string) => MONEY_SIGN.test(text) || MONEY_NEAR.test(text) || MONEY_ALONE.test(text);
const PERCENT = /%|(?<![\p{L}])(?:yüzde|percent)(?![\p{L}])/iu;
/** Two sentences: an end mark followed by more text. */
const TWO_SENTENCES = /[.!?]\s+\S/;

const slug = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Filler words a model varies between two wordings of the same thing. */
const FILLER = new Set(["ve", "ile", "icin", "bir", "the", "and", "for", "with", "of", "to", "in", "at", "a", "an", "de", "da", "gezisi", "turu", "tour", "trip", "visit", "ziyaret", "ziyareti", "yap", "git", "gidin", "go"]);

/**
 * A suggestion's key: its section and topic (a vehicle, insurance, an eSIM: one per trip, whatever the wording), else
 * its template and the title's words, filler aside and sorted ("Tegallalang pirinç terasları" = "Pirinç terasları,
 * Tegallalang"). Not the title as written: the same thing said twice keeps one key, so "Gerek yok" holds.
 */
export function suggestionKey(source: Suggestion["source"], section: SuggestionSection, kind: SuggestionKind, template: string, title: string): string {
  const topic = topicOf({ template });
  if (topic) return `${source}:${section}:${topic}`;
  const words = [...new Set(slug(title).split("-").filter((w) => w.length > 1 && !FILLER.has(w)))].sort();
  return `${source}:${section}:${template || kind}:${words.join("-") || slug(title)}`;
}

/**
 * A suggestion from the model, checked: an allowed section and kind, a template of that section (one is picked when
 * the section has only one), a short title, a one-sentence why, valid days, and no price, time or percentage it could
 * have made up. The reason as a string when it doesn't pass.
 */
export function checkSuggestionInput(raw: Partial<Record<keyof SuggestionInput, unknown>>, source: "ai" | "chat", now: number): Suggestion | string {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const section = str(raw.section);
  if (!isSuggestionSection(section)) return L(`Geçersiz bölüm: "${section}". Olanlar: ${SUGGESTION_SECTIONS.join(", ")}.`, `Invalid section: "${section}". Allowed: ${SUGGESTION_SECTIONS.join(", ")}.`);
  const kind = str(raw.kind) as SuggestionKind;
  if (!SUGGESTION_KINDS.includes(kind)) return L(`Geçersiz tür: "${kind}" (add ya da warning).`, `Invalid kind: "${kind}" (add or warning).`);
  const title = str(raw.title);
  const why = str(raw.why);
  if (!title || title.length > 80) return L("title kısa olmalı (1–80 karakter).", "title must be short (1–80 characters).");
  if (!why || why.length > 200) return L("why tek kısa cümle olmalı (1–200 karakter).", "why must be one short sentence (1–200 characters).");
  if (TWO_SENTENCES.test(why)) return L("why tek cümle olmalı.", "why must be a single sentence.");
  const text = `${title} ${why}`;
  if (CLOCK.test(text) || isMoney(text) || PERCENT.test(text)) {
    return L("Öneride fiyat, saat ya da yüzde olmaz (uydurma olabilir); yalnız olguları yaz.", "No prices, times or percentages in a suggestion (they could be made up); state facts only.");
  }
  let template = str(raw.template);
  const allowed = SECTION_TEMPLATES[section] as readonly string[];
  if (kind === "warning") {
    if (template) return L("Bir uyarının şablonu olmaz (template \"\").", "A warning has no template (template \"\").");
  } else {
    if (!template && allowed.length === 1) template = allowed[0];
    if (!template) return L(`Bu bölüm için template gerekli: ${allowed.join(", ")}.`, `This section needs a template: ${allowed.join(", ")}.`);
    if (!allowed.includes(template)) {
      const home = sectionOfTemplate(template);
      return home
        ? L(`"${template}" ${home} bölümünün şablonu; section'ı ${home} yap.`, `"${template}" belongs to the ${home} section; set section to ${home}.`)
        : L(`Geçersiz şablon: "${template}". Bu bölümde: ${allowed.join(", ")}.`, `Invalid template: "${template}". In this section: ${allowed.join(", ")}.`);
    }
  }
  const start = str(raw.start);
  const end = str(raw.end);
  if ((start && !isoDate(start)) || (end && !isoDate(end))) return L("start/end YYYY-MM-DD ya da boş olmalı.", "start/end must be YYYY-MM-DD or empty.");
  if (start && end && end < start) return L("end, start'tan önce olamaz.", "end can't be before start.");
  const city = str(raw.city).slice(0, 60);
  return {
    key: suggestionKey(source, section, kind, template, title),
    section,
    kind,
    title,
    why,
    source,
    ...(template ? { template } : {}),
    payload: { city: city || null, start: start || null, end: end || null, title },
    createdAt: now,
    state: "open",
  };
}

// --- "Plana ekle" --------------------------------------------------------------------------------------

/** Templates whose record is named by the suggestion (an idea, a restaurant, a policy, an eSIM); the rest by kind and place. */
const NAMED_BY_TITLE: readonly TemplateId[] = ["activity", "todo", "food", "esim", "insurance"];

/**
 * What "Plana ekle" does: the record itself when the payload makes a whole one, else the template's add sheet opened
 * where it belongs (a flight or a train needs both ends: never "Lombok → ?"; a stay needs its nights). Null for a
 * warning (nothing to add).
 */
export type SuggestedAdd = { kind: "item"; item: Item } | { kind: "sheet"; template: TemplateId; at: { city: string | null; date: string | null } };

export function suggestedAdd(s: Suggestion, tripId: string, id: string, now: number): SuggestedAdd | null {
  const tpl = s.kind === "add" ? TEMPLATES.find((t) => t.id === s.template) : undefined;
  if (!tpl) return null;
  const item = suggestedItem(s, tripId, id, now)!;
  const input = inputOf(s, tpl);
  const ends = tpl.form !== "trip" || tpl.kind === "taxi" || Boolean(input.from && input.to);
  const nights = tpl.form !== "stay" || Boolean(input.date && input.end_date);
  if (checkPlanned(input, ALL_PLANNED_KINDS, { complete: true }) || !ends || !nights) {
    return { kind: "sheet", template: tpl.id, at: { city: s.payload?.city?.trim() || null, date: isoDate(s.payload?.start ?? null) } };
  }
  return { kind: "item", item };
}

/**
 * The record a suggestion makes: its template, filled from its payload (city, days, a time for a taxi), planned
 * ("Planlanıyor") like a tile picked from "+ Ekle". Null for a warning. suggestedAdd says whether it's whole.
 */
export function suggestedItem(s: Suggestion, tripId: string, id: string, now: number): Item | null {
  const tpl = s.kind === "add" ? TEMPLATES.find((t) => t.id === s.template) : undefined;
  if (!tpl) return null;
  // An eSIM's place is its country (the suggestion's city is the first one), like one said in the chat.
  const made = esimInCountry(plannedItem(inputOf(s, tpl), tripId, id, now));
  return tpl.id === "todo" ? { ...made, booking: "none" } : made;
}

function inputOf(s: Suggestion, tpl: (typeof TEMPLATES)[number]): PlannedInput {
  const p = s.payload ?? {};
  const city = p.city?.trim() || null;
  const start = isoDate(p.start ?? null);
  const end = isoDate(p.end ?? null);
  const trip = tpl.form === "trip";
  return {
    kind: tpl.kind,
    date: start,
    end_date: tpl.form === "rental" || tpl.form === "stay" || tpl.id === "insurance" ? (end && start && end > start ? end : null) : null,
    time: trip && p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null,
    from: trip && tpl.kind !== "taxi" ? city : null,
    to: null,
    city: trip && tpl.kind !== "taxi" ? null : city,
    title: NAMED_BY_TITLE.includes(tpl.id) ? (p.title?.trim() || s.title) : null,
    booked: false,
    note: null,
  };
}
