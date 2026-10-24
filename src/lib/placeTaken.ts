// A stay chosen or booked takes the place the plan only made room for (the start's placeholder, a stay said in the chat
// with nothing concrete on it): set aside, one "Geri getir" from coming back, never a second card beside it. Used when
// the traveller presses Seç (actions.chooseItem) and when a saved page or a booking lands (process.ts).
import { bareChatPlan } from "./emptyCards";
import { nightsBetween } from "./items";
import { isPlaceholder } from "./placeholders";
import { sameCity, stayRange } from "./plan";
import type { Item, Trip } from "./types";

/** The nights a dateless plan says it is for ("Porto Konaklama (4 Gece)", "4 nights"); null when it says none. */
export function saidNights(item: Pick<Item, "name" | "summary" | "optionDetail">): number | null {
  const m = [item.name, item.summary, item.optionDetail].join(" ").match(/(\d{1,2})\s*(?:gece|night)/iu);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 ? n : null;
}

/**
 * The places a stay chosen now takes (0.38.6, Emre: "seçince omurga değişsin"), in the same city:
 * - one with dates: most of its nights. A choice for all of them closes it on the plan already (plan.ts); one for most
 *   leaves it standing with a night or two beside it, a second card, so it is set aside too. The nights left stay to find.
 * - one with no dates, only its nights said (2026-10-24, Emre: "Porto konaklama 4 gün demiştim sonra rezervasyonu attım,
 *   yine yeni ekledi; aynı şehir aynı gün sayısı çok belli o kart olduğu"): as many nights; with no nights said, any.
 */
export function stayPlaceholdersTaken(choice: Item, items: readonly Item[], trip: Pick<Trip, "startGuide">): Item[] {
  const own = choice.category === "stay" && choice.origin !== "chat" ? stayRange(choice) : null;
  if (!own) return [];
  return items.filter((i) => {
    if (i.id === choice.id || i.category !== "stay" || i.status === "dismissed" || !(isPlaceholder(trip, i) || bareChatPlan(i))) return false;
    if (!sameCity(i.city, choice.city)) return false;
    const r = stayRange(i);
    if (!r) {
      if (i.dates.start || i.dates.end) return false; // (half a date: not a plan to guess at)
      const said = saidNights(i);
      return said == null || said === nightsBetween(own.start, own.end);
    }
    if (own.start <= r.start && own.end >= r.end) return false;
    const start = own.start > r.start ? own.start : r.start;
    const end = own.end < r.end ? own.end : r.end;
    return start < end && nightsBetween(start, end) * 2 > nightsBetween(r.start, r.end);
  });
}
