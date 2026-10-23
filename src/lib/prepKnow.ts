// Hazırlık's "Bilmen gerekenler" card (v82 geçişi aşama 7; Etsy kararı T8 b; tasarım notu "v83 ek · Hazırlık"): at the
// top of the open list, only what has a source. The country's emergency numbers (the table below), the traveller's
// embassy as a map search (never a number of ours), the money and the plugs as the hero has them (tripFacts, countries.ts),
// and the AI's notes on daily life only marked as the AI's (prepPack.ts tips). A row that isn't known isn't drawn (C19).
// Pure.
import { countryInfo } from "./countries";
import { plugFitText, type PlugFit } from "./heroInfo";
import { L, locale } from "./i18n";
import type { PackTip } from "./types";

/** A country's emergency numbers: one for everything (`all`, a second that also works), or by service. */
export interface Emergency {
  all?: readonly string[];
  police?: string;
  ambulance?: string;
  fire?: string;
  tourist?: string;
  /** 112 as the European Union's own number. */
  eu?: boolean;
}

/**
 * Emergency numbers, only where they're sure (checked 2026-10). A country not here has no row.
 * Sources:
 *   - 112 in every EU member state and the EEA: European Commission, "112 – the European emergency number",
 *     https://digital-strategy.ec.europa.eu/en/policies/112 (with the national numbers that also work: Germany's police
 *     110; Austria's 133/144/122; Norway's 112/113/110; Switzerland's 117/144/118, Swiss Confederation ch.ch "Emergency numbers").
 *   - The rest: the UK Foreign, Commonwealth & Development Office's travel advice, "Getting help" of each country,
 *     https://www.gov.uk/foreign-travel-advice/<country>/getting-help (Japan, Thailand, United Arab Emirates, Egypt, South
 *     Korea, China, Singapore, Malaysia, South Africa, Brazil, Australia, New Zealand, Canada, Mexico, USA, Georgia, Turkey),
 *     and for the UK itself gov.uk "Call 999 or 112"; Türkiye 112 Acil Çağrı Merkezi (https://www.112.gov.tr/).
 *   - Added in 0.38.3, from the same FCDO pages: Sri Lanka, the Maldives, Indonesia, Vietnam, Morocco, India, Qatar,
 *     Jordan, Tunisia, Kenya, the Philippines, Cambodia, Azerbaijan and the Western Balkans (Serbia, Bosnia and Herzegovina,
 *     North Macedonia, Albania, Montenegro). Only the numbers we are sure of: a service left out has no part.
 */
const EU112 = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI"] as const;

export const EMERGENCY: Readonly<Record<string, Emergency>> = {
  ...Object.fromEntries(EU112.map((c) => [c, { all: ["112"], eu: true }])),
  DE: { all: ["112"], police: "110", eu: true },
  AT: { all: ["112"], police: "133", ambulance: "144", fire: "122", eu: true },
  IE: { all: ["112", "999"], eu: true },
  NO: { police: "112", ambulance: "113", fire: "110" },
  CH: { all: ["112"], police: "117", ambulance: "144", fire: "118" },
  GB: { all: ["999", "112"] },
  TR: { all: ["112"] },
  GE: { all: ["112"] },
  US: { all: ["911"] },
  CA: { all: ["911"] },
  MX: { all: ["911"] },
  JP: { police: "110", ambulance: "119", fire: "119" },
  KR: { police: "112", ambulance: "119", fire: "119" },
  CN: { police: "110", ambulance: "120", fire: "119" },
  TH: { police: "191", ambulance: "1669", fire: "199", tourist: "1155" },
  SG: { police: "999", ambulance: "995", fire: "995" },
  MY: { all: ["999"] },
  AE: { police: "999", ambulance: "998", fire: "997" },
  EG: { police: "122", ambulance: "123", fire: "180", tourist: "126" },
  ZA: { police: "10111", ambulance: "10177" },
  BR: { police: "190", ambulance: "192", fire: "193" },
  AU: { all: ["000", "112"] },
  NZ: { all: ["111"] },
  LK: { police: "119", ambulance: "1990", fire: "110" },
  MV: { police: "119", ambulance: "102", fire: "118" },
  ID: { all: ["112"], police: "110", fire: "113" },
  VN: { police: "113", ambulance: "115", fire: "114" },
  MA: { police: "19", ambulance: "15", fire: "15" },
  IN: { all: ["112"] },
  QA: { all: ["999"] },
  JO: { all: ["911"] },
  TN: { police: "197", ambulance: "190", fire: "198" },
  KE: { all: ["999", "112"] },
  PH: { all: ["911"] },
  KH: { police: "117", ambulance: "119", fire: "118" },
  AZ: { police: "102", ambulance: "103", fire: "101" },
  RS: { police: "192", ambulance: "194", fire: "193" },
  BA: { police: "122", ambulance: "124", fire: "123" },
  MK: { police: "192", ambulance: "194", fire: "193" },
  AL: { police: "129", ambulance: "127", fire: "128" },
  ME: { all: ["112"], police: "122", ambulance: "124", fire: "123" },
};

/** "110 polis · 119 ambulans ve itfaiye", "112 (AB ortak numara)"; null for a country not in the table. */
export function emergencyText(code: string | null | undefined): string | null {
  const e = code ? EMERGENCY[code.toUpperCase()] : undefined;
  if (!e) return null;
  const parts: string[] = [];
  if (e.all?.length) {
    const nums = e.all.join(L(" ya da ", " or "));
    parts.push(e.eu && e.all.length === 1 ? L(`${nums} (AB ortak numara)`, `${nums} (the EU's number)`) : nums);
  }
  if (e.police) parts.push(L(`${e.police} polis`, `${e.police} police`));
  if (e.ambulance && e.ambulance === e.fire) parts.push(L(`${e.ambulance} ambulans ve itfaiye`, `${e.ambulance} ambulance and fire`));
  else {
    if (e.ambulance) parts.push(L(`${e.ambulance} ambulans`, `${e.ambulance} ambulance`));
    if (e.fire) parts.push(L(`${e.fire} itfaiye`, `${e.fire} fire`));
  }
  if (e.tourist) parts.push(L(`${e.tourist} turist polisi`, `${e.tourist} tourist police`));
  return parts.join(" · ");
}

export type KnowIcon = "alert" | "cash" | "plug" | "flag" | "hand" | "shoe" | "train" | "card" | "info";

export interface KnowRow {
  id: string;
  icon: KnowIcon;
  label: string;
  text: string;
  /** A link after the text ("Haritada aç ↗"). */
  link: { url: string; text: string } | null;
  /** Written by the AI: marked as such. */
  ai: boolean;
}

export interface KnowInput {
  /** The trip's countries (ISO), the main one first. */
  countries: string[];
  /** The traveller's passport country (Settings → Pasaport). */
  passport: string;
  /** The money there as the hero has it (tripFacts.local): its name and "€1 = ₺38,20". */
  money: { name: string; rate: string | null; own: boolean } | null;
  plug: PlugFit | null;
  /** The AI's notes on daily life (prepPack.ts acceptPack). */
  tips: PackTip[];
}

/** A country's name in the board's language ("Portekiz"), or its code. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([locale()], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The AI note's picture, by its words. */
function tipIcon(t: PackTip): KnowIcon {
  const s = `${t.label} ${t.text}`.toLocaleLowerCase("tr-TR");
  if (/bahşiş|tip(ping)?\b|servis ücreti/.test(s)) return "hand";
  if (/ayakkabı|shoe/.test(s)) return "shoe";
  if (/tren|metro|otobüs|toplu taşıma|train|subway|bus|transport/.test(s)) return "train";
  if (/nakit|kart|para|ödeme|cash|card|pay/.test(s)) return "card";
  return "info";
}

/** The card's rows in their order: emergency, money, plugs, the AI's notes, the embassy. Only what's known. */
export function knowRows(k: KnowInput): KnowRow[] {
  const main = k.countries[0] ?? null;
  const rows: KnowRow[] = [];
  // Emergency: each country of the trip that the table knows, by name when there's more than one.
  const known = k.countries.map((c) => ({ c, text: emergencyText(c) })).filter((x): x is { c: string; text: string } => x.text != null);
  const texts = [...new Set(known.map((x) => x.text))];
  if (known.length) {
    const text = texts.length === 1 ? texts[0] : known.map((x) => `${countryName(x.c)} ${x.text}`).join(" · ");
    rows.push({ id: "emergency", icon: "alert", label: L("Acil", "Emergency"), text, link: null, ai: false });
  }
  if (k.money && !k.money.own) rows.push({ id: "money", icon: "cash", label: L("Para", "Money"), text: k.money.rate ? `${k.money.name} · ${k.money.rate}` : k.money.name, link: null, ai: false });
  const plugs = countryInfo(main)?.plugs;
  const abroad = main != null && main !== k.passport.toUpperCase();
  if (abroad && plugs?.length && k.plug)
    rows.push({ id: "plug", icon: "plug", label: L("Priz", "Plugs"), text: L(`${plugs.join(" ve ")} tipi · ${plugFitText(k.plug)}`, `Type ${plugs.join(" and ")} · ${plugFitText(k.plug)}`), link: null, ai: false });
  k.tips.forEach((t, i) => rows.push({ id: `tip:${i}`, icon: tipIcon(t), label: t.label, text: t.text, link: null, ai: true }));
  // (a passport said "Diğer": no embassy to name, never "XX Büyükelçiliği")
  const own = countryName(k.passport.toUpperCase());
  if (abroad && own !== k.passport.toUpperCase()) {
    const label = L(`${own} Büyükelçiliği`, `Embassy of ${own}`);
    const there = countryName(main);
    rows.push({
      id: "embassy",
      icon: "flag",
      label,
      text: there,
      link: { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label} ${there}`)}`, text: L("Haritada aç", "Open in Maps") },
      ai: false,
    });
  }
  return rows;
}

/** The card's small heading: the countries by name ("Portekiz · gezi boyunca işine yarayacaklar"). */
export const knowSub = (countries: string[]): string =>
  countries.length ? L(`${countries.map(countryName).join(", ")} · gezi boyunca işine yarayacaklar`, `${countries.map(countryName).join(", ")} · useful on the whole trip`) : "";
