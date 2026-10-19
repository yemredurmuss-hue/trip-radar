// An airline's two-character IATA code, from its flight number ("TK 52") or its name as a page or a source writes it
// ("Turkish Airlines", "Türk Hava Yolları"), and where its logo is read: the same logo files the flight card has used
// since 0.36.18 (Kiwi, else Aviasales; FlightTicket.AirlineLogo). Only airlines listed here by name: one we don't know
// keeps its letters on a colour, never a code made up from its name.

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

/** The airlines' own colours, where the mark is drawn without its logo (white letters on them). */
const COLORS: Readonly<Record<string, string>> = {
  TK: "#c8102e", QR: "#5c0632", EK: "#d71920", LH: "#05164d", KL: "#00a1de", AF: "#002157", BA: "#075aaa", SQ: "#1d2a5c",
};

/** The airline's code: its flight number's ("TK52", "TK 52"), else its name's from the table above; null otherwise. */
export function airlineCode(name: string | null | undefined, flightNumber: string | null | undefined = null): string | null {
  const own = flightNumber?.trim().match(/^([A-Z][A-Z0-9]|[0-9][A-Z])\s*\d/)?.[1];
  if (own) return own;
  const n = name?.trim();
  if (!n) return null;
  return AIRLINES.find(([re]) => re.test(n))?.[1] ?? null;
}

export const airlineColor = (code: string | null): string | null => (code ? (COLORS[code] ?? null) : null);

/** Where the airline's logo is read, first and the one to try when it won't load. */
export const airlineLogos = (code: string): [string, string] => [`https://images.kiwi.com/airlines/64/${code}.png`, `https://pics.avs.io/128/128/${code}.png`];
