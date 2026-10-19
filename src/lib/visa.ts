// Entry rules for a Turkish passport, only where we are sure. Every answer carries the official
// link; the board shows when the table was last checked. Anything else: "check the official source".
import { L } from "./i18n";
import type { Trip } from "./types";

export const VISA_CHECKED = "2026-10";
const OFFICIAL_TR = "https://www.konsolosluk.gov.tr/Visa";

export const SCHENGEN = ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"];
/**
 * Outside Schengen: the visa's name, the chore to apply for it (Hazırlık), its own official page when it has one, and
 * whether it is an electronic one applied for online (an ETA).
 */
const NEEDS_VISA: Record<string, { label: () => string; apply: () => string; link?: string; online?: boolean }> = {
  GB: { label: () => L("Birleşik Krallık vizesi", "UK visa"), apply: () => L("Birleşik Krallık vizesine başvur", "Apply for the UK visa") },
  US: { label: () => L("ABD vizesi", "US visa"), apply: () => L("ABD vizesine başvur", "Apply for the US visa") },
  CA: { label: () => L("Kanada vizesi", "Canada visa"), apply: () => L("Kanada vizesine başvur", "Apply for the Canada visa") },
  IE: { label: () => L("İrlanda vizesi", "Ireland visa"), apply: () => L("İrlanda vizesine başvur", "Apply for the Ireland visa") },
  LK: { label: () => L("Sri Lanka ETA (elektronik vize)", "Sri Lanka ETA (electronic visa)"), apply: () => L("Sri Lanka ETA başvurusu", "Apply for the Sri Lanka ETA"), link: "https://www.eta.gov.lk/", online: true },
};
const VISA_FREE: Record<string, number> = { GE: 365, JP: 90, RS: 90, BA: 90, MK: 90, AL: 90 };
/**
 * A visa bought on arrival, or online beforehand as an e-VOA (Indonesia: Turkish citizens are on its visa-on-arrival list;
 * a fee is paid, the stay is up to 30 days). The chore of getting it ahead and its official page.
 */
const ON_ARRIVAL: Record<string, { days: number; apply: () => string; link: string }> = {
  ID: { days: 30, apply: () => L("Endonezya e-VOA'sını al (ya da varışta vize)", "Get Indonesia's e-VOA (or a visa on arrival)"), link: "https://evisa.imigrasi.go.id/" },
};

export type Visa = {
  kind: "none" | "visa" | "free" | "arrival" | "unknown";
  label: string;
  days?: number;
  link: string;
  /** A visa outside Schengen, or one on arrival: the chore to get it (Hazırlık). */
  apply?: string;
  /** An electronic visa applied for online (an ETA). */
  online?: boolean;
  /** The passport isn't known (none set in Settings, no flight from home): the row asks which it is. */
  ask?: boolean;
};

const unknown = (link: string, ask = false): Visa => ({ kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link, ...(ask ? { ask } : {}) });

/** The rule for a passport (null: not known, never taken as Turkish) going to a country. */
export function visaFor(passport: string | null, country: string | null): Visa {
  const link = OFFICIAL_TR;
  if (!country) return unknown(link);
  const to = country.toUpperCase();
  if (!passport) return unknown("https://www.iatatravelcentre.com/", true);
  const from = passport.toUpperCase();
  if (from === to) return { kind: "none", label: L("Gerekmez", "Not needed"), link };
  if (from !== "TR") return unknown("https://www.iatatravelcentre.com/");
  if (SCHENGEN.includes(to)) return { kind: "visa", label: L("Schengen vizesi", "Schengen visa"), link };
  const needs = NEEDS_VISA[to];
  if (needs) return { kind: "visa", label: needs.label(), link: needs.link ?? link, apply: needs.apply(), ...(needs.online ? { online: true } : {}) };
  const arrival = ON_ARRIVAL[to];
  if (arrival) return { kind: "arrival", label: L("Varışta vize ya da e-VOA", "Visa on arrival or e-VOA"), days: arrival.days, link: arrival.link, apply: arrival.apply() };
  if (VISA_FREE[to]) return { kind: "free", label: L(`Vizesiz · ${VISA_FREE[to]} gün`, `Visa-free · ${VISA_FREE[to]} days`), days: VISA_FREE[to], link };
  return unknown(link);
}

/**
 * The country the visa row answers for: the trip's main country when it is abroad, else the first one abroad among its
 * places and where its flights land (a trip with only a flight to Denpasar still has one). Null when nothing is abroad.
 */
export function visaCountry(main: string | null, abroad: readonly string[], home: string | null): string | null {
  const own = home?.toUpperCase() ?? null;
  const m = main?.toUpperCase() ?? null;
  if (m && m !== own) return m;
  return abroad.map((c) => c.toUpperCase()).find((c) => c !== own) ?? null;
}

/**
 * Whether the visa is sorted (got, or no need confirmed): Belgeler's "Var" and Hazırlık's visa chore are one mark.
 * A visa chore ticked in Hazırlık before both were one (trip.prepDone's `visa:…`) counts too.
 */
export const visaDoneOf = (trip: Pick<Trip, "visaDone" | "prepDone">): boolean =>
  !!trip.visaDone || Object.keys(trip.prepDone ?? {}).some((k) => k.startsWith("visa:"));

/** The visa row's words: the answer itself, and what it rests on (the visa's name, how long), only what the table knows. */
export function visaAnswer(visa: Visa, done: boolean): { head: string; sub: string | null } {
  const upTo = (days?: number) => (days ? L(`${days} güne kadar`, `up to ${days} days`) : null);
  const said = ((): { head: string; sub: string | null } => {
    switch (visa.kind) {
      case "free":
        return { head: L("Vize gerekmez", "No visa needed"), sub: upTo(visa.days) };
      case "arrival":
        return { head: visa.label, sub: [upTo(visa.days), L("ücretli", "a fee is paid")].filter(Boolean).join(" · ") };
      case "visa":
        return visa.online ? { head: L("e-Vize (ETA) gerekli", "e-Visa (ETA) needed"), sub: visa.label } : { head: L("Vize gerekli · başvuru", "Visa needed · apply"), sub: visa.label };
      case "none":
        return { head: L("Vize gerekmez", "No visa needed"), sub: null };
      default:
        return visa.ask ? { head: L("Vize", "Visa"), sub: L("Pasaportun hangi ülke?", "Which country is your passport?") } : { head: L("Vize", "Visa"), sub: visa.label };
    }
  })();
  return done ? { head: L("Vize tamam", "Visa sorted"), sub: visa.kind === "unknown" ? null : said.head } : said;
}

/**
 * The trip with the visa marked sorted or not, from either place: Belgeler's "Var"/"Yok" or Hazırlık's visa chore (`key`,
 * kept with when it was ticked). Taken back, no visa chore stays ticked.
 */
export function withVisaDone<T extends Pick<Trip, "visaDone" | "prepDone">>(trip: T, done: boolean, key?: string, at = Date.now()): T {
  const rest = Object.fromEntries(Object.entries(trip.prepDone ?? {}).filter(([k]) => !k.startsWith("visa:")));
  const kept = Object.fromEntries(Object.entries(trip.prepDone ?? {}).filter(([k]) => k.startsWith("visa:")));
  const prepDone = done ? { ...rest, ...kept, ...(key ? { [key]: at } : {}) } : rest;
  return { ...trip, visaDone: done || undefined, prepDone };
}
