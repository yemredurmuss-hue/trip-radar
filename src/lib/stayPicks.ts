// "Üç akıllı konaklama önerisi" (MVP, owner-approved 2026-10-06): out of a stay's candidates (offerSources'
// stayCandidates, up to six hotels as the sources read them) the traveller sees three: "Sana en uygun", "Daha
// ekonomik", "Daha konforlu". Pure: no fetching, no storage.
//
// Nothing is made up. A pick is always one of the candidates; its one sentence of "why" is built only from what the
// sources said (rating, reviews, the price for these nights, the usual range, the labels, the place on the map) and
// from the trip's own data (its plans' places, its priorities and musts). A field that isn't known is
// never scored as good or bad and never claimed: a "quiet" wish counts only when a label says it, a distance only
// when both the hotel and the trip's plans in that city are on the map. The price is weighed against the other
// candidates, never against a share of the trip's budget: how much of a trip goes on beds differs every trip.
import { levelFor, levelSource, wantedAmenities } from "./decision";
import { distanceKm } from "./geo";
import { L } from "./i18n";
import { nNights, nReviews, num } from "./i18nText";
import { formatPrice } from "./items";
import type { Need, Offer } from "./offerSource";
import type { StayCandidate } from "./offerSources";
import { cityKeyOf, sameCity } from "./plan";
import type { Amenity, CriterionId, Item, PriorityLevel, Trip } from "./types";

export type PickKind = "best" | "cheaper" | "comfier";
export interface StayPick {
  cand: StayCandidate;
  why: string;
}
export interface Picks {
  best: StayPick | null;
  cheaper: StayPick | null;
  comfier: StayPick | null;
}

export interface PickCtx {
  /** The middle of the trip's plans in this city (their places on the map); null when none is on the map. */
  centre: { lat: number; lng: number } | null;
  /** The trip's own priorities and musts (decision.ts); missing: the defaults. */
  trip?: Partial<Pick<Trip, "priorities" | "categoryPriorities" | "requirements" | "wantedAmenities" | "intent">> | null;
}

/** The order the three are shown in, and their labels. */
export const PICK_ORDER: PickKind[] = ["best", "cheaper", "comfier"];
export const pickLabel = (kind: PickKind): string =>
  ({ best: L("Sana en uygun", "Best for you"), cheaper: L("Daha ekonomik", "Cheaper"), comfier: L("Daha konforlu", "More comfort") })[kind];

/** "Daha ekonomik" needs at least this rating (out of 5): never the cheapest bad one. */
export const CHEAP_MIN_RATING = 4;
/** decision.ts' weights for the priority levels (Önemsiz … Şart). */
const LEVEL_WEIGHT = [0, 0.5, 1, 2, 3];
/** The rating the reviews are weighed against: few reviews pull a rating towards it (ten 5-star reviews aren't 1.240). */
const PRIOR_RATING = 4;
const PRIOR_REVIEWS = 50;
/** A label that answers a must of the trip, or a wish (on a 0–1 measure): a must clearly lifts it, a wish tips a close call. */
const MUST_BONUS = 0.15;
const WISH_BONUS = 0.06;

// --- what the trip brings ------------------------------------------------------------------------------

/** The middle of the trip's plans in a city that are on the map (their average place); null when none is. */
export function centreOf(items: Item[], city: string | null | undefined): { lat: number; lng: number } | null {
  if (!city) return null;
  const here = items.filter((i) => i.status !== "dismissed" && i.geo && sameCity(i.city, city));
  if (!here.length) return null;
  return { lat: here.reduce((s, i) => s + i.geo!.lat, 0) / here.length, lng: here.reduce((s, i) => s + i.geo!.lng, 0) / here.length };
}

/** Everything the picks need from the board: the plans' middle there, the priorities. */
export function picksContext(need: Pick<Need, "city">, trip: Trip | null | undefined, items: Item[]): PickCtx {
  return { centre: centreOf(items, need.city), trip: trip ?? null };
}

// --- the candidates ------------------------------------------------------------------------------------

/** One hotel once: the same id, or the same name told another way; the one priced for the dates is kept. */
function distinct(cands: StayCandidate[]): StayCandidate[] {
  const out: StayCandidate[] = [];
  for (const c of cands) {
    if (!c || !c.id || !c.name) continue;
    const key = cityKeyOf(c.name);
    const at = out.findIndex((o) => o.id === c.id || (key && cityKeyOf(o.name) === key));
    if (at < 0) out.push(c);
    else if (out[at].nightly == null && c.nightly != null) out[at] = c;
  }
  return out;
}

/** A night's price to compare: the one for these dates, else the middle of the usual range; null when neither is known. */
const comparablePrice = (c: StayCandidate): number | null => c.nightly ?? (c.priceRange ? (c.priceRange.min + c.priceRange.max) / 2 : null);
const hasPrice = (c: StayCandidate) => c.nightly != null || c.priceRange != null;
/** The rating with its reviews' weight: a few reviews pull it towards an ordinary 4; unknown reviews leave it as it is. */
const weighedRating = (c: StayCandidate): number | null =>
  c.rating == null ? null : c.reviews == null ? c.rating : (c.rating * c.reviews + PRIOR_RATING * PRIOR_REVIEWS) / (c.reviews + PRIOR_REVIEWS);
const kmFrom = (c: StayCandidate, centre: PickCtx["centre"]): number | null => (centre && c.geo ? distanceKm(c.geo, centre) : null);
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** What the trip asks for that a candidate's labels can answer (the sources' "Kahvaltı dahil", "Ücretsiz iptal"); nothing else is read. */
interface Want {
  test: RegExp;
  /** A must (requirements) weighs more than a wish. */
  must: boolean;
}
const BREAKFAST = /kahvaltı dahil|breakfast included/i;
const FREE_CANCEL = /ücretsiz iptal|free cancellation/i;
/** The sources' words for an amenity asked for (a must or a wish): only labels that say it count. */
const AMENITY_LABEL: Partial<Record<Amenity, RegExp>> = {
  mutfak: /mutfak|kitchen/i,
  havuz: /havuz|pool/i,
  sessiz: /sessiz|quiet/i,
  "evcil hayvan kabul": /evcil|pets? (allowed|friendly)|pet-friendly/i,
  asansör: /asansör|elevator|lift/i,
  "engelli erişimi": /engelli|erişilebilir|accessib|wheelchair/i,
};
/** "Babam merdiven çıkamaz" (a must of the trip, playbooks/model.ts): a lift, step-free access or the ground floor. */
const STEP_FREE = /asansör|elevator|\blift\b|engelli|erişilebilir|accessib|wheelchair|zemin kat|ground floor|step-free|basamaksız/i;

function wantsOf(trip: PickCtx["trip"]): Want[] {
  if (!trip) return [];
  const t = trip as Trip;
  const req = t.requirements ?? [];
  const out: Want[] = [];
  const mustBreakfast = req.some((r) => r.kind === "amenity" && r.amenity === "kahvaltı dahil");
  if (mustBreakfast || wantedAmenities(t).includes("kahvaltı dahil") || levelFor(t, "stay", "breakfast") > 0) out.push({ test: BREAKFAST, must: mustBreakfast });
  const mustCancel = req.some((r) => r.kind === "free_cancellation");
  if (mustCancel || (levelSource(t, "stay", "cancellation") === "explicit" && levelFor(t, "stay", "cancellation") >= 3)) out.push({ test: FREE_CANCEL, must: mustCancel });
  // What the trip said must hold (its musts, as requirements) or wants (amenities), as far as a label can say it.
  const stepFree = Boolean(t.intent?.musts?.some((m) => m.id === "step_free"));
  if (stepFree) out.push({ test: STEP_FREE, must: true });
  for (const [amenity, test] of Object.entries(AMENITY_LABEL) as [Amenity, RegExp][]) {
    if (stepFree && (amenity === "asansör" || amenity === "engelli erişimi")) continue;
    const must = req.some((r) => r.kind === "amenity" && r.amenity === amenity);
    if (must || wantedAmenities(t).includes(amenity)) out.push({ test, must });
  }
  return out;
}
const matched = (c: StayCandidate, wants: Want[]): string[] => wants.flatMap((w) => c.labels.filter((l) => w.test.test(l)).slice(0, 1));

/** A criterion's weight on this trip (its priority, else the stay's default), as decision.ts weighs it. */
const weight = (trip: PickCtx["trip"], c: CriterionId): number => LEVEL_WEIGHT[levelFor((trip ?? {}) as Trip, "stay", c) as PriorityLevel];

/**
 * "Sana en uygun"'s measure for this trip: the rating with its reviews (standing in for comfort too), the price
 * against the others, the distance to the plans' middle, and a bonus for
 * each label the trip asks for. Only what's known is weighed; what isn't lowers the confidence, never the parts.
 */
function fitScore(c: StayCandidate, all: StayCandidate[], ctx: PickCtx, wants: Want[]): number {
  const trip = ctx.trip ?? null;
  const parts: { w: number; s: number | null }[] = [];
  const r = weighedRating(c);
  parts.push({ w: weight(trip, "rating") + weight(trip, "comfort"), s: r == null ? null : clamp((r - 3.5) / 1.5) });
  const p = comparablePrice(c);
  let ps: number | null = null;
  if (p != null) {
    const prices = all.map(comparablePrice).filter((x): x is number => x != null);
    const [lo, hi] = [Math.min(...prices), Math.max(...prices)];
    ps = hi > lo ? 1 - (p - lo) / (hi - lo) : 1;
  }
  parts.push({ w: weight(trip, "price"), s: ps });
  // No plan of the trip in that city on the map: distance isn't part of it at all.
  if (ctx.centre) {
    const km = kmFrom(c, ctx.centre);
    parts.push({ w: weight(trip, "location"), s: km == null ? null : 1 / (1 + km / 1.5) });
  }
  const known = parts.filter((x) => x.s != null && x.w > 0);
  const all_w = parts.reduce((s, x) => s + x.w, 0);
  const known_w = known.reduce((s, x) => s + x.w, 0);
  if (!known_w) return 0;
  const mean = known.reduce((s, x) => s + x.w * x.s!, 0) / known_w;
  const bonus = wants.reduce((s, w) => s + (c.labels.some((l) => w.test.test(l)) ? (w.must ? MUST_BONUS : WISH_BONUS) : 0), 0);
  return mean * (0.6 + (0.4 * known_w) / all_w) + bonus;
}

// --- the three -----------------------------------------------------------------------------------------

/**
 * The three for a stay, out of its candidates: "Daha ekonomik" the lowest price for these dates rated 4 or more;
 * "Daha konforlu" the highest rated (then the dearest of those) with a price or a usual range, not below the
 * cheaper one's rating; "Sana en uygun" the best measure for this trip among the rest. Never one hotel twice: with
 * fewer than three hotels, fewer cards ("Sana en uygun" first, the other only when it really is cheaper or better rated).
 */
export function pickThree(cands: StayCandidate[], ctx: PickCtx): Picks {
  const list = distinct(cands ?? []);
  const none: Picks = { best: null, cheaper: null, comfier: null };
  if (!list.length) return none;
  const wants = wantsOf(ctx.trip ?? null);
  const score = new Map(list.map((c) => [c.id, fitScore(c, list, ctx, wants)]));
  // The best for this trip is rated 4 or more whenever one of those is left (never a 3.9 for being cheap and near).
  const byFit = (pool: StayCandidate[]) => {
    const good = pool.filter((c) => c.rating != null && c.rating >= CHEAP_MIN_RATING);
    return [...(good.length ? good : pool)].sort((a, b) => score.get(b.id)! - score.get(a.id)!)[0] ?? null;
  };

  let best: StayCandidate | null = null;
  let cheaper: StayCandidate | null = null;
  let comfier: StayCandidate | null = null;
  if (list.length < 3) {
    best = byFit(list);
    const other = list.find((c) => c !== best) ?? null;
    if (other && best) {
      const cheaperThanBest = other.nightly != null && (other.rating ?? 0) >= CHEAP_MIN_RATING && (best.nightly == null || other.nightly < best.nightly);
      const [op, bp] = [comparablePrice(other), comparablePrice(best)];
      const ratedHigher =
        other.rating != null && hasPrice(other) && best.rating != null && (other.rating > best.rating || (other.rating === best.rating && op != null && bp != null && op > bp));
      if (cheaperThanBest) cheaper = other;
      else if (ratedHigher) comfier = other;
    }
  } else {
    cheaper =
      list
        .filter((c) => c.nightly != null && c.rating != null && c.rating >= CHEAP_MIN_RATING)
        .sort((a, b) => a.nightly! - b.nightly! || b.rating! - a.rating!)[0] ?? null;
    const rated = list.filter((c) => c !== cheaper && c.rating != null && hasPrice(c));
    const top = Math.max(...rated.map((c) => c.rating!));
    comfier = rated.filter((c) => c.rating === top).sort((a, b) => comparablePrice(b)! - comparablePrice(a)!)[0] ?? null;
    // Rated below the cheaper one: not "more comfort" than it.
    if (comfier && cheaper && comfier.rating! < cheaper.rating!) comfier = null;
    best = byFit(list.filter((c) => c !== cheaper && c !== comfier));
  }
  const say = new Why(list, ctx, wants);
  return {
    best: best ? { cand: best, why: say.best(best) } : null,
    cheaper: cheaper ? { cand: cheaper, why: say.cheaper(cheaper) } : null,
    comfier: comfier ? { cand: comfier, why: say.comfier(comfier, best?.nightly != null ? best : cheaper) } : null,
  };
}

/** The picks in the order shown, with their kind. */
export const pickList = (p: Picks): { kind: PickKind; pick: StayPick }[] =>
  PICK_ORDER.flatMap((kind) => (p[kind] ? [{ kind, pick: p[kind]! }] : []));

// --- the words: only what's known ----------------------------------------------------------------------

const eur = (n: number) => formatPrice(Math.round(n), "EUR");
/** "★4,8 · 1.240 yorum"; the reviews only when known. */
export const ratingLine = (c: StayCandidate): string | null =>
  c.rating == null ? null : `★${num(c.rating)}${c.reviews != null ? ` · ${nReviews(c.reviews)}` : ""}`;
const capital = (s: string) => (s ? s[0].toLocaleUpperCase(L("tr", "en")) + s.slice(1) : s);

class Why {
  constructor(
    private all: StayCandidate[],
    private ctx: PickCtx,
    private wants: Want[],
  ) {}
  /** The highest rating of them all (only said when every one has a rating: an unknown one might be higher). */
  private topRated(c: StayCandidate): boolean {
    return c.rating != null && this.all.every((o) => o.rating != null && o.rating <= c.rating!);
  }
  private distancePart(c: StayCandidate): string | null {
    const km = kmFrom(c, this.ctx.centre);
    return km == null ? null : L(`planının merkezine ${num(km)} km`, `${num(km)} km from your plans' centre`);
  }
  best(c: StayCandidate): string {
    const parts: string[] = [];
    const r = ratingLine(c);
    if (r) parts.push(this.topRated(c) ? L(`en yüksek puan (${r})`, `the highest rating (${r})`) : r);
    const d = this.distancePart(c);
    if (d) parts.push(d);
    for (const label of matched(c, this.wants)) parts.push(L(`${label.toLocaleLowerCase("tr")}, istediğin gibi`, `${label.toLocaleLowerCase("en")}, as you asked`));
    if (!parts.length && c.nightly != null) parts.push(L(`gecelik ${eur(c.nightly)}`, `${eur(c.nightly)} a night`));
    return capital(parts.slice(0, 3).join(", "));
  }
  cheaper(c: StayCandidate): string {
    const lowest = this.all.every((o) => o.nightly == null || o.nightly >= c.nightly!);
    const head = lowest ? L("Bulduklarımın en ucuzu", "The cheapest I found") : L(`★${CHEAP_MIN_RATING} ve üstünün en ucuzu`, `The cheapest rated ★${CHEAP_MIN_RATING} or more`);
    return [head, `★${num(c.rating!)}`].join(", ");
  }
  comfier(c: StayCandidate, ref: StayCandidate | null): string {
    const r = `★${num(c.rating!)}`;
    if (ref && ref !== c && ref.nightly != null && c.nightly != null && c.nightly > ref.nightly) {
      return L(`Gecelik ${eur(c.nightly - ref.nightly)} daha fazla ama ${r}`, `${eur(c.nightly - ref.nightly)} more a night, but ${r}`);
    }
    const line = ratingLine(c)!;
    return this.topRated(c) ? L(`En yüksek puan (${line})`, `The highest rating (${line})`) : capital(line);
  }
}

/**
 * The price with its scope, in two parts (the first drawn bold): "€155 / gece" · "4 gece €620"; without one for these
 * dates, "tipik €120–180 / gece" · "tarihli fiyat yok". Euros, as the source gives them.
 */
export function priceParts(c: StayCandidate): { main: string | null; rest: string } {
  if (c.nightly != null) {
    const total = c.total ?? c.nightly * c.nights;
    return { main: `${eur(c.nightly)} ${L("/ gece", "/ night")}`, rest: c.nights > 0 ? `${nNights(c.nights)} ${eur(total)}` : "" };
  }
  if (c.priceRange) {
    const { min, max } = c.priceRange;
    const span = max > min ? `${eur(min)}–${num(Math.round(max), 0)}` : eur(min);
    return { main: L(`tipik ${span} / gece`, `typically ${span} / night`), rest: L("tarihli fiyat yok", "no price for your dates") };
  }
  return { main: null, rest: L("tarihli fiyat yok", "no price for your dates") };
}
export const priceLine = (c: StayCandidate): string => {
  const { main, rest } = priceParts(c);
  return [main, rest].filter(Boolean).join(" · ");
};

/** A pick as an offer (the chat's cards, "Favorile"): the hotel as the sources read it, its price for these nights when there is one. */
export function candidateOffer(c: StayCandidate, kind: PickKind, why: string): Offer {
  return {
    id: c.id,
    kind: "stay",
    title: c.name,
    photo: c.photo,
    rating: c.rating,
    reviews: c.reviews,
    price: c.total ?? (c.nightly != null ? c.nightly * c.nights : null),
    currency: "EUR",
    nights: c.nights,
    url: c.url,
    why,
    // The hotel list, its ratings and usual prices are Tripadvisor's (via Xotelo); a price for the dates names its platform.
    source: c.source ?? "Tripadvisor",
    fetchedAt: c.fetchedAt,
    area: c.area,
    // Without a price for the dates, its usual range is said instead (never as if it were this stay's).
    meta: c.nightly == null && c.priceRange ? priceLine(c) : null,
    pick: kind,
  };
}
