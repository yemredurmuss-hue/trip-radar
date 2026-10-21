// What an intent's row says on the Plan (plan v14, onay paketi 2026-10-21): a flight or any way of travel as one 72 px row,
// a stay or a rental as a 120 px card that doesn't fold. Each says only its own state's facts (Değişmez kural):
//   Niyet     where, when, how many, what was asked for; about how much; "Ara"
//   Biriken   the deck and how many; our pick's price (else the lowest); "Seç" with the count on its edge
//   Önerimiz  our pick's facts; "Bunu seç"
//   Seçili    the carrier or the place, its hours or its rating, its price; "Satın al ↗" / "Rezerve et ↗"
//   Alınmış   its code; the green "✓ Alındı" / "✓ Rezerve"
//   Ayarlandı, Dahil  a grey hap; nothing to do
// The kind's word leads a mixed category's row ("Tren", "Transfer"), a chosen stay's its city and nights ("Chiang Mai · 3
// gece"); never in capitals (DESIGN.md: Türkçe büyük harf etiket yok). It reads intents.ts's view model and decides nothing:
// the states are intents.ts's, the words intentFrame.ts's and ticketFrame.ts's. Pure; app/plan/v82/IntentRow.tsx draws it.
import { L } from "./i18n";
import { codeLabel, headName, optionPrice, ratingParts, sidePrice } from "./intentFrame";
import type { IntentVM, OptionVM } from "./intents";
import { railDate, spanText } from "./railDates";
import { ticketCodeLabel, ticketFace, ticketPrice } from "./ticketFrame";

/** The face a row takes: a ticket's thin row (folds open), a stay's or a rental's card (doesn't fold). */
export type RowFace = "ticket" | "card";

/** The one thing on the row's right, in its 118 px slot. */
export type RowSlot =
  | { kind: "ask" }
  | { kind: "pick"; count: number }
  | { kind: "take" }
  | { kind: "book"; word: string }
  | { kind: "got" }
  | { kind: "hap"; tone: "ok" | "arr" | "inc"; text: string };

export interface RowPart {
  text: string;
  tone?: "ok" | "warn" | "bold";
}

export interface RowView {
  face: RowFace;
  /** Small over the name, in the category's colour: the kind's word, a chosen stay's city and nights, "✨ Önerimiz". */
  lead: string | null;
  /** The name: a ticket's two ends, a chosen place's name, the city. */
  title: string;
  route: { from: string; to: string } | null;
  /** The one line under the name. */
  line: RowPart[];
  /** A card's third line: what was asked for (niyet), the sources (biriken), the cancelling day (seçili), the check-in (rezerve). */
  third: RowPart[];
  /** Niyet's wants as chips (a must solid, a wish dashed). */
  wants: { label: string; must: boolean }[];
  /** The one figure: the price, the estimate, the code. */
  figure: { big: string; small: string | null; code?: boolean } | null;
  slot: RowSlot;
  /** How many options the deck holds (its corner). */
  count: number;
}

/** A rental (a car, a scooter, a camper, a bike) is drawn as a stay's card, its days on the rail (onay paketi, Ulaşım). */
export const isRental = (vm: Pick<IntentVM, "ticket">): boolean => vm.ticket?.rental != null;

export function rowFace(vm: Pick<IntentVM, "frame" | "kind" | "ticket">): RowFace {
  return vm.frame === "ticket" && !isRental(vm) ? "ticket" : "card";
}

/** The option whose price a deck shows: our pick, else the first (the best fit), else the cheapest. */
export function deckLead(options: readonly OptionVM[]): OptionVM | null {
  return options.find((o) => o.ours) ?? options[0] ?? null;
}

/** "Booking.com 3 · Airbnb 1": where the deck's options came from, the most first. */
export function sourceCounts(options: readonly Pick<OptionVM, "brand">[]): string | null {
  const by = new Map<string, number>();
  for (const o of options) if (o.brand?.label) by.set(o.brand.label, (by.get(o.brand.label) ?? 0) + 1);
  if (!by.size) return null;
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
}

const priceOf = (vm: Pick<IntentVM, "frame" | "ticket" | "kind">, o: OptionVM): { big: string; small: string | null } | null => {
  if (vm.frame === "ticket") return ticketPrice(o, vm.ticket?.mode ?? null);
  const p = sidePrice(o.price);
  return p ? { big: p.big, small: p.small?.replace(/^\/\s*/, "") ?? null } : null;
};

/** The deck's range: "€58–96 gece" (a stay's by the night), else as each option's price begins. */
function priceRange(vm: Pick<IntentVM, "frame">, options: readonly OptionVM[]): string | null {
  if (vm.frame === "ticket" || options.length < 2) return null;
  const each = options.map((o) => optionPrice(o.price)).filter((p): p is NonNullable<typeof p> => p != null);
  if (each.length < 2) return null;
  const nums = each.map((p) => ({ p, n: Number(p.amount.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) })).filter((x) => Number.isFinite(x.n));
  if (nums.length < 2) return null;
  nums.sort((a, b) => a.n - b.n);
  const lo = nums[0].p.amount, hi = nums.at(-1)!.p.amount;
  const unit = nums[0].p.unit?.replace(/^\/\s*/, "") ?? null;
  const cur = lo.replace(/[\d\s,.]/g, "");
  return [`${lo}–${hi.replace(cur, "")}`, unit].filter(Boolean).join(" ");
}

/** A head part the rail already says: a day, a stretch of days, the nights ("1 gece", "2–5 Nisan"). */
const isDayPart = (p: string): boolean => /\d/.test(p) && !/kişi|person|people/i.test(p);

export function rowView(vm: IntentVM): RowView {
  const face = rowFace(vm);
  const ticket = face === "ticket";
  const tf = vm.frame === "ticket" ? ticketFace(vm) : null;
  const chosen = vm.chosen;
  const status = vm.status;
  const hasOptions = vm.options.length > 0 || (vm.more?.length ?? 0) > 0;
  const deciding = (status === "searching" || status === "deciding") && hasOptions;
  const searching = status === "searching" && !hasOptions;
  const count = Math.max(vm.optionCount, vm.options.length + (vm.more?.length ?? 0));
  const rental = isRental(vm);
  const mode = vm.ticket?.mode ?? null;

  // The lead over the name.
  let lead: string | null = null;
  if (vm.kind === "stay" && (status === "chosen" || status === "booked" || status === "suggested") && vm.head.city) {
    lead = vm.head.nights > 0 ? `${vm.head.city} · ${spanText(vm.head.nights, "night")}` : vm.head.city;
  } else if (rental) {
    // (its days as the rail counts them: pick-up to return, both days)
    const days = railDate(vm)?.notches || null;
    const kind = vm.head.kindWord ? L(`${vm.head.kindWord} kiralama`, `${vm.head.kindWord} rental`) : L("Kiralama", "Rental");
    lead = [kind, days ? spanText(days, "day") : null].filter(Boolean).join(" · ");
  } else if (vm.head.kindWord) {
    lead = vm.head.kindWord;
  }
  if (status === "suggested" && !vm.own) lead = [`✨ ${L("Önerimiz", "Our pick")}`, lead].filter(Boolean).join(" · ");

  // The name.
  const route = ticket && vm.head.route ? vm.head.route : null;
  const title = route ? `${route.from} → ${route.to}` : !ticket && chosen && (status === "chosen" || status === "booked" || status === "suggested") ? chosen.title : headName(vm);

  // The line under it.
  const line: RowPart[] = [];
  const dayParts = vm.head.parts.filter((p) => !/→/.test(p));
  const shown = chosen && (status === "chosen" || status === "booked" || status === "suggested" || status === "arranged");
  if (ticket && shown && tf) {
    const t1 = tf.from?.time, t2 = tf.to?.time;
    if (t1 || t2) line.push({ text: [t1, t2].filter(Boolean).join(" → "), tone: "bold" });
    else if (tf.name) line.push({ text: [tf.name, tf.sub].filter(Boolean).join(" ") });
    if (tf.mid.top) line.push({ text: tf.mid.top });
    if (tf.mid.bottom) line.push({ text: tf.mid.bottom, tone: tf.mid.tone ?? undefined });
  } else if (!ticket && shown && chosen) {
    // (its days and nights are on the rail beside it)
    if (chosen.brand?.label) line.push({ text: chosen.brand.label });
    if (chosen.where) line.push({ text: chosen.where });
    if (vm.people) line.push({ text: L(`${vm.people} kişi`, `${vm.people} people`) });
    if (rental && vm.ticket?.rental?.line) line.push({ text: vm.ticket.rental.line });
  } else if (!ticket) {
    for (const p of dayParts) if (!isDayPart(p)) line.push({ text: p });
    if (vm.people) line.push({ text: L(`${vm.people} kişi`, `${vm.people} people`) });
    if (!line.length && vm.head.word) line.push({ text: vm.head.word });
  } else {
    for (const p of dayParts) line.push({ text: p });
    if (vm.people) line.push({ text: L(`${vm.people} kişi`, `${vm.people} people`) });
  }

  // A card's third line.
  const third: RowPart[] = [];
  if (!ticket) {
    if (deciding) {
      const src = sourceCounts([...vm.options, ...(vm.more ?? [])]);
      if (src) third.push({ text: src });
      const range = priceRange(vm, [...vm.options, ...(vm.more ?? [])]);
      if (range) third.push({ text: range });
    } else if (status === "booked") {
      if (vm.access?.checkIn) third.push({ text: L(`Giriş ${vm.access.checkIn}`, `Check-in ${vm.access.checkIn}`), tone: "ok" });
      if (vm.access?.checkOut) third.push({ text: L(`Çıkış ${vm.access.checkOut}`, `Check-out ${vm.access.checkOut}`) });
    } else if (chosen && (status === "chosen" || status === "suggested")) {
      if (chosen.cancel) third.push({ text: chosen.cancel, tone: /ücretsiz|free/i.test(chosen.cancel) ? "ok" : "warn" });
      for (const c of chosen.checks.slice(0, 2)) third.push({ text: c.text || c.label, tone: c.ok ? "ok" : "warn" });
      const r = ratingParts(chosen.rating);
      if (!third.length && r?.reviews) third.push({ text: r.reviews });
    }
  }
  const wants = searching || deciding ? vm.head.wants : [];

  // The figure.
  let figure: RowView["figure"] = null;
  if (searching && vm.estimate) {
    figure = { big: vm.estimate.label, small: vm.estimate.unit === "night" ? L("gece, tahmini", "a night, about") : L("yaklaşık", "about") };
  } else if (deciding) {
    const o = deckLead([...vm.options, ...(vm.more ?? [])]);
    const p = o ? priceOf(vm, o) : null;
    if (p) {
      const which = o?.ours ? L("önerimiz", "our pick") : L("ilk sırada", "top pick");
      figure = { big: p.big, small: ticket ? which : [p.small?.split(" · ")[0], which].filter(Boolean).join(", ") };
    }
  } else if ((status === "chosen" || status === "suggested") && chosen) {
    const p = priceOf(vm, chosen);
    if (p) figure = { big: p.big, small: ticket ? (p.small?.split(" · ")[0] ?? null) : p.small };
  } else if (status === "booked") {
    const label = vm.access ? codeLabel(vm.access) : null;
    if (vm.access?.code && label) figure = { big: vm.access.code.value, small: mode ? ticketCodeLabel(mode, label) : label, code: true };
    else if (vm.paid) figure = { big: vm.paid.replace(/\s+(ödendi|paid)$/i, ""), small: L("ödendi", "paid") };
  }

  // The one thing on the right.
  let slot: RowSlot;
  switch (status) {
    case "booked":
      slot = { kind: "hap", tone: "ok", text: vm.kind === "stay" || mode === "car" ? L("Rezerve", "Booked") : L("Alındı", "Bought") };
      break;
    case "arranged":
      slot = { kind: "hap", tone: "arr", text: L("Ayarlandı", "Arranged") };
      break;
    case "included":
      slot = { kind: "hap", tone: "inc", text: L("Dahil", "Included") };
      break;
    case "suggested":
      slot = { kind: "take" };
      break;
    case "chosen":
      slot = { kind: "book", word: vm.kind === "stay" || mode === "car" ? L("Rezerve et", "Book") : L("Satın al", "Buy") };
      break;
    default:
      slot = deciding ? { kind: "pick", count } : { kind: "ask" };
  }

  return { face, lead, title, route, line, third, wants, figure, slot, count };
}
