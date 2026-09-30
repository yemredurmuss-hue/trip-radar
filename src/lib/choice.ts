// A decision as the traveller reads it: every option numbered best first (1, 2, 3, 4...), with its score,
// what it's strongest on among the ones that fit ("En ekonomik", "En sessiz"), and why it stands where it
// does: against the first (for the first, against the second) what it costs or saves, what it gives and
// what it gives up. Above them one sentence: the pick and why, and the alternatives for each priority.
// Pure.
import {
  amenityState,
  checksOnlyReading,
  CRITERION_LABELS,
  levelFor,
  levelSource,
  saidOf,
  touchesTopic,
  WISH_TOPIC,
  WISHES,
  type DecisionContext,
  type GroupDecision,
  type OptionResult,
  type Part,
} from "./decision";
import { differencesOf, type DiffCell, type DiffRow } from "./differences";
import { formatPrice, listingKeyOf, nightsBetween } from "./items";
import { acceptKey, evidenceOf, FADED } from "./listing";
import { rangeOfGroupKey } from "./plan";
import type { Amenity, CriterionId, FindingTopic, Listing } from "./types";

type Ctx = Pick<DecisionContext, "trip" | "currency" | "inferred" | "listings" | "today" | "preferences"> & { said?: Set<string> };

/** What an option is compared against: how much more (or less) it costs, what it gives, what it gives up. */
export interface Trade {
  /** The option it's weighed against (the cheapest that meets the musts, or for that one, the balanced one). */
  vs: string;
  /** In the trip's currency; positive = this one costs more. Null when a price is missing. */
  diff: number | null;
  /** Per night, for stays of several nights. */
  perNight: number | null;
  /** "+€60", "€60 daha ucuz", "aynı fiyat". */
  money: string | null;
  /** What it has that the other doesn't: "mutfak var", "13 dk daha yakın", "Sessiz sokak · 4 yorum". */
  gains: string[];
  /** Where it falls short of the other, said from its side ("37 dk daha uzak", "mutfak yazmıyor"). */
  losses: string[];
}

export interface Ranked {
  option: OptionResult;
  /** 1, 2, 3...: its place; null for a stay priced for other dates (not in this comparison). */
  rank: number | null;
  /** What it's strongest on among the ones that fit: "En ekonomik", "En sessiz". */
  badges: string[];
  /** The same as nouns for a sentence: "tasarruf", "sessizlik". */
  lenses: string[];
  /** Against the first (the first: against the second): the money, what it gives, what it gives up. */
  trade: Trade | null;
  /** The place it's weighed against: 2 for the first, else 1. */
  vsRank: number | null;
  /** What the traveller cares about that the others' pages speak of and this one's don't: "sessizlik". */
  unknown: string[];
}

export interface Choice {
  /** Every option, best first: fit, then to check, then partial, then out. */
  ranked: Ranked[];
  /** The cheapest option that meets the musts. */
  anchor: OptionResult | null;
  /** "Önerim Casa Ribeira: en iyi konum; €60 fazlasına 15 dk daha yakın ve mutfak var. Tasarruf ve sessizlik için 2. Bonfim Loft (€60 daha ucuz)." */
  headline: string | null;
  /** What to check before choosing one near the top: "Bonfim Loft: mutfak yazmıyor". */
  verify: { itemId: string; name: string; what: string }[];
}

/** A lens: the criterion it looks at, the noun for the sentence, the superlative for the card. */
const LENS: Partial<Record<CriterionId, { noun: string; best: string }>> = {
  price: { noun: "tasarruf", best: "En ekonomik" },
  location: { noun: "konum", best: "En iyi konum" },
  quiet: { noun: "sessizlik", best: "En sessiz" },
  clean: { noun: "temizlik", best: "En temiz" },
  view: { noun: "manzara", best: "En iyi manzara" },
  space: { noun: "ferahlık", best: "En ferah" },
  bed: { noun: "uyku", best: "En iyi yatak" },
  breakfast: { noun: "kahvaltı", best: "En iyi kahvaltı" },
  access: { noun: "erişim", best: "En kolay erişim" },
  safety: { noun: "güvenlik", best: "En güvenli" },
  rating: { noun: "yorumlar", best: "En iyi yorumlar" },
  comfort: { noun: "konfor", best: "En konforlu" },
  cancellation: { noun: "esnek iptal", best: "En esnek iptal" },
  amenities: { noun: "istediğin olanaklar", best: "İstediklerin onda" },
  duration: { noun: "kısa yolculuk", best: "En kısa" },
  stops: { noun: "az aktarma", best: "En az aktarma" },
  schedule: { noun: "uygun saat", best: "En uygun saat" },
  baggage: { noun: "bagaj", best: "Bagaj dahil" },
  data: { noun: "veri", best: "En çok veri" },
  validity: { noun: "geçerlilik", best: "En uzun geçerlilik" },
};

/** A lens worth showing: the criterion matters ("Önemli" or more) and one option clearly leads on it. */
const LENS_LEVEL = 3;
const CLEAR_LEAD = 0.05;
/** The top places a missing fact is worth checking for. */
const VERIFY_TOP = 3;

const part = (o: OptionResult, c: CriterionId): Part | undefined => o.parts.find((p) => p.criterion === c);
const priceOf = (o: OptionResult) => (o.limited.length ? null : (part(o, "price")?.value ?? null));
const capital = (t: string) => t.charAt(0).toLocaleUpperCase("tr") + t.slice(1);
const lower = (t: string) => t.charAt(0).toLocaleLowerCase("tr") + t.slice(1);

function joinTr(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ve ${words.at(-1)}`;
}

/** The amenities asked for that this one has and the other doesn't know or lacks: "mutfak var". */
function amenityGains(a: OptionResult, b: OptionResult, ctx: Ctx): string[] {
  const wanted = [...new Set([...(ctx.trip.wantedAmenities ?? []), ...(ctx.trip.requirements ?? []).flatMap((r) => (r.kind === "amenity" ? [r.amenity] : []))])] as Amenity[];
  const listings = ctx as DecisionContext;
  return wanted.filter((x) => amenityState(a.item, x, listings) === "yes" && amenityState(b.item, x, listings) !== "yes").map((x) => `${x} var`);
}

/** What `a` has over `b` on one criterion, in concrete words. */
function gainText(c: CriterionId, pa: Part, pb: Part, a: OptionResult, b: OptionResult, ctx: Ctx): string[] {
  const diff = pa.value != null && pb.value != null ? Math.abs(pa.value - pb.value) : null;
  switch (c) {
    case "amenities":
      return amenityGains(a, b, ctx);
    case "location":
      return diff != null && diff >= 2 && (pa.display ?? "").includes(" dk") ? [`${Math.round(diff)} dk daha yakın`] : ["konumu daha iyi"];
    case "quiet":
    case "clean":
    case "view":
    case "space":
    case "bed":
    case "breakfast":
    case "access":
    case "safety":
      // What the pages say for it, in their words ("sessiz sokak · 4 yorum").
      return pa.display ? [lower(pa.display)] : [`${lower(CRITERION_LABELS[c])} daha iyi`];
    case "rating":
      return [`yorumlar daha iyi (${pa.display?.split(" · ")[0]} – ${pb.display?.split(" · ")[0]})`];
    case "cancellation":
      return [lower(pa.display ?? "iptal daha esnek")];
    case "stops":
    case "baggage":
      return [lower(pa.display ?? CRITERION_LABELS[c])];
    case "duration":
      return diff ? [`${Math.round(diff)} dk daha kısa`] : ["daha kısa"];
    case "comfort":
      return ["daha konforlu"];
    case "schedule":
      return ["saatleri daha uygun"];
    case "data":
      return ["daha çok veri"];
    case "validity":
      return ["daha uzun geçerli"];
    default:
      // "Yorum ve detaylar" as a whole says nothing concrete; its lines are on the card.
      return [];
  }
}

/**
 * Where `a` is clearly worse than `b`, said from `a`'s side: "37 dk daha uzak", "mutfak yazmıyor",
 * "gece bar gürültüsü · 3 yorum", "yorumları daha zayıf (8,9/10 – 9,2/10)".
 */
function shortfalls(a: OptionResult, b: OptionResult, ctx: Ctx): string[] {
  const texts = edgeRows(b, a, ctx).flatMap(({ criterion: c }) => {
    const own = part(a, c)!;
    const other = part(b, c)!;
    const diff = own.value != null && other.value != null ? Math.abs(own.value - other.value) : null;
    switch (c) {
      case "location":
        return diff != null && diff >= 2 && (own.display ?? "").includes(" dk") ? [`${Math.round(diff)} dk daha uzak`] : ["konumu daha zayıf"];
      case "duration":
        return diff ? [`${Math.round(diff)} dk daha uzun`] : ["daha uzun"];
      case "rating":
        return [`yorumları daha zayıf (${own.display?.split(" · ")[0]} – ${other.display?.split(" · ")[0]})`];
      case "amenities": {
        const listings = ctx as DecisionContext;
        const wanted = [...new Set([...(ctx.trip.wantedAmenities ?? []), ...(ctx.trip.requirements ?? []).flatMap((r) => (r.kind === "amenity" ? [r.amenity] : []))])] as Amenity[];
        return wanted
          .filter((x) => amenityState(b.item, x, listings) === "yes" && amenityState(a.item, x, listings) !== "yes")
          .map((x) => `${x} ${amenityState(a.item, x, listings) === "no" ? "yok" : "yazmıyor"}`);
      }
      case "comfort":
        return ["konforu daha zayıf"];
      case "schedule":
        return ["saatleri daha zor"];
      case "data":
        return ["daha az veri"];
      case "validity":
        return ["daha kısa geçerli"];
      default:
        // Its own words on it (a wish: "gece bar gürültüsü · 3 yorum"; "iade yok", "1 aktarma", "yalnız kabin").
        return own.display ? [lower(own.display)] : [`${lower(CRITERION_LABELS[c])} daha zayıf`];
    }
  });
  return [...new Set(texts)].slice(0, 3);
}

/** Where `a` is clearly better than `b`, what matters most first. */
function edges(a: OptionResult, b: OptionResult, ctx: Ctx): string[] {
  return [...new Set(edgeRows(a, b, ctx).flatMap((r) => r.texts))].slice(0, 3);
}

function edgeRows(a: OptionResult, b: OptionResult, ctx: Ctx): { criterion: CriterionId; texts: string[] }[] {
  const rows = a.parts
    .map((pa) => {
      const pb = part(b, pa.criterion);
      if (pa.criterion === "price" || pa.criterion === "ai" || pa.weight === 0 || pa.s == null || pb?.s == null || pa.s < pb.s + CLEAR_LEAD) return null;
      return { pa, pb, gain: pa.weight * (pa.s - pb.s) };
    })
    .filter((r): r is { pa: Part; pb: Part; gain: number } => r != null)
    .sort((x, y) => y.gain - x.gain);
  return rows.map(({ pa, pb }) => ({ criterion: pa.criterion, texts: gainText(pa.criterion, pa, pb, a, b, ctx) })).filter((r) => r.texts.length);
}

const SEVERITY = { high: 3, medium: 2, low: 1 } as const;

/**
 * What `a`'s pages say that `b`'s, read, don't (from the difference table): "çatı terası · 4 yorum" for it,
 * "yan binada inşaat · 3 yorum" against it. Only what tells them apart (not what every option has), is
 * still so, and is backed (the page, or two guests or more); "sorun değil" ones aren't held against it.
 */
function findingEdges(a: OptionResult, b: OptionResult, rows: DiffRow[], ctx: Ctx): { gains: string[]; losses: string[] } {
  const ka = listingKeyOf(a.item);
  const kb = listingKeyOf(b.item);
  if (ka === kb) return { gains: [], losses: [] };
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  const said = rows
    .filter((r) => !r.neutral && r.cells[ka]?.state === "present" && r.cells[kb]?.state === "absent")
    .map((r) => r.cells[ka])
    .filter((c) => {
      const f = c.finding!;
      return c.confidence >= FADED && (c.count >= 2 || f.source !== "reviews") && !(f.polarity === "negative" && accepted.has(acceptKey(ka, f)));
    })
    .sort((x, y) => SEVERITY[y.finding!.severity] * y.standing - SEVERITY[x.finding!.severity] * x.standing);
  const words = (c: DiffCell) => `${lower(c.finding!.text)}${c.count ? ` · ${c.count} yorum` : ""}`;
  return {
    gains: said.filter((c) => c.finding!.polarity === "positive").map(words),
    losses: said.filter((c) => c.finding!.polarity === "negative").map(words),
  };
}

/** Two lines of what the criteria say, then the most telling thing read, then the rest; the same thing said once. */
function merge(fromCriteria: string[], fromPages: string[]): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    const bare = t.split(" · ")[0];
    if (!out.some((o) => o.includes(bare) || bare.includes(o.split(" · ")[0]))) out.push(t);
  };
  [...fromCriteria.slice(0, 2), ...fromPages.slice(0, 1), ...fromCriteria.slice(2), ...fromPages.slice(1)].forEach(add);
  return out.slice(0, 3);
}

function tradeOf(a: OptionResult, b: OptionResult, ctx: Ctx, nights: number, rows: DiffRow[] = []): Trade {
  const pa = priceOf(a);
  const pb = priceOf(b);
  const diff = pa != null && pb != null ? pa - pb : null;
  const money =
    diff == null ? null : Math.abs(diff) < 1 ? "aynı fiyat" : diff > 0 ? `+${formatPrice(diff, ctx.currency)}` : `${formatPrice(-diff, ctx.currency)} daha ucuz`;
  const read = findingEdges(a, b, rows, ctx);
  return {
    vs: b.item.name,
    diff,
    perNight: diff != null && nights > 1 ? diff / nights : null,
    money,
    gains: merge(edges(a, b, ctx), read.gains),
    losses: merge(shortfalls(a, b, ctx), read.losses),
  };
}

/** A topic the traveller cares about, as a word for "bunda bilinmiyor": what the reviews may say or not. */
const TOPIC_WORDS: Partial<Record<FindingTopic, string>> = {
  noise: "sessizlik",
  cleanliness: "temizlik",
  view: "manzara",
  space: "ferahlık",
  bed: "yatak",
  food: "kahvaltı",
  access: "erişim",
  safety: "güvenlik",
};

/**
 * What the traveller cares about that this option's pages, read, don't mention while another option's do
 * ("sessizlik": the others' guests speak of the quiet or the noise, here nobody does): unknown, not
 * fine and not bad, worth a look. Only topics they asked for (a wish, a note, a must), so it stays short.
 */
function unknownsOf(o: OptionResult, others: OptionResult[], d: GroupDecision, ctx: Ctx): string[] {
  const listing = ctx.listings.get(listingKeyOf(o.item));
  if (!listing?.readAt) return [];
  const said = saidOf(ctx);
  const cared = (Object.keys(TOPIC_WORDS) as FindingTopic[]).filter(
    (t) =>
      said.has(t) ||
      WISHES.some((w) => WISH_TOPIC[w] === t && levelFor(ctx.trip, d.category, w, ctx.inferred, said) > 0) ||
      (ctx.trip.requirements ?? []).some((r) => r.kind === "avoid" && r.topic === t),
  );
  const mentions = (l: Listing, t: FindingTopic) => l.findings.some((f) => f.verified && touchesTopic(f, t) && !evidenceOf(f, l, ctx.today).faded);
  return cared
    .filter(
      (t) =>
        !mentions(listing, t) &&
        others.some((x) => {
          const theirs = ctx.listings.get(listingKeyOf(x.item));
          return theirs?.readAt && theirs.key !== listing.key && mentions(theirs, t);
        }),
    )
    .map((t) => TOPIC_WORDS[t]!);
}

/** The money side: "+€60 (gecelik +€20)", "€60 daha ucuz (gecelik −€20)". */
export function moneyText(t: Trade, currency: string): string | null {
  if (!t.money) return null;
  const night = t.perNight != null && Math.abs(t.perNight) >= 1 ? ` (gecelik ${t.perNight > 0 ? "+" : "−"}${formatPrice(Math.abs(t.perNight), currency)})` : "";
  return `${t.money}${night}`;
}

/** The trade in one line: "+€60 (gecelik +€20) · mutfak var, 13 dk daha yakın · eksiği: gece bar gürültüsü · 3 yorum". */
export function tradeText(t: Trade, currency: string): string {
  return [
    moneyText(t, currency),
    t.gains.length ? t.gains.join(", ") : null,
    t.losses.length ? `eksiği: ${t.losses.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Every option in its place, best first, and what each place means. Lenses (among the options that
 * fit): the cheapest, by a clear margin; the strongest one on each criterion the traveller made important
 * (said or set first, then defaults), when one clearly leads. An option can hold several, or none.
 */
export function choiceOf(d: GroupDecision, ctx: Ctx): Choice {
  const scored = d.options.filter((o) => o.score != null && !o.excluded);
  // One that only has something read to check (a doubtful complaint) meets the musts: it counts as fitting, flagged.
  const fit = scored.filter((o) => o.fit === "fit" || checksOnlyReading(o));
  const check = scored.filter((o) => o.fit === "check" && !checksOnlyReading(o));
  const contenders = [...fit, ...check];
  const range = d.category === "stay" ? rangeOfGroupKey(d.key) : null;
  const nights = range ? nightsBetween(range.start, range.end) : 0;

  const byPrice = (list: OptionResult[]) => list.filter((o) => priceOf(o) != null).sort((a, b) => priceOf(a)! - priceOf(b)!);
  const anchor = byPrice(fit)[0] ?? byPrice(check)[0] ?? null;
  const [cheapest, next] = byPrice(contenders);
  const saves = cheapest && next && priceOf(next)! - priceOf(cheapest)! >= Math.max(1, 0.01 * priceOf(next)!) ? cheapest : null;

  // Lenses on what matters, the traveller's own first: said or set before defaults, then by level.
  const said = saidOf(ctx);
  const source = (c: CriterionId) => levelSource(ctx.trip, d.category, c, ctx.inferred, said);
  const lead = contenders[0] ?? scored[0];
  const lensCriteria = (lead?.parts ?? [])
    .filter((p) => p.criterion !== "price" && p.criterion !== "ai" && p.criterion !== "details" && LENS[p.criterion] && p.level >= LENS_LEVEL)
    .sort((a, b) => Number(source(b.criterion) !== "default") - Number(source(a.criterion) !== "default") || b.level - a.level)
    .map((p) => p.criterion);
  const wins = new Map<string, CriterionId[]>();
  const win = (o: OptionResult, c: CriterionId) => wins.set(o.item.id, [...(wins.get(o.item.id) ?? []), c]);
  if (contenders.length > 1) {
    if (saves) win(saves, "price");
    for (const c of lensCriteria) {
      const ranked = contenders
        .map((o) => ({ o, s: part(o, c)?.s ?? null }))
        .filter((x): x is { o: OptionResult; s: number } => x.s != null)
        .sort((a, b) => b.s - a.s || (b.o.score ?? 0) - (a.o.score ?? 0));
      if (ranked.length >= 2 && ranked[0].s - ranked[1].s >= CLEAR_LEAD) win(ranked[0].o, c);
    }
  }
  const lensOrder = (c: CriterionId) => (c === "price" ? -1 : lensCriteria.indexOf(c));

  const inRace = d.options.filter((o) => !o.excluded);
  const [first, second] = inRace;
  // What their pages say differently: the concrete things read that one has and another doesn't.
  const rows = differencesOf(
    inRace.map((o) => ctx.listings.get(listingKeyOf(o.item))),
    ctx.today,
  );
  const ranked: Ranked[] = d.options.map((o) => {
    const place = o.excluded ? null : inRace.indexOf(o) + 1;
    const mine = [...(wins.get(o.item.id) ?? [])].sort((a, b) => lensOrder(a) - lensOrder(b));
    // Why it's here: the first against the second, every other one against the first.
    const vs = place == null ? null : o === first ? (second ?? null) : first;
    return {
      option: o,
      rank: place,
      badges: mine.map((c) => LENS[c]!.best),
      lenses: mine.map((c) => lensNoun(c, o, ctx)),
      trade: vs ? tradeOf(o, vs, ctx, nights, rows) : null,
      vsRank: vs ? (vs === first ? 1 : 2) : null,
      unknown: place == null ? [] : unknownsOf(o, inRace.filter((x) => x !== o), d, ctx),
    };
  });

  // What to check: a fact missing on one near the top, or on one that could lead once it's known (a
  // price not clear yet may well be the cheapest).
  const top = new Set(inRace.slice(0, VERIFY_TOP).map((o) => o.item.id));
  const couldLead = (o: OptionResult) =>
    top.has(o.item.id) || (o.score ?? 0) > (lead?.score ?? 0) || o.limited.length > 0 || (priceOf(o) != null && anchor != null && priceOf(o)! < (priceOf(anchor) ?? 0));
  const verify = inRace
    .filter((o) => o.fit === "check" && couldLead(o))
    .flatMap((o) => o.fitNotes.map((what) => ({ itemId: o.item.id, name: o.item.name, what })));

  return { ranked, anchor, headline: headlineOf(ranked, ctx, contenders), verify };
}

/** A lens as a noun for the sentence; the amenities by name ("mutfak") when there's one. */
function lensNoun(c: CriterionId, o: OptionResult, ctx: Ctx): string {
  if (c === "amenities") {
    const wanted = ctx.trip.wantedAmenities ?? [];
    return wanted.length === 1 ? wanted[0] : LENS.amenities!.noun;
  }
  void o;
  return LENS[c]!.noun;
}

/**
 * "Önerim Casa Ribeira: en iyi konum; €60 fazlasına 15 dk daha yakın ve mutfak var. Tasarruf ve sessizlik
 * için 2. Bonfim Loft (€60 daha ucuz)." The pick is the first that fits; why, from what it's strongest on
 * and what it has over the second; then the other options that lead on something, with their place.
 */
function headlineOf(ranked: Ranked[], ctx: Ctx, contenders: OptionResult[]): string | null {
  const top = ranked.find((r) => r.rank === 1);
  if (!top || !contenders.includes(top.option)) return null;
  const name = top.option.item.name;
  const second = ranked.find((r) => r.rank === 2 && contenders.includes(r.option));
  const why: string[] = [];
  if (top.badges.length) why.push(joinTr(top.badges.map(lower)));
  if (second) {
    // What it has over the second that its lenses don't already say.
    const own = new Set(ranked.find((r) => r === top)!.badges);
    const gains = edgeRows(top.option, second.option, ctx)
      .filter((r) => !own.has(LENS[r.criterion]?.best ?? ""))
      .flatMap((r) => r.texts)
      .slice(0, 2);
    const diff = top.trade?.diff ?? null;
    const money = diff != null && Math.abs(diff) >= 1 ? formatPrice(Math.abs(diff), ctx.currency) : null;
    if (money && diff! > 0 && gains.length) why.push(`${money} fazlasına ${joinTr(gains)}`);
    else if (money && diff! < 0 && !own.has(LENS.price!.best)) why.push(joinTr([`${money} daha ucuz`, ...gains]));
    else if (gains.length) why.push(joinTr(gains));
  }
  let text = `Önerim ${name}${why.length ? `: ${why.join("; ")}` : ""}.`;
  const alternatives = ranked
    .filter((r) => r !== top && r.lenses.length && contenders.includes(r.option))
    .slice(0, 2)
    .map((r) => {
      const money = r.trade?.money && r.trade.money !== "aynı fiyat" ? ` (${r.trade.money})` : "";
      return `${joinTr(r.lenses)} için ${r.rank}. ${r.option.item.name}${money}`;
    });
  if (alternatives.length) text += ` ${capital(alternatives.join("; "))}.`;
  return text;
}
