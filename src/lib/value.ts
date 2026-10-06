// "Is it worth it?" in plain terms. For each open decision: what the recommended option costs over
// the best cheaper alternative, what that money buys in concrete units (minutes, hours, stops...),
// which of the traveller's priorities makes it worth it, what would change the answer, and what it
// leaves of the budget. Pure; every number comes from the decision engine.
import {
  CRITERION_LABELS,
  LEVEL_LABELS,
  levelSource,
  totalPrice,
  type DecisionContext,
  type GroupDecision,
  type OptionResult,
  type Part,
} from "./decision";
import { L } from "./i18n";
import { capitalize, hoursMinutes, liveLabels, lowerText, MINUTES_SHOWN, nNights } from "./i18nText";
import { formatPrice, nightsBetween } from "./items";
import type { Plan } from "./plan";
import type { CriterionId, Item } from "./types";

export interface ValueCard {
  pick: OptionResult;
  /** The option it is weighed against: the best cheaper one, else the runner-up. */
  alt: OptionResult | null;
  tie: boolean;
  /** The card's stance: "Senin için", "Fiyat/performans" (level on priorities, cheaper) or "Başa baş". */
  kicker: string;
  /** pick − alt in the context currency; positive = the pick costs more. */
  priceDiff: number | null;
  /** "Konum senin için "Çok önemli": €45 fazlasına her yolda ~31 dk daha yakın; …". */
  because: string;
  /** "Konum o kadar önemli değilse Casa Azul: €45 cebinde kalır." */
  unless: string | null;
  /** "Bununla kalan bütçe €540 (Casa Azul ile €585)". */
  budget: string | null;
  /** The traveller already chose/booked another option in this group: how it compares. */
  chosenOther: string | null;
  /** "Casa Azul elendi: yan binada inşaat (7 yorum)" and proposed eliminations the evidence doesn't back. */
  ruledOut: string[];
}

export interface BudgetState {
  total: number;
  currency: string;
  /** Booked and chosen options, in the budget's currency. */
  spent: number;
  remaining: number;
  /** Settled options whose price couldn't be counted (no price or no exchange rate). */
  uncounted: number;
}

export function budgetState(plan: Plan | null, items: Item[], ctx: DecisionContext): BudgetState | null {
  const budget = ctx.trip.budget;
  if (!budget || budget.currency !== ctx.currency) return null;
  const closed = new Set(plan?.closed.map((c) => c.item.id) ?? []);
  const settled = items.filter((i) => (i.status === "booked" || i.status === "chosen") && !closed.has(i.id));
  let spent = 0;
  let uncounted = 0;
  for (const i of settled) {
    const price = totalPrice(i, ctx);
    if (price == null) uncounted++;
    else spent += price;
  }
  return { total: budget.amount, currency: ctx.currency, spent, remaining: budget.amount - spent, uncounted };
}

const partOf = (o: OptionResult, c: CriterionId): Part | undefined => o.parts.find((p) => p.criterion === c);
const priceOf = (o: OptionResult) => partOf(o, "price")?.value ?? null;
const round = (n: number) => Math.round(n);

const minutesText = hoursMinutes;

const SHORT: Readonly<Partial<Record<CriterionId, string>>> = liveLabels({
  location: ["daha iyi konum", "a better location"],
  rating: ["daha iyi yorumlar", "better reviews"],
  comfort: ["daha iyi konfor ve temizlik", "more comfort and cleanliness"],
  amenities: ["istediğin olanaklar", "the amenities you want"],
  duration: ["daha kısa yolculuk", "a shorter journey"],
  schedule: ["daha uygun saatler", "better times"],
  data: ["daha çok veri", "more data"],
  validity: ["daha uzun geçerlilik", "longer validity"],
  details: ["yorumlarda ve detaylarda daha iyi", "better on reviews and details"],
});

/**
 * Concrete things the pick gives over the alternative, most decisive first. `short` gives a bare
 * phrase ("daha çok veri") for use inside another sentence.
 */
function gainsOver(
  pick: OptionResult,
  alt: OptionResult,
  ctx: DecisionContext,
  priceDiff: number | null,
  short = false,
): { criterion: CriterionId; text: string }[] {
  const nights = nightsBetween(pick.item.dates.start, pick.item.dates.end) || ctx.tripNights || 1;
  const perHour = (hours: number) =>
    priceDiff && priceDiff > 0 && hours >= 1
      ? L(` (saat başı ~${formatPrice(priceDiff / hours, ctx.currency)})`, ` (~${formatPrice(priceDiff / hours, ctx.currency)} an hour)`)
      : "";
  const rows = pick.parts
    .map((p) => {
      const q = partOf(alt, p.criterion);
      if (p.criterion === "price" || p.criterion === "ai" || p.s == null || q?.s == null || p.weight === 0 || p.s <= q.s + 0.02) return null;
      return { p, q, gain: p.weight * (p.s - q.s) };
    })
    .filter((r): r is { p: Part; q: Part; gain: number } => r != null)
    .sort((a, b) => b.gain - a.gain);

  const lower = (t: string | null) => lowerText(t ?? "");
  return rows.map(({ p, q }) => {
    const c = p.criterion;
    if (short) return { criterion: c, text: SHORT[c] ?? lower(p.display) };
    if (c === "location" && p.value != null && q.value != null && MINUTES_SHOWN.test(p.display ?? "")) {
      const saved = round(q.value - p.value);
      if (saved >= 3) {
        const hours = (saved * 2 * nights) / 60;
        const total = round(hours) || 1;
        return {
          criterion: c,
          text: L(
            `her yolda ~${saved} dk daha yakın; günde bir gidiş-dönüşle ${nights} gecede ~${total} saat${perHour(hours)}`,
            `~${saved} min closer each way; with one round trip a day, ~${total} hour${total === 1 ? "" : "s"} over ${nNights(nights)}${perHour(hours)}`,
          ),
        };
      }
    }
    if (c === "duration" && p.value != null && q.value != null && q.value - p.value >= 15) {
      const saved = q.value - p.value;
      return { criterion: c, text: L(`${minutesText(saved)} daha kısa yolculuk${perHour(saved / 60)}`, `${minutesText(saved)} shorter journey${perHour(saved / 60)}`) };
    }
    switch (c) {
      case "stops":
      case "baggage":
      case "cancellation":
        return { criterion: c, text: L(`${lower(p.display)} (diğerinde ${lower(q.display)})`, `${lower(p.display)} (the other: ${lower(q.display)})`) };
      case "rating":
        return { criterion: c, text: L(`daha iyi yorumlar: ${p.display} – ${q.display}`, `better reviews: ${p.display} – ${q.display}`) };
      case "location":
        return { criterion: c, text: L(`daha iyi konum: ${p.display}`, `a better location: ${p.display}`) };
      case "schedule":
      case "data":
      case "validity":
      case "amenities":
        return { criterion: c, text: `${SHORT[c]}: ${p.display}` };
      default:
        return { criterion: c, text: SHORT[c] ?? lower(p.label) };
    }
  });
}

/** "Konum senin için "Çok önemli": " when the weight came from the traveller; nothing for defaults. */
function intentPhrase(d: GroupDecision, ctx: DecisionContext, part: Part): string {
  const source = levelSource(ctx.trip, d.category, part.criterion, ctx.inferred);
  if (source === "explicit") return L(`${part.label} senin için "${LEVEL_LABELS[part.level]}": `, `${part.label} is "${LEVEL_LABELS[part.level]}" to you: `);
  if (source === "inferred" && (ctx.inferred.get(`${d.category}:${part.criterion}`)?.delta ?? 0) > 0) {
    return L(`${part.label} senin için önemli görünüyor: `, `${part.label} seems to matter to you: `);
  }
  return "";
}

export function valueCard(d: GroupDecision, ctx: DecisionContext, budget: BudgetState | null): ValueCard | null {
  if (d.status !== "ok" && d.status !== "tie") return null;
  const scored = d.options.filter((o) => o.score != null);
  const inPlay = (o: OptionResult) => !o.unmet.length && !o.eliminated;
  const contenders = scored.some(inPlay) ? scored.filter(inPlay) : scored;
  if (!contenders[0]) return null;
  const tie = d.status === "tie";
  // A tie is still a decision: level on the traveller's priorities, the cheaper one is the better value.
  let pick = contenders[0];
  let valuePick = false;
  if (tie && contenders[1]) {
    const [a, b] = contenders;
    const pa = priceOf(a);
    const pb = priceOf(b);
    if (pa != null && pb != null && Math.abs(pa - pb) >= 0.03 * Math.max(pa, pb)) {
      pick = pa < pb ? a : b;
      valuePick = true;
    }
  }
  const pickPrice = priceOf(pick);
  // The question people actually ask: is it worth paying more than the best cheaper option?
  const cheaper = contenders.slice(1).find((o) => pickPrice != null && priceOf(o) != null && priceOf(o)! < pickPrice - 0.5);
  const alt = tie ? (contenders.slice(0, 2).find((o) => o !== pick) ?? null) : cheaper ?? contenders[1] ?? null;
  const altPrice = alt ? priceOf(alt) : null;
  const priceDiff = pickPrice != null && altPrice != null ? pickPrice - altPrice : null;
  const money = (n: number) => formatPrice(Math.abs(n), ctx.currency);

  let because: string;
  if (!alt) {
    because = L(`${pick.item.name} bu ihtiyaç için en iyi seçenek.`, `${pick.item.name} is the best option for this.`);
  } else {
    const gains = gainsOver(pick, alt, ctx, priceDiff);
    const top = gains[0] ? partOf(pick, gains[0].criterion)! : null;
    const what = gains.slice(0, 2).map((g) => g.text).join("; ");
    if (valuePick) {
      const theirs = gainsOver(alt, pick, ctx, null, true)[0];
      const scores = `${contenders[0].score}–${contenders[1].score}`;
      because = [
        L(
          `Puanlar başa baş (${scores}); ${pick.item.name} ${money(priceDiff!)} daha ucuz, fiyat/performans onda.`,
          `Scores are level (${scores}); ${pick.item.name} is ${money(priceDiff!)} cheaper, so it's the better value.`,
        ),
        theirs ? `${alt.item.name}: ${theirs.text}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
    } else if (tie) {
      const theirs = gainsOver(alt, pick, ctx, null, true)[0];
      const cheaper = (name: string) => L(`${name} ${money(priceDiff!)} daha ucuz`, `${name} is ${money(priceDiff!)} cheaper`);
      const cheaperSide = priceDiff ? (priceDiff > 0 ? cheaper(alt.item.name) : cheaper(pick.item.name)) : null;
      because = [
        L(`${pick.item.name} ile ${alt.item.name} başa baş.`, `${pick.item.name} and ${alt.item.name} are level.`),
        top ? `${pick.item.name}: ${gains[0].text}.` : null,
        theirs ? `${alt.item.name}: ${theirs.text}.` : null,
        cheaperSide ? `${cheaperSide}.` : null,
        L("Hangisi senin için daha önemliyse o.", "Go with what matters more to you."),
      ]
        .filter(Boolean)
        .join(" ");
    } else if (priceDiff != null && priceDiff > 0.5) {
      because = top
        ? L(`${intentPhrase(d, ctx, top)}${money(priceDiff)} fazlasına ${what}.`, `${intentPhrase(d, ctx, top)}for ${money(priceDiff)} more, ${what}.`)
        : L(`${money(priceDiff)} daha pahalı ama önceliklerine göre toplamda önde.`, `${money(priceDiff)} more, but ahead overall on your priorities.`);
    } else if (priceDiff != null && priceDiff < -0.5) {
      const theirs = gainsOver(alt, pick, ctx, null, true)[0];
      because = what
        ? L(`Hem ${money(priceDiff)} daha ucuz hem ${what}.`, `Both ${money(priceDiff)} cheaper and ${what}.`)
        : L(
            `${money(priceDiff)} daha ucuz${theirs ? `; diğerinin artısı (${theirs.text}) önceliklerine göre bu farka değmez` : ""}.`,
            `${money(priceDiff)} cheaper${theirs ? `; the other's plus (${theirs.text}) isn't worth the difference on your priorities` : ""}.`,
          );
    } else if (pickPrice == null || altPrice == null) {
      // A missing price is not a similar price: say what is known and what the verdict waits for.
      const waiting = (pickPrice == null ? pick : alt).item.name;
      const known = what ? `${capitalize(what)}.` : L(`${pick.item.name} bilinenlerde önde.`, `${pick.item.name} leads on what's known.`);
      because = `${known} ${L(`${waiting} için fiyat eksik; gelince yeniden tartarım.`, `${waiting} has no price yet; I'll weigh it again when it comes.`)}`;
    } else {
      because = what ? L(`Fiyat benzer; ${what}.`, `Similar price; ${what}.`) : L(`${pick.item.name} toplamda önde.`, `${pick.item.name} is ahead overall.`);
    }
  }

  let unless: string | null = null;
  if (alt && valuePick) {
    const theirs = gainsOver(alt, pick, ctx, null, true)[0];
    if (theirs) unless = L(`${capitalize(theirs.text)} senin için daha önemliyse ${alt.item.name}.`, `If ${theirs.text} matters more to you, ${alt.item.name}.`);
  } else if (alt && !tie) {
    const flip = d.unless.find((u) => u.winner === alt.item.name) ?? d.unless[0];
    if (flip) {
      const kept = flip.winner === alt.item.name && priceDiff != null && priceDiff > 0.5;
      const keeps = kept ? L(`: ${money(priceDiff!)} cebinde kalır`, `: you keep ${money(priceDiff!)}`) : "";
      unless = L(
        `${CRITERION_LABELS[flip.criterion]} o kadar önemli değilse ${flip.winner}${keeps}.`,
        `If ${lowerText(CRITERION_LABELS[flip.criterion])} doesn't matter that much, ${flip.winner}${keeps}.`,
      );
    }
  }

  const isSettled = (o: OptionResult) => o.item.status === "chosen" || o.item.status === "booked";
  const settledOther = d.options.find((o) => o !== pick && isSettled(o)) ?? null;
  let chosenOther: string | null = null;
  if (settledOther) {
    const edge = gainsOver(settledOther, pick, ctx, null, true)[0];
    const otherPrice = priceOf(settledOther);
    const cheaperBy =
      pickPrice != null && otherPrice != null && otherPrice < pickPrice - 0.5 ? L(`${money(pickPrice - otherPrice)} daha ucuz`, `${money(pickPrice - otherPrice)} cheaper`) : null;
    const plus = [cheaperBy, edge?.text].filter(Boolean).join(", ");
    const booked = settledOther.item.status === "booked";
    const yours = `${booked ? L("Rezervasyonun", "Your booking") : L("Seçimin", "Your choice")}: ${settledOther.item.name}${plus ? ` (${plus})` : ""}.`;
    const lead = settledOther.score != null && pick.score != null ? pick.score - settledOther.score : null;
    chosenOther = L(
      `${yours} Önceliklerine göre ${pick.item.name} ${lead != null ? `${lead} puan önde` : "önde"}; karar senin.`,
      `${yours} On your priorities ${pick.item.name} is ${lead != null ? `${lead} point${lead === 1 ? "" : "s"} ahead` : "ahead"}; your call.`,
    );
  }

  let budgetLine: string | null = null;
  if (budget) {
    const note = budget.uncounted ? L(" · bazı fiyatlar hesaba katılamadı", " · some prices couldn't be counted") : "";
    // What's left if this need were settled with each option (the current choice for it is added back).
    const settledPrice = settledOther ? priceOf(settledOther) ?? 0 : isSettled(pick) ? pickPrice ?? 0 : 0;
    const free = budget.remaining + settledPrice;
    const fp = (n: number) => formatPrice(n, budget.currency);
    if (isSettled(pick)) {
      budgetLine = `${L("Kalan bütçe", "Budget left")} ${fp(budget.remaining)}${note}`;
    } else if (pickPrice != null) {
      const after = free - pickPrice;
      const altAfter = altPrice != null ? free - altPrice : null;
      const altLeft = altAfter == null ? "" : altAfter >= 0 ? fp(altAfter) : L(`${fp(-altAfter)} aşım`, `${fp(-altAfter)} over`);
      budgetLine =
        (after >= 0 ? L(`Bununla kalan bütçe ${fp(after)}`, `Budget left with this: ${fp(after)}`) : L(`Bütçeyi ${fp(-after)} aşar`, `${fp(-after)} over budget`)) +
        (alt && altAfter != null ? L(` (${alt.item.name} ile ${altLeft})`, ` (with ${alt.item.name}: ${altLeft})`) : "") +
        note;
    }
  }

  const ruledOut = [
    ...d.options.filter((o) => o.eliminated).map((o) => L(`${o.item.name} elendi: ${o.eliminated!.reason}`, `${o.item.name} is out: ${o.eliminated!.reason}`)),
    ...d.checks.map((c) => {
      const name = d.options.find((o) => o.item.id === c.itemId)?.item.name ?? "";
      return L(`Kontrol gerekiyor: ${name}: ${c.reason} (sayfada doğrulanamadı)`, `Needs a check: ${name}: ${c.reason} (couldn't be confirmed on the page)`);
    }),
  ];

  const kicker = valuePick ? VALUE_ROLE() : tie ? L("Başa baş", "Level") : L("Senin için", "For you");
  return { pick, alt, tie: tie && !valuePick, kicker, priceDiff, because, unless, budget: budgetLine, chosenOther, ruledOut };
}

/**
 * What sets each option apart in its group, as short badges: the best value (cheapest among those
 * level with the top), the cheapest, the best location, the best reviews, the shortest journey.
 * Only for options still in play, and only when one clearly stands out.
 */
export function rolesOf(d: GroupDecision): Map<string, string[]> {
  const roles = new Map<string, string[]>();
  if (d.status !== "ok" && d.status !== "tie") return roles;
  const inPlay = d.options.filter((o) => o.score != null && !o.unmet.length && !o.eliminated);
  if (inPlay.length < 2) return roles;
  const add = (o: OptionResult, role: string) => roles.set(o.item.id, [...(roles.get(o.item.id) ?? []), role]);

  const priced = inPlay.filter((o) => priceOf(o) != null && !o.limited.length).sort((a, b) => priceOf(a)! - priceOf(b)!);
  const top = inPlay[0].score!;
  const value = priced.find((o) => o.score! >= top - VALUE_BAND);
  if (value) add(value, VALUE_ROLE());
  if (priced[0] && priced[0] !== value && priceOf(priced[0])! < priceOf(value ?? priced[0])! - 0.5) add(priced[0], L("En ucuz", "Cheapest"));

  const standout = (criterion: CriterionId, role: string) => {
    const ranked = inPlay
      .map((o) => ({ o, s: partOf(o, criterion)?.s ?? null, w: partOf(o, criterion)?.weight ?? 0 }))
      .filter((x) => x.s != null && x.w > 0)
      .sort((a, b) => b.s! - a.s!);
    if (ranked.length >= 2 && ranked[0].s! - ranked[1].s! >= 0.05) add(ranked[0].o, role);
  };
  standout("location", L("En iyi konum", "Best location"));
  standout("rating", L("En iyi yorumlar", "Best reviews"));
  standout("duration", L("En kısa yolculuk", "Shortest journey"));
  return roles;
}

/** The best value among the options level with the top. */
const VALUE_ROLE = () => L("Fiyat/performans", "Best value");

/** Options within this many points of the top count as level with it for "Fiyat/performans". */
const VALUE_BAND = 5;
