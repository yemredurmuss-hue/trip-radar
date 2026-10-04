// The hero's paragraph: an AI-written mood sentence (no numbers, cached per set of cities) followed
// by a sentence the code builds from the to-do counts. Facts never come from the model.
import { L } from "./i18n";
import { capitalize, locative } from "./i18nText";
import type { TodoKind } from "./progress";

export const MOOD_MAX = 120;

export function acceptMood(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= MOOD_MAX && !/\d/.test(t);
}

export const moodKey = (cities: string[]) => cities.map((c) => c.trim().toLowerCase()).join("|");

export function statusSentence(count: Record<TodoKind, number>, ctx: { flightsDone: boolean; waitingCity: string | null }): string {
  const parts: string[] = [];
  if (ctx.flightsDone) parts.push(L("Uçuşlar hazır", "Flights are set"));
  if (count.decide > 0) {
    parts.push(ctx.waitingCity && count.decide === 1
      ? L(`${locative(ctx.waitingCity)} bir karar bekliyor`, `one decision waits in ${ctx.waitingCity}`)
      : L(`${count.decide} karar bekliyor`, `${count.decide} decision${count.decide === 1 ? "" : "s"} waiting`));
  }
  if (count.book > 0) {
    parts.push(L(`${count.book} rezervasyon bekliyor`, `${count.book} booking${count.book === 1 ? "" : "s"} waiting`));
  }
  const other = count.plan + count.deadline;
  if (other > 0) parts.push(L(`${other} iş bekliyor`, `${other} thing${other === 1 ? "" : "s"} waiting`));
  if (count.decide + count.book + other === 0) return L("Her şey hazır.", "Everything's set.");
  return `${capitalize(parts.join(", "))}.`;
}
