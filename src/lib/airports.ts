// Airport code → the city a traveller would say, for the origin shown in the facts column.
import { L } from "./i18n";

const AIRPORTS: Record<string, [tr: string, en: string]> = {
  IST: ["İstanbul", "Istanbul"], SAW: ["İstanbul", "Istanbul"],
  ESB: ["Ankara", "Ankara"], ADB: ["İzmir", "Izmir"], AYT: ["Antalya", "Antalya"], DLM: ["Dalaman", "Dalaman"],
  BJV: ["Bodrum", "Bodrum"], TZX: ["Trabzon", "Trabzon"],
  LHR: ["Londra", "London"], LGW: ["Londra", "London"], STN: ["Londra", "London"],
  CDG: ["Paris", "Paris"], ORY: ["Paris", "Paris"],
  FRA: ["Frankfurt", "Frankfurt"], MUC: ["Münih", "Munich"], AMS: ["Amsterdam", "Amsterdam"],
  FCO: ["Roma", "Rome"], MAD: ["Madrid", "Madrid"], BCN: ["Barselona", "Barcelona"],
  LIS: ["Lizbon", "Lisbon"], OPO: ["Porto", "Porto"], FNC: ["Funchal", "Funchal"],
  DXB: ["Dubai", "Dubai"], JFK: ["New York", "New York"],
};

/** The country of the airports above (ISO code), for how early to be there (inside Schengen or not). */
const COUNTRY: Record<string, string> = {
  IST: "TR", SAW: "TR", ESB: "TR", ADB: "TR", AYT: "TR", DLM: "TR", BJV: "TR", TZX: "TR",
  LHR: "GB", LGW: "GB", STN: "GB", CDG: "FR", ORY: "FR", FRA: "DE", MUC: "DE", AMS: "NL",
  FCO: "IT", MAD: "ES", BCN: "ES", LIS: "PT", OPO: "PT", FNC: "PT", DXB: "AE", JFK: "US",
};
export const countryOfAirport = (code: string | null | undefined): string | null => (code ? (COUNTRY[code.toUpperCase()] ?? null) : null);

/** The city for an exact 3-letter uppercase airport code; any other text (already a city name) comes back as it is. */
export function cityOfAirport(text: string): string {
  const names = /^[A-Z]{3}$/.test(text) ? AIRPORTS[text] : undefined;
  return names ? L(names[0], names[1]) : text;
}
