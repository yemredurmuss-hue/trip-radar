// A decision as the traveller weighs it: not one ranking, but the strongest option for each thing that
// matters to them ("En ekonomik", "En iyi konum", "En sessiz"), each with what it costs or saves against
// the cheapest option that meets their musts, and what's still to check before choosing. The score
// orders options inside a lens and finds the balanced one; it isn't the headline. Pure.
import { amenityState, CRITERION_LABELS, levelSource, saidOf, type DecisionContext, type GroupDecision, type OptionResult, type Part } from "./decision";
import { formatPrice, nightsBetween } from "./items";
import { rangeOfGroupKey } from "./plan";
import type { Amenity, CriterionId } from "./types";

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
  /** What the other has that it doesn't. */
  losses: string[];
}

export interface Candidate {
  option: OptionResult;
  /** 1 = shown first. */
  rank: number;
  /** The lenses it's strongest on, as nouns for a sentence: "tasarruf", "konum", "sessizlik". */
  lenses: string[];
  /** Its card label: "En ekonomik", "En iyi konum ve en sessiz", "Dengeli seçim". */
  label: string;
  trade: Trade | null;
}

export interface Choice {
  /** The options worth a card: the strongest one for each lens, best balanced first; three at most. */
  candidates: Candidate[];
  /** The rest, best first (to check, partial, out included). */
  rest: OptionResult[];
  /** The cheapest option that meets the musts: what the others' prices are weighed against. */
  anchor: OptionResult | null;
  /** "Konum için Casa Ribeira (+€60); tasarruf ve sessizlik için Bonfim Loft." */
  headline: string | null;
  /** What to check before choosing one of the candidates: "Bonfim Loft: mutfak yazmıyor". */
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
const MAX_CANDIDATES = 3;

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

/** Where `a` is clearly better than `b`, what matters most first. */
function edges(a: OptionResult, b: OptionResult, ctx: Ctx): string[] {
  const rows = a.parts
    .map((pa) => {
      const pb = part(b, pa.criterion);
      if (pa.criterion === "price" || pa.criterion === "ai" || pa.weight === 0 || pa.s == null || pb?.s == null || pa.s < pb.s + CLEAR_LEAD) return null;
      return { pa, pb, gain: pa.weight * (pa.s - pb.s) };
    })
    .filter((r): r is { pa: Part; pb: Part; gain: number } => r != null)
    .sort((x, y) => y.gain - x.gain);
  return [...new Set(rows.flatMap(({ pa, pb }) => gainText(pa.criterion, pa, pb, a, b, ctx)))].slice(0, 3);
}

function tradeOf(a: OptionResult, b: OptionResult, ctx: Ctx, nights: number): Trade {
  const pa = priceOf(a);
  const pb = priceOf(b);
  const diff = pa != null && pb != null ? pa - pb : null;
  const money =
    diff == null ? null : Math.abs(diff) < 1 ? "aynı fiyat" : diff > 0 ? `+${formatPrice(diff, ctx.currency)}` : `${formatPrice(-diff, ctx.currency)} daha ucuz`;
  return {
    vs: b.item.name,
    diff,
    perNight: diff != null && nights > 1 ? diff / nights : null,
    money,
    gains: edges(a, b, ctx),
    losses: edges(b, a, ctx),
  };
}

/** The trade in one line: "+€60 (gecelik +€20) · mutfak var, 13 dk daha yakın · vazgeçtiğin: Sessiz sokak". */
export function tradeText(t: Trade, currency: string): string {
  const night = t.perNight != null && Math.abs(t.perNight) >= 1 ? ` (gecelik ${t.perNight > 0 ? "+" : "−"}${formatPrice(Math.abs(t.perNight), currency)})` : "";
  return [
    t.money ? `${t.money}${night}` : null,
    t.gains.length ? t.gains.join(", ") : null,
    t.losses.length ? `vazgeçtiğin: ${t.losses.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The options worth a card, and the sentence that frames them. Lenses: the cheapest option that meets
 * the musts; the strongest one on each criterion the traveller made important (said, set or by
 * default), when one clearly leads; and the balanced one (best score). One option can hold several.
 */
export function choiceOf(d: GroupDecision, ctx: Ctx): Choice {
  const empty: Choice = { candidates: [], rest: d.options, anchor: null, headline: null, verify: [] };
  const scored = d.options.filter((o) => o.score != null && !o.excluded);
  const fit = scored.filter((o) => o.fit === "fit");
  const check = scored.filter((o) => o.fit === "check");
  const contenders = fit.length || check.length ? [...fit, ...check] : [];
  if (!contenders.length) return empty;
  const range = d.category === "stay" ? rangeOfGroupKey(d.key) : null;
  const nights = range ? nightsBetween(range.start, range.end) : 0;

  // The cheapest that meets the musts (fit before to-check): what everything else costs more than.
  const byPrice = (list: OptionResult[]) => list.filter((o) => priceOf(o) != null).sort((a, b) => priceOf(a)! - priceOf(b)!);
  const anchor = byPrice(fit)[0] ?? byPrice(check)[0] ?? null;
  const balanced = contenders[0];
  // The cheapest of all (one to check included, flagged): "En ekonomik" only when it clearly is.
  const [cheapest, next] = byPrice(contenders);
  const saves = cheapest && next && priceOf(next)! - priceOf(cheapest)! >= Math.max(1, 0.01 * priceOf(next)!) ? cheapest : null;

  // Lenses on what matters, the traveller's own first: said or set before defaults, then by level.
  const said = saidOf(ctx);
  const source = (c: CriterionId) => levelSource(ctx.trip, d.category, c, ctx.inferred, said);
  const lensCriteria = balanced.parts
    .filter((p) => p.criterion !== "price" && p.criterion !== "ai" && p.criterion !== "details" && LENS[p.criterion] && p.level >= LENS_LEVEL)
    .sort((a, b) => Number(source(b.criterion) !== "default") - Number(source(a.criterion) !== "default") || b.level - a.level)
    .map((p) => p.criterion);
  const wins = new Map<string, CriterionId[]>();
  const win = (o: OptionResult, c: CriterionId) => wins.set(o.item.id, [...(wins.get(o.item.id) ?? []), c]);
  if (saves) win(saves, "price");
  for (const c of lensCriteria) {
    const ranked = contenders
      .map((o) => ({ o, s: part(o, c)?.s ?? null }))
      .filter((x): x is { o: OptionResult; s: number } => x.s != null)
      .sort((a, b) => b.s - a.s || (b.o.score ?? 0) - (a.o.score ?? 0));
    if (ranked.length >= 2 && ranked[0].s - ranked[1].s >= CLEAR_LEAD) win(ranked[0].o, c);
  }

  // Cards: the balanced one first, then the other lens winners in lens order (savings first).
  const order = [balanced, ...contenders.filter((o) => o !== balanced && wins.has(o.item.id))].slice(0, MAX_CANDIDATES);
  const lensOrder = (c: CriterionId) => (c === "price" ? -1 : lensCriteria.indexOf(c));
  const candidates: Candidate[] = order.map((o, i) => {
    const mine = [...(wins.get(o.item.id) ?? [])].sort((a, b) => lensOrder(a) - lensOrder(b));
    const nouns = mine.map((c) => lensNoun(c, o, ctx));
    const label = mine.length ? capital(joinTr(mine.map((c, k) => (k === 0 ? LENS[c]!.best : lower(LENS[c]!.best))))) : "Genel olarak en iyi";
    // Weighed against the cheapest that meets the musts; that one, against the balanced one (or, when
    // it is the balanced one, against the next card: what its extra buys).
    const vs = o !== anchor ? anchor : balanced !== anchor ? balanced : (order.find((x) => x !== o) ?? null);
    return { option: o, rank: i + 1, lenses: nouns, label, trade: vs ? tradeOf(o, vs, ctx, nights) : null };
  });
  const shown = new Set(candidates.map((c) => c.option.item.id));
  const rest = d.options.filter((o) => !shown.has(o.item.id));

  // What to check: on the cards, and on one left out only because of it that would otherwise lead
  // (a better score, a lower price): the missing fact that could change the decision.
  const couldLead = (o: OptionResult) =>
    o.fit === "check" &&
    ((o.score ?? 0) > (balanced.score ?? 0) ||
      o.limited.length > 0 || // its price isn't clear yet: it may well be the cheapest
      (priceOf(o) != null && anchor != null && priceOf(anchor) != null && priceOf(o)! < priceOf(anchor)!));
  const verify = [...candidates.map((c) => c.option), ...rest.filter(couldLead)]
    .filter((o) => o.fit === "check")
    .flatMap((o) => o.fitNotes.map((what) => ({ itemId: o.item.id, name: o.item.name, what })));

  return { candidates, rest, anchor, headline: headlineOf(candidates, ctx.currency), verify };
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
 * "Konum için Casa Ribeira (+€60, mutfak var); tasarruf ve sessizlik için Bonfim Loft." One option
 * strongest on everything: "Casa Ribeira her açıdan önde: en ekonomik ve en iyi konum."
 */
function headlineOf(candidates: Candidate[], currency: string): string | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) {
    const [only] = candidates;
    return only.lenses.length ? `${only.option.item.name} her açıdan önde: ${lower(only.label)}.` : `${only.option.item.name} öne çıkıyor.`;
  }
  const parts = candidates.map((c) => {
    const money = c.trade?.money && c.trade.money !== "aynı fiyat" ? c.trade.money : null;
    const note = [money, c.trade && c.trade.diff != null && c.trade.diff > 0 ? c.trade.gains[0] : null].filter(Boolean).join(", ");
    const lens = c.lenses.length ? `${joinTr(c.lenses)} için` : "genel olarak";
    return `${lens} ${c.option.item.name}${note ? ` (${note})` : ""}`;
  });
  void currency;
  return `${capital(parts.join("; "))}.`;
}
