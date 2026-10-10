// What an option's row or card says about its place in the comparison. Pure.
import { advantageOver, type GroupDecision } from "./decision";
import type { Tone } from "./items";
import { L } from "./i18n";
import { lowerText } from "./i18nText";
import type { Item } from "./types";

export interface DecisionLabel {
  text: string;
  tone: Tone;
  score: number | null;
  best: boolean;
}

/** What the row of an option says about its place in the comparison; null when there's nothing to compare. */
export function decisionLabel(item: Item, decision: GroupDecision | undefined, currency: string): DecisionLabel | null {
  if (!decision || decision.status === "single") return null;
  const option = decision.options.find((o) => o.item.id === item.id);
  if (!option) return null;
  if (option.excluded) return { text: L("Farklı tarih", "Different dates"), tone: "warning", score: null, best: false };
  if (option.score == null) {
    const missing = option.missing.slice(0, 2).join(", ");
    return { text: L(`Puan yok${missing ? ` · eksik: ${missing}` : ""}`, `No score${missing ? ` · missing: ${missing}` : ""}`), tone: "warning", score: null, best: false };
  }
  // The reasons sit right under the row (pros and cons), so the label stays short.
  if (option.eliminated) return { text: L("Elendi", "Ruled out"), tone: "warning", score: option.score, best: false };
  if (option.unmet.length) return { text: L("Şartına uymuyor", "Doesn't meet your must-haves"), tone: "warning", score: option.score, best: false };
  const topTwo = decision.options.slice(0, 2).map((o) => o.item.id);
  if (decision.status === "tie" && topTwo.includes(item.id)) return { text: L("Başa baş", "Neck and neck"), tone: "accent", score: option.score, best: true };
  if (decision.winner?.item.id === item.id) {
    const reason = decision.reasons[0]?.label;
    const why = reason && lowerText(reason);
    return { text: why ? L(`En uygun · ${why}`, `Best fit · ${why}`) : L("En uygun", "Best fit"), tone: "accent", score: option.score, best: true };
  }
  if (option.limited.length) {
    return { text: L(`Geçici puan · ${option.limited.join(", ")} eksik`, `Provisional score · missing ${option.limited.join(", ")}`), tone: "warning", score: option.score, best: false };
  }
  if (option.dominatedBy) return { text: L("Elenebilir", "Could be dropped"), tone: "warning", score: option.score, best: false };
  const advantage = decision.winner ? advantageOver(option, decision.winner, currency) : null;
  return { text: advantage ?? item.summary, tone: "muted", score: option.score, best: false };
}
