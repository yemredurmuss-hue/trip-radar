// Country facts that don't change: currency, language, a representative time zone, plug types.
// Kept small and only with values we are sure of; a country not here simply shows no row.
export interface CountryInfo {
  currency: string;
  language: { tr: string; en: string };
  /** IANA zone used for the time difference (the capital's). */
  timeZone: string;
  plugs: string[];
}

const c = (currency: string, tr: string, en: string, timeZone: string, plugs: string[]): CountryInfo => ({ currency, language: { tr, en }, timeZone, plugs });

export const COUNTRIES: Record<string, CountryInfo> = {
  PT: c("EUR", "Portekizce", "Portuguese", "Europe/Lisbon", ["C", "F"]),
  ES: c("EUR", "İspanyolca", "Spanish", "Europe/Madrid", ["C", "F"]),
  FR: c("EUR", "Fransızca", "French", "Europe/Paris", ["C", "E"]),
  IT: c("EUR", "İtalyanca", "Italian", "Europe/Rome", ["C", "F", "L"]),
  DE: c("EUR", "Almanca", "German", "Europe/Berlin", ["C", "F"]),
  NL: c("EUR", "Felemenkçe", "Dutch", "Europe/Amsterdam", ["C", "F"]),
  BE: c("EUR", "Felemenkçe, Fransızca", "Dutch, French", "Europe/Brussels", ["C", "E"]),
  AT: c("EUR", "Almanca", "German", "Europe/Vienna", ["C", "F"]),
  GR: c("EUR", "Yunanca", "Greek", "Europe/Athens", ["C", "F"]),
  CH: c("CHF", "Almanca, Fransızca, İtalyanca", "German, French, Italian", "Europe/Zurich", ["C", "J"]),
  GB: c("GBP", "İngilizce", "English", "Europe/London", ["G"]),
  IE: c("EUR", "İngilizce", "English", "Europe/Dublin", ["G"]),
  CZ: c("CZK", "Çekçe", "Czech", "Europe/Prague", ["C", "E"]),
  HU: c("HUF", "Macarca", "Hungarian", "Europe/Budapest", ["C", "F"]),
  PL: c("PLN", "Lehçe", "Polish", "Europe/Warsaw", ["C", "E"]),
  HR: c("EUR", "Hırvatça", "Croatian", "Europe/Zagreb", ["C", "F"]),
  SE: c("SEK", "İsveççe", "Swedish", "Europe/Stockholm", ["C", "F"]),
  DK: c("DKK", "Danca", "Danish", "Europe/Copenhagen", ["C", "E", "F", "K"]),
  NO: c("NOK", "Norveççe", "Norwegian", "Europe/Oslo", ["C", "F"]),
  TR: c("TRY", "Türkçe", "Turkish", "Europe/Istanbul", ["C", "F"]),
  GE: c("GEL", "Gürcüce", "Georgian", "Asia/Tbilisi", ["C", "F"]),
  US: c("USD", "İngilizce", "English", "America/New_York", ["A", "B"]),
  JP: c("JPY", "Japonca", "Japanese", "Asia/Tokyo", ["A", "B"]),
  TH: c("THB", "Tayca", "Thai", "Asia/Bangkok", ["A", "B", "C", "O"]),
  ID: c("IDR", "Endonezce", "Indonesian", "Asia/Jakarta", ["C", "F"]),
  AE: c("AED", "Arapça", "Arabic", "Asia/Dubai", ["G"]),
  EG: c("EGP", "Arapça", "Arabic", "Africa/Cairo", ["C", "F"]),
  MA: c("MAD", "Arapça, Fransızca", "Arabic, French", "Africa/Casablanca", ["C", "E"]),
  // Added in 0.38.3 (Emre's Sri Lanka trip showed no money, plug, time or language): the places Turkish travellers
  // often go. The plugs are the IEC's "World Plugs" list; a country whose list we can't vouch for has none (no chip).
  LK: c("LKR", "Sinhalaca, Tamilce", "Sinhala, Tamil", "Asia/Colombo", ["D", "G"]),
  MV: c("MVR", "Divehi", "Dhivehi", "Indian/Maldives", []),
  VN: c("VND", "Vietnamca", "Vietnamese", "Asia/Ho_Chi_Minh", ["A", "C"]),
  MX: c("MXN", "İspanyolca", "Spanish", "America/Mexico_City", ["A", "B"]),
  KR: c("KRW", "Korece", "Korean", "Asia/Seoul", ["C", "F"]),
  CN: c("CNY", "Çince", "Chinese", "Asia/Shanghai", ["A", "C", "I"]),
  SG: c("SGD", "İngilizce, Malayca, Çince, Tamilce", "English, Malay, Chinese, Tamil", "Asia/Singapore", ["G"]),
  MY: c("MYR", "Malayca", "Malay", "Asia/Kuala_Lumpur", ["G"]),
  IN: c("INR", "Hintçe, İngilizce", "Hindi, English", "Asia/Kolkata", ["C", "D", "M"]),
  QA: c("QAR", "Arapça", "Arabic", "Asia/Qatar", ["D", "G"]),
  JO: c("JOD", "Arapça", "Arabic", "Asia/Amman", []),
  TN: c("TND", "Arapça", "Arabic", "Africa/Tunis", ["C", "E"]),
  KE: c("KES", "Svahili, İngilizce", "Swahili, English", "Africa/Nairobi", ["G"]),
  AZ: c("AZN", "Azerbaycan Türkçesi", "Azerbaijani", "Asia/Baku", ["C", "F"]),
  RS: c("RSD", "Sırpça", "Serbian", "Europe/Belgrade", ["C", "F"]),
  BA: c("BAM", "Boşnakça, Hırvatça, Sırpça", "Bosnian, Croatian, Serbian", "Europe/Sarajevo", ["C", "F"]),
  MK: c("MKD", "Makedonca, Arnavutça", "Macedonian, Albanian", "Europe/Skopje", ["C", "F"]),
  AL: c("ALL", "Arnavutça", "Albanian", "Europe/Tirane", ["C", "F"]),
  ME: c("EUR", "Karadağca", "Montenegrin", "Europe/Podgorica", ["C", "F"]),
  BG: c("EUR", "Bulgarca", "Bulgarian", "Europe/Sofia", ["C", "F"]),
  RO: c("RON", "Romence", "Romanian", "Europe/Bucharest", ["C", "F"]),
  CY: c("EUR", "Yunanca, Türkçe", "Greek, Turkish", "Asia/Nicosia", ["G"]),
  MT: c("EUR", "Maltaca, İngilizce", "Maltese, English", "Europe/Malta", ["G"]),
  SI: c("EUR", "Slovence", "Slovenian", "Europe/Ljubljana", ["C", "F"]),
  SK: c("EUR", "Slovakça", "Slovak", "Europe/Bratislava", ["C", "E"]),
  FI: c("EUR", "Fince, İsveççe", "Finnish, Swedish", "Europe/Helsinki", ["C", "F"]),
  EE: c("EUR", "Estonca", "Estonian", "Europe/Tallinn", ["C", "F"]),
  LV: c("EUR", "Letonca", "Latvian", "Europe/Riga", ["C", "F"]),
  LT: c("EUR", "Litvanca", "Lithuanian", "Europe/Vilnius", ["C", "F"]),
  LU: c("EUR", "Lüksemburgca, Fransızca, Almanca", "Luxembourgish, French, German", "Europe/Luxembourg", ["C", "F"]),
  IS: c("ISK", "İzlandaca", "Icelandic", "Atlantic/Reykjavik", ["C", "F"]),
  CA: c("CAD", "İngilizce, Fransızca", "English, French", "America/Toronto", ["A", "B"]),
  BR: c("BRL", "Portekizce", "Portuguese", "America/Sao_Paulo", ["C", "N"]),
  AR: c("ARS", "İspanyolca", "Spanish", "America/Argentina/Buenos_Aires", ["C", "I"]),
  AU: c("AUD", "İngilizce", "English", "Australia/Sydney", ["I"]),
  NZ: c("NZD", "İngilizce, Maorice", "English, Māori", "Pacific/Auckland", ["I"]),
  PH: c("PHP", "Filipince, İngilizce", "Filipino, English", "Asia/Manila", ["A", "B", "C"]),
  KH: c("KHR", "Kmerce", "Khmer", "Asia/Phnom_Penh", ["A", "C", "G"]),
};

export const countryInfo = (code: string | null | undefined): CountryInfo | null => (code ? COUNTRIES[code.toUpperCase()] ?? null : null);
