// The hero's main places (revizyon 1, 2026-10-05): the destinations the traveller is visiting (a city, an
// island, a region), not every town they sleep in. A stay in Gaula, a parish on Madeira, belongs to Madeira:
// the hero's city switcher, photos, weather, mood and style speak of "Porto | Madeira", not "Porto | Funchal |
// Gaula". The Plan and Günlük akış keep the places as they are.
//
// Which place sits inside which comes from the traveller's model (asked once per set of stay cities, kept on
// the trip as `placeParents`), validated here. Until it answers (no key, an error), a cheap guess: a stay whose
// own address names another of the trip's places folds into it. Pure.
import { L } from "./i18n";
import { cityKeyOf } from "./plan";
import type { Item } from "./types";

/** A destination as the hero shows it, and the trip's places (the Plan's cities) inside it, in order. */
export interface MainPlace {
  name: string;
  members: string[];
}

/** What the model is asked for: the stay cities, compared as keys, in any order. */
export const placesKey = (cities: string[]): string =>
  [...new Set(cities.map(cityKeyOf).filter((k): k is string => !!k))].sort().join("|");

/** A bigger place's name longer than this isn't a place's name. */
const PARENT_MAX = 40;

/** A name as written, only case, accents and punctuation aside (no other-language names: "Madeira" isn't "Funchal" here). */
const plain = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The cities folded into their bigger destinations, in the order each first appears, each once (case and
 * accents don't matter: cityKeyOf). `parents` maps a city's key to its destination's name. A destination is
 * called by the name the model gave it ("Madeira", the island, for Funchal and Gaula; the trip's own
 * spelling when it is one of the trip's places), else by its place's own name.
 */
export function mainPlaces(cities: string[], parents: Record<string, string>): MainPlace[] {
  const named = new Map<string, string>();
  for (const c of cities) {
    const key = cityKeyOf(c);
    if (key && !named.has(key)) named.set(key, c.trim());
  }
  const spelled = new Map([...named.values()].map((c) => [plain(c), c]));
  const out = new Map<string, MainPlace & { given: boolean }>();
  for (const [key, city] of named) {
    const parent = parents[key]?.trim();
    const mainKey = (parent && cityKeyOf(parent)) || key;
    const name = parent ? (spelled.get(plain(parent)) ?? parent) : city;
    const place = out.get(mainKey);
    if (!place) out.set(mainKey, { name, members: [city], given: !!parent });
    else {
      place.members.push(city);
      // The first name the model gave wins over a place's own ("Funchal" → the island it's on).
      if (parent && !place.given) Object.assign(place, { name, given: true });
    }
  }
  return [...out.values()].map(({ name, members }) => ({ name, members }));
}

/** The destination a place belongs to (itself when it's one), for a sentence that names it. */
export function mainPlaceOf(places: MainPlace[], city: string | null | undefined): string | null {
  const key = cityKeyOf(city);
  if (!key) return null;
  return places.find((p) => cityKeyOf(p.name) === key || p.members.some((m) => cityKeyOf(m) === key))?.name ?? city!.trim();
}

/**
 * A place → bigger destination answer, checked: only the trip's own places, a non-empty name of at most 40
 * characters, never a place inside itself, and no chains (a place whose destination is itself inside another
 * is dropped, and a loop goes with it). A place the app already treats as its destination under another
 * name (Funchal → Madeira: one city key) is kept: it names the destination, it doesn't move the place.
 */
export function acceptParents(cities: string[], answer: { place: string; parent: string | null }[] | Record<string, string | null>): Record<string, string> {
  const keys = new Set(cities.map(cityKeyOf).filter(Boolean));
  const pairs = Array.isArray(answer) ? answer.map((a) => [a.place, a.parent] as const) : Object.entries(answer);
  const raw: Record<string, string> = {};
  for (const [place, parent] of pairs) {
    const key = cityKeyOf(place);
    const name = parent?.trim().replace(/\s+/g, " ") ?? "";
    if (!key || !keys.has(key) || !name || name.length > PARENT_MAX || /[\n\r]/.test(name)) continue;
    if (plain(name) === plain(place) || plain(name) === key) continue; // itself
    raw[key] ??= name;
  }
  /** Inside another place (not just its other name). */
  const moves = (key: string) => raw[key] !== undefined && cityKeyOf(raw[key]) !== key;
  const out: Record<string, string> = {};
  for (const [key, name] of Object.entries(raw)) if (cityKeyOf(name) === key || !moves(cityKeyOf(name)!)) out[key] = name;
  return out;
}

/**
 * Before (or without) the model: a place whose saved stays name another of the trip's places in their
 * address or area ("…, Gaula, Madeira, Portugal" while Madeira is a stay too) is inside it. Otherwise
 * nothing is folded, as before.
 */
export function fallbackParents(cities: string[], items: Item[]): Record<string, string> {
  const named = new Map<string, string>();
  for (const c of cities) {
    const key = cityKeyOf(c);
    if (key && !named.has(key)) named.set(key, c.trim());
  }
  const found: Record<string, string> = {};
  for (const [key] of named) {
    const stays = items.filter((i) => i.category === "stay" && i.status !== "dismissed" && cityKeyOf(i.city) === key);
    const parts = stays.flatMap((i) => [i.location?.area ?? "", ...(i.location?.address ?? "").split(/[,·|]/)]);
    for (const part of parts) {
      // "9100-123 Gaula" or "Madeira 9000": the postcode isn't part of the name.
      const other = cityKeyOf(part.replace(/\b\d[\d-]*\b/g, " "));
      if (other && other !== key && named.has(other)) {
        found[key] = named.get(other)!;
        break;
      }
    }
  }
  return acceptParents(cities, found);
}

/** The model's instructions: which of the trip's places is a smaller locality inside a bigger destination. */
export const placesSystemPrompt = (): string =>
  L(
    [
      "Bir gezinin gecelenen yerlerini sırayla veriyorum (biliniyorsa ülkesiyle).",
      "Her yer için: bu yer, gezinin daha büyük bir destinasyonunun içindeki küçük bir yerleşimse (kasaba, köy, mahalle, belde)",
      "ya da bilinen bir adanın veya bölgenin içindeyse, o büyük destinasyonun yaygın adını parent olarak yaz; değilse parent null.",
      "Büyük destinasyon listedeki başka bir yer ya da bilinen bir ada veya bölge olabilir.",
      "Örnekler: Gaula → Madeira, Funchal → Madeira, Câmara de Lobos → Madeira.",
      "Sintra → Lizbon yalnızca Lizbon da listedeyse; yoksa Sintra için parent null.",
      "Gezginin ayrı ayrı kaldığı iki gerçek şehri asla birleştirme: Porto ve Lizbon ayrı kalır.",
      "Adları Türkçede yaygın yazılışıyla yaz; place alanına yeri listede yazıldığı gibi yaz.",
    ].join(" "),
    [
      "Here are the places a trip sleeps in, in order (with their country when known).",
      "For each place: if it is a smaller locality (town, village, parish, district) inside a bigger destination of this trip,",
      "or inside a well-known island or region, give that bigger destination's common name as parent; otherwise parent is null.",
      "The bigger destination may be another place in the list or a well-known island or region.",
      "Examples: Gaula → Madeira, Funchal → Madeira, Câmara de Lobos → Madeira.",
      "Sintra → Lisbon only if Lisbon is in the list too; otherwise Sintra's parent is null.",
      "Never merge two real cities the traveller stays in separately: Porto and Lisbon stay apart.",
      "Write names as commonly written in English; write place exactly as it is in the list.",
    ].join(" "),
  );

/** What the model is asked: the stay cities in order, each with its country when the saves know it. */
export function placesPrompt(cities: string[], countryOf: (city: string) => string | null): string {
  return `<places>\n${cities.map((c) => (countryOf(c) ? `${c} (${countryOf(c)})` : c)).join("\n")}\n</places>`;
}
