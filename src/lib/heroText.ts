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

/** One clause for what's most pressing: decisions and bookings first; the other to-dos only when there are none. */
export function statusSentence(count: Record<Exclude<TodoKind, "doc">, number>, ctx: { flightsDone: boolean; waitingCity: string | null }): string {
  const { decide, book } = count;
  const other = count.plan + count.deadline;
  if (decide + book + other === 0) return L("Her şey hazır.", "Everything's set.");
  const decisions = L(`${decide} karar`, `${decide} decision${decide === 1 ? "" : "s"}`);
  const bookings = L(`${book} rezervasyon`, `${book} booking${book === 1 ? "" : "s"}`);
  let waiting: string;
  if (decide > 0 && book > 0) waiting = L(`${decisions} ve ${bookings} bekliyor`, `${decisions} and ${bookings} waiting`);
  else if (decide === 1 && ctx.waitingCity) waiting = L(`${locative(ctx.waitingCity)} bir karar bekliyor`, `one decision waits in ${ctx.waitingCity}`);
  else if (decide > 0) waiting = L(`${decisions} bekliyor`, `${decisions} waiting`);
  else if (book > 0) waiting = L(`${bookings} bekliyor`, `${bookings} waiting`);
  else waiting = L(`${other} iş bekliyor`, `${other} thing${other === 1 ? "" : "s"} waiting`);
  return `${capitalize([ctx.flightsDone ? L("Uçuşlar hazır", "Flights are set") : null, waiting].filter(Boolean).join(", "))}.`;
}
