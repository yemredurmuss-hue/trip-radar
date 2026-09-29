// What has been read about a place, kept as evidence. Pure: turns a reading into stored reviews and
// findings, checking every excerpt against the stored page, and answers how much each finding is
// backed and how recent it is. The model call that produces a reading lives in reader.ts.
import { excerptOnPage, plainPage, plainText, samePlain, textId } from "./evidence";
import { compact } from "./extract";
import { corpusOf, listingKeyOf } from "./items";
import type { ReaderOutput } from "./reader";
import type { Capture, Category, Finding, HouseRules, Item, Listing, ReviewEvidence } from "./types";

/** Places whose pages are worth reading closely. Flights and eSIMs are covered by extraction. */
export const READ_CATEGORIES: Category[] = ["stay", "activity", "food", "other", "transport"];

const MIN_TEXT = 300;
const MAX_REVIEWS = 200;
const MAX_FINDINGS = 20;
const RETRY_MS = 10 * 60e3;
const AUTO_RETRIES = 3;

export const hasReadableText = (capture: Capture) => compact(capture.pageText).length >= MIN_TEXT;

/** A reading is due when the place's newest page hasn't been read yet (failures wait, a few times at most). */
export function needsReading(item: Item, listing: Listing | undefined, now = Date.now(), force = false): boolean {
  if (!READ_CATEGORIES.includes(item.category) || item.status === "dismissed") return false;
  const latest = item.captureIds.at(-1);
  if (!latest || listing?.readCaptureIds.includes(latest)) return false;
  if (force || !listing?.error) return true;
  return (listing.autoRetries ?? 0) < AUTO_RETRIES && now - (listing.errorAt ?? 0) > RETRY_MS;
}

export function emptyListing(item: Item, now: number): Listing {
  return {
    key: listingKeyOf(item),
    name: item.name,
    reviews: [],
    reviewTotal: null,
    findings: [],
    readCaptureIds: [],
    readAt: null,
    dropped: 0,
    error: null,
    errorAt: null,
    updatedAt: now,
  };
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Turns the model's reading into stored evidence, checking everything against the stored page:
 * excerpts that aren't on it are dropped (and counted), a review's date counts only if its text is
 * on the page. The newest reading's findings come first; earlier findings on other topics are kept,
 * since the reviews behind them are still evidence.
 */
export function applyReading(
  previous: Listing | undefined,
  item: Item,
  capture: Capture,
  out: ReaderOutput,
  today: string,
  now: number,
): Listing {
  const base = previous ?? emptyListing(item, now);
  const page = plainPage(corpusOf(capture));
  let dropped = 0;

  const reviews = new Map(base.reviews.map((r) => [r.id, r]));
  for (const r of out.reviews.slice(0, 60)) {
    const text = r.text.trim();
    if (!excerptOnPage(text, page)) {
      dropped++;
      continue;
    }
    const shownDate = r.date_text ? plainText(r.date_text) : "";
    const date = shownDate && page.includes(` ${shownDate} `) && r.date && MONTH.test(r.date) && r.date <= today.slice(0, 7) ? r.date : null;
    const id = textId(text);
    const known = reviews.get(id);
    reviews.set(id, known ? { ...known, date: known.date ?? date } : { id, text: text.slice(0, 600), date, captureId: capture.id });
  }
  const stored = [...reviews.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, MAX_REVIEWS);

  const findings = new Map<string, Finding>();
  for (const f of out.findings.slice(0, 24)) {
    const text = f.text.trim();
    if (!text) continue;
    const reviewIds = new Set<string>();
    const quotes: string[] = [];
    for (const q of f.quotes.slice(0, 5)) {
      if (!excerptOnPage(q, page)) {
        dropped++;
        continue;
      }
      const pieces = q.split(/\.\.\.|…/).filter((p) => p.trim().length >= 12);
      const review = stored.find((r) => pieces.some((p) => samePlain(r.text, p)));
      if (review) reviewIds.add(review.id);
      else quotes.push(q.trim().slice(0, 300));
    }
    const finding: Finding = {
      id: `${f.topic}:${f.polarity}:${textId(text)}`,
      text: text.slice(0, 80),
      polarity: f.polarity,
      topic: f.topic,
      source: f.source,
      severity: f.severity,
      reviewIds: [...reviewIds],
      quotes: [...new Set(quotes)],
      verified: reviewIds.size > 0 || quotes.length > 0,
    };
    const same = findings.get(finding.id);
    findings.set(
      finding.id,
      same
        ? {
            ...same,
            reviewIds: [...new Set([...same.reviewIds, ...finding.reviewIds])],
            quotes: [...new Set([...same.quotes, ...finding.quotes])],
            verified: same.verified || finding.verified,
          }
        : finding,
    );
  }
  const fresh = [...findings.values()];
  const covered = new Set(fresh.map((f) => `${f.topic}:${f.polarity}`));
  const kept = base.findings.filter((f) => f.verified && !covered.has(`${f.topic}:${f.polarity}`));

  const house = houseRules(out.house ?? null, page);
  if (house.dropped) dropped += house.dropped;
  const total =
    typeof out.review_total === "number" && Number.isFinite(out.review_total) && out.review_total > 0 ? Math.round(out.review_total) : null;
  return {
    ...base,
    name: item.name,
    reviews: stored,
    reviewTotal: total ?? base.reviewTotal,
    findings: [...fresh, ...kept].slice(0, MAX_FINDINGS),
    house: house.rules ?? base.house ?? null,
    readCaptureIds: [...new Set([...base.readCaptureIds, capture.id])],
    readAt: now,
    dropped,
    error: null,
    errorAt: null,
    autoRetries: 0,
    updatedAt: now,
  };
}

/** Clock times written in a text, as HH:MM: "15:00", "3 PM", "11.30" (a bare number isn't one). */
export function clockTimes(text: string): string[] {
  const out = new Set<string>();
  const pad = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  for (const m of text.matchAll(/(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|öö|ös)?/gi)) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const half = m[3]?.toLowerCase().replace(/\./g, "");
    if (!m[2] && !half) continue; // a bare number isn't a time
    if (half === "pm" || half === "ös") h = h === 12 ? 12 : h + 12;
    if ((half === "am" || half === "öö") && h === 12) h = 0;
    if (h <= 23 && min <= 59) out.add(pad(h, min));
  }
  return [...out];
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The stay's times and arrival rules, kept only when the page says them: the quotes must be on the
 * page, and each time must appear in them ("15:00" in "Giriş: 15:00'ten itibaren", or as "3:00 PM").
 */
function houseRules(house: ReaderOutput["house"], page: string): { rules: HouseRules | null; dropped: number } {
  if (!house) return { rules: null, dropped: 0 };
  const quotes = house.quotes.map((q) => q.trim()).filter((q) => q && excerptOnPage(q, page));
  const dropped = house.quotes.length - quotes.length;
  if (!quotes.length) return { rules: null, dropped };
  const shown = new Set(quotes.flatMap(clockTimes));
  const time = (t: string | null) => (t && HHMM.test(t) && shown.has(t) ? t : null);
  const rules: HouseRules = {
    checkInFrom: time(house.check_in_from),
    checkInUntil: time(house.check_in_until),
    checkOutUntil: time(house.check_out_until),
    selfCheckIn: house.self_check_in,
    luggageStorage: house.luggage_storage,
    airportShuttle: house.airport_shuttle,
    quotes: quotes.map((q) => q.slice(0, 300)),
  };
  const any = rules.checkInFrom || rules.checkInUntil || rules.checkOutUntil || [rules.selfCheckIn, rules.luggageStorage, rules.airportShuttle].some((b) => b !== null);
  return { rules: any ? rules : null, dropped };
}

/** A failed reading: the evidence already gathered stays; the next try waits (see needsReading). */
export function failedReading(previous: Listing | undefined, item: Item, message: string, now: number): Listing {
  const base = previous ?? emptyListing(item, now);
  return { ...base, error: message, errorAt: now, autoRetries: previous?.error ? (previous.autoRetries ?? 0) + 1 : 0, updatedAt: now };
}

// --- reading the evidence ---------------------------------------------------------------------------

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export interface FindingEvidence {
  /** Stored reviews that say it (a sample of the site's reviews, not all guests). */
  count: number;
  /** Newest dated review behind it, YYYY-MM. */
  newest: string | null;
  /** Every review behind it is dated and over a year old, and the page text doesn't say it: history, not evidence. */
  stale: boolean;
  reviews: ReviewEvidence[];
}

/** The reviews behind a finding, how recent the newest one is, and whether it is too old to go on. */
export function evidenceOf(finding: Finding, listing: Listing, today: string): FindingEvidence {
  const reviews = finding.reviewIds
    .map((id) => listing.reviews.find((r) => r.id === id))
    .filter((r): r is ReviewEvidence => Boolean(r));
  const dates = reviews.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();
  const newest = dates.at(-1) ?? null;
  const [y, m] = today.split("-").map(Number);
  const yearAgo = `${y - 1}-${String(m).padStart(2, "0")}`;
  const stale = !finding.quotes.length && reviews.length > 0 && dates.length === reviews.length && newest != null && newest < yearAgo;
  return { count: reviews.length, newest, stale, reviews };
}

/** Can this finding decide anything (rule a place out)? Only when it was found on the page and isn't old. */
export function isDecisive(finding: Finding, listing: Listing, today: string): boolean {
  return finding.verified && !evidenceOf(finding, listing, today).stale;
}

/** "48 yorum incelendi (sitede 1.204) · Eyl 2025 – Eyl 2026". */
export function coverageText(listing: Listing): string {
  const n = listing.reviews.length;
  const dates = listing.reviews.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();
  const range = dates.length
    ? dates[0] === dates.at(-1)
      ? monthLabel(dates[0])
      : `${monthLabel(dates[0])} – ${monthLabel(dates.at(-1)!)}`
    : null;
  const total = listing.reviewTotal && listing.reviewTotal > n ? ` (sitede ${listing.reviewTotal.toLocaleString("tr-TR")})` : "";
  return [n ? `${n} yorum incelendi${total}` : "Sayfada okunabilir yorum yoktu", range].filter(Boolean).join(" · ");
}

/** Key under which the traveller accepted a kind of finding for a place ("sorun değil"). */
export const acceptKey = (listingKey: string, f: Pick<Finding, "topic" | "polarity">) => `${listingKey}#${f.topic}:${f.polarity}`;

/** One line about the reading of an item's place: what was read, or that it is pending or failed. */
export function readingLine(item: Item, listing: Listing | undefined, now = Date.now()): { text: string; tone: "muted" | "warning" } | null {
  if (!READ_CATEGORIES.includes(item.category)) return null;
  const pending = needsReading(item, listing, now);
  if (listing?.error && !listing.readAt) return { text: `Sayfa okunamadı: ${listing.error}`, tone: "warning" };
  if (listing?.readAt) return { text: `${coverageText(listing)}${pending ? " · yeni kayıt okunuyor…" : ""}`, tone: "muted" };
  return pending ? { text: "Sayfa okunuyor…", tone: "muted" } : null;
}

/**
 * Passages of a stored page that mention any of the words (for questions the reading didn't cover:
 * "TV var mı?", "check-in saati?"). Case- and accent-insensitive; each passage is a line of the page,
 * cut to a readable length around the match.
 */
export function searchText(text: string, words: string[], max = 8): string[] {
  const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("tr");
  const terms = [...new Set(words.map((w) => fold(w.trim())).filter((w) => w.length >= 2))];
  if (!terms.length) return [];
  const found: string[] = [];
  for (const line of text.split(/\n+/)) {
    const clean = line.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const folded = fold(clean);
    const at = Math.min(...terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0));
    if (!Number.isFinite(at)) continue;
    const start = Math.max(0, at - 120);
    const passage = `${start > 0 ? "…" : ""}${clean.slice(start, start + 300)}${start + 300 < clean.length ? "…" : ""}`;
    if (!found.includes(passage)) found.push(passage);
    if (found.length >= max) break;
  }
  return found;
}
