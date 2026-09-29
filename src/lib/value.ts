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

function minutesText(m: number): string {
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return h ? `${h} sa${rest ? ` ${rest} dk` : ""}` : `${rest} dk`;
}

const SHORT: Partial<Record<CriterionId, string>> = {
  location: "daha iyi konum",
  rating: "daha iyi yorumlar",
  comfort: "daha iyi konfor ve temizlik",
  amenities: "istediğin olanaklar",
  duration: "daha kısa yolculuk",
  schedule: "daha uygun saatler",
  data: "daha çok veri",
  validity: "daha uzun geçerlilik",
  details: "yorumlarda ve detaylarda daha iyi",
};

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
    priceDiff && priceDiff > 0 && hours >= 1 ? ` (saat başı ~${formatPrice(priceDiff / hours, ctx.currency)})` : "";
  const rows = pick.parts
    .map((p) => {
      const q = partOf(alt, p.criterion);
      if (p.criterion === "price" || p.criterion === "ai" || p.s == null || q?.s == null || p.weight === 0 || p.s <= q.s + 0.02) return null;
      return { p, q, gain: p.weight * (p.s - q.s) };
    })
    .filter((r): r is { p: Part; q: Part; gain: number } => r != null)
    .sort((a, b) => b.gain - a.gain);

  const lower = (t: string | null) => (t ?? "").toLocaleLowerCase("tr");
  return rows.map(({ p, q }) => {
    const c = p.criterion;
    if (short) return { criterion: c, text: SHORT[c] ?? lower(p.display) };
    if (c === "location" && p.value != null && q.value != null && (p.display ?? "").includes("dk")) {
      const saved = round(q.value - p.value);
      if (saved >= 3) {
        const hours = (saved * 2 * nights) / 60;
        return {
          criterion: c,
          text: `her yolda ~${saved} dk daha yakın; günde bir gidiş-dönüşle ${nights} gecede ~${round(hours) || 1} saat${perHour(hours)}`,
        };
      }
    }
    if (c === "duration" && p.value != null && q.value != null && q.value - p.value >= 15) {
      const saved = q.value - p.value;
      return { criterion: c, text: `${minutesText(saved)} daha kısa yolculuk${perHour(saved / 60)}` };
    }
    switch (c) {
      case "stops":
      case "baggage":
      case "cancellation":
        return { criterion: c, text: `${lower(p.display)} (diğerinde ${lower(q.display)})` };
      case "rating":
        return { criterion: c, text: `daha iyi yorumlar: ${p.display} – ${q.display}` };
      case "location":
        return { criterion: c, text: `daha iyi konum: ${p.display}` };
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
  if (source === "explicit") return `${part.label} senin için "${LEVEL_LABELS[part.level]}": `;
  if (source === "inferred" && (ctx.inferred.get(`${d.category}:${part.criterion}`)?.delta ?? 0) > 0) {
    return `${part.label} senin için önemli görünüyor: `;
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
    because = `${pick.item.name} bu ihtiyaç için en iyi seçenek.`;
  } else {
    const gains = gainsOver(pick, alt, ctx, priceDiff);
    const top = gains[0] ? partOf(pick, gains[0].criterion)! : null;
    const what = gains.slice(0, 2).map((g) => g.text).join("; ");
    if (valuePick) {
      const theirs = gainsOver(alt, pick, ctx, null, true)[0];
      because = [
        `Puanlar başa baş (${contenders[0].score}–${contenders[1].score}); ${pick.item.name} ${money(priceDiff!)} daha ucuz, fiyat/performans onda.`,
        theirs ? `${alt.item.name}: ${theirs.text}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
    } else if (tie) {
      const theirs = gainsOver(alt, pick, ctx, null, true)[0];
      const cheaperSide = priceDiff ? (priceDiff > 0 ? `${alt.item.name} ${money(priceDiff)} daha ucuz` : `${pick.item.name} ${money(priceDiff)} daha ucuz`) : null;
      because = [
        `${pick.item.name} ile ${alt.item.name} başa baş.`,
        top ? `${pick.item.name}: ${gains[0].text}.` : null,
        theirs ? `${alt.item.name}: ${theirs.text}.` : null,
        cheaperSide ? `${cheaperSide}.` : null,
        "Hangisi senin için daha önemliyse o.",
      ]
        .filter(Boolean)
        .join(" ");
    } else if (priceDiff != null && priceDiff > 0.5) {
      because = top
        ? `${intentPhrase(d, ctx, top)}${money(priceDiff)} fazlasına ${what}.`
        : `${money(priceDiff)} daha pahalı ama önceliklerine göre toplamda önde.`;
    } else if (priceDiff != null && priceDiff < -0.5) {
      const theirs = gainsOver(alt, pick, ctx, null, true)[0];
      because = what
        ? `Hem ${money(priceDiff)} daha ucuz hem ${what}.`
        : `${money(priceDiff)} daha ucuz${theirs ? `; diğerinin artısı (${theirs.text}) önceliklerine göre bu farka değmez` : ""}.`;
    } else if (pickPrice == null || altPrice == null) {
      // A missing price is not a similar price: say what is known and what the verdict waits for.
      const waiting = (pickPrice == null ? pick : alt).item.name;
      because = `${what ? `${what.charAt(0).toLocaleUpperCase("tr")}${what.slice(1)}.` : `${pick.item.name} bilinenlerde önde.`} ${waiting} için fiyat eksik; gelince yeniden tartarım.`;
    } else {
      because = what ? `Fiyat benzer; ${what}.` : `${pick.item.name} toplamda önde.`;
    }
  }

  let unless: string | null = null;
  if (alt && valuePick) {
    const theirs = gainsOver(alt, pick, ctx, null, true)[0];
    if (theirs) unless = `${theirs.text.charAt(0).toLocaleUpperCase("tr")}${theirs.text.slice(1)} senin için daha önemliyse ${alt.item.name}.`;
  } else if (alt && !tie) {
    const flip = d.unless.find((u) => u.winner === alt.item.name) ?? d.unless[0];
    if (flip) {
      const keeps = flip.winner === alt.item.name && priceDiff != null && priceDiff > 0.5 ? `: ${money(priceDiff)} cebinde kalır` : "";
      unless = `${CRITERION_LABELS[flip.criterion]} o kadar önemli değilse ${flip.winner}${keeps}.`;
    }
  }

  const isSettled = (o: OptionResult) => o.item.status === "chosen" || o.item.status === "booked";
  const settledOther = d.options.find((o) => o !== pick && isSettled(o)) ?? null;
  let chosenOther: string | null = null;
  if (settledOther) {
    const edge = gainsOver(settledOther, pick, ctx, null, true)[0];
    const otherPrice = priceOf(settledOther);
    const cheaperBy = pickPrice != null && otherPrice != null && otherPrice < pickPrice - 0.5 ? `${money(pickPrice - otherPrice)} daha ucuz` : null;
    const plus = [cheaperBy, edge?.text].filter(Boolean).join(", ");
    chosenOther = `${settledOther.item.status === "booked" ? "Rezervasyonun" : "Seçimin"}: ${settledOther.item.name}${plus ? ` (${plus})` : ""}. Önceliklerine göre ${pick.item.name} ${
      settledOther.score != null && pick.score != null ? `${pick.score - settledOther.score} puan önde` : "önde"
    }; karar senin.`;
  }

  let budgetLine: string | null = null;
  if (budget) {
    const note = budget.uncounted ? " · bazı fiyatlar hesaba katılamadı" : "";
    // What's left if this need were settled with each option (the current choice for it is added back).
    const settledPrice = settledOther ? priceOf(settledOther) ?? 0 : isSettled(pick) ? pickPrice ?? 0 : 0;
    const free = budget.remaining + settledPrice;
    if (isSettled(pick)) {
      budgetLine = `Kalan bütçe ${formatPrice(budget.remaining, budget.currency)}${note}`;
    } else if (pickPrice != null) {
      const after = free - pickPrice;
      const altAfter = altPrice != null ? free - altPrice : null;
      budgetLine =
        (after >= 0 ? `Bununla kalan bütçe ${formatPrice(after, budget.currency)}` : `Bütçeyi ${formatPrice(-after, budget.currency)} aşar`) +
        (alt && altAfter != null ? ` (${alt.item.name} ile ${altAfter >= 0 ? formatPrice(altAfter, budget.currency) : `${formatPrice(-altAfter, budget.currency)} aşım`})` : "") +
        note;
    }
  }

  const ruledOut = [
    ...d.options
      .filter((o) => o.eliminated)
      .map((o) => `${o.item.name} elendi: ${o.eliminated!.reason}`),
    ...d.checks.map((c) => `Kontrol gerekiyor: ${d.options.find((o) => o.item.id === c.itemId)?.item.name ?? ""} — ${c.reason} (sayfada doğrulanamadı)`),
  ];

  const kicker = valuePick ? "Fiyat/performans" : tie ? "Başa baş" : "Senin için";
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
  if (value) add(value, "Fiyat/performans");
  if (priced[0] && priced[0] !== value && priceOf(priced[0])! < priceOf(value ?? priced[0])! - 0.5) add(priced[0], "En ucuz");

  const standout = (criterion: CriterionId, role: string) => {
    const ranked = inPlay
      .map((o) => ({ o, s: partOf(o, criterion)?.s ?? null, w: partOf(o, criterion)?.weight ?? 0 }))
      .filter((x) => x.s != null && x.w > 0)
      .sort((a, b) => b.s! - a.s!);
    if (ranked.length >= 2 && ranked[0].s! - ranked[1].s! >= 0.05) add(ranked[0].o, role);
  };
  standout("location", "En iyi konum");
  standout("rating", "En iyi yorumlar");
  standout("duration", "En kısa yolculuk");
  return roles;
}

/** Options within this many points of the top count as level with it for "Fiyat/performans". */
const VALUE_BAND = 5;
