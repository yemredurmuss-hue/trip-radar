// Plan v82's rows of cards (Etkinlik ve turlar, Yapılacaklar ve restoranlar; v82 geçişi aşama 4, izlenebilirlik 119-123):
// what each fixed 224 px card of a city's two rows says, and how the rows are laid out. A city's row is one intent
// (intents.ts collectionIntents): what's on the plan in "Planında", the rest in "Öneriler". Each card is one of four
// families (a ticket or a tour, a place to see, a restaurant, a note) in one of five states (an idea, on the plan, bought or
// a table booked, done, or a place the start opened that nobody has filled). Öneriler is one row of four cells: up to four
// cards, else three and "+n Pano'da"; Planında has every card on the plan, four across (Emre, 19 Ekim), and an empty
// Planında is four empty slots.
//
// Nothing is decided here: what's on the plan is intents.ts's, the facts cardFacts.ts's, the source's badge pano.ts's, the
// reason for the trip reason.ts's, the days and the done line ideas.ts's. This file only puts them in the cards' shape. Pure.
import { airportCities, cityOfAirport, countryOfAirport } from "./airports";
import { brandOf, type Brand } from "./brands";
import { cardFacts, durationText } from "./cardFacts";
import { ticketPrices } from "./cardTicket";
import { topDate } from "./cardView";
import { refFromNote } from "./bookingRows";
import { needsBooking } from "./booking";
import { citiesOfPlan, type SectionId } from "./categories";
import { L } from "./i18n";
import { num } from "./i18nText";
import { ideaKindOf, kindLabel } from "./ideaKinds";
import { dayChip, ideaMapUrl, ideaSource, ideaThumb, mealLabel, shortDay } from "./ideas";
import { sourceBadge } from "./intentFrame";
import type { IntentVM, OptionSource } from "./intents";
import { formatPrice, isoDate, placeMapUrl } from "./items";
import { clockOf } from "./legs";
import type { Offer } from "./offerSource";
import type { NearPlace } from "./offerSources";
import { adderOf } from "./pano";
import { cleanPlaceTitle, placeMapsUrl } from "./placeSuggest";
import { sameCity, type Plan } from "./plan";
import { reasonItemOf } from "./reason";
import type { Item, Suggestion, Trip } from "./types";

/** A row's cells (v82: four across), the last one "+n Pano'da" when there are more. */
export const ROW_CELLS = 4;

/** What a card is: a ticket or a tour (Etkinlik), a place to see, a restaurant, a note (Yapılacaklar). */
export type KFamily = "event" | "place" | "food" | "note";
/** Where a card stands: an idea, on the plan, bought (a table booked), done, a place the start opened still to fill (D3). */
export type KState = "idea" | "planned" | "booked" | "done" | "wanted";
/** Yapılacaklar' chips over Planında: Hepsi, Gezilecek, Restoranlar. */
export type KFilter = "all" | "go" | "food";
export const K_FILTERS: readonly KFilter[] = ["all", "go", "food"];

/** A bought ticket's or a booked table's way in (v81 alındı etkinlik): when, where to meet, its code, the map. */
export interface KAccess {
  /** "4 Nis 17:20", a table's "6 Nis akşam 19:30 · 2 kişi". */
  when: string | null;
  /** The meeting place: its address, else its area; never guessed. */
  where: string | null;
  code: { label: string; value: string } | null;
  map: string | null;
}

export interface KCardVM {
  /** Unique in the row: "i:<record id>", "s:<suggestion key>", "o:<offer id>". */
  key: string;
  item: Item | null;
  suggestion: Suggestion | null;
  offer: Offer | null;
  family: KFamily;
  state: KState;
  title: string;
  /** Its own photo; without one the family's drawing (`art`). */
  photo: string | null;
  art: string;
  /** Who put it there, as the picture's badge ("✨ AI önerisi", "Senin linkin", "Sabine ekledi"). */
  badge: ReturnType<typeof sourceBadge>;
  /** A ticket's site, as its label in its colour (the first line of a ticket's card). */
  brand: Brand | null;
  /** A place's word (the first line of a place's card): "Gezilecek", "Restoran", "Not". */
  tag: string | null;
  /** The grey line: a ticket's day and price a person, a place's note, area and rating, a suggestion's why. */
  line: string | null;
  /** Gezinin sebebi (plan v30): the ticket the trip is for (a festival's), pinned first. */
  reason: boolean;
  /** Its day on the plan ("8 Eki", a restaurant's "8 Eki akşam"). */
  day: string | null;
  /** A restaurant that takes a table: "Rezervasyonu yaptım" in its menu. */
  takesTable: boolean;
  /** Bought or booked: how to get to it. */
  access: KAccess | null;
  /** Its page (the site to buy on). */
  page: string | null;
  /** Its map (a place's own Maps page, else a search for it). */
  map: string | null;
  /** "+ Plana koy" puts it on the plan (an idea, a suggestion to add, the source's tour). */
  canPut: boolean;
}

/** A city's two rows: what's on the plan (the reason first), the rest to pick from, the chips' counts. */
export interface CollectionRowVM {
  plan: KCardVM[];
  ideas: KCardVM[];
  counts: Record<KFilter, number>;
}

/** The drawings of the families (static/illus), for a card with no photo. */
const ART: Readonly<Record<KFamily, string>> = {
  event: "illus/etkinlik-tur.png",
  place: "illus/yapilacak.png",
  food: "illus/restoran.png",
  note: "illus/not.png",
};

export function familyOf(section: SectionId, item: Pick<Item, "category" | "plannedKind">): KFamily {
  if (section === "activity") return "event";
  if (item.plannedKind === "note") return "note";
  return item.category === "food" ? "food" : "place";
}

/**
 * Where a card stands. Done only counts in Yapılacaklar (a thing done there is "yapıldı"); a ticket is bought, never done.
 * `planned`: intents.ts put it on the plan (chosen, booked, a thing with its day); `wanted`: a place the start opened.
 */
export function stateOf(section: SectionId, item: Pick<Item, "status" | "doneAt">, at: { planned: boolean; wanted: boolean }): KState {
  if (at.wanted) return "wanted";
  if (section !== "activity" && item.doneAt != null) return "done";
  if (item.status === "booked") return "booked";
  return at.planned ? "planned" : "idea";
}

/** The filter a card falls under: a restaurant is "Restoranlar", anything else "Gezilecek". */
export const filterOf = (card: Pick<KCardVM, "family">): Exclude<KFilter, "all"> => (card.family === "food" ? "food" : "go");
export const inFilter = (card: Pick<KCardVM, "family">, f: KFilter): boolean => f === "all" || filterOf(card) === f;

export function filterWord(f: KFilter): string {
  return f === "all" ? L("Hepsi", "All") : f === "go" ? L("Gezilecek", "To see") : L("Restoranlar", "Restaurants");
}

const sourceOf = (item: Item): OptionSource | null => {
  const adder = adderOf(item);
  if (adder === "ai") return { kind: "ai" };
  if (adder) return { kind: "person", name: adder };
  return item.url ? { kind: "link" } : null;
};

const uniq = (parts: (string | null | undefined)[]): string[] => parts.filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i);

/** A ticket's grey line: its day (and hour), its price a person ("4 Nisan · €45 kişi başı"); only what the record says. */
function eventLine(item: Item, facts: ReturnType<typeof cardFacts>, people: number | null): string | null {
  const prices = ticketPrices(item, facts.price, people);
  const price = prices?.each ? L(`${prices.each} kişi başı`, `${prices.each} per person`) : (facts.price?.text ?? null);
  return uniq([topDate(item, "activity"), price]).join(" · ") || null;
}

/** A place's grey line (v46, as drawn): its note, its kind, its area, its rating; the city is the row's own head. */
function placeLine(item: Item): string | null {
  const kind = ideaKindOf(item);
  const rating = item.rating.value != null ? `★ ${num(item.rating.value)}` : null;
  return uniq([item.summary.trim() || null, kind ? kindLabel(kind) : null, item.location.area, rating]).join(" · ") || null;
}

/** "Yapıldı · 12 Eki", a restaurant's "Gidildi · 12 Eki". */
export function doneLine(item: Pick<Item, "doneAt" | "category">): string | null {
  if (item.doneAt == null) return null;
  const day = shortDay(new Date(item.doneAt).toISOString().slice(0, 10));
  return item.category === "food" ? L(`Gidildi · ${day}`, `Been there · ${day}`) : L(`Yapıldı · ${day}`, `Done · ${day}`);
}

/** How to get to a bought ticket or a booked table: when, where to meet, its code, the map. */
export function accessOf(item: Item, family: KFamily, people: number | null): KAccess {
  const day = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  const time = clockOf(item.flight?.departure) ?? null;
  const n = item.guests.adults ?? people;
  const when =
    family === "food"
      ? uniq([day ? (item.meal ? `${shortDay(day)} ${mealLabel(item.meal)}` : shortDay(day)) : null, time, n && n > 0 ? L(`${n} kişi`, `${n} ${n === 1 ? "person" : "people"}`) : null]).join(" · ") || null
      : [day ? shortDay(day) : null, time].filter(Boolean).join(" ") || null;
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  return {
    when,
    where: item.location.address ?? item.location.area ?? null,
    code: ref ? { label: family === "food" ? L("Rezervasyon", "Booking") : L("Bilet", "Ticket"), value: ref } : null,
    map: mapOf(item, family),
  };
}

const mapOf = (item: Item, family: KFamily): string | null =>
  family === "event" ? (item.geo || item.location.address || item.name ? placeMapUrl(item) : null) : ideaMapUrl(item);

export interface CardCtx {
  section: SectionId;
  people: number | null;
  /** The decision engine's context (the facts' prices and the wants). */
  ctx?: Parameters<typeof cardFacts>[2];
}

/** A record's card. */
export function recordCard(item: Item, at: CardCtx & { planned: boolean; wanted: boolean; reason: boolean }): KCardVM {
  const family = familyOf(at.section, item);
  const state = stateOf(at.section, item, at);
  const facts = cardFacts(item, undefined, at.ctx);
  const event = family === "event";
  return {
    key: `i:${item.id}`,
    item,
    suggestion: null,
    offer: null,
    family,
    state,
    title: item.name,
    // A place's picture is its saved page's (a Maps pin's photo); a ticket's whatever its page gave.
    photo: event ? facts.image : ideaThumb(item),
    art: ART[family],
    // A pin saved from Google Maps says "Maps" (the live tile's badge); a source's tour saved from its row its source
    // ("Viator", not a model's idea); anything else who put it there.
    badge:
      !event && ideaSource(item) === "Maps"
        ? { tone: "mine", text: "Maps", initial: null }
        : event && adderOf(item) === "ai" && item.provider && item.url
          ? { tone: "mine", text: item.provider, initial: null }
          : sourceBadge({ ours: false, source: sourceOf(item) }),
    brand: event ? brandOf(facts.source?.label, facts.source?.host) : null,
    tag: family === "food" ? L("Restoran", "Restaurant") : family === "note" ? L("Not", "Note") : event ? null : L("Gezilecek", "To see"),
    line: state === "done" ? doneLine(item) : event ? eventLine(item, facts, at.people) : family === "note" ? item.summary.trim() || null : placeLine(item),
    reason: at.reason,
    day: event ? null : dayChip(item),
    takesTable: family === "food" && needsBooking(item),
    access: state === "booked" ? accessOf(item, family, at.people) : null,
    page: item.url,
    map: mapOf(item, family),
    canPut: state === "idea",
  };
}

/** A suggestion to add (the chat's, a rule's) among the ideas: ✨, its why, "+ Plana koy". */
export function suggestionCard(s: Suggestion, section: SectionId): KCardVM {
  const food = s.section === "food" || s.template === "food";
  const family: KFamily = section === "activity" ? "event" : food ? "food" : "place";
  const place = family !== "event";
  return {
    key: `s:${s.key}`,
    item: null,
    suggestion: s,
    offer: null,
    family,
    state: "idea",
    // A place's name as a name (one stored cut in a sentence: "Tanah Lot Tapınağı'nın"); its photo comes from its page (KCard).
    title: place ? cleanPlaceTitle(s.title) : s.title,
    photo: null,
    art: ART[family],
    badge: { tone: "ai", text: `✨ ${L("Öneri", "Suggestion")}`, initial: null },
    brand: null,
    tag: family === "food" ? L("Restoran", "Restaurant") : family === "place" ? L("Gezilecek", "To see") : null,
    line: s.why.trim() || null,
    reason: false,
    day: null,
    takesTable: false,
    access: null,
    page: null,
    map: place ? placeMapsUrl(s) : null,
    canPut: s.kind === "add",
  };
}

/** The country (ISO alpha-2) of the stay the plan has in a city: its record's, the first that says. */
export function stopCountry(plan: Pick<Plan, "stayBlocks">, city: string): string | null {
  for (const b of plan.stayBlocks) {
    const item = b.kind === "open" ? b.slot : b.item;
    if (!item?.countryCode || !sameCity(b.city ?? item.city, city)) continue;
    return item.countryCode;
  }
  return null;
}

/**
 * The trip's other cities in a town's country, asked for tours when the town has few of its own (offerSources.cityTours):
 * the stays' cities there, then the airports flown into or out of there (Kolombo for Ahangama), searched by their English
 * name. Only the trip's own places: nothing is looked up by distance. None while the country isn't known.
 */
export function nearPlaces(plan: Pick<Plan, "stayBlocks">, items: Iterable<Item>, city: string, country: string | null): NearPlace[] {
  if (!country) return [];
  const out: NearPlace[] = [];
  const add = (search: string, label: string) => {
    if (sameCity(search, city) || sameCity(label, city) || out.some((p) => sameCity(p.city, search) || sameCity(p.label, label))) return;
    out.push({ city: search, label });
  };
  for (const c of citiesOfPlan(plan)) if (stopCountry(plan, c.city) === country) add(c.city, c.city);
  for (const i of items) {
    if (i.status === "dismissed" || i.category !== "flight" || !i.flight) continue;
    for (const code of [i.flight.to, i.flight.from]) {
      const en = airportCities(code)[1];
      if (en && countryOfAirport(code) === country) add(en, cityOfAirport(code!));
    }
  }
  return out;
}

/** A tour the connected source offers for the city (its page, its photo, how long, its price a person). */
export function offerCard(o: Offer, people: number | null): KCardVM {
  const each = o.price != null && o.price > 0 ? (people && people > 1 ? o.price / people : o.price) : null;
  const price = each != null ? L(`${formatPrice(Math.round(each), o.currency ?? "EUR")} kişi başı`, `${formatPrice(Math.round(each), o.currency ?? "EUR")} per person`) : null;
  return {
    key: `o:${o.id}`,
    item: null,
    suggestion: null,
    offer: o,
    family: "event",
    state: "idea",
    title: o.title,
    photo: o.photo ?? null,
    art: ART.event,
    // The source's own name (a real tour it lists, not a model's idea; Emre, 19 Ekim) and where it was asked ("Viator · Galle").
    badge: { tone: "mine", text: o.place ? `${o.source} · ${o.place}` : o.source, initial: null },
    brand: brandOf(o.source, null),
    tag: null,
    line: [o.durationMinutes ? durationText(o.durationMinutes) : null, price].filter(Boolean).join(" · ") || null,
    reason: false,
    day: null,
    takesTable: false,
    access: null,
    page: o.url,
    map: null,
    canPut: true,
  };
}

/** One chip on a card's picture, top left (option A, 0.38.8). */
export type KChip =
  | { kind: "reason" }
  /** Who put an idea there; `mark` is the site's letter in its colour when the chip names it ("V Viator · Ushuaia"). */
  | { kind: "source"; tone: string; text: string; initial: string | null; mark: { color: string; letter: string } | null }
  /** A ticket's site as its label in its colour ("Viator"). */
  | { kind: "site"; brand: Brand }
  /** A place's word ("Gezilecek", "Restoran"). */
  | { kind: "tag"; text: string };

/**
 * The chips on a card's picture (Emre's option A: the badges move off the lines onto the photo): the trip's own ticket says
 * "Gezinin sebebi" (no other source); an idea who put it there, with the site's mark when it names the site, so a source's
 * tour is one chip ("V Viator · Ushuaia") where it was two lines; a ticket's site unless that chip names it already; then
 * a place's word (on the picture's foot, beside "✓ Rezervasyon", clear of the tools).
 */
export function pictureChips(card: Pick<KCardVM, "reason" | "badge" | "brand" | "state" | "family" | "tag">): KChip[] {
  const out: KChip[] = [];
  const event = card.family === "event";
  const brand = card.brand;
  if (card.reason) out.push({ kind: "reason" });
  else {
    const b = card.state === "idea" ? card.badge : null;
    const named = !!b && !!brand && b.text.startsWith(brand.label);
    if (b) {
      const mark = named && brand?.color ? { color: brand.color, letter: [...brand.label][0] ?? "" } : null;
      out.push({ kind: "source", tone: b.tone, text: b.text, initial: b.initial, mark });
    }
    if (event && brand && !named) out.push({ kind: "site", brand });
  }
  if (!event && card.tag) out.push({ kind: "tag", text: card.tag });
  return out;
}

/**
 * A city's two rows from its intent (intents.ts collectionIntents) and the trip's records: what intents.ts put on the plan
 * and the places still to fill go to Planında (the trip's reason first), the rest to Öneriler, then the source's tours
 * that aren't saved yet, then the suggestions.
 */
export function collectionRow(
  vm: Pick<IntentVM, "section" | "itemIds" | "planned" | "wanted" | "suggestions">,
  byId: ReadonlyMap<string, Item>,
  at: Omit<CardCtx, "section"> & { trip: Pick<Trip, "intent">; offers?: readonly Offer[] },
): CollectionRowVM {
  const section = vm.section;
  const live = vm.itemIds.map((id) => byId.get(id)).filter((i): i is Item => i != null && i.status !== "dismissed");
  const planned = new Set(vm.planned.map((o) => o.id));
  const wanted = new Set(vm.wanted.map((o) => o.id));
  const onPlan = live.filter((i) => planned.has(i.id) || wanted.has(i.id));
  const reason = section === "activity" ? reasonItemOf(at.trip, onPlan) : null;
  const card = (item: Item) => recordCard(item, { ...at, section, planned: planned.has(item.id), wanted: wanted.has(item.id), reason: item.id === reason?.id });
  // The plan's order (intents.ts: booked, then on the plan), the reason first, the places still to fill after.
  const plan = [...onPlan.filter((i) => i.id === reason?.id), ...onPlan.filter((i) => i.id !== reason?.id && !wanted.has(i.id)), ...onPlan.filter((i) => i.id !== reason?.id && wanted.has(i.id))].map(card);
  const saved = live.filter((i) => !onPlan.includes(i));
  const offers = (at.offers ?? []).filter((o) => !live.some((i) => (i.url && i.url === o.url) || sameName(i.name, o.title)));
  // The saved ones, then the source's real tours, then the model's ideas (Emre, 19 Ekim).
  const ideas = [...saved.map(card), ...offers.map((o) => offerCard(o, at.people)), ...vm.suggestions.map((s) => suggestionCard(s, section))];
  const all = [...plan, ...ideas];
  return { plan, ideas, counts: { all: all.length, go: all.filter((c) => filterOf(c) === "go").length, food: all.filter((c) => filterOf(c) === "food").length } };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sameName = (a: string, b: string) => fold(a) === fold(b);

/** Öneriler's four cells: every card while they fit, else three and "+n Pano'da" (n: the rest). */
export function rowCells<T>(cards: readonly T[], cells = ROW_CELLS): { shown: T[]; more: number } {
  if (cards.length <= cells) return { shown: [...cards], more: 0 };
  return { shown: cards.slice(0, cells - 1), more: cards.length - (cells - 1) };
}

/** Öneriler's caption: "3", or "7 · ilk 3, tümü Pano'da" when the rest wait on the Pano. */
export function ideasCaption(total: number, shown: number): string {
  return total > shown ? L(`${total} · ilk ${shown}, tümü Pano'da`, `${total} · first ${shown}, all on the Board`) : String(total);
}

/** "+3 Pano'da", in words for a reader. */
export const moreLabel = (n: number, title: string): string => L(`${title}: ${n} tane daha, Pano'da aç`, `${title}: ${n} more, open on the Board`);

/** The lines for the trip's chat: more for the city, another in a card's place, more like a place. */
export function askMore(section: SectionId, city: string | null): string {
  const where = city ?? L("bu gezi", "this trip");
  return section === "activity"
    ? L(`${where} için bilet ya da rezervasyon gerektiren birkaç etkinlik ve tur daha öner.`, `Suggest a few more activities and tours for ${where}, the kind that take a ticket or a booking.`)
    : L(`${where} için gezilecek birkaç yer ve restoran daha öner.`, `Suggest a few more places to see and restaurants for ${where}.`);
}
export const askOther = (title: string): string => L(`“${title}” yerine başka bir etkinlik ya da tur öner.`, `Suggest another activity or tour in place of “${title}”.`);
export const askLike = (card: Pick<KCardVM, "title" | "family">, city: string | null): string =>
  card.family === "food"
    ? L(`${city ?? "Bu şehir"} için “${card.title}” gibi birkaç restoran daha öner.`, `Suggest a few more restaurants like “${card.title}” in ${city ?? "this city"}.`)
    : L(`${city ?? "Bu şehir"} için “${card.title}” gibi gezilecek birkaç yer daha öner.`, `Suggest a few more places like “${card.title}” to see in ${city ?? "this city"}.`);

/** "Kendin ara" for a city's places: Google Maps, looking for what the chip says (restaurants, places to see). */
export function mapsSearch(city: string | null, f: KFilter): { id: string; name: string; color: string; letter: string; url: string } | null {
  if (!city) return null;
  const what = f === "food" ? L("restoran", "restaurants") : f === "go" ? L("gezilecek yerler", "things to do") : L("gezilecek yerler ve restoranlar", "things to do and restaurants");
  return { id: "maps", name: L("Google Haritalar", "Google Maps"), color: "#ea4335", letter: "G", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} ${what}`)}` };
}

/** Yapılacaklar' closed row: how many of its things are done ("1 yapıldı"); a ticket is never "done". */
export function doneCount(intents: readonly Pick<IntentVM, "section" | "frame" | "itemIds" | "status">[], byId: ReadonlyMap<string, Item>): number {
  const ids = new Set(intents.filter((i) => i.section === "todo" && i.frame === "collection" && i.status !== "skipped").flatMap((i) => i.itemIds));
  return [...ids].filter((id) => {
    const item = byId.get(id);
    return item != null && item.status !== "dismissed" && item.doneAt != null && !item.part;
  }).length;
}
