// Deterministic facts from the URL alone: which site, which listing, and the searched dates/guests.
// Only standard, documented-or-observed query parameters; no page parsing here.

export interface UrlFacts {
  provider: string | null;
  key: string | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
  currency: string | null;
  from: string | null;
  to: string | null;
}

const EMPTY: UrlFacts = {
  provider: null,
  key: null,
  checkIn: null,
  checkOut: null,
  adults: null,
  children: null,
  rooms: null,
  currency: null,
  from: null,
  to: null,
};

// Query parameters that identify a product on otherwise generic URLs.
const IDENTITY_PARAMS = ["id", "hotel_id", "pid", "product", "tfs"];

export function parseUrl(raw: string): UrlFacts {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ...EMPTY };
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const q = url.searchParams;

  if (host === "booking.com" || host.endsWith(".booking.com")) return parseBooking(url, q);
  if (/(^|\.)airbnb\.[a-z.]+$/.test(host)) return parseAirbnb(url, q);
  if (/(^|\.)skyscanner\.[a-z.]+$/.test(host)) return parseSkyscanner(url, q);
  if (/(^|\.)kayak\.[a-z.]+$/.test(host)) return parseKayak(url);
  if (host === "google.com" && url.pathname.startsWith("/travel/flights")) {
    return { ...EMPTY, provider: "Google Flights", key: genericKey(url) };
  }
  if (/(^|\.)getyourguide\.[a-z.]+$/.test(host)) {
    const id = url.pathname.match(/-t(\d+)\/?$/)?.[1];
    return { ...EMPTY, provider: "GetYourGuide", key: id ? `gyg:${id}` : genericKey(url) };
  }
  if (/(^|\.)viator\.com$/.test(host)) {
    const code = url.pathname.match(/\/d\d+-([A-Za-z0-9]+)\/?$/)?.[1];
    return { ...EMPTY, provider: "Viator", key: code ? `viator:${code}` : genericKey(url) };
  }
  return { ...EMPTY, key: genericKey(url) };
}

function parseBooking(url: URL, q: URLSearchParams): UrlFacts {
  // /hotel/{cc}/{slug}.html or /hotel/{cc}/{slug}.{lang}.html
  const m = url.pathname.match(/^\/hotel\/([a-z]{2})\/([^./]+)(?:\.[a-z-]+)?\.html$/i);
  return {
    ...EMPTY,
    provider: "Booking.com",
    key: m ? `booking:${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null,
    checkIn: isoDate(q.get("checkin")) ?? legacyBookingDate(q, "checkin"),
    checkOut: isoDate(q.get("checkout")) ?? legacyBookingDate(q, "checkout"),
    adults: int(q.get("group_adults")),
    children: int(q.get("group_children")),
    rooms: int(q.get("no_rooms")),
    currency: q.get("selected_currency"),
  };
}

function legacyBookingDate(q: URLSearchParams, prefix: string): string | null {
  const y = q.get(`${prefix}_year`);
  const m = q.get(`${prefix}_month`);
  const d = q.get(`${prefix}_monthday`);
  if (!y || !m || !d) return null;
  return isoDate(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
}

function parseAirbnb(url: URL, q: URLSearchParams): UrlFacts {
  const id = url.pathname.match(/^\/rooms\/(?:plus\/|luxury\/)?(\d+)/)?.[1];
  return {
    ...EMPTY,
    provider: "Airbnb",
    key: id ? `airbnb:${id}` : null,
    checkIn: isoDate(q.get("check_in") ?? q.get("checkin")),
    checkOut: isoDate(q.get("check_out") ?? q.get("checkout")),
    adults: int(q.get("adults")),
    children: int(q.get("children")),
  };
}

function parseSkyscanner(url: URL, q: URLSearchParams): UrlFacts {
  // /transport/flights/{from}/{to}/{yymmdd}/{yymmdd?}
  const m = url.pathname.match(/\/transport\/flights\/([a-z]+)\/([a-z]+)\/(\d{6})(?:\/(\d{6}))?/i);
  return {
    ...EMPTY,
    provider: "Skyscanner",
    from: m?.[1]?.toUpperCase() ?? null,
    to: m?.[2]?.toUpperCase() ?? null,
    checkIn: m ? yymmdd(m[3]) : null,
    checkOut: m?.[4] ? yymmdd(m[4]) : null,
    adults: int(q.get("adultsv2") ?? q.get("adults")),
  };
}

function parseKayak(url: URL): UrlFacts {
  // /flights/IST-OPO/2026-10-08/2026-10-14
  const m = url.pathname.match(/\/flights\/([A-Z]{3})-([A-Z]{3})\/(\d{4}-\d{2}-\d{2})(?:\/(\d{4}-\d{2}-\d{2}))?/i);
  return {
    ...EMPTY,
    provider: "Kayak",
    from: m?.[1]?.toUpperCase() ?? null,
    to: m?.[2]?.toUpperCase() ?? null,
    checkIn: m ? isoDate(m[3]) : null,
    checkOut: m?.[4] ? isoDate(m[4]) : null,
  };
}

/** host + path without tracking params; keeps params that identify the product. */
export function genericKey(url: URL): string {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");
  const kept = IDENTITY_PARAMS.filter((p) => url.searchParams.has(p)).map(
    (p) => `${p}=${url.searchParams.get(p)}`,
  );
  return `url:${host}${path}${kept.length ? `?${kept.join("&")}` : ""}`;
}

function isoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

function yymmdd(value: string): string | null {
  return isoDate(`20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`);
}

function int(value: string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/**
 * The same listing with the stay's dates (and guests) filled in, so saving it again brings the real
 * price for those nights. Only for sites whose date parameters are known; null otherwise.
 */
export function withDates(url: string | null, range: { start: string; end: string }, adults: number | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (/(^|\.)airbnb\.[a-z.]+$/.test(host)) {
      u.searchParams.set("check_in", range.start);
      u.searchParams.set("check_out", range.end);
      if (adults) u.searchParams.set("adults", String(adults));
      return u.toString();
    }
    if (/(^|\.)booking\.com$/.test(host)) {
      u.searchParams.set("checkin", range.start);
      u.searchParams.set("checkout", range.end);
      if (adults) u.searchParams.set("group_adults", String(adults));
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}
