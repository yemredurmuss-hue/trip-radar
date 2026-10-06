// Aşamalar (spec 2026-10-06-asamalar-design.md): the one place that says where a record and a need stand, so the
// cards, the hero, the Plan's sections, the to-do list, the day view and the chat never count differently.
//
//   Aranacak (search) → Seçenekler (options) → Planlandı (planned) → Rezerve edildi (booked) → Hazır (ready)
//   side stages: İptal edildi (cancelled), Gerek yok (notNeeded), Kullanıldı (used)
//
// Only needs that take a booking have stages (a stay, a flight, a train / bus / ferry, a car, a transfer, a
// ticketed activity, an eSIM, insurance); a walk, a market or a restaurant is an idea and never in a percentage.
// "Hazır" isn't a status of its own: booked with a file on it. A need made of parts (the nights of a stay in
// blocks, one ticket per person) stands where its furthest-behind part stands. Pure.
import { L } from "./i18n";
import { isoDate } from "./items";
import { namesSomething } from "./planned";
import type { Item } from "./types";

export type Stage = "search" | "options" | "planned" | "booked" | "ready" | "cancelled" | "notNeeded" | "used";
/** The way forward, in order; the side stages aren't on it. */
export const MAIN_STAGES = ["search", "options", "planned", "booked", "ready"] as const;
export type MainStage = (typeof MAIN_STAGES)[number];
const RANK: Record<MainStage, number> = { search: 0, options: 1, planned: 2, booked: 3, ready: 4 };
export const isMainStage = (s: Stage): s is MainStage => s in RANK;

/** What the caller knows about a record beyond the record itself. */
export interface StageCtx {
  /** A place the start chat only made room for (startTrip.isPlaceholder). */
  placeholder?: boolean;
  /** Drawn as an empty card: a plan said with nothing concrete (emptyCards.isEmptyRecord). */
  empty?: boolean;
  /** Its files (a ticket, a voucher, a policy): booked with one is Hazır. */
  docs?: number;
  /** Today (YYYY-MM-DD): a booking whose dates are over is Kullanıldı. Without it nothing is used. */
  today?: string | null;
}

/** The day a record is over: its end, else its start (a flight, a ticket). */
const lastDay = (item: Item): string | null => isoDate(item.dates.end) ?? isoDate(item.dates.start) ?? isoDate(item.flight?.departure);

/**
 * Where one record stands. A status this version doesn't know (a newer version's) is never read as an option:
 * it's out of the counts until this version learns it.
 */
export function stageOf(item: Pick<Item, "status" | "dates" | "flight" | "installedAt" | "cancelledAt">, ctx: StageCtx = {}): Stage {
  switch (item.status as string) {
    // A cancelled booking is stored as a ruled-out record with the day it was cancelled (types.Item.cancelledAt),
    // so no reader, an older version's either, ever takes it for an option; "cancelled" is read too.
    case "cancelled":
      return "cancelled";
    case "dismissed":
      return item.cancelledAt ? "cancelled" : "notNeeded";
    case "saved":
      return "options";
    case "chosen":
      // Only a truly empty place is Aranacak: what the start made room for, or a plan said with nothing concrete.
      // One that names something ("TK1449", "Jardim Stay") is a decision made: Planlandı.
      if (ctx.placeholder) return "search";
      if (ctx.empty && !("name" in item && namesSomething(item as Item))) return "search";
      // An eSIM put in ("Kurdum"): nothing more to buy or attach.
      return item.installedAt ? "ready" : "planned";
    case "booked": {
      const end = lastDay(item as Item);
      if (ctx.today && end && end < ctx.today) return "used";
      return ctx.docs ? "ready" : "booked";
    }
    default:
      return "notNeeded";
  }
}

/** Of a part's alternatives (its options, the one chosen, the one booked), the furthest along. None left: Aranacak. */
export function bestOf(stages: Stage[]): Stage {
  const live = stages.filter((s) => s !== "cancelled" && s !== "notNeeded");
  if (!live.length) return "search";
  if (live.includes("used")) return "used";
  return live.reduce((a, b) => (RANK[b as MainStage] > RANK[a as MainStage] ? b : a));
}

/**
 * A need made of parts (a stay's night blocks, one ticket per person): it stands where its furthest-behind part
 * stands (Emre's ticket booked, Sabine's only chosen: Planlandı). A part that's over (used) doesn't hold it back;
 * every part over: used. No parts: Aranacak.
 */
export function needStage(parts: Stage[]): Stage {
  const live = parts.filter((s) => s !== "notNeeded");
  if (!live.length) return "search";
  // A part cancelled is a part to find again.
  const open = live.map((s) => (s === "cancelled" ? "search" : s));
  const ahead = open.filter((s) => s !== "used") as MainStage[];
  if (!ahead.length) return "used";
  return ahead.reduce((a, b) => (RANK[b] < RANK[a] ? b : a));
}

/**
 * A need's stage from its records: each person's records are a part (records for no one in particular are
 * everyone's alternatives), each part as far as its best record, the need as far as its furthest-behind part.
 */
export function needStageOf(items: Pick<Item, "id" | "status" | "dates" | "flight" | "installedAt" | "cancelledAt" | "forWho">[], ctxOf: (item: Item) => StageCtx = () => ({})): Stage {
  if (!items.length) return "search";
  const stage = (i: (typeof items)[number]) => stageOf(i, ctxOf(i as Item));
  const owners = [...new Set(items.flatMap((i) => i.forWho ?? []))];
  if (owners.length < 2) return needStage([bestOf(items.map(stage))]);
  const everyone = items.filter((i) => !i.forWho?.length);
  return needStage(owners.map((who) => bestOf([...items.filter((i) => i.forWho?.includes(who)), ...everyone].map(stage))));
}

/** What can be done at a stage (the card's buttons and its ••• menu read this). */
export type StageAction = "search" | "paste" | "notNeeded" | "compare" | "pick" | "book" | "change" | "cancel" | "addDoc" | "openDoc" | "restore" | "refundNote";
export function actionsFor(stage: Stage): StageAction[] {
  switch (stage) {
    case "search":
      return ["search", "paste", "notNeeded"];
    case "options":
      return ["compare", "pick", "search"];
    case "planned":
      return ["book", "change"];
    case "booked":
      return ["addDoc", "cancel", "change"];
    case "ready":
      return ["openDoc", "cancel"];
    case "cancelled":
      return ["refundNote", "search"];
    case "notNeeded":
      return ["restore"];
    case "used":
      return ["openDoc"];
  }
}

/**
 * How a delete goes at a stage: at once with Geri al, or only after asking (a booking made, a file on it). The
 * question names the other people on a shared trip.
 */
export function deleteLevel(stage: Stage, opts: { shared?: boolean } = {}): { level: "undo" | "confirm"; text: string | null } {
  const others = opts.shared ? L(" Paylaşılan gezide diğer kişiler de etkilenir.", " On a shared trip it affects the others too.") : "";
  if (stage === "booked")
    return { level: "confirm", text: L("Bu rezervasyon onaylı. İptal ettiysen 'İptal ettim' de.", "This booking is confirmed. If you cancelled it, say 'I cancelled it'.") + others };
  if (stage === "ready" || stage === "used")
    return { level: "confirm", text: L("Belgesiyle birlikte çöpe gider (geri alınabilir).", "It goes to the trash with its files (it can be brought back).") + others };
  return { level: "undo", text: null };
}

/**
 * A stage in words: "Aranacak", "Seçenekler (3)", "Planlandı · bilet alınmadı" / "Planlandı · rezerve edilmedi",
 * "Rezerve edildi", "Hazır", "İptal edildi", "Gerek yok", "Kullanıldı". `ticket`: a ticket is bought for it
 * (a flight, a train, a tour); `options`: how many are saved.
 */
export function stageLabel(stage: Stage, opts: { ticket?: boolean; options?: number } = {}): string {
  switch (stage) {
    case "search":
      return L("Aranacak", "To find");
    case "options":
      return opts.options ? L(`Seçenekler (${opts.options})`, `Options (${opts.options})`) : L("Seçenekler", "Options");
    case "planned":
      return opts.ticket ? L("Planlandı · bilet alınmadı", "Planned · no ticket yet") : L("Planlandı · rezerve edilmedi", "Planned · not booked");
    case "booked":
      return L("Rezerve edildi", "Booked");
    case "ready":
      return L("Hazır", "Ready");
    case "cancelled":
      return L("İptal edildi", "Cancelled");
    case "notNeeded":
      return L("Gerek yok", "Not needed");
    case "used":
      return L("Kullanıldı", "Used");
  }
}

/** How many needs stand at each stage. */
export type StageCounts = Record<Stage, number>;
export const noCounts = (): StageCounts => ({ search: 0, options: 0, planned: 0, booked: 0, ready: 0, cancelled: 0, notNeeded: 0, used: 0 });
export function countStages(stages: (Stage | null | undefined)[]): StageCounts {
  const out = noCounts();
  for (const s of stages) if (s) out[s]++;
  return out;
}

/**
 * The hero's numbers (spec: "Planlananların %X'i rezerve · N ihtiyaç karar bekliyor"). The percentage is over
 * what's in the plan only (Planlandı + Rezerve edildi + Hazır); what waits for a decision (Aranacak + Seçenekler)
 * is a count beside it, never in it. Nothing in the plan: no percentage (null).
 */
export function heroNumbers(c: StageCounts): { done: number; planned: number; inPlan: number; open: number; pct: number | null } {
  const done = c.booked + c.ready;
  const inPlan = c.planned + done;
  return { done, planned: c.planned, inPlan, open: c.search + c.options, pct: inPlan ? Math.round((done / inPlan) * 100) : null };
}

/** Turkish "%67'si", "%30'u", "%100'ü": the number's suffix as it's read aloud. */
export function percentPossessive(n: number): string {
  const units = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"]; // sıfır bir iki üç dört beş altı yedi sekiz dokuz
  const tens = ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"]; // on yirmi otuz kırk elli altmış yetmiş seksen doksan
  const whole = Math.round(Math.abs(n));
  // yüz is read last in 100; else the units; else the tens.
  const end = whole === 0 ? "ı" : whole % 100 === 0 ? "ü" : whole % 10 ? units[whole % 10] : tens[Math.floor(whole / 10) % 10];
  return `%${whole}'${end}`;
}

/** "Planlananların %67'si rezerve" / "67% of what's planned is booked". */
export const plannedBookedText = (pct: number): string => L(`Planlananların ${percentPossessive(pct)} rezerve`, `${pct}% of what's planned is booked`);
/** "3 ihtiyaç karar bekliyor" / "3 needs to decide". */
export const openNeedsText = (n: number): string => L(`${n} ihtiyaç karar bekliyor`, `${n} ${n === 1 ? "need" : "needs"} to decide`);
