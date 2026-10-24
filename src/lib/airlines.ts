// An airline's two-character IATA code, from its flight number ("TK 52") or its name as a page or a source writes it
// ("Turkish Airlines", "Türk Hava Yolları"), and where its logo is read: the same logo files the flight card has used
// since 0.36.18 (Kiwi, else Aviasales; FlightTicket.AirlineLogo). The library (0.46.0, Emre onayladı): every active
// airline's name (OpenFlights) and 785 logos in the extension (airlogos; VF left out, it is AJet now), the rest read once from Kiwi and kept by the
// browser. One we can't name keeps its letters on a colour, never a code made up from its name.
import { AIRLINE_NAMES, LOGO_CODES } from "./airlineData";

const AIRLINES: readonly [RegExp, string][] = [
  [/turkish airlines|t[üu]rk hava yollar[ıi]|^thy$/i, "TK"],
  [/pegasus/i, "PC"],
  [/\bajet\b|anadolujet/i, "VF"],
  [/sunexpress/i, "XQ"],
  [/qatar airways|^qatar$/i, "QR"],
  [/emirates/i, "EK"],
  [/etihad/i, "EY"],
  [/flydubai/i, "FZ"],
  [/oman air/i, "WY"],
  [/saudia/i, "SV"],
  [/lufthansa/i, "LH"],
  [/\bklm\b/i, "KL"],
  [/air france/i, "AF"],
  [/british airways/i, "BA"],
  [/swiss international|^swiss$/i, "LX"],
  [/austrian airlines|^austrian$/i, "OS"],
  [/aegean/i, "A3"],
  [/tap air portugal|^tap( portugal)?$/i, "TP"],
  [/iberia/i, "IB"],
  [/vueling/i, "VY"],
  [/ryanair/i, "FR"],
  [/easyjet/i, "U2"],
  [/singapore airlines/i, "SQ"],
  [/garuda/i, "GA"],
  [/batik air/i, "ID"],
  [/lion air/i, "JT"],
  [/malaysia airlines/i, "MH"],
  [/thai airways/i, "TG"],
  [/cathay pacific/i, "CX"],
  [/japan airlines/i, "JL"],
  [/all nippon|^ana$/i, "NH"],
  [/korean air/i, "KE"],
  [/srilankan/i, "UL"],
  [/air india/i, "AI"],
];

/** South America's, as the sites write them (Patagonia, 0.46.0): looked at for a flight only, like the library. */
const MORE: readonly [RegExp, string][] = [
  [/aerol[ií]neas argentinas/i, "AR"],
  [/\blatam\b/i, "LA"],
  [/jetsmart|jet smart/i, "JA"],
  [/flybondi/i, "FO"],
  [/\bsky airline\b|^sky$/i, "H2"],
  [/\bgol\b(?! ?f)/i, "G3"],
  [/\bazul\b/i, "AD"],
  [/avianca/i, "AV"],
  [/copa airlines|^copa$/i, "CM"],
  // (the library's names are old in places: its "Indigo" is a closed I9, IndiGo flies as 6E)
  [/\bindigo\b/i, "6E"],
];

/** Words every airline has: a name made of these alone says nothing. */
const GENERIC = new Set(["air", "airline", "airlines", "airways", "aviation", "express", "jet", "international", "regional", "connect", "cargo", "lines", "the", "de", "of", "and"]);
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let NAMED: { name: string; code: string }[] | null = null;
/** The library's names, folded, the specific ones only (at least one word that isn't "Air", "Airlines"…), longest first. */
const named = () =>
  (NAMED ??= AIRLINE_NAMES.map(([n, code]) => ({ name: fold(n), code }))
    .filter((x) => x.name.length >= 4 && x.name.split(" ").some((w) => w.length > 2 && !GENERIC.has(w)))
    .sort((a, b) => b.name.length - a.name.length));

/** The airline a name is, from the library: its whole name in the words given ("Aerolineas Argentinas S.A." → AR). */
export function airlineByName(text: string): string | null {
  const t = ` ${fold(text)} `;
  if (t.trim().length < 3) return null;
  return named().find((x) => t.includes(` ${x.name} `))?.code ?? null;
}

/** The airlines' own colours, where the mark is drawn without its logo (white letters on them). */
const COLORS: Readonly<Record<string, string>> = {
  TK: "#c8102e", QR: "#5c0632", EK: "#d71920", LH: "#05164d", KL: "#00a1de", AF: "#002157", BA: "#075aaa", SQ: "#1d2a5c",
};

/**
 * The airline's code: its flight number's ("TK52", "TK 52"), else its name's from the table above, else (a flight's, never a
 * train's or a ferry's operator) from the library; null otherwise.
 */
export function airlineCode(name: string | null | undefined, flightNumber: string | null | undefined = null, library = true): string | null {
  const own = flightNumber?.trim().match(/^([A-Z][A-Z0-9]|[0-9][A-Z])\s*\d/)?.[1];
  if (own) return own;
  const n = name?.trim();
  if (!n) return null;
  return AIRLINES.find(([re]) => re.test(n))?.[1] ?? (library ? (MORE.find(([re]) => re.test(n))?.[1] ?? airlineByName(n)) : null);
}

export const airlineColor = (code: string | null): string | null => (code ? (COLORS[code] ?? null) : null);

/**
 * The logos in the extension itself (onay paketi 2026-10-22: "her logo gelsin"; airlogos, MIT, static/licenses): all the
 * package has but a code since handed to another airline (scripts/airline-data.mjs STALE: VF is AJet, not Fly Viking),
 * read with nothing fetched. Any other is read from Kiwi, else Aviasales (and kept by the browser).
 */
const BUNDLED: ReadonlySet<string> = new Set(LOGO_CODES.split(" "));

/** Where the airline's logo is read, first and the one to try when it won't load. */
export const airlineLogos = (code: string): [string, string] =>
  BUNDLED.has(code) ? [`logos/airlines/${code}.png`, `https://images.kiwi.com/airlines/64/${code}.png`] : [`https://images.kiwi.com/airlines/64/${code}.png`, `https://pics.avs.io/128/128/${code}.png`];
