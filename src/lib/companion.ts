// Benle gezen eklenti, seviye 2: "Sitede benle gel" (docs/superpowers/plans/2026-10-23-karar-masasi-gecis.md). On a
// flight site the traveller allowed one by one (optional host permissions), only while its address is a search for a
// flight on the plan, a thin strip says which row it is for, and each result gets a "+" and where it stands against the
// deck ("Destende var", "Destedekinden €38 ucuz", "Direktlerin en ucuzu"). Nothing is saved until "+" is pressed; no link
// on the site is changed (PRIVACY.md §4, §8). What a result says is read from its own text here; pure, tested.
import { L } from "./i18n";
import { formatPrice } from "./items";

/** The sites it may come along on, each asked for once (manifest optional_host_permissions, the same list). */
export const COMPANION_SITES = [
  "https://www.skyscanner.com/*",
  "https://www.skyscanner.net/*",
  "https://www.skyscanner.com.tr/*",
  "https://www.skyscanner.de/*",
  "https://www.skyscanner.co.uk/*",
  "https://www.skyscanner.co.th/*",
  "https://www.kiwi.com/*",
] as const;

/** The site's pattern a page belongs to ("https://www.skyscanner.com.tr/*"), else null. */
export function companionSiteOf(url: string | null | undefined): string | null {
  if (!url) return null;
  let host = "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  return COMPANION_SITES.find((p) => new URL(p.replace("/*", "/")).hostname === host) ?? null;
}

/** The site's name for its button ("Skyscanner", "Kiwi.com"). */
export const companionName = (site: string): string => (/kiwi/.test(site) ? "Kiwi.com" : "Skyscanner");

/** What a result's own text says: its hours, its price and its stops. */
export interface CardFacts {
  dep: string | null;
  arr: string | null;
  price: number | null;
  currency: string | null;
  stops: number | null;
}

/** One option of the deck as the strip compares against it. */
export interface DeckBrief {
  name: string;
  dep: string | null;
  arr: string | null;
  price: number | null;
  currency: string | null;
  stops: number | null;
}

const CURRENCY: [RegExp, string][] = [
  [/€|\bEUR\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/₺|\bTL\b|\bTRY\b/i, "TRY"],
  [/฿|\bTHB\b/i, "THB"],
  [/US\$|\$|\bUSD\b/i, "USD"],
];

/** "1.234", "1,234", "1 234", "326" → 1234 / 326 (a decimal part dropped: prices are compared whole). */
function amountOf(s: string): number | null {
  const plain = s.replace(/\s/g, "");
  const m = plain.match(/^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?$/);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function cardFacts(text: string): CardFacts {
  // (a 12-hour clock's "7:55 PM" is 19:55)
  const times = [...text.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?:\s?([AaPp])\.?[Mm]\.?)?/g)].map((m) => {
    let h = Number(m[1]);
    if (m[3] && /p/i.test(m[3]) && h < 12) h += 12;
    if (m[3] && /a/i.test(m[3]) && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m[2]}`;
  });
  let price: number | null = null;
  let currency: string | null = null;
  for (const [re, code] of CURRENCY) {
    const sym = re.source.replace(/\\b/g, "");
    const near = new RegExp(`(?:${sym})\\s?([\\d][\\d.,\\s]{0,9}\\d|\\d)|([\\d][\\d.,\\s]{0,9}\\d|\\d)\\s?(?:${sym})`, "i").exec(text);
    if (near) {
      const n = amountOf((near[1] ?? near[2] ?? "").trim());
      if (n != null) {
        price = n;
        currency = code;
        break;
      }
    }
  }
  const stops = /\b(direkt|direct|nonstop|non-stop|aktarmasız|aktarmasiz)\b/i.test(text) ? 0 : (() => {
    const m = text.match(/\b(\d)\s*(aktarma|stops?|durak|transfer)\b/i);
    return m ? Number(m[1]) : null;
  })();
  return { dep: times[0] ?? null, arr: times[1] ?? null, price, currency, stops };
}

/** A result's text, not a page's: two hours and a price, and not a whole list (short enough). */
export const isResultText = (text: string): boolean => {
  if (text.length < 20 || text.length > 700) return false;
  const f = cardFacts(text);
  return f.dep != null && f.arr != null && f.price != null;
};

/**
 * Where a result stands against the deck, only from what both say: already in it (its hours), cheaper than the deck's best
 * (the same currency), or the cheapest of the direct ones in view. Null when there is nothing worth saying.
 */
export function cardLabel(card: CardFacts, deck: readonly DeckBrief[], visible: readonly CardFacts[]): string | null {
  if (card.dep && card.arr && deck.some((d) => d.dep === card.dep && d.arr === card.arr)) return L("Destende var", "In your deck");
  const priced = deck.filter((d) => d.price != null && d.currency === card.currency);
  const best = priced.length ? Math.min(...priced.map((d) => d.price!)) : null;
  if (card.price != null && best != null && card.price < best) return L(`Destedekinden ${formatPrice(best - card.price, card.currency)} ucuz`, `${formatPrice(best - card.price, card.currency)} cheaper than your deck`);
  if (card.stops === 0 && card.price != null) {
    const direct = visible.filter((v) => v.stops === 0 && v.price != null && v.currency === card.currency);
    if (direct.length > 1 && card.price <= Math.min(...direct.map((v) => v.price!))) return L("Direktlerin en ucuzu", "The cheapest direct one");
  }
  return null;
}

/** What the companion asks the extension (content script → service worker); the worker checks who asks. */
export type CompanionAsk =
  | { type: "desk:route"; url: string }
  | { type: "desk:add"; url: string; title: string; text: string }
  | { type: "desk:shot"; url: string; title: string; text: string }
  | { type: "desk:open"; tripId: string }
  | { type: "desk:seen"; url: string; price: number; currency: string | null };

export interface CompanionRoute {
  tripId: string;
  title: string;
  from: string;
  to: string;
  day: string;
  deck: DeckBrief[];
  /** The flight chosen for it, not bought yet (fiyat izleme: seen on the site, its price there is read). */
  chosen?: DeckBrief | null;
}
