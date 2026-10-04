// The hero's paragraph: an AI-written mood sentence (no numbers, cached per set of cities) followed
// by a sentence the code builds from the to-do counts. Facts never come from the model.
import { L } from "./i18n";
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
      ? L(`${ctx.waitingCity}'da bir karar bekliyor`, `one decision waits in ${ctx.waitingCity}`)
      : L(`${count.decide} karar bekliyor`, `${count.decide} decision${count.decide === 1 ? "" : "s"} waiting`));
  } else if (count.book > 0) {
    parts.push(L(`${count.book} rezervasyon bekliyor`, `${count.book} booking${count.book === 1 ? "" : "s"} waiting`));
  }
  if (!parts.length || (parts.length === 1 && ctx.flightsDone && !count.decide && !count.book)) return L("Her şey hazır.", "Everything's set.");
  const s = parts.join(", ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}
