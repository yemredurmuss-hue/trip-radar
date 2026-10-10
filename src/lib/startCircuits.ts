// Classic circuits for popular countries (rev 3): a route proposed at once, without the model, for a week or more in
// a country or a large region ("Sri Lanka, 14 gece" → Sigiriya 3 · Kandy 3 · Ella 3 · Mirissa 5). The model's
// proposal refines it when it comes and differs; the generating screen uses it when the model's isn't there yet.
// Also the coordinates the generating screen's map needs: the main cities people leave from, the circuits' stops and
// a few popular places (the destination's country centroid comes from the map data itself). Pure; no imports but i18n.
import { L } from "./i18n";

export interface CircuitStop {
  tr: string;
  en: string;
  lat: number;
  lng: number;
  /** Its share of the nights. */
  weight: number;
  /** Kept first when there are fewer stops than the circuit has (1 most important). */
  rank: 1 | 2 | 3;
  /** A beach stop takes more nights for a beach trip; a culture stop for a culture trip. */
  kind?: "beach" | "culture" | "nature";
}
export interface Circuit {
  /** In travel order. */
  stops: CircuitStop[];
  /**
   * Where flights land and leave when it isn't the first or last stop: its name, and the stops it serves (English
   * names; none: the whole country). Dropped when the stop kept first (in) or last (out) isn't one of them (rev 3:
   * a week in Türkiye without Fethiye never flies home from Dalaman).
   */
  arrive?: Airport;
  leave?: Airport;
}
export interface Airport {
  name: [string, string];
  near?: string[];
}
const A = (tr: string, en: string, near?: string[]): Airport => ({ name: [tr, en], ...(near ? { near } : {}) });

const S = (tr: string, en: string, lat: number, lng: number, weight: number, rank: 1 | 2 | 3, kind?: CircuitStop["kind"]): CircuitStop => ({ tr, en, lat, lng, weight, rank, ...(kind ? { kind } : {}) });

/** By ISO 3166-1 alpha-2 code; "bali" is a region of Indonesia with its own. */
export const CIRCUITS: Record<string, Circuit> = {
  LK: {
    stops: [S("Sigiriya", "Sigiriya", 7.96, 80.76, 2, 3, "culture"), S("Kandy", "Kandy", 7.29, 80.63, 3, 1, "culture"), S("Ella", "Ella", 6.87, 81.05, 3, 2, "nature"), S("Mirissa", "Mirissa", 5.95, 80.46, 5, 1, "beach")],
    arrive: A("Kolombo", "Colombo"),
    leave: A("Kolombo", "Colombo"),
  },
  TH: {
    stops: [S("Bangkok", "Bangkok", 13.76, 100.5, 3, 1, "culture"), S("Chiang Mai", "Chiang Mai", 18.79, 98.98, 3, 2, "nature"), S("Koh Samui", "Koh Samui", 9.51, 100.01, 3, 3, "beach"), S("Krabi", "Krabi", 8.09, 98.91, 4, 1, "beach")],
  },
  VN: {
    stops: [S("Hanoi", "Hanoi", 21.03, 105.85, 3, 1, "culture"), S("Ha Long", "Ha Long", 20.95, 107.08, 2, 3, "nature"), S("Hoi An", "Hoi An", 15.88, 108.33, 4, 1, "culture"), S("Ho Chi Minh", "Ho Chi Minh City", 10.82, 106.63, 3, 2)],
  },
  JP: {
    stops: [S("Tokyo", "Tokyo", 35.68, 139.69, 4, 1, "culture"), S("Hakone", "Hakone", 35.23, 139.11, 2, 3, "nature"), S("Kyoto", "Kyoto", 35.01, 135.77, 4, 1, "culture"), S("Osaka", "Osaka", 34.69, 135.5, 2, 2)],
  },
  IT: {
    stops: [S("Venedik", "Venice", 45.44, 12.33, 2, 2, "culture"), S("Floransa", "Florence", 43.77, 11.26, 3, 1, "culture"), S("Roma", "Rome", 41.9, 12.5, 4, 1, "culture"), S("Amalfi", "Amalfi", 40.63, 14.6, 3, 3, "beach")],
    leave: A("Napoli", "Naples", ["Amalfi"]),
  },
  PT: {
    stops: [S("Porto", "Porto", 41.15, -8.61, 3, 1, "culture"), S("Coimbra", "Coimbra", 40.2, -8.41, 1, 3, "culture"), S("Lizbon", "Lisbon", 38.72, -9.14, 4, 1, "culture"), S("Lagos", "Lagos", 37.1, -8.67, 3, 2, "beach")],
    leave: A("Faro", "Faro", ["Lagos"]),
  },
  ES: {
    stops: [S("Barselona", "Barcelona", 41.39, 2.17, 4, 1, "culture"), S("Madrid", "Madrid", 40.42, -3.7, 3, 2, "culture"), S("Sevilla", "Seville", 37.39, -5.98, 3, 1, "culture"), S("Granada", "Granada", 37.18, -3.6, 2, 3, "culture")],
    leave: A("Malaga", "Malaga", ["Granada"]),
  },
  GR: {
    stops: [S("Atina", "Athens", 37.98, 23.73, 2, 1, "culture"), S("Paros", "Paros", 37.08, 25.15, 3, 3, "beach"), S("Naksos", "Naxos", 37.1, 25.38, 3, 2, "beach"), S("Santorini", "Santorini", 36.39, 25.46, 3, 1, "beach")],
  },
  TR: {
    stops: [S("İstanbul", "Istanbul", 41.01, 28.98, 3, 1, "culture"), S("Kapadokya", "Cappadocia", 38.64, 34.83, 3, 1, "nature"), S("Selçuk", "Selçuk", 37.95, 27.37, 2, 3, "culture"), S("Fethiye", "Fethiye", 36.62, 29.12, 4, 2, "beach")],
    leave: A("Dalaman", "Dalaman", ["Fethiye"]),
  },
  ID: {
    stops: [S("Yogyakarta", "Yogyakarta", -7.8, 110.36, 3, 3, "culture"), S("Ubud", "Ubud", -8.51, 115.26, 4, 1, "culture"), S("Gili Air", "Gili Air", -8.36, 116.08, 3, 2, "beach"), S("Uluwatu", "Uluwatu", -8.83, 115.09, 3, 1, "beach")],
    leave: A("Denpasar", "Denpasar", ["Ubud", "Uluwatu", "Gili Air"]),
  },
  bali: {
    stops: [S("Ubud", "Ubud", -8.51, 115.26, 4, 1, "culture"), S("Sidemen", "Sidemen", -8.48, 115.44, 2, 3, "nature"), S("Canggu", "Canggu", -8.65, 115.13, 3, 2, "beach"), S("Uluwatu", "Uluwatu", -8.83, 115.09, 3, 1, "beach")],
    arrive: A("Denpasar", "Denpasar"),
    leave: A("Denpasar", "Denpasar"),
  },
  MA: {
    stops: [S("Marakeş", "Marrakesh", 31.63, -7.99, 4, 1, "culture"), S("Merzouga", "Merzouga", 31.1, -4.01, 2, 2, "nature"), S("Fes", "Fes", 34.03, -5.0, 3, 1, "culture"), S("Şefşavan", "Chefchaouen", 35.17, -5.27, 2, 3, "culture")],
    leave: A("Fes", "Fes", ["Fes"]),
  },
  PE: {
    stops: [S("Lima", "Lima", -12.05, -77.04, 2, 2), S("Arequipa", "Arequipa", -16.41, -71.54, 3, 3, "culture"), S("Cusco", "Cusco", -13.53, -71.97, 4, 1, "culture"), S("Urubamba", "Urubamba", -13.31, -72.12, 2, 1, "nature")],
    leave: A("Cusco", "Cusco", ["Cusco", "Urubamba"]),
  },
  MX: {
    stops: [S("Meksiko", "Mexico City", 19.43, -99.13, 3, 1, "culture"), S("Oaxaca", "Oaxaca", 17.07, -96.73, 3, 2, "culture"), S("Mérida", "Mérida", 20.97, -89.62, 2, 3, "culture"), S("Tulum", "Tulum", 20.21, -87.47, 4, 1, "beach")],
    leave: A("Cancún", "Cancún", ["Tulum", "Mérida"]),
  },
};

/** How many stops for so many nights: a week 2, ten nights 3, two weeks and more 4 (never more than the circuit has). */
export const stopsFor = (nights: number): number => (nights < 7 ? 1 : nights < 10 ? 2 : nights < 14 ? 3 : 4);

/**
 * The circuit fitted to the nights and the style: its most important stops kept (in travel order), the nights shared
 * by weight (a beach trip gives the beach more, a culture trip the towns), every stop at least one night, the
 * shares adding up exactly. Names in the language now (L).
 */
export function fitCircuit(c: Circuit, total: number, styles: readonly string[] = []): { stops: { city: string; nights: number }[]; arrive: string | null; leave: string | null } | null {
  const n = Math.min(stopsFor(total), c.stops.length);
  if (n < 2 || total < n) return null;
  const kept = c.stops
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.rank - b.s.rank || b.s.weight - a.s.weight || a.i - b.i)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  const boost = (s: CircuitStop) => (s.kind && styles.includes(s.kind) ? 1.5 : 1);
  const weights = kept.map((s) => s.weight * boost(s));
  const sum = weights.reduce((a, b) => a + b, 0);
  // At least one night each; the rest by largest remainder.
  const rest = total - n;
  const exact = weights.map((w) => (rest * w) / sum);
  const nights = exact.map((x) => 1 + Math.floor(x));
  let left = total - nights.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ r: x - Math.floor(x), i })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) nights[order[k].i]++;
  // An airport only when the stop it serves is kept, first (in) or last (out).
  const name = (a: Airport | undefined, by: CircuitStop) => (a && (!a.near || a.near.includes(by.en)) ? L(a.name[0], a.name[1]) : null);
  return { stops: kept.map((s, i) => ({ city: L(s.tr, s.en), nights: nights[i] })), arrive: name(c.arrive, kept[0]), leave: name(c.leave, kept[kept.length - 1]) };
}

// --- coordinates for the map --------------------------------------------------------------------------------------

/** Lower case, no accents, no spaces ("İstanbul", "Istanbul" and "istanbul" alike). */
export const coordKey = (s: string): string =>
  s
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]/gu, "");

/** [names…, lat, lng]: the cities people leave from most, and popular places the start knows. */
const PLACES: [string[], number, number][] = [
  [["İstanbul", "Istanbul"], 41.01, 28.98], [["Ankara"], 39.93, 32.86], [["İzmir", "Izmir"], 38.42, 27.14], [["Antalya"], 36.9, 30.7],
  [["Bodrum"], 37.03, 27.43], [["Dalaman"], 36.77, 28.8], [["Trabzon"], 41.0, 39.72], [["Adana"], 37.0, 35.32], [["Kayseri"], 38.73, 35.48],
  [["Bursa"], 40.19, 29.06], [["Gaziantep"], 37.07, 37.38], [["Kapadokya", "Cappadocia"], 38.64, 34.83],
  [["Berlin"], 52.52, 13.4], [["Londra", "London"], 51.51, -0.13], [["Amsterdam"], 52.37, 4.9], [["Paris"], 48.86, 2.35],
  [["Münih", "Munich", "München"], 48.14, 11.58], [["Frankfurt"], 50.11, 8.68], [["Hamburg"], 53.55, 9.99], [["Köln", "Cologne"], 50.94, 6.96],
  [["Düsseldorf"], 51.23, 6.77], [["Stuttgart"], 48.78, 9.18], [["Viyana", "Vienna", "Wien"], 48.21, 16.37], [["Zürih", "Zurich", "Zürich"], 47.38, 8.54],
  [["Brüksel", "Brussels"], 50.85, 4.35], [["Kopenhag", "Copenhagen"], 55.68, 12.57], [["Stockholm"], 59.33, 18.07], [["Oslo"], 59.91, 10.75],
  [["Helsinki"], 60.17, 24.94], [["Varşova", "Warsaw"], 52.23, 21.01], [["Prag", "Prague"], 50.08, 14.44], [["Budapeşte", "Budapest"], 47.5, 19.04],
  [["Madrid"], 40.42, -3.7], [["Barselona", "Barcelona"], 41.39, 2.17], [["Lizbon", "Lisbon", "Lisboa"], 38.72, -9.14], [["Porto"], 41.15, -8.61],
  [["Roma", "Rome"], 41.9, 12.5], [["Milano", "Milan"], 45.46, 9.19], [["Atina", "Athens"], 37.98, 23.73], [["Dublin"], 53.35, -6.26],
  [["New York"], 40.71, -74.01], [["Los Angeles", "LA"], 34.05, -118.24], [["San Francisco"], 37.77, -122.42], [["Chicago"], 41.88, -87.63],
  [["Toronto"], 43.65, -79.38], [["Sydney"], -33.87, 151.21], [["Manchester"], 53.48, -2.24], [["Abu Dabi", "Abu Dhabi"], 24.45, 54.38], [["Dubai"], 25.2, 55.27], [["Doha"], 25.29, 51.53], [["Kahire", "Cairo"], 30.04, 31.24], [["Tiflis", "Tbilisi"], 41.72, 44.79],
  [["Bali"], -8.41, 115.19], [["Denpasar"], -8.65, 115.22], [["Madeira", "Funchal"], 32.65, -16.91], [["Tokyo"], 35.68, 139.69], [["Kyoto"], 35.01, 135.77],
  [["Bangkok"], 13.76, 100.5], [["Phuket"], 7.88, 98.39], [["Koh Phangan"], 9.73, 100.01], [["Koh Samui", "Samui"], 9.51, 100.01], [["Koh Tao"], 10.1, 99.84],
  [["Koh Lanta"], 7.62, 99.04], [["Krabi"], 8.09, 98.91], [["Chiang Mai"], 18.79, 98.98], [["Santorini"], 36.39, 25.46], [["Maldivler", "Maldives", "Malé", "Male"], 4.18, 73.51],
  [["Kolombo", "Colombo"], 6.93, 79.85], [["Galle"], 6.03, 80.22], [["Singapur", "Singapore"], 1.35, 103.82], [["Mauritius"], -20.25, 57.55],
  [["Napoli", "Naples"], 40.85, 14.27], [["Faro"], 37.02, -7.93], [["Malaga"], 36.72, -4.42], [["Cancún", "Cancun"], 21.16, -86.85], [["Venedik", "Venice"], 45.44, 12.33],
  // The events' places and the cities flights land in for them (startEvents.ts), so their routes draw (2026-10-06).
  [["Tankwa Karoo"], -32.33, 19.75], [["Cape Town", "Kapstadt"], -33.92, 18.42], [["Black Rock City"], 40.79, -119.2], [["Reno"], 39.53, -119.81],
  [["Boom"], 51.09, 4.37], [["Glastonbury"], 51.15, -2.71], [["Bristol"], 51.45, -2.59], [["Indio"], 33.72, -116.22], [["Rio de Janeiro"], -22.91, -43.17],
  [["Buñol", "Bunol"], 39.42, -0.79], [["Valencia"], 39.47, -0.38], [["Pamplona"], 42.81, -1.64], [["Mathura"], 27.49, 77.67], [["Delhi", "New Delhi"], 28.61, 77.21],
  [["Jaipur"], 26.91, 75.79], [["Hong Kong"], 22.32, 114.17], [["Tromsø", "Tromso"], 69.65, 18.96], [["Roskilde"], 55.64, 12.08], [["Miami"], 25.76, -80.19],
  [["Las Vegas"], 36.17, -115.14], [["Monako", "Monaco"], 43.74, 7.42], [["Nice"], 43.7, 7.27], [["Silverstone"], 52.07, -1.02], [["Monza"], 45.58, 9.27],
  [["Spa-Francorchamps", "Spa"], 50.44, 5.97], [["Edinburgh"], 55.95, -3.19], [["New Orleans"], 29.95, -90.07], [["Mekke", "Mecca"], 21.39, 39.86],
  [["Cidde", "Jeddah"], 21.49, 39.19], [["Haridwar"], 29.95, 78.16], [["Lyon"], 45.76, 4.84], [["Nürnberg", "Nuremberg"], 49.45, 11.08],
  [["Albuquerque"], 35.08, -106.65], [["Katmandu", "Kathmandu"], 27.72, 85.32], [["Santiago"], -33.45, -70.67], [["Münih", "Munich"], 48.14, 11.58],
];

const COORDS = new Map<string, { lat: number; lng: number }>();
for (const [names, lat, lng] of PLACES) for (const n of names) COORDS.set(coordKey(n), { lat, lng });
for (const c of Object.values(CIRCUITS)) for (const s of c.stops) for (const n of [s.tr, s.en]) if (!COORDS.has(coordKey(n))) COORDS.set(coordKey(n), { lat: s.lat, lng: s.lng });

/** A place's coordinates when the table knows it ("İstanbul", "Kandy", "Koh Samui"); null for anything else. */
export function cityCoord(name: string | null | undefined): { lat: number; lng: number } | null {
  if (!name) return null;
  return COORDS.get(coordKey(name)) ?? COORDS.get(coordKey(name.split(/[,(]/)[0])) ?? null;
}

/** Small countries the 1:110m map has no outline for (their capital or main island). */
export const SMALL_COUNTRIES: Record<string, [lat: number, lng: number]> = {
  MV: [4.18, 73.51], SG: [1.35, 103.82], MU: [-20.25, 57.55], BH: [26.07, 50.56], MT: [35.9, 14.45], SC: [-4.62, 55.45], AD: [42.51, 1.52],
  MC: [43.74, 7.42], LI: [47.14, 9.55], LU: [49.61, 6.13], CV: [15.12, -23.6], BB: [13.19, -59.54], HK: [22.32, 114.17], MO: [22.2, 113.55],
};

/** A circuit stop's English name ("Floransa" → "Florence"), for the photo search; null for any other place. */
export function englishName(name: string): string | null {
  const k = coordKey(name);
  for (const c of Object.values(CIRCUITS)) for (const s of c.stops) if (coordKey(s.tr) === k || coordKey(s.en) === k) return s.en;
  return null;
}
