// What has been read about a place, kept as evidence. Pure: turns a reading into stored reviews and
// findings, checking every excerpt against the stored page, and answers how much each finding is
// backed and how recent it is. The model call that produces a reading lives in reader.ts.
import { excerptOnPage, plainPage, plainText, samePlain, textId } from "./evidence";
import { compact } from "./extract";
import { corpusOf, listingKeyOf } from "./items";
import type { ReaderOutput } from "./reader";
import type { Capture, Category, Finding, FindingNature, HouseRules, Item, Listing, ReviewEvidence } from "./types";

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
      nature: f.nature,
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
  /** Is it still so? What the reviews after the last mention say (see stillTrue). */
  still: StillTrue;
  /** How well it's backed, 0–1: the page itself, or how many guests say it, in how many months. */
  strength: number;
  /** Probably not so any more: an event later guests stopped mentioning, or history (see FADED). */
  faded: boolean;
}

/**
 * Things that happen and pass: scaffolding, construction, a renovation, a broken air conditioner, a
 * closed pool. For findings read before the reader said which kind they were.
 */
const EVENT_WORDS =
  /iskele|inşaat|şantiye|tadilat|renovasyon|onarım|scaffold|construction|building work|renovat|refurb|remodel|andaime|obras|bozu[kl]|arıza|çalışmıyor|kapalı|broken|out of order|not working|\bclosed\b/i;

/**
 * Lasting (thin walls, no lift, a noisy street), an event (scaffolding, a renovation, a pool closed
 * that week), or stated by the page itself (description, amenities, rules). The reader says which;
 * for older readings, what it says decides.
 */
export function natureOf(f: Pick<Finding, "nature" | "source" | "text">): FindingNature {
  if (f.source !== "reviews") return "stated";
  if (f.nature === "event" || f.nature === "lasting") return f.nature;
  return EVENT_WORDS.test(f.text) ? "event" : "lasting";
}

/** Words for the same passing thing in the languages guests write in: a later review naming it speaks to it. */
const EVENT_TERMS: RegExp[] = [
  /iskele|scaffold|andaime|ponteggi|gerüst|échafaudage/i,
  /inşaat|şantiye|construction|building work|construção|\bobras?\b|cantiere|baustelle|chantier|drilling/i,
  /tadilat|renovasyon|renovat|refurb|remodel|\breforma/i,
];
/** A later guest saying it's over: "iskele kaldırılmış", "the works are finished". */
const ENDED = /bitmiş|bitti|kaldırıl|söküldü|artık yok|tamamlan|no longer|finished|completed|removed|taken down|gone now|já não|terminad|acabaram/i;

/** Confidence that it's still so, at or above which a problem is held against a place. */
export const CONFIDENT = 0.7;
/** Below this it has probably passed: kept and shown in the details, not on the card, not in points. */
export const FADED = 0.35;
/** Each later guest who doesn't mention a passing thing: its confidence drops this much (6 silent: ~0.26). */
const SILENT_DECAY = 0.8;
/** A later guest saying it's over. */
const ENDED_DECAY = 0.3;
/** A later guest praising the same thing (quiet, after "construction noise"). */
const COUNTER_DECAY = 0.6;
/** Reviews without dates: can't tell, so neither sure nor dismissed. */
const UNDATED = 0.6;
/** Only guests over a year ago said it. */
const OLD = 0.3;

export interface StillTrue {
  nature: FindingNature;
  /** 0–1: how likely it's still so. 1 for what the page states and for what recent guests say. */
  confidence: number;
  /** The last month a guest said it (a later review naming it counts), YYYY-MM. */
  lastSaid: string | null;
  /** Later reviews (dated after lastSaid) that don't mention it. */
  laterSilent: number;
  /** Later reviews that name the same thing without being counted behind it (it's still there). */
  laterFor: number;
  /** Later reviews that say it's over, or praise the same thing. */
  laterAgainst: number;
  /** Months the guests behind it wrote in. */
  distinctMonths: number;
  /** Share of the reviews read that say it; null when none were read. */
  share: number | null;
  /** Whether its reviews have dates at all. */
  dated: boolean;
}

/**
 * Is it still so? For what the page states: yes. For a lasting thing (thin walls): yes while guests
 * said it within the year; later silence doesn't change a wall. For an event (scaffolding): each later
 * guest who doesn't mention it makes it less likely (about six silent reviews: probably over), a later
 * guest naming it again brings it back, one saying it's over drops it fast. Undated: can't tell (medium).
 */
export function stillTrue(finding: Finding, listing: Listing, today: string): StillTrue {
  const nature = natureOf(finding);
  const backing = new Set(finding.reviewIds);
  const reviews = listing.reviews.filter((r) => backing.has(r.id));
  const dates = reviews.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();
  const share = listing.reviews.length ? reviews.length / listing.reviews.length : null;
  const base = { nature, lastSaid: dates.at(-1) ?? null, laterSilent: 0, laterFor: 0, laterAgainst: 0, distinctMonths: new Set(dates).size, share, dated: dates.length > 0 };
  if (nature === "stated") return { ...base, confidence: 1, dated: true };
  if (!dates.length) return { ...base, confidence: UNDATED };

  // The passing thing as later guests would name it (in whatever language): from its words and its reviews.
  const said = [finding.text, ...reviews.map((r) => r.text)];
  const terms = nature === "event" ? EVENT_TERMS.filter((re) => said.some((t) => re.test(t))) : [];
  const names = (text: string) => terms.some((re) => re.test(text));
  const others = listing.reviews.filter((r) => r.date && !backing.has(r.id));
  // A later guest naming it again (and not saying it's over): it's still there.
  const again = others.filter((r) => r.date! > base.lastSaid! && names(r.text) && !ENDED.test(r.text));
  const lastSaid = [base.lastSaid!, ...again.map((r) => r.date!)].sort().at(-1)!;
  const after = others.filter((r) => r.date! > lastSaid);
  const ended = after.filter((r) => names(r.text) && ENDED.test(r.text));
  // Guests praising the same thing afterwards ("çok sessiz" after "inşaat gürültüsü").
  const counter = new Set(
    listing.findings.filter((o) => o.polarity !== finding.polarity && o.topic === finding.topic && o.verified).flatMap((o) => o.reviewIds),
  );
  const praised = after.filter((r) => counter.has(r.id) && !ended.includes(r));
  const silent = after.length - ended.length - praised.length;

  let confidence = 1;
  if (nature === "event") confidence *= SILENT_DECAY ** silent * ENDED_DECAY ** ended.length * COUNTER_DECAY ** praised.length;
  const [y, m] = today.split("-").map(Number);
  const yearAgo = `${y - 1}-${String(m).padStart(2, "0")}`;
  if (lastSaid < yearAgo && dates.length === reviews.length && !finding.quotes.length) confidence *= OLD;
  return {
    ...base,
    confidence,
    lastSaid,
    laterSilent: nature === "event" ? silent : 0,
    laterFor: again.length,
    laterAgainst: nature === "event" ? ended.length + praised.length : 0,
  };
}

/**
 * How well a finding is backed, 0–1: the page itself says it (1), or guests do: one 0.4, two 0.8,
 * three or more 1; guests in different months count a little more, a handful out of very many a little less.
 */
function strengthOf(f: Finding, count: number, still: StillTrue, reviewsRead: number): number {
  if (still.nature === "stated") return 1;
  const n = Math.max(count, f.quotes.length ? 1 : 0);
  let s = n >= 3 ? 1 : n === 2 ? 0.8 : n === 1 ? 0.4 : 0;
  if (still.distinctMonths >= 2) s += 0.2;
  if (reviewsRead >= 20 && still.share != null && still.share < 0.05 && n <= 2) s *= 0.85;
  return Math.min(1, s);
}

/** "son söz Mar 2026, sonraki 10 yorum bahsetmiyor": why a passing thing is doubted; null when it isn't. */
export function stillText(still: StillTrue): string | null {
  if (!still.dated) return "yorumlar tarihsiz";
  if (!still.lastSaid || still.nature === "stated") return null;
  const last = `son söz ${monthLabel(still.lastSaid)}`;
  if (still.laterAgainst) return `${last}; sonraki ${still.laterAgainst} yorum geçtiğini söylüyor`;
  if (still.laterSilent) return `${last}, sonraki ${still.laterSilent} yorum bahsetmiyor`;
  return null;
}

/** The question to settle a doubt about a problem, by what it's about; its own words otherwise. */
const QUESTIONS: [RegExp, string][] = [
  [/iskele|scaffold/i, "İskele hâlâ duruyor mu?"],
  [/inşaat|şantiye|construction|building work/i, "İnşaat hâlâ sürüyor mu?"],
  [/tadilat|renovasyon|renovat/i, "Tadilat bitti mi?"],
  [/tahtakurusu|pire|böcek|haşere|hamamböce|bed ?bugs?|cockroach/i, "Haşere sorunu giderildi mi, ilaçlama yapıldı mı?"],
  [/havuz|pool/i, "Havuz açık mı?"],
  [/klima|air ?con/i, "Klima çalışıyor mu?"],
  [/asansör|elevator|\blift\b/i, "Asansör çalışıyor mu?"],
  [/sıcak su|hot water/i, "Sıcak su sorunu giderildi mi?"],
  [/wi-?fi|internet/i, "İnternet düzgün çalışıyor mu?"],
];

/** "İskele hâlâ duruyor mu?": what to ask before booking to know whether a problem is still there. */
export function questionFor(f: Pick<Finding, "text">): string {
  return QUESTIONS.find(([re]) => re.test(f.text))?.[1] ?? `“${f.text}”: hâlâ böyle mi?`;
}

/** Held against a place: well backed (the page, or two guests or more) and still so. */
export function holds(e: Pick<FindingEvidence, "strength" | "still">): boolean {
  return e.strength >= 0.6 && e.still.confidence >= CONFIDENT;
}

/** How much of a finding stands, 0–1: how well it's backed times how likely it's still so. */
export const standing = (e: Pick<FindingEvidence, "strength" | "still">) => e.strength * e.still.confidence;

/**
 * Standard things a page lists as there or missing that don't decide where to stay: a smoke alarm, a
 * hair dryer, hangers... Kept in what was read, left out of the decision and the cards.
 */
const TRIVIAL =
  /(?<!\p{L})(duman|karbon ?monoksit|co alarm|smoke|carbon monoxide|yangın söndür|yangın alarm|fire extinguisher|fire alarm|ilk ?yardım|first ?aid|saç kurutma|hair ?dryer|ütü(?!\p{L})|iron(?!\p{L})|askı|hangers?(?!\p{L})|şampuan|shampoo|sabun|soap|duş jeli|body wash|temel (malzeme|ihtiyaç)|essentials|nevresim|bed linens?|tabak|çatal|bıçak|dishes|silverware|cutlery)/iu;

export const isTrivialFinding = (f: Pick<Finding, "text">) => TRIVIAL.test(f.text);

/** Not knowing isn't a minus: "asansör bilgisi yok", "belirtilmemiş". */
const UNKNOWN = /(bilgi(si)?\s+(yok|verilmemiş)|belirtilmemiş|belirtilmiyor|yazmıyor|bilinmiyor|görünmüyor|belirsiz|not (stated|mentioned|specified)|no information)/i;
/** A complaint about arriving, as opposed to just its hours. */
const CHECK_IN_TROUBLE = /(zor|sorun|bekle|kimse|karışık|kötü|geç kal|ulaşıl|bulama|yok|hard|difficult|problem|wait|nobody|confus)/i;
/** Check-in from 14–16, check-out by 10–12: what every place does, not a plus or a minus. */
const HOUR = /(\d{1,2})(?:[:.](\d{2}))?/;

/**
 * Something read that's a fact, not a plus or a minus: when check-in opens (the transfers use the hours),
 * or that the page doesn't say something. Kept in what was read, left out of the decision and the cards.
 */
export function isInfoFinding(f: Pick<Finding, "text" | "topic">): boolean {
  if (UNKNOWN.test(f.text)) return true;
  if (f.topic === "check_in" && HOUR.test(f.text) && !CHECK_IN_TROUBLE.test(f.text)) {
    const hour = Number(f.text.match(HOUR)![1]);
    // An hour out of the usual (check-in at 20:00, check-out at 8:00) is worth saying; the usual isn't.
    return (hour >= 13 && hour <= 16) || (hour >= 10 && hour <= 12);
  }
  return false;
}

/** The place as the decision sees it: what was read, without the trivia and the plain facts. */
export function usefulListing(listing: Listing): Listing {
  const findings = listing.findings.filter((f) => !isTrivialFinding(f) && !isInfoFinding(f));
  return findings.length === listing.findings.length ? listing : { ...listing, findings };
}

/**
 * A minor thing one review mentions ("giriş zor" once): worth knowing in the details, not a headline.
 * What the page itself says, anything serious, and what several guests say are never weak.
 */
export function isWeakFinding(f: Finding, listing: Listing, today: string): boolean {
  // Mentions: the stored reviews behind it, or the quotes the reader gave when those didn't match.
  return f.source === "reviews" && f.severity !== "high" && Math.max(evidenceOf(f, listing, today).count, f.quotes.length) <= 1;
}

export function evidenceOf(finding: Finding, listing: Listing, today: string): FindingEvidence {
  const reviews = finding.reviewIds
    .map((id) => listing.reviews.find((r) => r.id === id))
    .filter((r): r is ReviewEvidence => Boolean(r));
  const dates = reviews.map((r) => r.date).filter((d): d is string => Boolean(d)).sort();
  const newest = dates.at(-1) ?? null;
  const [y, m] = today.split("-").map(Number);
  const yearAgo = `${y - 1}-${String(m).padStart(2, "0")}`;
  const stale = !finding.quotes.length && reviews.length > 0 && dates.length === reviews.length && newest != null && newest < yearAgo;
  const still = stillTrue(finding, listing, today);
  const strength = strengthOf(finding, reviews.length, still, listing.reviews.length);
  return { count: reviews.length, newest, stale, reviews, still, strength, faded: still.confidence < FADED };
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

/** Topics wide enough that two findings on them can be about different things (a pool, a washer). */
const BROAD_TOPICS = new Set<Finding["topic"]>(["amenities", "facilities", "other", "nearby", "location", "transport", "value", "condition", "access"]);
const stems = (text: string) =>
  new Set(
    text
      .toLocaleLowerCase("tr")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4)
      .map((w) => w.slice(0, 5)),
  );

/** Whether another place's page says the same kind of thing (a view, noise at night, a kitchen...). */
export function saysSame(f: Finding, other: Finding): boolean {
  if (f.polarity !== other.polarity || f.topic !== other.topic) return false;
  if (!BROAD_TOPICS.has(f.topic)) return true;
  const mine = stems(f.text);
  return [...stems(other.text)].some((w) => mine.has(w));
}
