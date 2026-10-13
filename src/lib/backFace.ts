// The back of a card (plan v46 F4): what a need's options are split into. "Kaydettikleriniz" is every option anyone but
// the AI saved (you, the extension, a Pano link), "Önerimiz" what the AI found; each shows three at most and says how
// many more wait on the Pano. The one on the plan, or on the card as the draft, is always among those shown. "Yeni" is a record saved in the last two
// days that this device hasn't seen on a back yet (the seen ids are kept in localStorage, never in the trip's data). Pure,
// except for the two seen-id helpers at the foot.
import { isAiOption } from "./pano";
import type { Item } from "./types";

export const BACK_CAP = 3;
export const FRESH_MS = 48 * 3_600_000;

/** An option on the plan (chosen or booked). */
export const onPlan = (item: Item): boolean => item.status === "chosen" || item.status === "booked";

export interface BackSplit {
  /** What the travellers saved (extension, Pano link, typed), at most `cap`. */
  mine: Item[];
  /** What the AI found, at most `cap`. */
  ai: Item[];
  /** How many of each there are in all (the section's count). */
  mineTotal: number;
  aiTotal: number;
  /** How many options are left out of the two sections ("Pano'da aç · +N"). */
  more: number;
}

/** The first `cap` of a list, the one on the plan (or on the card as the draft) kept in: it takes the last place when it would fall outside. */
function shownOf(list: Item[], cap: number, drafted?: string): Item[] {
  const head = list.slice(0, cap);
  const chosen = list.find(onPlan) ?? list.find((i) => i.id === drafted);
  if (chosen && !head.includes(chosen)) head[cap - 1] = chosen;
  return head;
}

/** The options (best first) as the back's two sections; `drafted` is the id of the one the card shows as "Önerimiz". */
export function splitBack(items: Item[], drafted?: string, cap = BACK_CAP): BackSplit {
  const mine = items.filter((i) => !isAiOption(i));
  const ai = items.filter(isAiOption);
  const shownMine = shownOf(mine, cap, drafted);
  const shownAi = shownOf(ai, cap, drafted);
  return { mine: shownMine, ai: shownAi, mineTotal: mine.length, aiTotal: ai.length, more: mine.length - shownMine.length + (ai.length - shownAi.length) };
}

/** "Yeni": saved within the last 48 hours, not yet seen on a back here, and not already the one on the plan. */
export const isFresh = (item: Item, seen: ReadonlySet<string>, now: number): boolean =>
  !onPlan(item) && !seen.has(item.id) && now - item.createdAt >= 0 && now - item.createdAt <= FRESH_MS;

export type BackTag = "selected" | "onCard" | "new";

/**
 * The word on a card's corner: "Seçili" when it is the one on the plan, "Kartta" when it is the one the card shows as
 * "Önerimiz" (a draft, not chosen), "Yeni" when fresh, else none.
 */
export const tagOf = (item: Item, fresh: boolean, drafted = false): BackTag | null => (onPlan(item) ? "selected" : drafted ? "onCard" : fresh ? "new" : null);

// --- seen ids (this device only) ----------------------------------------------------------------------------------

const seenKey = (tripId: string) => `trip-radar:seen:${tripId}`;

export function loadSeen(tripId: string): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(seenKey(tripId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Marks these records as seen (kept to the newest 200 so the key never grows without end). */
export function markSeen(tripId: string, ids: string[]): void {
  try {
    const all = [...loadSeen(tripId), ...ids.filter((id) => id)];
    globalThis.localStorage?.setItem(seenKey(tripId), JSON.stringify([...new Set(all)].slice(-200)));
  } catch {
    /* private window or blocked storage: "Yeni" simply shows again */
  }
}
