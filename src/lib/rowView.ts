// What an intent's row says on the Plan (plan v14, onay paketi 2026-10-21): a flight or any way of travel as one 72 px row,
// a stay or a rental as a 120 px card that doesn't fold. Each says only its own state's facts (Değişmez kural):
//   Niyet     where, when, how many, what was asked for; about how much; "Ara"
//   Biriken   the deck and how many; our pick's price (else the lowest); "Seç" with the count on its edge
//   Önerimiz  our pick's facts; "Bunu seç"
//   Seçili    the carrier or the place, its hours or its rating, its price; "Satın al ↗" / "Rezerve et ↗"
//   Alınmış   its code; the green "✓ Alındı" / "✓ Rezerve"
//   Ayarlandı, Dahil  a grey hap; nothing to do
// Onay paketi 2026-10-22 ("planlamanın dört adımı"): every row stands on one of four steps, said by a mark on its picture's
// corner and a word after the kind's, never by the rail (the rail keeps the date): Seçenekler (nothing decided: a dashed
// card, "Seç" and the count) → Planda (decided; bought ahead or paid on the spot) → Alındı (paid, its ticket still to add:
// "Bileti ekle") → Bilet elde (its code or its file: a ticket's stub). Yellow is for trouble only: the paid sum is said
// only once a ticket or a code backs it, never guessed from the listing.
// Karar Masası (docs/superpowers/specs/2026-10-22-karar-masasi-kararlar.md, Uçuş first): a flight's row says "Seçtin" once
// chosen and "Bilet alındı" once bought; nothing looked for yet, its one thing on the right is "Kendin ara ↗" (a site with
// the route and the day) and the "+" on its mark's corner opens the drawer; a deck shows its best one's carrier and hours.
// The kind's word leads a mixed category's row ("Tren", "Transfer"), a chosen stay's its city and nights ("Chiang Mai · 3
// gece"); never in capitals (DESIGN.md: Türkçe büyük harf etiket yok). It reads intents.ts's view model and decides nothing:
// the states are intents.ts's, the words intentFrame.ts's and ticketFrame.ts's. Pure; app/plan/v82/IntentRow.tsx draws it.
import { L } from "./i18n";
import { isoDate } from "./items";
import { codeLabel, headName, optionPrice, ratingParts, sidePrice } from "./intentFrame";
import type { IntentStatus, IntentVM, OptionVM } from "./intents";
import { isDatedSection, railDate, spanText, stayCheckOut } from "./railDates";
import { ticketCodeLabel, ticketFace, ticketPrice } from "./ticketFrame";

/** The face a row takes: a ticket's thin row (folds open), a stay's or a rental's card (doesn't fold). */
export type RowFace = "ticket" | "card";

/** The four steps of planning (onay paketi 2026-10-22). */
export type RowStage = "options" | "planned" | "bought" | "ticket";

/** The one thing on the row's right, in its 118 px slot. */
export type RowSlot =
  | { kind: "ask" }
  | { kind: "pick"; count: number }
  | { kind: "take" }
  | { kind: "book"; word: string }
  | { kind: "got" }
  /** Kaçırdıklarımız (tarihsiz niyet): a need on the date rail with no day yet: "Tarih ver" before anything is looked for. */
  | { kind: "date" }
  | { kind: "hap"; tone: "ok" | "arr" | "inc" | "busy"; text: string }
  /** Bought, nothing to show for it yet: its ticket's (a stay's confirmation's) last step. */
  | { kind: "proof"; word: string }
  /** Karar Masası: a flight nothing is looked for yet: "Kendin ara ↗" (the first site, filled with the route and the day). */
  | { kind: "self" }
  /** Planned with nothing to book ahead: where its ticket is bought ("İskelede alınır"). */
  | { kind: "onsite"; text: string }
  /** Its ticket is in hand: the stub says it (the figure's code), nothing to press. */
  | { kind: "none" };

export interface RowPart {
  text: string;
  tone?: "ok" | "warn" | "bold";
}

export interface RowView {
  face: RowFace;
  /** Small over the name, in the category's colour: the kind's word, a chosen stay's city and nights. */
  lead: string | null;
  /** The step it stands on, and its word after the lead ("Planda", "3 seçenek", "Bilet elde"). */
  stage: RowStage;
  stageWord: string;
  /** The name: a ticket's two ends, a chosen place's name, the city. */
  title: string;
  route: { from: string; to: string } | null;
  /** The one line under the name. */
  line: RowPart[];
  /** A card's third line: what was asked for (niyet), the sources (biriken), the cancelling day (seçili), the check-in (rezerve). */
  third: RowPart[];
  /** Niyet's wants as chips (a must solid, a wish dashed). */
  wants: { label: string; must: boolean }[];
  /** The one figure: the price, the estimate, the code; on a stub, a word over it ("giriş") and plain type for an hour. */
  figure: { big: string; small: string | null; code?: boolean; top?: string; plain?: boolean } | null;
  slot: RowSlot;
  /** How many options the deck holds (its corner). */
  count: number;
  /** Karar Masası's language (a flight's row, Uçuş first): the plane between the ends, Seçtin, Bilet alındı, Kendin ara ↗. */
  desk: boolean;
  /** Karar Masası: the AI or the source is looking right now (the ring turns, the hours and the price load). */
  busy?: boolean;
}

/** A rental (a car, a scooter, a camper, a bike) is drawn as a stay's card, its days on the rail (onay paketi, Ulaşım). */
export const isRental = (vm: Pick<IntentVM, "ticket">): boolean => vm.ticket?.rental != null;

export function rowFace(vm: Pick<IntentVM, "frame" | "kind" | "ticket">): RowFace {
  return vm.frame === "ticket" && !isRental(vm) ? "ticket" : "card";
}

/** A booking backed by something: its code, or a file of it. */
export const hasProof = (vm: Pick<IntentVM, "access">): boolean => Boolean(vm.access?.code || (vm.access?.doc.count ?? 0) > 0);

/** Which of the four steps an intent stands on: "Ben hallettim" and a cover count as bought, a way with nothing to book as planned. */
export function rowStage(vm: Pick<IntentVM, "status" | "access" | "selfArranged">): RowStage {
  switch (vm.status) {
    case "booked":
      return hasProof(vm) ? "ticket" : "bought";
    case "included":
      return "bought";
    case "arranged":
      return vm.selfArranged ? "bought" : "planned";
    case "chosen":
      return "planned";
    default:
      return "options";
  }
}

/** Karar Masası's rows (Uçuş first): a flight drawn as its thin row. */
export const isDeskRow = (vm: Pick<IntentVM, "kind" | "frame" | "ticket">): boolean => vm.kind === "flight" && rowFace(vm) === "ticket";

/** A booking's word: a stay's and a rented car's are booked, the rest bought. */
const isBooking = (vm: Pick<IntentVM, "kind" | "ticket">): boolean => vm.kind === "stay" || vm.ticket?.mode === "car" || isRental(vm);

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
  const desk = isDeskRow(vm);

  // The lead over the name.
  let lead: string | null = null;
  if (vm.kind === "stay") {
    // (its city is the rail's, said where the city changes, its nights there too: onay paketi 2026-10-22, "şehir hatta")
    lead = null;
  } else if (rental) {
    // (its days as the rail counts them: pick-up to return, both days)
    const days = railDate(vm)?.notches || null;
    const kind = vm.head.kindWord ? L(`${vm.head.kindWord} kiralama`, `${vm.head.kindWord} rental`) : L("Kiralama", "Rental");
    lead = [kind, days ? spanText(days, "day") : null].filter(Boolean).join(" · ");
  } else if (vm.head.kindWord) {
    lead = vm.head.kindWord;
  }
  const stage = rowStage(vm);
  const booking = isBooking(vm);
  // (P6, F38: the traveller's own one save says so, never our "Önerimiz")
  const stageWord =
    stage === "ticket"
      ? booking ? L("Onay elde", "Confirmed") : L("Bilet elde", "Ticket in hand")
      : stage === "bought"
        ? status === "included" ? L("Dahil", "Included") : vm.selfArranged ? L("Sen hallettin", "You sorted it") : booking ? L("Rezerve", "Booked") : desk ? L("Bilet alındı", "Ticket bought") : L("Alındı", "Bought")
        : stage === "planned"
          ? desk && status === "chosen" ? L("Seçtin", "You chose") : L("Planda", "Planned")
          : status === "suggested"
            ? vm.own ? L("Senin kaydın", "Your save") : `✨ ${L("Önerimiz", "Our pick")}`
            : deciding
              ? L(`${count} seçenek`, count === 1 ? "1 option" : `${count} options`)
              : L("Aranacak", "To find");

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
  } else if (desk && deciding) {
    // (a deck: its best one's carrier, hours and stops, as the drawer's first card says them)
    const best = deckLead([...vm.options, ...(vm.more ?? [])]);
    const leg = best?.leg ?? null;
    const name = best?.carrier?.name ?? best?.brand?.label ?? null;
    if (name) line.push({ text: name });
    if (leg?.dep || leg?.arr) line.push({ text: [leg.dep, leg.arr].filter(Boolean).join(" → "), tone: "bold" });
    if (leg?.stops) line.push({ text: leg.stops.text.toLocaleLowerCase(L("tr", "en")), tone: leg.stops.direct ? "ok" : "warn" });
    if (!line.length) for (const p of dayParts) line.push({ text: p });
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
  // (a stay's check-out day leads its third line: the rail says only its check-in and its nights)
  const out = stayCheckOut(vm);
  if (out && !searching && !(deciding && vm.head.wants.length)) {
    // (a booking's check-out hour joins its day: "Çıkış 1 Aralık Salı 11:00")
    const hour = status === "booked" && vm.access?.checkOut ? vm.access.checkOut : null;
    const at = hour ? third.findIndex((p) => p.text.includes(hour) && !/Giriş|Check-in/.test(p.text)) : -1;
    if (at >= 0) third.splice(at, 1);
    third.unshift({ text: hour ? `${out} ${hour}` : out });
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
      const which = desk ? L("en iyisi", "the best") : o?.ours ? L("önerimiz", "our pick") : L("ilk sırada", "top pick");
      figure = { big: p.big, small: ticket ? which : [p.small?.split(" · ")[0], which].filter(Boolean).join(", ") };
    }
  } else if ((status === "chosen" || status === "suggested") && chosen) {
    const p = priceOf(vm, chosen);
    if (p) figure = { big: p.big, small: ticket ? (p.small?.split(" · ")[0] ?? null) : p.small };
  } else if (status === "booked") {
    // (the paid sum is never the listing's guess: a code or a file stands on the stub, else nothing until its ticket comes)
    const label = vm.access ? codeLabel(vm.access) : null;
    // (a stay's stub: its check-in hour and what was paid, not a number nobody reads there; the number is in its details)
    const paid = vm.paid?.replace(/\s+(ödendi|paid)$/i, "") ?? null;
    if (vm.kind === "stay" && stage === "ticket")
      figure = vm.access?.checkIn
        ? { top: L("giriş", "check-in"), big: vm.access.checkIn, small: vm.paid, code: true, plain: true }
        : paid
          ? { big: paid, small: L("ödendi", "paid"), code: true, plain: true }
          : { big: L("Onaylı", "Confirmed"), small: null, code: true, plain: true };
    else if (vm.access?.code && label) figure = { big: vm.access.code.value, small: mode ? ticketCodeLabel(mode, label) : label, code: true };
    else if (stage === "ticket") figure = { big: L("Ekli", "On file"), small: booking ? L("onay", "confirmation") : L("bilet", "ticket"), code: true };
  } else if (status === "arranged" && !vm.selfArranged && chosen) {
    // (nothing to book: what it costs is the page's or one's own guess, said so)
    const p = priceOf(vm, chosen);
    if (p) figure = { big: p.big, small: L("tahmini", "about") };
  }

  // The one thing on the right.
  let slot: RowSlot;
  switch (status) {
    case "booked":
      slot = stage === "ticket" ? { kind: "none" } : { kind: "proof", word: booking ? L("Onayı ekle", "Add the confirmation") : L("Bileti ekle", "Add the ticket") };
      break;
    case "arranged":
      slot = vm.selfArranged
        ? { kind: "proof", word: booking ? L("Onayı ekle", "Add the confirmation") : L("Bileti ekle", "Add the ticket") }
        : { kind: "onsite", text: vm.kind === "ferry" || mode === "ferry" ? L("İskelede alınır", "At the pier") : L("Yerinde alınır", "Paid on the spot") };
      break;
    case "included":
      slot = { kind: "hap", tone: "inc", text: L("Dahil", "Included") };
      break;
    case "suggested":
      // (a stop of a route the AI proposed, nothing saved for it yet: still to look for; its route is agreed under it)
      slot = vm.chosen ? { kind: "take" } : desk ? { kind: "self" } : { kind: "ask" };
      break;
    case "chosen":
      slot = { kind: "book", word: vm.kind === "stay" || mode === "car" ? L("Rezerve et", "Book") : L("Satın al", "Buy") };
      break;
    default:
      slot = deciding ? { kind: "pick", count } : isDatedSection(vm.section) && !isoDate(vm.head.date) ? { kind: "date" } : desk ? { kind: "self" } : { kind: "ask" };
  }

  return { face, lead, stage, stageWord, title, route, line, third, wants, figure, slot, count, desk };
}

/**
 * Kaçırdıklarımız 1 (Aranıyor): while the AI looks for a need still to find or decide (Ara pressed, the drawer closed), the
 * slot says so ("Aranıyor…") instead of Ara or Seç; the first option in turns it back into a deck.
 */
export function whileSearching(view: RowView, status: IntentStatus, searching: boolean): RowView {
  if (!searching || (status !== "searching" && status !== "deciding")) return view;
  // (Karar Masası: the ring turns and the hours and the price load; "Kendin ara ↗" stays, a deck keeps its Seç)
  if (view.desk) return { ...view, stageWord: view.slot.kind === "pick" ? view.stageWord : L("Aranıyor", "Searching"), busy: true };
  return { ...view, stageWord: L("Aranıyor", "Searching"), slot: { kind: "hap", tone: "busy", text: L("Aranıyor…", "Searching…") } };
}


/**
 * A dated category's state line by the four steps (onay paketi 2026-10-22): "2 alındı · 1 planda · 1 karar"; Karar Masası's
 * Uçuş says what was chosen as chosen ("1 seçildi"). "karar" opens the first decision (F5).
 */
export function stepParts(counts: Record<RowStage, number>, desk: boolean): { text: string; decide: boolean }[] {
  const done = counts.bought + counts.ticket;
  return [
    ...(done ? [{ text: L(`${done} alındı`, `${done} bought`), decide: false }] : []),
    ...(counts.planned ? [{ text: desk ? L(`${counts.planned} seçildi`, `${counts.planned} chosen`) : L(`${counts.planned} planda`, `${counts.planned} planned`), decide: false }] : []),
    ...(counts.options ? [{ text: L(`${counts.options} karar`, `${counts.options} to decide`), decide: true }] : []),
  ];
}

export type PlanStepsTip = ReturnType<typeof planSteps>;

export interface NextStep {
  key: string;
  section: IntentVM["section"];
  stage: RowStage;
  /** What to do: "Seç", "Bileti al", "Onayı ekle". */
  act: string;
  /** Its name: "Chiang Mai → Pai", "Rimping Village". */
  text: string;
  /** Its day and what it's waiting on ("27 Mar · 3 seçenek"). */
  sub: string | null;
}

/**
 * The plan's state by the four steps and its next things to do (onay paketi 2026-10-22, web: "Planın durumu" and
 * "Sıradaki işler"), over the dated categories in the rail's order: first what's still to decide, then to buy, then the
 * tickets to add. A way paid on the spot is planned and done; nothing skipped counts.
 */
export function planSteps(intents: readonly IntentVM[], max = 3): { counts: Record<RowStage, number>; total: number; next: NextStep[] } {
  const live = intents.filter((v) => v.status !== "skipped" && v.frame !== "collection" && isDatedSection(v.section));
  const counts: Record<RowStage, number> = { options: 0, planned: 0, bought: 0, ticket: 0 };
  const todo: (NextStep & { rank: number; date: string })[] = [];
  for (const vm of live) {
    const view = rowView(vm);
    counts[view.stage]++;
    const name = view.title;
    const day = vm.head.date ? railDate(vm)?.when ?? null : null;
    const booking = isBooking(vm);
    const step =
      view.slot.kind === "pick" || view.slot.kind === "take"
        ? { rank: 0, act: L("Seç", "Choose"), sub: [day, view.slot.kind === "pick" ? view.stageWord : L("önerimiz hazır", "our pick is ready")] }
        : view.slot.kind === "ask" || view.slot.kind === "date" || view.slot.kind === "self"
          ? { rank: 1, act: L("Ara", "Search"), sub: [day] }
          : view.slot.kind === "book"
            ? { rank: 2, act: booking ? L("Rezerve et", "Book it") : L("Bileti al", "Buy the ticket"), sub: [day, view.figure?.big ?? null] }
            : view.slot.kind === "proof"
              ? { rank: 3, act: booking ? L("Onayı ekle", "Add the confirmation") : L("Bileti ekle", "Add the ticket"), sub: [day] }
              : null;
    if (step) todo.push({ key: vm.key, section: vm.section, stage: view.stage, act: step.act, text: name, sub: step.sub.filter(Boolean).join(" · ") || null, rank: step.rank, date: isoDate(vm.head.date) ?? "9999" });
  }
  todo.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));
  return { counts, total: live.length, next: todo.slice(0, max).map(({ rank: _r, date: _d, ...s }) => s) };
}
