// The circuit breaker: when an option's place hangs on one thing read on its page, say so. Pure: for
// each minus that weighs on an option, the group is ranked again as if the traveller had said "sorun
// değil" (the same path as acceptedFindings); if that alone moves the option across the #1 line or two
// places, it's pivotal. Until the traveller answers ("Önemli, kalsın" / "Sorun değil"), it costs points
// only, never rules the place out; the card asks, with a question ready for the host.
import { decideGroup, findingWeight, type DecisionContext, type GroupDecision } from "./decision";
import { liveLabels, nReviews } from "./i18nText";
import { listingKeyOf } from "./items";
import { acceptKey, evidenceOf, monthLabel, questionFor } from "./listing";
import type { Finding, Item } from "./types";

export interface Pivot {
  itemId: string;
  listingKey: string;
  finding: Finding;
  /** Its place now (1-based, among the options compared) and without this one thing. */
  from: number;
  to: number;
  /** "2 yorum, Mar 2026" or where the page says it ("açıklamada"). */
  evidence: string;
  /** What to ask before booking: "İskele hâlâ duruyor mu?". */
  question: string;
  /** A short message to copy to the host, quoting what the guests wrote. */
  hostMessage: string;
}

/** The minuses weighed per option (the heaviest few), so the check stays cheap. */
const PER_OPTION = 3;
/** Places an option must move for one thing to count as pivotal (or cross the #1 line). */
const MOVE = 2;
/** Points the one thing must weigh on the option's score (options level within a point or two flip on anything). */
const MIN_GAIN = 3;

const SOURCE_WORDS: Readonly<Record<Finding["source"], string>> = liveLabels({
  reviews: ["yorumlarda", "in reviews"],
  description: ["açıklamada", "in the description"],
  amenities: ["olanaklarda", "in the amenities"],
  policy: ["kurallarda", "in the rules"],
  other: ["sayfada", "on the page"],
});

/**
 * The findings the ranking of this group hangs on, the biggest moves first, at most `max`. Recomputed
 * without the AI review on both sides, so only the one thing differs.
 */
export function pivotalFindings(d: GroupDecision, ctx: DecisionContext, max = 2): Pivot[] {
  if (d.status !== "ok" && d.status !== "tie") return [];
  const items = d.options.map((o) => o.item);
  const plain: DecisionContext = { ...ctx, analyses: new Map() };
  const placeIn = (g: GroupDecision, id: string) => g.options.filter((o) => !o.excluded).findIndex((o) => o.item.id === id) + 1;
  const base = decideGroup(items, plain, d.key);
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  const confirmed = new Set(ctx.trip.confirmedFindings ?? []);
  const found: Pivot[] = [];
  for (const option of base.options) {
    if (option.excluded || option.score == null || option.fit === "unfit") continue;
    const listing = ctx.listings.get(listingKeyOf(option.item));
    if (!listing?.readAt) continue;
    const from = placeIn(base, option.item.id);
    if (from <= 1) continue; // first already: nothing it could gain
    const weighing = listing.findings
      .filter((f) => {
        if (f.polarity !== "negative" || !f.verified || f.severity === "low") return false;
        const key = acceptKey(listing.key, f);
        if (accepted.has(key) || confirmed.has(key)) return false;
        const e = evidenceOf(f, listing, ctx.today);
        return !e.stale && !e.faded;
      })
      .sort((a, b) => findingWeight(b, listing, ctx.today) - findingWeight(a, listing, ctx.today))
      .slice(0, PER_OPTION);
    const tried = new Set<string>();
    for (const f of weighing) {
      const key = acceptKey(listing.key, f);
      if (tried.has(key)) continue; // "sorun değil" covers the kind of thing: once per kind
      tried.add(key);
      const without = decideGroup(items, { ...plain, trip: { ...plain.trip, acceptedFindings: [...accepted, key] } }, d.key);
      const to = placeIn(without, option.item.id);
      if (to < 1 || !(to === 1 || from - to >= MOVE)) continue;
      // Level with another, any little thing flips them: only what weighs counts as the one thing.
      const gain = (without.options.find((o) => o.item.id === option.item.id)?.score ?? 0) - option.score;
      if (gain < MIN_GAIN) continue;
      found.push(pivotOf(option.item, listing.key, f, from, to, ctx));
    }
  }
  return found.sort((a, b) => b.from - b.to - (a.from - a.to) || a.to - b.to).slice(0, max);
}

function pivotOf(item: Item, listingKey: string, f: Finding, from: number, to: number, ctx: DecisionContext): Pivot {
  const listing = ctx.listings.get(listingKey)!;
  const e = evidenceOf(f, listing, ctx.today);
  const evidence = e.count ? `${nReviews(e.count)}${e.newest ? `, ${monthLabel(e.newest)}` : ""}` : SOURCE_WORDS[f.source];
  // The guests' own words (the newest), else the page's: what the host is asked about is on the page.
  const said = [...e.reviews].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0]?.text ?? f.quotes[0] ?? f.text;
  return { itemId: item.id, listingKey, finding: f, from, to, evidence, question: questionFor(f), hostMessage: hostMessage(item, f, said, e.count > 0) };
}

/** The question in English, for the host: what the Turkish question asks. */
const HOST_QUESTIONS: [RegExp, string][] = [
  [/iskele|scaffold/i, "Is the scaffolding still up?"],
  [/inşaat|şantiye|construction|building work|road ?works/i, "Is the construction work still going on?"],
  [/tadilat|renovasyon|renovat|refurb/i, "Is the renovation finished?"],
  [/tahtakurusu|pire|böcek|haşere|hamamböce|bed ?bugs?|cockroach|roach|\bfleas?\b|\bpests?\b|insects?|\bbugs\b/i, "Has the pest problem been dealt with?"],
  [/havuz|pool/i, "Is the pool open?"],
  [/klima|air ?con|\ba\/c\b/i, "Is the air conditioning working?"],
  [/asansör|elevator|\blift\b/i, "Is the lift working?"],
  [/sıcak su|hot water/i, "Is the hot water working properly?"],
  [/wi-?fi|internet/i, "Is the Wi-Fi working well?"],
];

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * "Hi! We're looking at your place for 8–11 Oct. A review mentions: "Scaffolding was put up outside…"
 * Is the scaffolding still up? Thanks!" In English (hosts abroad), quoting the page as it is.
 */
export function hostMessage(item: Pick<Item, "dates">, f: Pick<Finding, "text">, said: string, fromReview = true): string {
  const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const when = item.dates.start && item.dates.end ? ` for ${date(item.dates.start)} – ${date(item.dates.end)}` : "";
  const ask = HOST_QUESTIONS.find(([re]) => re.test(f.text) || re.test(said))?.[1] ?? "Is this still the case?";
  return `Hi! We're considering your place${when}. ${fromReview ? "A review mentions" : "The listing says"}: "${clip(said, 160)}" ${ask} Thank you!`;
}
