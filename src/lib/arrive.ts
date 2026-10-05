// Content arriving on the board (a link, a dropped file, a page saved from the popup): where it will most
// likely land, the line its waiting card says while it's read, which records are new since the last look,
// and what a chat chip says. Pure: the guess only places a quiet waiting card; the real section is always
// the pipeline's (process.ts → categories.ts).
import type { SectionId } from "./categories";
import { L } from "./i18n";

/** The site's name from a whole address ("https://www.google.com/maps/place/…" → "Google Maps"). */
export function siteOf(url: string | null | undefined): string | null {
  const host = hostOf(url);
  if (!host) return null;
  let path = "";
  try {
    path = new URL(url!).pathname.toLowerCase();
  } catch {
    path = "";
  }
  return siteName(host, path);
}

/** "airbnb.com.tr" from "https://www.airbnb.com.tr/rooms/1"; null when it isn't a web address. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/** The site's own name for the waiting line: "Airbnb", "Booking.com", "GetYourGuide", else "Example". */
const NAMES: [RegExp, string][] = [
  [/(^|\.)airbnb\./, "Airbnb"],
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)vrbo\.com$/, "Vrbo"],
  [/(^|\.)hotels\.com$/, "Hotels.com"],
  [/(^|\.)agoda\./, "Agoda"],
  [/(^|\.)skyscanner\./, "Skyscanner"],
  [/(^|\.)kiwi\.com$/, "Kiwi.com"],
  [/(^|\.)getyourguide\./, "GetYourGuide"],
  [/(^|\.)tripadvisor\./, "Tripadvisor"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)indiecampers\./, "Indie Campers"],
  [/(^|\.)rentalcars\.com$/, "Rentalcars"],
  [/^cp\.pt$/, "CP"],
];
export function siteName(host: string | null, path = ""): string | null {
  if (!host) return null;
  if (isGoogleMaps(host, path)) return "Google Maps";
  if (/^(google\.|.*\.google\.)/.test(host)) return "Google";
  const named = NAMES.find(([re]) => re.test(host));
  if (named) return named[1];
  const parts = host.split(".");
  // "sixt.pt" → "Sixt", "flights.example.co.uk" → "Example": the label before the public suffix.
  const twoPart = parts.length > 2 && /^(co|com|org|net|gov|ac)$/.test(parts.at(-2)!);
  const label = parts.at(twoPart ? -3 : -2) ?? parts[0];
  return label ? label[0].toUpperCase() + label.slice(1) : host;
}

/** host is the site or one of its subdomains; a trailing "." means any ending ("airbnb." → airbnb.pt too). */
const on = (host: string, site: string): boolean =>
  site.endsWith(".") ? host.startsWith(site) || host.includes(`.${site}`) : host === site || host.endsWith(`.${site}`);
const any = (host: string, sites: readonly string[]) => sites.some((s) => on(host, s));

const STAY = ["airbnb.", "booking.com", "vrbo.com", "hotels.com", "agoda.", "hostelworld.com", "homeaway.", "expedia."] as const;
const FLIGHT = [
  "skyscanner.", "kiwi.com", "momondo.", "ryanair.com", "easyjet.com", "flytap.com", "turkishairlines.com", "flypgs.com", "ajet.com",
  "sunexpress.com", "lufthansa.com", "klm.", "airfrance.", "britishairways.com", "vueling.com", "wizzair.com", "emirates.com",
  "qatarairways.com", "iberia.com", "transavia.com", "norwegian.com", "united.com", "delta.com", "aa.com", "azoresairlines.pt",
] as const;
const ACTIVITY = ["getyourguide.", "viator.com", "tiqets.com", "klook.com", "civitatis.com", "musement.com", "headout.com"] as const;
const TRANSPORT = [
  "indiecampers.", "rentalcars.com", "sixt.", "europcar.", "omio.", "trainline.", "thetrainline.com", "flixbus.", "cp.pt", "hertz.",
  "avis.", "discovercars.com", "blablacar.", "renfe.com", "sncf-connect.com", "bolt.eu", "uber.com",
] as const;
const FOOD = ["thefork.", "opentable.", "yemeksepeti.com", "zomato.com"] as const;
const INSPO = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be", "pinterest.", "pin.it", "medium.com", "substack.com"] as const;

function isGoogleMaps(host: string, path: string): boolean {
  if (host === "maps.app.goo.gl" || (host === "goo.gl" && path.startsWith("/maps"))) return true;
  if (/^maps\.google\./.test(host)) return true;
  return /^(google\.|.*\.google\.)/.test(host) && path.startsWith("/maps");
}

const EATS = /restaurant|restaurante|ristorante|tasca|taberna|trattoria|osteria|bistro|brasserie|cafe|café|bakery|pastelaria|lokanta|meyhane|kebap|pizzeria|sushi|steakhouse|izakaya|diner/i;

/**
 * The section a link will most likely land in, from the address alone (and the page's title when there is
 * one): Airbnb → Konaklama, Skyscanner → Uçuş, GetYourGuide → Etkinlikler, Sixt → Ulaşım, a place on Google
 * Maps → Yapılacak şeyler (Restoranlar when it says it's a restaurant), a Reel or a blog → İlham. Null when
 * unsure: a document, a screenshot, a site it doesn't know.
 */
export function predictSection(input: { url?: string | null; title?: string | null; fileName?: string | null; fileType?: string | null }): SectionId | null {
  if (input.fileName || input.fileType) return null; // a PDF or a picture says what it is only once read
  const host = hostOf(input.url);
  if (!host) return null;
  let path = "";
  try {
    path = decodeURIComponent(new URL(input.url!).pathname);
  } catch {
    path = "";
  }
  const lower = path.toLowerCase();
  const title = input.title ?? "";
  if (isGoogleMaps(host, lower)) {
    if (/^\/travel\/flights|^\/flights/.test(lower)) return "flight";
    if (/^\/travel\/(hotels|search)/.test(lower)) return "stay";
    return EATS.test(`${path} ${title}`) ? "food" : "todo";
  }
  if (/^(google\.|.*\.google\.)/.test(host)) {
    if (/^\/travel\/flights|^\/flights/.test(lower)) return "flight";
    if (/^\/travel\/(hotels|search)/.test(lower)) return "stay";
    return null;
  }
  if (on(host, "tripadvisor.")) {
    if (lower.includes("/restaurant_review")) return "food";
    if (lower.includes("/hotel_review")) return "stay";
    if (lower.includes("/attraction")) return "todo";
    return null;
  }
  if (on(host, "booking.com")) {
    if (host.startsWith("flights.") || lower.startsWith("/flights")) return "flight";
    if (host.startsWith("cars.") || lower.startsWith("/cars")) return "transport";
    if (lower.startsWith("/attractions")) return "activity";
    return "stay";
  }
  if (on(host, "skyscanner.")) {
    if (/\/hotels?\b/.test(lower)) return "stay";
    if (/car-?hire/.test(lower)) return "transport";
    return "flight";
  }
  if (any(host, STAY)) return "stay";
  if (any(host, FLIGHT)) return "flight";
  if (any(host, ACTIVITY)) return "activity";
  if (any(host, TRANSPORT)) return "transport";
  if (any(host, FOOD)) return "food";
  if (any(host, INSPO)) return "inspo";
  if (/(^|\.)blog\.|blog/.test(host) || /\/blog(\/|$)/.test(lower)) return "inspo";
  return null;
}

/** "Konaklama'ya" / "to Stays": a section as the arrival sentence says it. */
const SECTION_TO: Record<SectionId, [string, string]> = {
  flight: ["Uçuş'a", "to Flights"],
  stay: ["Konaklama'ya", "to Stays"],
  transport: ["Ulaşım'a", "to Getting around"],
  activity: ["Etkinlikler'e", "to Activities"],
  todo: ["Yapılacak şeyler'e", "to Things to do"],
  food: ["Restoranlar'a", "to Restaurants"],
  other: ["Diğer'e", "to Other"],
  inspo: ["İlham'a", "to Inspiration"],
};
export const sectionTo = (id: SectionId): string => L(...SECTION_TO[id]);

/** The toast when a new card lands out of sight: "Konaklama'ya eklendi: Casa Azul", or how many. */
export function arrivedText(arrived: { name: string; section: SectionId }[]): string {
  if (arrived.length === 1) {
    const [{ name, section }] = arrived;
    return L(`${sectionTo(section)} eklendi: ${name}`, `Added ${sectionTo(section)}: ${name}`);
  }
  return L(`${arrived.length} kayıt plana eklendi`, `${arrived.length} things added to the plan`);
}

/** What the waiting card is busy with, by section ("Fiyat ve tarihler bulunuyor…"). */
const FINDING: Record<SectionId | "none", [string, string]> = {
  stay: ["Fiyat ve tarihler bulunuyor…", "Finding the price and dates…"],
  flight: ["Saatler ve fiyat bulunuyor…", "Finding the times and price…"],
  transport: ["Güzergâh ve fiyat bulunuyor…", "Finding the route and price…"],
  activity: ["Tarih ve fiyat bulunuyor…", "Finding the date and price…"],
  todo: ["Yer ve adres bulunuyor…", "Finding the place and address…"],
  food: ["Yer ve adres bulunuyor…", "Finding the place and address…"],
  other: ["Ayrıntılar bulunuyor…", "Finding the details…"],
  inspo: ["Ne olduğuna bakılıyor…", "Looking at what it is…"],
  none: ["Ne olduğuna bakılıyor…", "Looking at what it is…"],
};

/** The stages of the waiting line: there's no real progress from the model, so the line moves with time. */
export const STAGE_MS = [2500, 6500] as const;

/**
 * The waiting card's line: "Airbnb okunuyor…" → "Fiyat ve tarihler bulunuyor…" → "Plana yerleşiyor…", by how
 * long it has been read; a failure says so instead.
 */
export function stageText(c: { status: "pending" | "processing" | "done" | "error"; kind?: "extension" | "paste-link" | "image" | "file" }, site: string | null, section: SectionId | null, elapsed: number): string {
  if (c.status === "error") return L("Okunamadı", "Couldn't read it");
  if (elapsed < STAGE_MS[0]) {
    if (c.kind === "image") return L("Ekran görüntüsü okunuyor…", "Reading the screenshot…");
    if (c.kind === "file") return L("Belge okunuyor…", "Reading the document…");
    return site ? L(`${site} okunuyor…`, `Reading ${site}…`) : L("Sayfa okunuyor…", "Reading the page…");
  }
  if (elapsed < STAGE_MS[1]) return L(...FINDING[section ?? "none"]);
  return L("Plana yerleşiyor…", "Finding its place in the plan…");
}

/** The ids seen on one trip so far: what's in it now and was never seen is new. */
export interface Seen {
  tripId: string;
  ids: ReadonlySet<string>;
}

/**
 * New since the last look: none on the first look and none on another trip's (they were there already); a
 * record that comes back (an undo) was seen before, so it isn't new either.
 */
export function diffArrivals(seen: Seen | null, tripId: string, ids: readonly string[]): { seen: Seen; fresh: string[] } {
  if (!seen || seen.tripId !== tripId) return { seen: { tripId, ids: new Set(ids) }, fresh: [] };
  const fresh = ids.filter((id) => !seen.ids.has(id));
  if (!fresh.length) return { seen, fresh };
  return { seen: { tripId, ids: new Set([...seen.ids, ...fresh]) }, fresh };
}

/** A chat chip's state: working, landed (with the card to go to), or failed (with what to retry). */
export type ChipState =
  | { tone: "work"; text: string }
  | { tone: "done"; text: string; itemId: string | null }
  | { tone: "error"; text: string; captureId: string | null; detail: string | null };

/**
 * A link's (or a screenshot's) chip from its capture as it stands: "Airbnb okunuyor…", then "✓ Konaklama'ya
 * eklendi" when its record is on this trip, "✓ Portekiz gezisine eklendi" when it went to another, else
 * "⚠ okunamadı". `capture` undefined: not read back yet (still working).
 */
export function chipState(
  capture: { id: string; status: "pending" | "processing" | "done" | "error"; error: string | null; itemId: string | null } | null | undefined,
  landed: { id: string; tripId: string; section: SectionId } | null,
  ctx: { tripId: string; site: string | null; tripTitle?: (id: string) => string | null; screenshot?: boolean },
): ChipState {
  if (capture === null) return { tone: "error", text: L("Kaldırıldı", "Removed"), captureId: null, detail: null };
  if (!capture || capture.status === "pending" || capture.status === "processing") {
    return { tone: "work", text: ctx.screenshot ? L("Ekran görüntüsü okunuyor…", "Reading the screenshot…") : ctx.site ? L(`${ctx.site} okunuyor…`, `Reading ${ctx.site}…`) : L("Okunuyor…", "Reading…") };
  }
  if (capture.status === "error") return { tone: "error", text: L("Okunamadı", "Couldn't read it"), captureId: capture.id, detail: capture.error };
  if (landed && landed.tripId !== ctx.tripId) {
    const title = ctx.tripTitle?.(landed.tripId);
    return { tone: "done", text: title ? L(`✓ ${title} gezisine eklendi`, `✓ Added to ${title}`) : L("✓ Başka bir geziye eklendi", "✓ Added to another trip"), itemId: null };
  }
  if (landed) return { tone: "done", text: L(`✓ ${sectionTo(landed.section)} eklendi`, `✓ Added ${sectionTo(landed.section)}`), itemId: landed.id };
  return { tone: "done", text: L("✓ Eklendi", "✓ Added"), itemId: null };
}

/**
 * The record a chat event line is about: "✓ Casa Azul kaydedildi → Konaklama · Porto", "↻ Bolhão pazarı
 * güncellendi", "✓ Casa Azul booked…" → "Casa Azul". Null for a line that names none.
 */
export function eventItemName(text: string): string | null {
  const saved = text.match(/^✓\s+(.+?)\s+(?:kaydedildi|rezerve edildi|saved|booked|örnek geziden|moved here)(?:\s|$)/);
  if (saved) return saved[1].trim();
  const updated = text.match(/^↻\s+(.+?)\s+(?:güncellendi|updated)\s*$/);
  return updated ? updated[1].trim() : null;
}
