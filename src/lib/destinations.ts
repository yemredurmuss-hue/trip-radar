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

/**
 * The trip place an answer's `place` names. The prompt lists a place with its country ("Gaula (Portekiz)") and
 * asks for the place "as written in the list": a model that copies the line back answers "Gaula (Portekiz)",
 * which isn't a place of the trip's by itself (0.35.3: the answer was dropped and the empty result kept). The
 * country in brackets, or after a comma, is left out.
 */
function answeredKey(place: string, keys: Set<string | null>): string | null {
  const whole = cityKeyOf(place);
  if (whole && keys.has(whole)) return whole;
  for (const bare of [place.replace(/\s*\([^)]*\)\s*$/, ""), place.split(",")[0]]) {
    const key = cityKeyOf(bare);
    if (key && keys.has(key)) return key;
  }
  return whole;
}

/** Whether an answer named any of the trip's places at all (one that named none is asked again, not kept). */
export function answersAny(cities: string[], answer: { place: string }[]): boolean {
  const keys = new Set(cities.map(cityKeyOf).filter(Boolean));
  return answer.some((a) => {
    const key = answeredKey(a.place, keys);
    return key != null && keys.has(key);
  });
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
    const key = answeredKey(place, keys);
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

// --- islands and regions the app knows without the model ---------------------------------------------------
//
// Gaula's stay folded into Porto | Gaula when the model had no key or its answer didn't count: Madeira isn't one
// of the trip's places, so fallbackParents had nothing to fold into. A short table of destinations we're sure of
// does it without the model. Only small localities are members: a real city stays its own stop (Palermo and
// Catania, Heraklion and Chania, Cagliari, Faro). An island's capital is named by its island (Palma → Mallorca,
// as Funchal → Madeira). Porto Santo is its own island, not Madeira's.
//
// A table can't tell two places of one name apart, so a member needs evidence (review of 0.35.5): a stay that
// names the region itself in its address or area ("Gaula, Madeira, Portugal"), or, for a name found nowhere
// else, a save of the trip in the region's country. A name that is also a town elsewhere in that country or
// abroad (Santa Cruz, Calheta, Lagos, San Antonio, Kuta…: AMBIGUOUS) needs the region named. A stay whose own
// country is another never folds. A plan said in the chat has no country: alone, it isn't evidence.

interface Region {
  tr: string;
  en: string;
  /** ISO 3166-1 alpha-2: a member's name elsewhere ("Santa Cruz", Bolivia) isn't this one. */
  country: string;
  /** The island's capital is named by the island (only on an island with one main town). */
  capital?: string[];
  /** Other names for the destination itself. */
  aliases?: string[];
  members: string[];
}

const REGIONS: Region[] = [
  {
    tr: "Madeira", en: "Madeira", country: "PT", capital: ["Funchal"],
    aliases: ["Madeira Island", "Ilha da Madeira", "Região Autónoma da Madeira", "Madeira Adası"],
    members: ["Gaula", "Santa Cruz", "Machico", "Câmara de Lobos", "Estreito de Câmara de Lobos", "Calheta", "Arco da Calheta", "Porto Moniz", "Santana", "Caniço", "Caniço de Baixo", "Caniçal", "Ribeira Brava", "Ponta do Sol", "São Vicente", "Seixal", "Jardim do Mar", "Paul do Mar", "Prazeres", "Curral das Freiras", "Camacha", "Santo da Serra", "Madalena do Mar"],
  },
  { tr: "Porto Santo", en: "Porto Santo", country: "PT", capital: ["Vila Baleira"], aliases: ["Ilha do Porto Santo"], members: [] },
  {
    tr: "São Miguel", en: "São Miguel", country: "PT", capital: ["Ponta Delgada"], aliases: ["São Miguel Island", "Ilha de São Miguel"],
    members: ["Furnas", "Ribeira Grande", "Sete Cidades", "Vila Franca do Campo", "Nordeste", "Povoação", "Capelas", "Mosteiros", "Rabo de Peixe"],
  },
  {
    tr: "Algarve", en: "Algarve", country: "PT",
    members: ["Lagos", "Albufeira", "Portimão", "Praia da Rocha", "Alvor", "Tavira", "Vilamoura", "Quarteira", "Carvoeiro", "Sagres", "Vila do Bispo", "Olhão", "Armação de Pêra", "Praia da Luz", "Loulé", "Silves", "Monte Gordo", "Cabanas de Tavira", "Almancil", "Aljezur", "Ferragudo", "Burgau", "Salema", "Galé", "Vale do Lobo", "Quinta do Lago"],
  },
  {
    tr: "Mallorca", en: "Mallorca", country: "ES", capital: ["Palma", "Palma de Mallorca"], aliases: ["Majorca", "Mayorka"],
    members: ["Sóller", "Port de Sóller", "Deià", "Deya", "Valldemossa", "Pollença", "Port de Pollença", "Alcúdia", "Port d'Alcúdia", "Cala d'Or", "Santanyí", "Cala Millor", "Cala Ratjada", "Can Picafort", "Magaluf", "Port d'Andratx", "Andratx", "Portals Nous", "Colònia de Sant Jordi", "Cala Figuera", "Porto Cristo", "Felanitx", "Inca", "Manacor", "Llucmajor", "Sa Pobla", "Banyalbufar", "Fornalutx", "Santa Ponsa", "Peguera", "El Arenal", "Playa de Palma"],
  },
  {
    tr: "İbiza", en: "Ibiza", country: "ES", capital: ["Ibiza Town", "Eivissa", "Ibiza Ciudad", "Ibiza Stadt"], aliases: ["Eivissa island"],
    members: ["Sant Antoni de Portmany", "San Antonio", "Sant Antoni", "Santa Eulària des Riu", "Santa Eulalia del Río", "Santa Eulària", "Sant Josep de sa Talaia", "San José", "Portinatx", "Es Canar", "Playa d'en Bossa", "Cala Llonga", "Sant Joan de Labritja", "Sant Miquel de Balansat", "Cala Comte", "Talamanca"],
  },
  {
    tr: "Menorca", en: "Menorca", country: "ES", capital: ["Mahón", "Maó", "Maó-Mahón"], aliases: ["Minorca", "Minorka"],
    members: ["Ciutadella", "Ciutadella de Menorca", "Fornells", "Binibeca", "Es Mercadal", "Cala Galdana", "Alaior", "Es Castell", "Sant Lluís", "Cala en Porter", "Son Bou", "Ferreries", "Punta Prima", "Cala en Bosc"],
  },
  {
    tr: "Tenerife", en: "Tenerife", country: "ES", capital: ["Santa Cruz de Tenerife"],
    members: ["Puerto de la Cruz", "Los Cristianos", "Costa Adeje", "Adeje", "Playa de las Américas", "La Laguna", "San Cristóbal de La Laguna", "Los Gigantes", "Acantilado de los Gigantes", "El Médano", "Garachico", "Icod de los Vinos", "La Orotava", "Arona", "Callao Salvaje", "Golf del Sur", "Puerto de Santiago"],
  },
  {
    tr: "Gran Canaria", en: "Gran Canaria", country: "ES", capital: ["Las Palmas", "Las Palmas de Gran Canaria"],
    members: ["Maspalomas", "Playa del Inglés", "Puerto de Mogán", "Mogán", "Agaete", "San Agustín", "Meloneras", "Arguineguín", "Telde", "Teror", "Agüimes", "Gáldar", "Arucas", "Patalavaca", "Amadores"],
  },
  {
    tr: "Lanzarote", en: "Lanzarote", country: "ES", capital: ["Arrecife"],
    members: ["Playa Blanca", "Puerto del Carmen", "Costa Teguise", "Teguise", "Yaiza", "Haría", "Puerto Calero", "Famara", "Caleta de Famara", "Órzola", "Tinajo", "San Bartolomé", "Tías"],
  },
  {
    tr: "Fuerteventura", en: "Fuerteventura", country: "ES", capital: ["Puerto del Rosario"],
    members: ["Corralejo", "Morro Jable", "Costa Calma", "El Cotillo", "Caleta de Fuste", "Jandía", "La Oliva", "Lajares", "Pájara", "Tarajalejo", "Las Playitas", "Gran Tarajal"],
  },
  {
    tr: "Santorini", en: "Santorini", country: "GR", capital: ["Fira", "Thira"], aliases: ["Thera", "Santorin"],
    members: ["Oia", "Imerovigli", "Firostefani", "Kamari", "Perissa", "Perivolos", "Pyrgos", "Akrotiri", "Megalochori", "Karterados", "Messaria", "Vothonas", "Emporio", "Finikia", "Vlychada"],
  },
  {
    tr: "Mikonos", en: "Mykonos", country: "GR", capital: ["Mykonos Town", "Mykonos Chora"], aliases: ["Mykonos Island"],
    members: ["Ornos", "Platis Gialos", "Platys Gialos", "Ano Mera", "Psarou", "Kalafatis", "Agios Ioannis", "Paraga", "Tourlos", "Agios Sostis", "Kalo Livadi", "Paradise Beach", "Super Paradise"],
  },
  {
    tr: "Girit", en: "Crete", country: "GR", aliases: ["Kriti", "Crete Island", "Girit Adası"],
    members: ["Elounda", "Agios Nikolaos", "Hersonissos", "Chersonissos", "Malia", "Rethymno", "Rethymnon", "Plakias", "Kissamos", "Sitia", "Matala", "Platanias", "Georgioupoli", "Agia Pelagia", "Stalis", "Ierapetra", "Paleochora", "Kalyves", "Almyrida", "Agia Marina", "Kolymbari", "Analipsi", "Makrygialos"],
  },
  {
    tr: "Sicilya", en: "Sicily", country: "IT", aliases: ["Sicilia"],
    members: ["Taormina", "Cefalù", "Noto", "Ragusa", "Ragusa Ibla", "Modica", "Agrigento", "Trapani", "Marsala", "Giardini Naxos", "Scicli", "Ortigia", "San Vito Lo Capo", "Erice", "Castellammare del Golfo", "Scopello", "Mondello", "Marzamemi", "Letojanni", "Castelmola", "Sciacca", "Piazza Armerina", "Avola"],
  },
  {
    tr: "Sardinya", en: "Sardinia", country: "IT", aliases: ["Sardegna"],
    members: ["Alghero", "Porto Cervo", "Villasimius", "Cala Gonone", "Stintino", "San Teodoro", "Bosa", "Chia", "Costa Rei", "Santa Teresa Gallura", "Porto Rotondo", "Baja Sardinia", "Cannigione", "La Maddalena", "Orosei", "Dorgali", "Budoni", "Arzachena", "Castelsardo", "Muravera", "Teulada", "Carloforte"],
  },
  {
    tr: "Bali", en: "Bali", country: "ID", capital: ["Denpasar"],
    members: ["Ubud", "Seminyak", "Canggu", "Kuta", "Legian", "Uluwatu", "Sanur", "Nusa Dua", "Jimbaran", "Amed", "Lovina", "Munduk", "Pecatu", "Kerobokan", "Tanjung Benoa", "Pererenan", "Sidemen", "Tabanan", "Candidasa", "Padangbai", "Tegallalang", "Bingin", "Ungasan", "Kintamani"],
  },
];

/** Members that are also towns elsewhere (in the region's own country or abroad): only with the region named. */
const AMBIGUOUS = new Set(
  [
    "Santa Cruz", "Calheta", "Santana", "São Vicente", "Camacha", "Seixal", "Prazeres", "Ponta do Sol",
    "Nordeste", "Capelas", "Mosteiros",
    "Lagos", "Monte Gordo", "Galé",
    "San Antonio", "Sant Antoni", "San José", "Talamanca", "Inca", "El Arenal", "Punta Prima", "Son Bou",
    "La Laguna", "Arona", "San Agustín", "San Bartolomé", "La Oliva",
    "Pyrgos", "Akrotiri", "Emporio", "Kamari", "Messaria", "Finikia", "Agios Ioannis", "Agios Sostis", "Paradise Beach", "Super Paradise",
    "Agios Nikolaos", "Agia Marina", "Agia Pelagia", "Platanias", "Analipsi", "Kalyves",
    "Chia", "Bosa", "Teulada", "San Teodoro",
    "Kuta", "Amed", "Sidemen",
  ].map((n) => plain(n)),
);

/** Plain name → its region, and whether it is the region itself, its capital or a member. */
let regionIndex: Map<string, { region: Region; as: "region" | "capital" | "member" }> | null = null;
function regionNamed(name: string | null | undefined): { region: Region; as: "region" | "capital" | "member" } | null {
  if (!regionIndex) {
    regionIndex = new Map();
    for (const region of REGIONS) {
      for (const n of [region.tr, region.en, ...(region.aliases ?? [])]) regionIndex.set(plain(n), { region, as: "region" });
      for (const n of region.capital ?? []) regionIndex.set(plain(n), { region, as: "capital" });
      for (const n of region.members) regionIndex.set(plain(n), { region, as: "member" });
    }
  }
  if (!name) return null;
  // "9100-123 Gaula" or "Madeira 9000": the postcode isn't part of the name.
  const key = plain(name.replace(/\b\d[\d-]*\b/g, " "));
  return key ? (regionIndex.get(key) ?? null) : null;
}

const regionName = (r: Region) => L(r.tr, r.en);

/** A destination's name as the table writes it ("Crete" from the model is "Girit" on a Turkish board), else as given. */
export function regionNameOf(name: string): string {
  const found = regionNamed(name);
  return found?.as === "region" ? regionName(found.region) : name;
}

/** A campervan, a motorhome: its "city" is only where it's picked up; the island or region it names is where it goes. */
const MOBILE = /\b(camper ?vans?|campers?|motor ?homes?|karavan|kamp ?arac|rv|indie campers|van ?life|campervan rental)\b/i;
export const isMobileStay = (item: Item): boolean =>
  item.plannedKind === "rv_rental" || MOBILE.test(`${item.name} ${item.provider ?? ""} ${item.optionDetail ?? ""}`);

/** Region names that occur as words in a text ("Campervan hire in Madeira"): only the destinations, never a member. */
function regionsInText(text: string): Region[] {
  const words = ` ${plain(text)} `;
  return REGIONS.filter((r) => [r.tr, r.en, ...(r.aliases ?? [])].some((n) => words.includes(` ${plain(n)} `)));
}

/**
 * The islands and regions the table knows: a place that is one of a region's localities, or whose saved stays name
 * one (or the region) in their address or area, is inside it; a campervan's page naming an island takes it there.
 * Checked like the model's answer (acceptParents), except that an island's capital may be named by its island.
 */
export function tableParents(cities: string[], items: Item[]): Record<string, string> {
  const named = new Map<string, string>();
  for (const c of cities) {
    const key = cityKeyOf(c);
    if (key && !named.has(key)) named.set(key, c.trim());
  }
  // The countries the trip's saves are in (a chat plan has none).
  const tripCountries = new Set(items.filter((i) => i.status !== "dismissed" && i.countryCode).map((i) => i.countryCode!.toUpperCase()));
  const found: Record<string, string> = {};
  const capitals = new Set<string>();
  for (const [key, city] of named) {
    const stays = items.filter((i) => i.category === "stay" && i.status !== "dismissed" && cityKeyOf(i.city) === key);
    // A stay of this place in another country: never in this region.
    const elsewhere = (r: Region) => stays.some((s) => s.countryCode && s.countryCode.toUpperCase() !== r.country);
    const parts = stays.flatMap((i) => [i.location?.area ?? "", ...(i.location?.address ?? "").split(/[,·|]/)]);
    // The region itself, written in an address or an area ("Gaula, Madeira, Portugal"), or on a campervan's page.
    const regionsNamed = new Set<Region>([
      ...[city, ...parts].map(regionNamed).flatMap((h) => (h?.as === "region" ? [h.region] : [])),
      ...stays.filter(isMobileStay).flatMap((i) => regionsInText(`${i.name} ${i.summary} ${i.optionDetail ?? ""}`)),
    ]);
    const counts = (h: { region: Region; as: "region" | "capital" | "member" }, name: string) => {
      const r = h.region;
      if (elsewhere(r)) return false;
      if (h.as === "region" || regionsNamed.has(r)) return true;
      if (h.as === "capital") return knownPlace(cityKeyOf(name)) || tripCountries.has(r.country);
      return !AMBIGUOUS.has(plain(name.replace(/\b\d[\d-]*\b/g, " "))) && tripCountries.has(r.country);
    };
    const hit =
      [city, ...parts].map((name) => ({ name, h: regionNamed(name) })).find(({ name, h }) => h && counts(h, name))?.h ??
      [...regionsNamed].filter((r) => !elsewhere(r)).map((region) => ({ region, as: "region" as const }))[0] ??
      null;
    if (!hit) continue;
    found[key] = regionName(hit.region);
    if (hit.as === "capital" && regionNamed(city)?.as === "capital") capitals.add(key);
  }
  const accepted = acceptParents(cities, found);
  // Palma is a city the app knows (its airport), but on Mallorca the island is the destination, as Funchal is Madeira.
  for (const key of capitals) accepted[key] ??= found[key];
  return accepted;
}

/** Whether a place's own stays name this region in their address or area (one comma part: "…, Madeira, Portugal"). */
function addressNames(key: string, items: Item[], parent: string): boolean {
  const region = regionNamed(parent)?.region;
  if (!region) return false;
  return items
    .filter((i) => i.category === "stay" && i.status !== "dismissed" && cityKeyOf(i.city) === key)
    .flatMap((i) => [i.location?.area ?? "", ...(i.location?.address ?? "").split(/[,·|]/)])
    .some((part) => {
      const h = regionNamed(part);
      return h?.as === "region" && h.region === region;
    });
}

/**
 * The model's answer as it is kept on the trip: the parents it gave (checked), and "" for a place it answered
 * with null on purpose ("not inside anything"), so the table can't fold what the model chose to keep.
 */
export function answerParents(cities: string[], answer: { place: string; parent: string | null }[]): Record<string, string> {
  const keys = new Set(cities.map(cityKeyOf).filter(Boolean));
  const out = acceptParents(cities, answer);
  for (const a of answer) {
    const key = answeredKey(a.place, keys);
    if (key && keys.has(key) && !a.parent?.trim() && !(key in out)) out[key] = "";
  }
  return out;
}

/**
 * The hero's parents: the model's answer when there is one (checked), else the guess from the addresses; the
 * table fills in what neither folded, never a place the model kept on purpose (""). Every name the table knows is
 * written its way, so "Crete" and "Girit" are one destination.
 */
export function resolveParents(cities: string[], items: Item[], known: Record<string, string> | null): Record<string, string> {
  const given = known ? acceptParents(cities, known) : fallbackParents(cities, items);
  const kept = new Set(Object.entries(known ?? {}).flatMap(([k, v]) => (v.trim() ? [] : [k])));
  const out: Record<string, string> = { ...given };
  // A place the model kept (null) still folds on hard evidence: its own stay's address or area names the region
  // ("Gaula, Madeira, Portugal"); the weaker evidence (a save in the country, a capital) doesn't beat the model.
  for (const [key, parent] of Object.entries(tableParents(cities, items)))
    if (!(key in out) && (!kept.has(key) || addressNames(key, items, parent))) out[key] = parent;
  for (const key of Object.keys(out)) out[key] = regionNameOf(out[key]);
  return out;
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
      "Adları Türkçede yaygın yazılışıyla yaz; place alanına yeri listede yazıldığı gibi, parantezdeki ülkesi olmadan yaz (Gaula (Portekiz) → Gaula).",
    ].join(" "),
    [
      "Here are the places a trip sleeps in, in order (with their country when known).",
      "For each place: if it is a smaller locality (town, village, parish, district) inside a bigger destination of this trip,",
      "or inside a well-known island or region, give that bigger destination's common name as parent; otherwise parent is null.",
      "The bigger destination may be another place in the list or a well-known island or region.",
      "Examples: Gaula → Madeira, Funchal → Madeira, Câmara de Lobos → Madeira.",
      "Sintra → Lisbon only if Lisbon is in the list too; otherwise Sintra's parent is null.",
      "Never merge two real cities the traveller stays in separately: Porto and Lisbon stay apart.",
      "Write names as commonly written in English; write place exactly as it is in the list, without the country in brackets (Gaula (Portugal) → Gaula).",
    ].join(" "),
  );

/** What the model is asked: the stay cities in order, each with its country when the saves know it. */
export function placesPrompt(cities: string[], countryOf: (city: string) => string | null): string {
  return `<places>\n${cities.map((c) => (countryOf(c) ? `${c} (${countryOf(c)})` : c)).join("\n")}\n</places>`;
}
