// The hero's "Sıradaki" (F4, C30): the one next thing, which updates itself as decisions are made (no toast). A visa to
// get comes first; then our pick waiting to be taken (Önerimiz), then a decision with options, then a need with none
// yet. C30's other faces: with nothing saved "İlk kaydı ekle"; with every need on the plan the plan as a PDF; with every
// need bought (or sorted) sharing, or simply "all set" when the trip can't be shared. On the trip and after it there is
// no visa to get and nothing left to decide (D8, row 127): the PDF, or sharing. Pure.
import { L } from "./i18n";
import { locative } from "./i18nText";
import type { CardKind } from "./cardKinds";
import type { IntentStatus, IntentVM } from "./intents";
import type { TripMode } from "./tripPhase";

export type NextIntent = Pick<IntentVM, "key" | "section" | "kind" | "status" | "frame" | "domKeys"> & { head: Pick<IntentVM["head"], "name" | "route"> };

export type NextStep =
  | { kind: "first" }
  | { kind: "visa" }
  | { kind: "intent"; intent: NextIntent }
  | { kind: "pdf" }
  | { kind: "share" }
  | { kind: "ready" };

/** The order a need waiting for a decision is taken in (F4). */
const ORDER: readonly IntentStatus[] = ["suggested", "deciding", "searching"];
/** Bought, or nothing to buy: what "hepsi alındı" counts (a need said not needed is no need). */
const SETTLED: readonly IntentStatus[] = ["booked", "arranged", "included", "skipped"];

export function nextStep({ intents, saved, visa, sharable, mode = "plan" }: {
  intents: readonly NextIntent[];
  /** Anything saved on the trip at all (else "İlk kaydı ekle"). */
  saved: boolean;
  /** A visa is needed and not marked as got. */
  visa: boolean;
  sharable: boolean;
  /** Planning it, on it, back from it (tripPhase.tripModeOf): only while planning is there a visa or a decision to go to. */
  mode?: TripMode;
}): NextStep {
  if (!saved && !intents.length) return { kind: "first" };
  if (mode === "plan") {
    if (visa) return { kind: "visa" };
    for (const status of ORDER) {
      const hit = intents.find((i) => i.status === status);
      if (hit) return { kind: "intent", intent: hit };
    }
  }
  if (!saved) return { kind: "first" };
  // C30: every need bought or sorted: sharing (or all set); else every need is on the plan (nothing left to decide): the PDF.
  if (intents.every((i) => SETTLED.includes(i.status))) return sharable ? { kind: "share" } : { kind: "ready" };
  return { kind: "pdf" };
}

/** C24: the thin bar says "✓ Her şey hazır" once every need is bought, where the hero offers sharing. */
export const allSet = (step: NextStep): boolean => step.kind === "share" || step.kind === "ready";

/** A need's own word after its name ("Porto konaklaması", "İstanbul → Porto uçuşu"). */
const WORD: Partial<Record<CardKind, [string, string]>> = {
  stay: ["konaklaması", "stay"],
  flight: ["uçuşu", "flight"],
  train: ["treni", "train"],
  bus: ["otobüsü", "bus"],
  minibus: ["minibüsü", "minibus"],
  ferry: ["vapuru", "ferry"],
  taxi: ["transferi", "transfer"],
  car: ["araç kiralaması", "car rental"],
  moto: ["motosiklet kiralaması", "motorbike rental"],
  rv: ["karavanı", "camper van"],
  bike: ["bisikleti", "bike"],
  transport: ["yolculuğu", "journey"],
};

/** What the next need is, in a few words: "Porto konaklaması", "İstanbul → Porto uçuşu", "Lizbon'da etkinlikler". */
export function intentLabel(intent: NextIntent): string {
  const name = intent.head.name.trim();
  if (intent.frame === "collection")
    return intent.section === "activity" ? L(`${locative(name)} etkinlikler`, `Activities in ${name}`) : L(`${locative(name)} yapılacaklar`, `Things to do in ${name}`);
  // A stay is named by its city; a ticket by its two ends ("İstanbul → Porto"); anything else by its own name.
  const word = intent.section === "stay" || intent.head.route || name.includes("→") ? WORD[intent.kind] : undefined;
  return word ? L(`${name} ${word[0]}`, `${name} ${word[1]}`) : name;
}

/** The button's words: "Sıradaki: Porto konaklaması", "İlk kaydı ekle", "Planı PDF indir", "Paylaş", "Her şey hazır". */
export function nextLabel(step: NextStep): string {
  switch (step.kind) {
    case "first":
      return L("İlk kaydı ekle", "Add the first one");
    case "visa":
      return L("Sıradaki: vize randevusu", "Next: visa appointment");
    case "intent":
      return L(`Sıradaki: ${intentLabel(step.intent)}`, `Next: ${intentLabel(step.intent)}`);
    case "pdf":
      return L("Planı PDF indir", "Download the plan as PDF");
    case "share":
      return L("Paylaş", "Share");
    case "ready":
      return L("Her şey hazır", "All set");
  }
}

/** The thin bar's shorter form: "Sıradaki Porto konaklaması" (no colon), the others as they are. */
export function nextShort(step: NextStep): string {
  if (step.kind === "visa") return L("Sıradaki vize randevusu", "Next: visa");
  if (step.kind === "intent") return L(`Sıradaki ${intentLabel(step.intent)}`, `Next: ${intentLabel(step.intent)}`);
  return nextLabel(step);
}
