// The v82 Plan's categories open one at a time (B8, E1; plan v82 "akordiyon"): opening one closes the others, the choice is
// kept per trip on this computer (sectionMeta.useSectionOpen), and the one just opened comes up to the top of the view in a
// single move, unless its head is already near the top. Pure: the state and the decisions, no DOM.
import type { OpenState, SectionId } from "./categories";

/** Opening a category closes every other; closing one leaves the rest as they are (all closed but what was open). */
export function withOpen(state: OpenState, id: SectionId, open: boolean, all: readonly SectionId[]): OpenState {
  if (!open) return { ...state, [id]: false };
  return Object.fromEntries([...new Set([...all, ...(Object.keys(state) as SectionId[]), id])].map((k) => [k, k === id])) as OpenState;
}

/**
 * The one open category on screen: the traveller's own choice, remembered (the last one opened); nothing remembered, all
 * closed (F §4: "Plan ilk açıldığında hepsi kapalı").
 */
export function openOne(state: OpenState, order: readonly SectionId[]): SectionId | null {
  return order.find((id) => state[id] === true) ?? null;
}

/** E1: the head is already in the top quarter of the view (below what's pinned over it): it stays where it is. */
export function staysPut(headTop: number, view: { top: number; height: number }, pinned = 0): boolean {
  const from = view.top + pinned;
  return headTop >= from - 2 && headTop <= from + view.height / 4;
}

/** The scroll that brings the head to the top of the view, under what's pinned there; 0 when it stays. */
export function scrollBy(headTop: number, view: { top: number; height: number }, pinned = 0): number {
  return staysPut(headTop, view, pinned) ? 0 : Math.round(headTop - (view.top + pinned));
}

/** The e-move curve (the motion tokens' --e-move, .65,0,.35,1) at t in [0, 1], for the one scroll E1 makes by hand. */
export function eMove(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
