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
  // (0.41.0: hotels and activities too: a "+" on each result of a list, "Desteye ekle" on a hotel's or a tour's own page)
  "https://www.booking.com/*",
  "https://www.airbnb.com/*",
  "https://www.airbnb.com.tr/*",
  "https://www.airbnb.co.uk/*",
  "https://www.airbnb.de/*",
  "https://www.getyourguide.com/*",
  "https://www.getyourguide.de/*",
  "https://www.getyourguide.co.uk/*",
  "https://www.viator.com/*",
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

/** The site's name for its button ("Skyscanner", "Kiwi.com", "Booking.com"). */
export const companionName = (site: string): string =>
  /kiwi/.test(site) ? "Kiwi.com" : /booking/.test(site) ? "Booking.com" : /airbnb/.test(site) ? "Airbnb" : /getyourguide/.test(site) ? "GetYourGuide" : /viator/.test(site) ? "Viator" : "Skyscanner";

/** What a site sells, and so which deck its results join. */
export type SiteKind = "flight" | "stay" | "activity";
export const siteKindOf = (site: string): SiteKind => (/booking|airbnb/.test(site) ? "stay" : /getyourguide|viator/.test(site) ? "activity" : "flight");

/** The deck's name in the plan for a kind ("Konaklama destesine girer"). */
export const deckWord = (kind: SiteKind): string =>
  kind === "stay" ? L("Konaklama", "Stays") : kind === "activity" ? L("Etkinlikler", "Activities") : L("Uçuş", "Flights");

/**
 * One thing's own page (a hotel, a stay, a tour), not a list: what "Desteye ekle" is for. From its address on the sites
 * it knows, or what the page says it is (its JSON-LD types). Null: a list, a search, or anything else.
 */
export function offerPageKind(url: string, ldTypes: readonly string[] = []): SiteKind | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname, path = u.pathname;
  if (/booking\.com$/.test(host)) return /^\/hotel\/[a-z]{2}\//.test(path) ? "stay" : null;
  if (/airbnb\./.test(host)) return /^\/rooms\/\d+/.test(path) ? "stay" : null;
  if (/getyourguide\./.test(host)) return /-t\d+\/?$/.test(path) ? "activity" : null;
  if (/viator\.com$/.test(host)) return /^\/(?:[a-z]{2}-[A-Z]{2}\/)?tours\//.test(path) ? "activity" : null;
  const types = ldTypes.map((t) => t.toLowerCase());
  if (types.some((t) => ["hotel", "lodgingbusiness", "resort", "hostel", "vacationrental"].includes(t))) return "stay";
  if (types.some((t) => ["touristtrip", "touristattraction", "event"].includes(t))) return "activity";
  return null;
}

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

/** A hotel's or a tour's result in a list: a price and enough words to be one result, not the whole list. */
export const isOfferText = (text: string): boolean => text.length >= 25 && text.length <= 900 && cardFacts(text).price != null;

/** The same thing by its name, as the deck has it ("Memmo Alfama Hotel" and "Memmo Alfama"): "Destende var". */
export function inDeckByName(text: string, names: readonly string[]): boolean {
  const fold = (x: string) => x.toLocaleLowerCase("tr").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const t = ` ${fold(text)} `;
  return names.some((n) => {
    const f = fold(n).replace(/\b(hotel|otel|hostel|apartments?|by|the)\b/g, " ").replace(/\s+/g, " ").trim();
    return f.length >= 5 && t.includes(` ${f} `);
  });
}

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
  | { type: "desk:where"; url: string; title: string }
  | ({ type: "desk:add"; url: string; title: string; text: string } & TripPick)
  | ({ type: "desk:shot"; url: string; title: string; text: string } & TripPick)
  | ({ type: "desk:page"; url: string; snapshot: unknown } & TripPick)
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

/**
 * Hangi gezi on the site (0.41.0, lib/tripRules.ts): the trip picked in the page's own question (or a new one for the
 * country), and whether to keep it as that country's trip. None: the route's trip, or the remembered one.
 */
export interface TripPick {
  tripId?: string;
  newTrip?: boolean;
  remember?: boolean;
}

/** What the extension says of a page on an allowed site before anything is added: where it would go, else the trips to ask. */
export interface CompanionWhere {
  /** Its trip: the remembered one for the page's country (null: asked at the first "+"). */
  trip: { id: string; title: string } | null;
  /** The page's country as the code reads it from the address and title ("Portekiz"), when it can. */
  country: string | null;
  /** The trips to ask among: the country's first (match), at most six. */
  trips: { id: string; title: string; when: string | null; match: boolean }[];
  /** This very page is on the plan already. */
  saved: boolean;
  /** The names of that trip's options of this kind ("Destende var" on a hotel list). */
  names: string[];
}
