// Airport code → the city a traveller would say, for the origin shown in the facts column and the day's
// lines ("İstanbul → Kopenhag", not "SAW → CPH"); and the airport's own name for the grey line under it.
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
  CPH: ["Kopenhag", "Copenhagen"], BER: ["Berlin", "Berlin"], VIE: ["Viyana", "Vienna"], ZRH: ["Zürih", "Zurich"],
  BRU: ["Brüksel", "Brussels"], DUB: ["Dublin", "Dublin"], ATH: ["Atina", "Athens"], PRG: ["Prag", "Prague"],
  BUD: ["Budapeşte", "Budapest"], WAW: ["Varşova", "Warsaw"], ARN: ["Stockholm", "Stockholm"], OSL: ["Oslo", "Oslo"],
  HEL: ["Helsinki", "Helsinki"], MXP: ["Milano", "Milan"], VCE: ["Venedik", "Venice"], NAP: ["Napoli", "Naples"],
  NCE: ["Nice", "Nice"], PMI: ["Palma", "Palma"], AGP: ["Malaga", "Malaga"], SVQ: ["Sevilla", "Seville"],
  FAO: ["Faro", "Faro"], PDL: ["Ponta Delgada", "Ponta Delgada"], DOH: ["Doha", "Doha"],
  ALC: ["Alicante", "Alicante"], VLC: ["Valensiya", "Valencia"], BIO: ["Bilbao", "Bilbao"], IBZ: ["İbiza", "Ibiza"],
  TFS: ["Tenerife", "Tenerife"], LPA: ["Gran Canaria", "Gran Canaria"], GVA: ["Cenevre", "Geneva"], LYS: ["Lyon", "Lyon"],
  MRS: ["Marsilya", "Marseille"], MAN: ["Manchester", "Manchester"], EDI: ["Edinburgh", "Edinburgh"], BLQ: ["Bologna", "Bologna"],
  FLR: ["Floransa", "Florence"], CTA: ["Katanya", "Catania"], DBV: ["Dubrovnik", "Dubrovnik"], SPU: ["Split", "Split"],
  KRK: ["Krakov", "Krakow"], SOF: ["Sofya", "Sofia"], OTP: ["Bükreş", "Bucharest"], BEG: ["Belgrad", "Belgrade"],
  LCA: ["Larnaka", "Larnaca"], ECN: ["Lefkoşa", "Nicosia"], TLV: ["Tel Aviv", "Tel Aviv"], CAI: ["Kahire", "Cairo"],
  RAK: ["Marakeş", "Marrakesh"], DPS: ["Bali", "Bali"], BKK: ["Bangkok", "Bangkok"], HKT: ["Phuket", "Phuket"],
  HND: ["Tokyo", "Tokyo"], NRT: ["Tokyo", "Tokyo"], KIX: ["Osaka", "Osaka"], ITM: ["Osaka", "Osaka"], NGO: ["Nagoya", "Nagoya"],
  FUK: ["Fukuoka", "Fukuoka"], CTS: ["Sapporo", "Sapporo"], ICN: ["Seul", "Seoul"], HKG: ["Hong Kong", "Hong Kong"],
  SIN: ["Singapur", "Singapore"], KUL: ["Kuala Lumpur", "Kuala Lumpur"], CMB: ["Kolombo", "Colombo"], MLE: ["Male", "Malé"],
  DEL: ["Delhi", "Delhi"], BOM: ["Mumbai", "Mumbai"], AUH: ["Abu Dabi", "Abu Dhabi"], HRG: ["Hurgada", "Hurghada"],
  SSH: ["Şarm El-Şeyh", "Sharm El Sheikh"], NBO: ["Nairobi", "Nairobi"], JNB: ["Johannesburg", "Johannesburg"], CPT: ["Cape Town", "Cape Town"],
  EWR: ["New York", "New York"], LAX: ["Los Angeles", "Los Angeles"], SFO: ["San Francisco", "San Francisco"], MIA: ["Miami", "Miami"],
  ORD: ["Chicago", "Chicago"], YYZ: ["Toronto", "Toronto"], MEX: ["Meksiko", "Mexico City"], GRU: ["São Paulo", "São Paulo"],
  EZE: ["Buenos Aires", "Buenos Aires"],
  // Argentina and Chile (0.38.8, Patagonya): the trip's flights inside them are said by these codes.
  AEP: ["Buenos Aires", "Buenos Aires"], USH: ["Ushuaia", "Ushuaia"], FTE: ["El Calafate", "El Calafate"], BRC: ["Bariloche", "Bariloche"],
  IGR: ["Iguazú", "Iguazú"], MDZ: ["Mendoza", "Mendoza"], COR: ["Córdoba", "Córdoba"], SLA: ["Salta", "Salta"], REL: ["Trelew", "Trelew"],
  SCL: ["Santiago", "Santiago"], PUQ: ["Punta Arenas", "Punta Arenas"], PNT: ["Puerto Natales", "Puerto Natales"],
  PMC: ["Puerto Montt", "Puerto Montt"], CJC: ["Calama", "Calama"], IPC: ["Paskalya Adası", "Easter Island"],
  // Other places many trips fly to.
  GIG: ["Rio de Janeiro", "Rio de Janeiro"], LIM: ["Lima", "Lima"], CUZ: ["Cusco", "Cusco"], BOG: ["Bogota", "Bogotá"],
  CTG: ["Cartagena", "Cartagena"], MVD: ["Montevideo", "Montevideo"], UIO: ["Quito", "Quito"], PTY: ["Panama", "Panama City"],
  CUN: ["Cancun", "Cancún"], HAV: ["Havana", "Havana"], PUJ: ["Punta Cana", "Punta Cana"],
  LAS: ["Las Vegas", "Las Vegas"], MCO: ["Orlando", "Orlando"], BOS: ["Boston", "Boston"], SEA: ["Seattle", "Seattle"], HNL: ["Honolulu", "Honolulu"],
  YVR: ["Vancouver", "Vancouver"], YUL: ["Montreal", "Montreal"],
  KEF: ["Reykjavik", "Reykjavík"], TBS: ["Tiflis", "Tbilisi"], GYD: ["Bakü", "Baku"], EVN: ["Erivan", "Yerevan"], MLA: ["Malta", "Malta"],
  SKG: ["Selanik", "Thessaloniki"], JTR: ["Santorini", "Santorini"], JMK: ["Mikonos", "Mykonos"], HER: ["Kandiye", "Heraklion"],
  RHO: ["Rodos", "Rhodes"], CFU: ["Korfu", "Corfu"], TIA: ["Tiran", "Tirana"], ZAG: ["Zagreb", "Zagreb"], LJU: ["Ljubljana", "Ljubljana"],
  RIX: ["Riga", "Riga"], TLL: ["Tallinn", "Tallinn"], VNO: ["Vilnius", "Vilnius"],
  CMN: ["Kazablanka", "Casablanca"], TUN: ["Tunus", "Tunis"], ADD: ["Addis Ababa", "Addis Ababa"], ZNZ: ["Zanzibar", "Zanzibar"],
  MRU: ["Mauritius", "Mauritius"], AMM: ["Amman", "Amman"], MCT: ["Maskat", "Muscat"],
  DMK: ["Bangkok", "Bangkok"], CNX: ["Chiang Mai", "Chiang Mai"], KBV: ["Krabi", "Krabi"], USM: ["Koh Samui", "Koh Samui"],
  SGN: ["Ho Chi Minh", "Ho Chi Minh City"], HAN: ["Hanoi", "Hanoi"], DAD: ["Da Nang", "Da Nang"], CGK: ["Cakarta", "Jakarta"],
  MNL: ["Manila", "Manila"], PEK: ["Pekin", "Beijing"], PKX: ["Pekin", "Beijing"], PVG: ["Şanghay", "Shanghai"], SHA: ["Şanghay", "Shanghai"],
  TPE: ["Taipei", "Taipei"], KTM: ["Katmandu", "Kathmandu"],
  SYD: ["Sidney", "Sydney"], MEL: ["Melbourne", "Melbourne"], AKL: ["Auckland", "Auckland"], ZQN: ["Queenstown", "Queenstown"],
};

/** The airport's own name, where it isn't only its city's ("Sabiha Gökçen", "Kastrup"). */
const NAMES: Record<string, [tr: string, en: string]> = {
  IST: ["İstanbul Havalimanı", "Istanbul Airport"], SAW: ["Sabiha Gökçen", "Sabiha Gökçen"], ESB: ["Esenboğa", "Esenboğa"],
  ADB: ["Adnan Menderes", "Adnan Menderes"], BJV: ["Milas-Bodrum", "Milas-Bodrum"],
  LHR: ["Heathrow", "Heathrow"], LGW: ["Gatwick", "Gatwick"], STN: ["Stansted", "Stansted"],
  CDG: ["Charles de Gaulle", "Charles de Gaulle"], ORY: ["Orly", "Orly"], AMS: ["Schiphol", "Schiphol"],
  FCO: ["Fiumicino", "Fiumicino"], MAD: ["Barajas", "Barajas"], BCN: ["El Prat", "El Prat"],
  LIS: ["Humberto Delgado", "Humberto Delgado"], OPO: ["Francisco Sá Carneiro", "Francisco Sá Carneiro"],
  CPH: ["Kastrup", "Kastrup"], BER: ["Brandenburg", "Brandenburg"], ARN: ["Arlanda", "Arlanda"], OSL: ["Gardermoen", "Gardermoen"],
  MXP: ["Malpensa", "Malpensa"], VCE: ["Marco Polo", "Marco Polo"], ATH: ["Venizelos", "Venizelos"], PRG: ["Václav Havel", "Václav Havel"],
  WAW: ["Chopin", "Chopin"], JFK: ["JFK", "JFK"], DOH: ["Hamad", "Hamad"],
  HND: ["Haneda", "Haneda"], NRT: ["Narita", "Narita"], KIX: ["Kansai", "Kansai"], ITM: ["Itami", "Itami"], ICN: ["Incheon", "Incheon"],
  SIN: ["Changi", "Changi"], EWR: ["Newark", "Newark"],
  EZE: ["Ezeiza", "Ezeiza"], AEP: ["Aeroparque", "Aeroparque"], SCL: ["Arturo Merino Benítez", "Arturo Merino Benítez"],
  GIG: ["Galeão", "Galeão"], KEF: ["Keflavík", "Keflavík"], DMK: ["Don Mueang", "Don Mueang"], PKX: ["Daxing", "Daxing"],
  PVG: ["Pudong", "Pudong"], SHA: ["Hongqiao", "Hongqiao"], CGK: ["Soekarno-Hatta", "Soekarno-Hatta"],
};

/**
 * An airport named above by its island or region ("Bali"), the town it is in: what the road from it starts at ("Denpasar
 * (DPS) → Canggu", 0.38.6), while the region still matches a stay said as "Bali".
 */
const TOWNS: Record<string, [tr: string, en: string]> = { DPS: ["Denpasar", "Denpasar"] };
export function airportTown(text: string | null | undefined): string | null {
  const names = text && isCode(text) ? TOWNS[text] : undefined;
  return names ? L(names[0], names[1]) : null;
}

/** Other names an airport above goes by, where its town isn't its city ("Milas" for Bodrum's). */
const ALSO: Record<string, readonly string[]> = { BJV: ["Milas"], DPS: ["Ngurah Rai"] };

const plainName = (s: string) =>
  s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();

/** An airport's town, own name or other name (plain) → its code. */
const BY_NAME = new Map<string, string>(
  [TOWNS, NAMES, ALSO].flatMap((table) => Object.entries(table).flatMap(([code, names]) => names.map((n) => [plainName(n), code] as const))),
);

/**
 * The city an airport is listed under, in English, for a flight's end said as its code ("DPS"), its town ("Denpasar"),
 * its own name ("Milas-Bodrum") or another name ("Milas"): a flight's ends said differently are the same way (0.38.7:
 * "BJV → DPS" and "Bodrum → Bali"). Null for any other text (a city is compared by its own name).
 */
export function airportCityOf(text: string | null | undefined): string | null {
  const t = text?.trim();
  if (!t) return null;
  const code = isCode(t) ? t : BY_NAME.get(plainName(t));
  return (code && AIRPORTS[code]?.[1]) || null;
}

/** The country of the airports above (ISO code), for how early to be there (inside Schengen or not). */
const COUNTRY: Record<string, string> = {
  IST: "TR", SAW: "TR", ESB: "TR", ADB: "TR", AYT: "TR", DLM: "TR", BJV: "TR", TZX: "TR",
  LHR: "GB", LGW: "GB", STN: "GB", CDG: "FR", ORY: "FR", FRA: "DE", MUC: "DE", AMS: "NL",
  FCO: "IT", MAD: "ES", BCN: "ES", LIS: "PT", OPO: "PT", FNC: "PT", DXB: "AE", JFK: "US",
  CPH: "DK", BER: "DE", VIE: "AT", ZRH: "CH", BRU: "BE", DUB: "IE", ATH: "GR", PRG: "CZ", BUD: "HU", WAW: "PL",
  ARN: "SE", OSL: "NO", HEL: "FI", MXP: "IT", VCE: "IT", NAP: "IT", NCE: "FR", PMI: "ES", AGP: "ES", SVQ: "ES",
  FAO: "PT", PDL: "PT", DOH: "QA",
  ALC: "ES", VLC: "ES", BIO: "ES", IBZ: "ES", TFS: "ES", LPA: "ES", GVA: "CH", LYS: "FR", MRS: "FR", MAN: "GB", EDI: "GB",
  BLQ: "IT", FLR: "IT", CTA: "IT", DBV: "HR", SPU: "HR", KRK: "PL", SOF: "BG", OTP: "RO", BEG: "RS", LCA: "CY", ECN: "CY",
  TLV: "IL", CAI: "EG", RAK: "MA", DPS: "ID", BKK: "TH", HKT: "TH",
  HND: "JP", NRT: "JP", KIX: "JP", ITM: "JP", NGO: "JP", FUK: "JP", CTS: "JP", ICN: "KR", HKG: "HK", SIN: "SG", KUL: "MY",
  CMB: "LK", MLE: "MV", DEL: "IN", BOM: "IN", AUH: "AE", HRG: "EG", SSH: "EG", NBO: "KE", JNB: "ZA", CPT: "ZA",
  EWR: "US", LAX: "US", SFO: "US", MIA: "US", ORD: "US", YYZ: "CA", MEX: "MX", GRU: "BR", EZE: "AR",
  AEP: "AR", USH: "AR", FTE: "AR", BRC: "AR", IGR: "AR", MDZ: "AR", COR: "AR", SLA: "AR", REL: "AR",
  SCL: "CL", PUQ: "CL", PNT: "CL", PMC: "CL", CJC: "CL", IPC: "CL",
  GIG: "BR", LIM: "PE", CUZ: "PE", BOG: "CO", CTG: "CO", MVD: "UY", UIO: "EC", PTY: "PA", CUN: "MX", HAV: "CU", PUJ: "DO",
  LAS: "US", MCO: "US", BOS: "US", SEA: "US", HNL: "US", YVR: "CA", YUL: "CA",
  KEF: "IS", TBS: "GE", GYD: "AZ", EVN: "AM", MLA: "MT", SKG: "GR", JTR: "GR", JMK: "GR", HER: "GR", RHO: "GR", CFU: "GR",
  TIA: "AL", ZAG: "HR", LJU: "SI", RIX: "LV", TLL: "EE", VNO: "LT",
  CMN: "MA", TUN: "TN", ADD: "ET", ZNZ: "TZ", MRU: "MU", AMM: "JO", MCT: "OM",
  DMK: "TH", CNX: "TH", KBV: "TH", USM: "TH", SGN: "VN", HAN: "VN", DAD: "VN", CGK: "ID", MNL: "PH",
  PEK: "CN", PKX: "CN", PVG: "CN", SHA: "CN", TPE: "TW", KTM: "NP",
  SYD: "AU", MEL: "AU", AKL: "NZ", ZQN: "NZ",
};
export const countryOfAirport = (code: string | null | undefined): string | null => (code ? (COUNTRY[code.toUpperCase()] ?? null) : null);

const isCode = (text: string) => /^[A-Z]{3}$/.test(text);

/** The city for an exact 3-letter uppercase airport code; any other text (already a city name) comes back as it is. */
export function cityOfAirport(text: string): string {
  const names = isCode(text) ? AIRPORTS[text] : undefined;
  return names ? L(names[0], names[1]) : text;
}

/** The city an exact airport code names, in both languages (["Kolombo", "Colombo"]); none for any other text. */
export const airportCities = (text: string | null | undefined): readonly string[] => (text && isCode(text) ? (AIRPORTS[text] ?? []) : []);

/** Whether the code is one we can name a city for (an unknown code stays a code). */
/** Every airport the table knows with the city a traveller would say for it, in both languages (searchLinks' fallback). */
export const airportEntries = (): [code: string, names: readonly string[]][] => Object.entries(AIRPORTS);

export const knownAirport = (text: string | null | undefined): boolean => !!text && isCode(text) && text in AIRPORTS;

/** The airport's name for a code ("Sabiha Gökçen", else its city: "Funchal"); any other text as it is. */
export function airportName(text: string): string {
  const name = isCode(text) ? NAMES[text] : undefined;
  return name ? L(name[0], name[1]) : cityOfAirport(text);
}
