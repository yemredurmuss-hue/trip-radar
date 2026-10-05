// The hero's main places (revizyon 1, 2026-10-05): the destinations the traveller is visiting (a city, an
// island, a region), not every town they sleep in. A stay in Gaula, a parish on Madeira, belongs to Madeira:
// the hero's city switcher, photos, weather, mood and style speak of "Porto | Madeira", not "Porto | Funchal |
// Gaula". The Plan and Günlük akış keep the places as they are.
//
// Which place sits inside which comes from the traveller's model (asked once per set of stay cities, kept on
// the trip as `placeParents`), validated here. Until it answers (no key, an error), a cheap guess: a stay whose
// own address names another of the trip's places folds into it. Pure.
import { L } from "./i18n";
import { cityKeyOf, knownPlace } from "./plan";
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
  return [...out.values()].map(({ name, members }) => ({ name: boardName(name), members }));
}

/**
 * A known city in the board's language (the alias table in plan.ts knows it under every name): "Lisbon" on a
 * Turkish board is "Lizbon", "Lizbon" on an English one "Lisbon". Madeira stays Madeira (the table reads the
 * island as its capital Funchal, but the island is the destination), so Funchal isn't here.
 */
const BOARD_NAMES: Record<string, [tr: string, en: string]> = {
  lizbon: ["Lizbon", "Lisbon"], porto: ["Porto", "Porto"], roma: ["Roma", "Rome"], atina: ["Atina", "Athens"],
  munih: ["Münih", "Munich"], viyana: ["Viyana", "Vienna"], prag: ["Prag", "Prague"], floransa: ["Floransa", "Florence"],
  venedik: ["Venedik", "Venice"], napoli: ["Napoli", "Naples"], milano: ["Milano", "Milan"], sevilla: ["Sevilla", "Seville"],
  bruksel: ["Brüksel", "Brussels"], kopenhag: ["Kopenhag", "Copenhagen"], varsova: ["Varşova", "Warsaw"],
  moskova: ["Moskova", "Moscow"], cenevre: ["Cenevre", "Geneva"], koln: ["Köln", "Cologne"], londra: ["Londra", "London"],
  barselona: ["Barselona", "Barcelona"], nis: ["Nice", "Nice"], marsilya: ["Marsilya", "Marseille"],
  budapeste: ["Budapeşte", "Budapest"], bukres: ["Bükreş", "Bucharest"], belgrad: ["Belgrad", "Belgrade"],
  selanik: ["Selanik", "Thessaloniki"], lefkosa: ["Lefkoşa", "Nicosia"], kahire: ["Kahire", "Cairo"],
  edinburg: ["Edinburg", "Edinburgh"], lahey: ["Lahey", "The Hague"], anvers: ["Anvers", "Antwerp"], zurih: ["Zürih", "Zurich"],
  kudus: ["Kudüs", "Jerusalem"], tiflis: ["Tiflis", "Tbilisi"], istanbul: ["İstanbul", "Istanbul"],
};
export function boardName(name: string): string {
  const key = cityKeyOf(name);
  const names = key ? BOARD_NAMES[key] : undefined;
  return names ? L(names[0], names[1]) : name.trim();
}

/** The destination a place belongs to (itself when it's one), for a sentence that names it. */
export function mainPlaceOf(places: MainPlace[], city: string | null | undefined): string | null {
  const key = cityKeyOf(city);
  if (!key) return null;
  return places.find((p) => cityKeyOf(p.name) === key || p.members.some((m) => cityKeyOf(m) === key))?.name ?? city!.trim();
}

/** A few names a country also goes by that aren't ISO regions of their own. */
const MORE_COUNTRIES = ["england", "ingiltere", "scotland", "iskocya", "wales", "galler", "holland", "hollanda", "usa", "abd", "uk"];
let countryNames: Set<string> | null = null;
/** "Portekiz", "Portugal", "İspanya"…: every region name in both board languages (Intl), compared plain. */
export function isCountryName(name: string): boolean {
  if (!countryNames) {
    const found = new Set(MORE_COUNTRIES);
    for (const lang of ["tr", "en"]) {
      let names: Intl.DisplayNames;
      try {
        names = new Intl.DisplayNames([lang], { type: "region" });
      } catch {
        continue;
      }
      for (let i = 0; i < 26; i++)
        for (let j = 0; j < 26; j++) {
          const code = String.fromCharCode(65 + i, 65 + j);
          let n: string | undefined;
          try {
            n = names.of(code);
          } catch {
            n = undefined;
          }
          if (n && n !== code) found.add(plain(n));
        }
    }
    countryNames = found;
  }
  return countryNames.has(plain(name));
}

/** How many steps a chain of "inside" may take (Oia → Fira → Santorini is two). */
const MAX_DEPTH = 3;

/**
 * A place → bigger destination answer, checked so that two real stops never merge:
 * - only the trip's own places; a non-empty name of at most 40 characters; never a place inside itself;
 * - a chain is followed to its end (Oia → Fira → Santorini ⇒ Santorini), at most three steps; a loop is dropped;
 * - never into a country (Porto → Portekiz);
 * - a city the app knows (the alias table in plan.ts: Porto, Lizbon, Faro…) never moves into another place;
 *   another name for it is kept (Funchal → Madeira, one city key: it names the destination, it doesn't move);
 * - into another of the trip's stay cities only when that one is a destination the app knows and the place
 *   isn't (Gaula → Madeira, a stay too); never into a stay town the app doesn't know (Burgau → Lagos).
 *   Otherwise only into a name that isn't one of the stay cities: an island or a region (Lagos → Algarve).
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
  const out: Record<string, string> = {};
  for (const [key, first] of Object.entries(raw)) {
    // Follow the chain: the parent's own parent, until one isn't inside anything (or only goes by another name).
    let at = key;
    let name = first;
    let ok = true;
    const seen = new Set([key]);
    for (let step = 1; ; step++) {
      const next = cityKeyOf(name)!;
      if (next === at || raw[next] === undefined) break;
      if (cityKeyOf(raw[next]) === next) {
        name = raw[next]; // the parent goes by another name (Funchal → Madeira)
        break;
      }
      if (seen.has(next) || step >= MAX_DEPTH) {
        ok = false; // a loop, or too long to be sure
        break;
      }
      seen.add(next);
      at = next;
      name = raw[next];
    }
    if (!ok || isCountryName(name)) continue;
    const target = cityKeyOf(name)!;
    if (target === key) {
      out[key] = name; // another name for the same place
      continue;
    }
    if (knownPlace(key)) continue; // a real city stays its own stop
    if (keys.has(target) && !knownPlace(target)) continue; // two stay towns: not ours to merge
    out[key] = name;
  }
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
