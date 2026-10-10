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
};

export const countryInfo = (code: string | null | undefined): CountryInfo | null => (code ? COUNTRIES[code.toUpperCase()] ?? null : null);
