// Understanding what the traveller wants without making them fill in a form. What they say (chat,
// the comparison view) is taken as is; on top of that, soft signals are read from what they save
// and what they choose. A signal only nudges a default by one step, always carries its evidence,
// never overrides something the traveller said, and can be ignored with one click. Pure.
import {
  CRITERION_LABELS,
  cancellationType,
  decideGroup,
  inferredKey,
  measureFor,
  totalPrice,
  type DecisionContext,
  type Inferred,
} from "./decision";
import { formatPrice } from "./items";
import { COMPARABLE, groupKeyOf } from "./plan";
import { L, locale } from "./i18n";
import type { Category, CriterionId, Item, Trip } from "./types";

export interface Signal {
  /** Stable across renders and sources, so "ignore" keeps working: `${category}:${criterion}:up|down`. */
  id: string;
  source: "choice" | "links";
  category: Category;
  criterion: CriterionId;
  delta: 1 | -1;
  /** "Konum senin için önemli görünüyor". */
  text: string;
  /** Asked before it counts: "Konum senin için daha mı önemli?". */
  question: string;
  /** Why: "Jardim Stay'i seçtin (Casa Azul yerine): konumu daha iyi, €45 daha pahalı". */
  evidence: string;
}

/** A pattern needs this many saved stays before it says anything. */
const MIN_SAVED = 4;
/** A chosen option must beat the engine's pick by this much on a criterion for it to count. */
const CLEAR_GAIN = 0.15;

export function inferSignals(items: Item[], ctx: DecisionContext): Signal[] {
  return merge([...fromChoices(items, ctx), ...fromSaves(items, ctx)]);
}

/** Signals still meaningful: not ignored, not overridden by something the traveller said. */
function openSignals(signals: Signal[], trip: Trip): Signal[] {
  const ignored = new Set(trip.ignoredSignals ?? []);
  return signals.filter(
    (s) =>
      !ignored.has(s.id) &&
      trip.categoryPriorities?.[s.category]?.[s.criterion] === undefined &&
      trip.priorities?.[s.criterion] === undefined,
  );
}

/**
 * The signals that change weights: only the ones the traveller confirmed. One pricier pick doesn't
 * prove price matters less (they may have liked the photos or trusted the host), so a guess is asked
 * about first ("Konum senin için daha mı önemli?") and counts only after a yes.
 */
export function activeSignals(signals: Signal[], trip: Trip): Signal[] {
  const confirmed = new Set(trip.confirmedSignals ?? []);
  return openSignals(signals, trip).filter((s) => confirmed.has(s.id));
}

/** Guesses waiting for a yes or a no. */
export function pendingSignals(signals: Signal[], trip: Trip): Signal[] {
  const confirmed = new Set(trip.confirmedSignals ?? []);
  return openSignals(signals, trip).filter((s) => !confirmed.has(s.id));
}

export function toInferred(signals: Signal[]): Inferred {
  return new Map(signals.map((s) => [inferredKey(s.category, s.criterion), { delta: s.delta, evidence: s.evidence }]));
}

// --- revealed preference: what they chose over the engine's pick --------------------------------------

function fromChoices(items: Item[], ctx: DecisionContext): Signal[] {
  // What the engine would have said with the traveller's explicit settings only (no signals, no AI).
  const base: DecisionContext = { ...ctx, inferred: new Map(), analyses: new Map() };
  const groups = new Map<string, Item[]>();
  for (const i of items.filter((x) => COMPARABLE.includes(x.category))) {
    groups.set(groupKeyOf(i), [...(groups.get(groupKeyOf(i)) ?? []), i]);
  }
  const signals: Signal[] = [];
  for (const [key, list] of groups) {
    const picked = list.find((i) => i.status === "booked" || i.status === "chosen");
    if (!picked || list.length < 2) continue;
    // Everything scored as still open (a booking closes the alternatives it was chosen over).
    const d = decideGroup(list.map((i) => ({ ...i, status: "saved" as const })), base, key);
    const mine = d.options.find((o) => o.item.id === picked.id);
    const engine = d.winner;
    if (d.status !== "ok" || !engine || !mine || mine.score == null || engine.item.id === picked.id) continue;

    // Worded without suffixes on names ("Casa Azul'u/'i"): vowel harmony can't be guessed reliably.
    const lead =
      picked.status === "booked"
        ? L(`Rezervasyonun ${picked.name}, ${engine.item.name} yerine`, `You booked ${picked.name} over ${engine.item.name}`)
        : L(`Seçimin ${picked.name}, ${engine.item.name} yerine`, `You chose ${picked.name} over ${engine.item.name}`);
    const myPrice = totalPrice(picked, base);
    const theirPrice = totalPrice(engine.item, base);
    const pricier = myPrice != null && theirPrice != null && myPrice > theirPrice * 1.05 ? myPrice - theirPrice : 0;
    const cheaper = myPrice != null && theirPrice != null && myPrice < theirPrice * 0.95 ? theirPrice - myPrice : 0;
    // Criteria where one side is clearly better, biggest weighted gap first.
    const gaps = (a: typeof mine, b: typeof mine) =>
      a.parts
        .map((p) => ({ p, other: b.parts.find((x) => x.criterion === p.criterion) }))
        .filter(({ p, other }) => p.criterion !== "price" && p.criterion !== "ai" && p.s != null && other?.s != null && p.s - other.s >= CLEAR_GAIN)
        .sort((x, y) => y.p.weight * (y.p.s! - y.other!.s!) - x.p.weight * (x.p.s! - x.other!.s!))
        .map(({ p }) => p);
    const gains = gaps(mine, engine);
    const losses = gaps(engine, mine);
    if (pricier && gains.length) {
      // Paid more for something: that something matters, the price less.
      const better = gains.map((p) => L(`${lower(p.label)} daha iyi`, `better ${lower(p.label)}`)).join(", ");
      const evidence = `${lead}: ${better}, ${L(`${formatPrice(pricier, base.currency)} daha pahalı`, `${formatPrice(pricier, base.currency)} more`)}`;
      for (const p of gains) signals.push(signal("choice", d.category, p.criterion, 1, evidence));
      signals.push(signal("choice", d.category, "price", -1, evidence));
    } else if (cheaper) {
      // Saved money at a cost: the price matters, the main thing given up less.
      const weaker = losses[0] ? `, ${L(`${lower(losses[0].label)} daha zayıf`, `weaker ${lower(losses[0].label)}`)}` : "";
      const evidence = `${lead}: ${L(`${formatPrice(cheaper, base.currency)} daha ucuz`, `${formatPrice(cheaper, base.currency)} cheaper`)}${weaker}`;
      signals.push(signal("choice", d.category, "price", 1, evidence));
      if (losses[0]) signals.push(signal("choice", d.category, losses[0].criterion, -1, evidence));
    } else if (gains.length) {
      const evidence = `${lead}: ${gains.map((p) => L(`${lower(p.label)} daha iyi`, `better ${lower(p.label)}`)).join(", ")}`;
      for (const p of gains) signals.push(signal("choice", d.category, p.criterion, 1, evidence));
    }
  }
  return signals;
}

// --- patterns in what they save ---------------------------------------------------------------------

function fromSaves(items: Item[], ctx: DecisionContext): Signal[] {
  const stays = items.filter((i) => i.category === "stay" && i.status !== "dismissed");
  if (stays.length < MIN_SAVED) return [];
  const signals: Signal[] = [];
  const share = (hits: number, of: number) => (of >= MIN_SAVED ? hits / of : 0);

  const minutes = stays.map((i) => measureFor("location", i, ctx)).filter((m) => m?.unit === "minutes").map((m) => m!.value);
  const near = minutes.filter((m) => m <= 15).length;
  if (share(near, minutes.length) >= 0.75) {
    signals.push(signal("links", "stay", "location", 1, L(
      `Kaydettiğin ${minutes.length} konaklamadan ${near} tanesi 15 dk yürüme içinde`,
      `${near} of the ${minutes.length} stays you saved are within a 15 min walk`,
    )));
  }

  const types = stays.map((i) => cancellationType(i)).filter((t) => t !== "unknown");
  const free = types.filter((t) => t === "free").length;
  if (share(free, types.length) >= 0.8) {
    signals.push(signal("links", "stay", "cancellation", 1, L(
      `Kaydettiğin ${types.length} konaklamadan ${free} tanesi ücretsiz iptalli`,
      `${free} of the ${types.length} stays you saved have free cancellation`,
    )));
  }

  const ratings = stays.map((i) => measureFor("rating", i, ctx)).filter(Boolean).map((m) => m!.value);
  const high = ratings.filter((r) => r >= 0.87).length;
  if (share(high, ratings.length) >= 0.75) {
    signals.push(signal("links", "stay", "rating", 1, L(
      `Kaydettiğin ${ratings.length} konaklamadan ${high} tanesi yüksek puanlı`,
      `${high} of the ${ratings.length} stays you saved are highly rated`,
    )));
  }
  return signals;
}

// --- helpers ------------------------------------------------------------------------------------------

/** A criterion's label inside a sentence ("konum", "location"). */
const lower = (label: string) => label.toLocaleLowerCase(locale());

function signal(source: Signal["source"], category: Category, criterion: CriterionId, delta: 1 | -1, evidence: string): Signal {
  const label = CRITERION_LABELS[criterion];
  return {
    id: `${category}:${criterion}:${delta > 0 ? "up" : "down"}`,
    source,
    category,
    criterion,
    delta,
    text:
      delta > 0
        ? L(`${label} senin için önemli görünüyor`, `${label} seems to matter to you`)
        : L(`${label} senin için birinci sırada değil gibi`, `${label} doesn't seem to come first for you`),
    question:
      delta > 0
        ? L(`${label} senin için daha mı önemli?`, `Does ${lower(label)} matter more to you?`)
        : L(`${label} senin için ikinci planda mı?`, `Is ${lower(label)} less important to you?`),
    evidence,
  };
}

/** One signal per criterion: evidence pooled, opposite signals cancel out (then nothing is assumed). */
function merge(signals: Signal[]): Signal[] {
  const byKey = new Map<string, Signal[]>();
  for (const s of signals) byKey.set(inferredKey(s.category, s.criterion), [...(byKey.get(inferredKey(s.category, s.criterion)) ?? []), s]);
  const merged: Signal[] = [];
  for (const list of byKey.values()) {
    const sum = list.reduce((n, s) => n + s.delta, 0);
    if (sum === 0) continue;
    const direction = list.filter((s) => Math.sign(s.delta) === Math.sign(sum));
    const evidence = [...new Set(direction.map((s) => s.evidence))];
    merged.push({ ...direction[0], evidence: evidence.slice(0, 2).join(" · ") });
  }
  return merged;
}
