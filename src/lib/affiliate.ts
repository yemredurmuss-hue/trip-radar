// Partner links (Emre, 2026-10-06: "bizden çıkan tüm linkler"): a page of a brand Trip Radar is a Travelpayouts
// partner of, opened from the board, goes through Travelpayouts' redirect (tp.media) so a booking made there pays
// the project; it costs the traveller nothing and lands on the same page. Turned only when clicked (Chrome Web
// Store's rule: an affiliate code needs the user's own action, and is disclosed: PRIVACY.md §8), never on the
// sites the traveller visits.
//
// A page that can carry the traveller's own booking (manage, confirmation, account, sign-in; a token or a
// confirmation number in it) is never turned: it isn't sent to Travelpayouts. Brands without a program (Airbnb,
// Skyscanner, Kayak, Google Flights) go as they are.
//
// The ids are the ones Travelpayouts' Links API gave for project 34810 on 2026-10-06; the offers function
// (supabase/functions/offers) asks that API itself for its own pages.

const MARKER = 281838;
const TRS = 34810;
const SUB = "tripradar";

/** Host (and its subdomains) → [campaign_id, p]. */
const BRANDS: Record<string, readonly [number, number]> = {
  "booking.com": [84, 2076],
  "agoda.com": [104, 2854],
  "trip.com": [121, 8980],
  "expedia.com": [594, 8645],
  "hostelworld.com": [93, 3518],
  "getyourguide.com": [108, 3965],
  "viator.com": [47, 1922],
  "klook.com": [137, 4110],
  "gocity.com": [62, 1942],
  "tripadvisor.com": [149, 4456],
  "wegotrip.com": [150, 4487],
  "aviasales.com": [100, 4114],
  "kiwi.com": [111, 4136],
  "omio.com": [91, 2078],
  "12go.asia": [44, 1764],
  "busbud.com": [138, 4109],
  "gettransfer.com": [147, 4439],
  "discovercars.com": [117, 3555],
  "localrent.com": [87, 2043],
  "getrentacar.com": [222, 5996],
  "qeeq.com": [172, 4845],
  "economybookings.com": [10, 2018],
  "bikesbooking.com": [57, 1767],
  "airalo.com": [541, 8310],
  "yesim.app": [224, 5998],
  "saily.com": [629, 8979],
  "drimsim.com": [102, 2762],
  "ektatraveling.com": [225, 5869],
  "visitorscoverage.com": [153, 4552],
  "compensair.com": [86, 4129],
};

/** Pages that may carry the traveller's own booking or account: never sent anywhere else. */
const PRIVATE_PATH = /my-?reservations?|my-?bookings?|manage|confirmation|confirm|itinerar|account|profile|sign-?in|log-?in|auth|checkout|payment|order|voucher|ticket\/|pnr|trips\//i;
const PRIVATE_QUERY = /(^|&)(token|auth|key|pin|pincode|bn|confirmation|confirmation_?number|booking_?(id|number|ref)|order_?id|pnr|email|e-mail|session|sid|code)=/i;

function brandOf(host: string): readonly [number, number] | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  for (const [domain, ids] of Object.entries(BRANDS)) if (h === domain || h.endsWith(`.${domain}`)) return ids;
  return null;
}

/** The partner link for a page, or the page as it is (not a partner brand, a private page, already a partner link, not https). */
export function partnerUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return url;
  if (u.hostname === "tp.media" || u.hostname.endsWith(".tp.st")) return url;
  const ids = brandOf(u.hostname);
  if (!ids) return url;
  // Already the project's own partner page (Viator's API pages carry its pid, GetYourGuide's its partner_id): kept.
  if (u.searchParams.has("pid") && /(^|\.)viator\.com$/.test(u.hostname)) return url;
  if (u.searchParams.has("partner_id") && /(^|\.)getyourguide\.com$/.test(u.hostname)) return url;
  if (PRIVATE_PATH.test(u.pathname) || PRIVATE_QUERY.test(u.search.slice(1))) return url;
  const q = new URLSearchParams({ campaign_id: String(ids[0]), marker: String(MARKER), p: String(ids[1]), sub_id: SUB, trs: String(TRS), u: url });
  return `https://tp.media/r?${q}`;
}

/**
 * Turns a clicked link to a partner brand's page into its partner link just before the browser follows it (a
 * click, a middle click, Enter on it). Installed once on the board's document; returns the uninstall.
 */
export function installPartnerLinks(doc: Document = document): () => void {
  const onClick = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const turned = partnerUrl(a.href);
    if (turned !== a.href) a.href = turned;
  };
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("auxclick", onClick, true);
  return () => {
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("auxclick", onClick, true);
  };
}
