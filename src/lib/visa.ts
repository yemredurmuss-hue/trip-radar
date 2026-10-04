// Entry rules for a Turkish passport, only where we are sure. Every answer carries the official
// link; the board shows when the table was last checked. Anything else: "check the official source".
import { L } from "./i18n";

export const VISA_CHECKED = "2026-10";
const OFFICIAL_TR = "https://www.konsolosluk.gov.tr/Visa";

const SCHENGEN = ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"];
const NEEDS_VISA: Record<string, () => string> = { GB: () => L("Birleşik Krallık vizesi", "UK visa"), US: () => L("ABD vizesi", "US visa"), CA: () => L("Kanada vizesi", "Canada visa"), IE: () => L("İrlanda vizesi", "Ireland visa") };
const VISA_FREE: Record<string, number> = { GE: 365, JP: 90, RS: 90, BA: 90, MK: 90, AL: 90, ME: 90 };

export type Visa = { kind: "none" | "visa" | "free" | "unknown"; label: string; days?: number; link: string };

export function visaFor(passport: string, country: string | null): Visa {
  const link = OFFICIAL_TR;
  if (!country) return { kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link };
  const to = country.toUpperCase();
  if (passport !== "TR") return { kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link: "https://www.iatatravelcentre.com/" };
  if (to === "TR") return { kind: "none", label: L("Gerekmez", "Not needed"), link };
  if (SCHENGEN.includes(to)) return { kind: "visa", label: L("Schengen vizesi", "Schengen visa"), link };
  if (NEEDS_VISA[to]) return { kind: "visa", label: NEEDS_VISA[to](), link };
  if (VISA_FREE[to]) return { kind: "free", label: L(`Vizesiz · ${VISA_FREE[to]} gün`, `Visa-free · ${VISA_FREE[to]} days`), days: VISA_FREE[to], link };
  return { kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link };
}
