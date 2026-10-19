// Entry rules for a Turkish passport, only where we are sure. Every answer carries the official
// link; the board shows when the table was last checked. Anything else: "check the official source".
import { L } from "./i18n";

export const VISA_CHECKED = "2026-10";
const OFFICIAL_TR = "https://www.konsolosluk.gov.tr/Visa";

export const SCHENGEN = ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"];
/** Outside Schengen: the visa's name, the chore to apply for it (Hazırlık), and its own official page when it has one. */
const NEEDS_VISA: Record<string, { label: () => string; apply: () => string; link?: string }> = {
  GB: { label: () => L("Birleşik Krallık vizesi", "UK visa"), apply: () => L("Birleşik Krallık vizesine başvur", "Apply for the UK visa") },
  US: { label: () => L("ABD vizesi", "US visa"), apply: () => L("ABD vizesine başvur", "Apply for the US visa") },
  CA: { label: () => L("Kanada vizesi", "Canada visa"), apply: () => L("Kanada vizesine başvur", "Apply for the Canada visa") },
  IE: { label: () => L("İrlanda vizesi", "Ireland visa"), apply: () => L("İrlanda vizesine başvur", "Apply for the Ireland visa") },
  LK: { label: () => L("Sri Lanka ETA (elektronik vize)", "Sri Lanka ETA (electronic visa)"), apply: () => L("Sri Lanka ETA başvurusu", "Apply for the Sri Lanka ETA"), link: "https://www.eta.gov.lk/" },
};
const VISA_FREE: Record<string, number> = { GE: 365, JP: 90, RS: 90, BA: 90, MK: 90, AL: 90 };

export type Visa = { kind: "none" | "visa" | "free" | "unknown"; label: string; days?: number; link: string; /** A visa outside Schengen: the chore to apply for it. */ apply?: string };

export function visaFor(passport: string, country: string | null): Visa {
  const link = OFFICIAL_TR;
  if (!country) return { kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link };
  const to = country.toUpperCase();
  if (passport.toUpperCase() !== "TR") return { kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link: "https://www.iatatravelcentre.com/" };
  if (to === "TR") return { kind: "none", label: L("Gerekmez", "Not needed"), link };
  if (SCHENGEN.includes(to)) return { kind: "visa", label: L("Schengen vizesi", "Schengen visa"), link };
  const needs = NEEDS_VISA[to];
  if (needs) return { kind: "visa", label: needs.label(), link: needs.link ?? link, apply: needs.apply() };
  if (VISA_FREE[to]) return { kind: "free", label: L(`Vizesiz · ${VISA_FREE[to]} gün`, `Visa-free · ${VISA_FREE[to]} days`), days: VISA_FREE[to], link };
  return { kind: "unknown", label: L("Resmi kaynağa bak", "Check the official source"), link };
}
