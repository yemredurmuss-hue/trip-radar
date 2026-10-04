// Where today is against the trip's dates, for the label under the hero photo.
import { L } from "./i18n";
import { nightsBetween } from "./items";

export type Countdown = { kind: "before"; days: number } | { kind: "during"; day: number; total: number } | { kind: "after" };

export function countdown(range: { start: string; end: string } | null, today: string): Countdown | null {
  if (!range) return null;
  if (today < range.start) return { kind: "before", days: nightsBetween(today, range.start) };
  if (today > range.end) return { kind: "after" };
  return { kind: "during", day: nightsBetween(range.start, today) + 1, total: nightsBetween(range.start, range.end) + 1 };
}

export function countdownText(c: Countdown | null): string | null {
  if (!c) return null;
  if (c.kind === "after") return L("Bitti", "Over");
  if (c.kind === "during") return L(`${c.day}. gün / ${c.total}`, `Day ${c.day} of ${c.total}`);
  if (c.days === 1) return L("Yarın", "Tomorrow");
  return L(`${c.days} gün kaldı`, `${c.days} days to go`);
}
