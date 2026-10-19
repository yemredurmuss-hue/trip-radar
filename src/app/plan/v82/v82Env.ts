// What the v82 intent boxes need from the Plan beyond each box's view model (CategoryPlan provides it): the trip's records by
// id (a need's every option, for "Seç" and "Gerek yok"), the suggestions' "Plana koy" and "Gerek yok", where "Kendin ara"
// searches, and the way to open a category and go to an intent (F5, "Sıradaki").
import { createContext, useContext } from "react";
import type { SectionId } from "../../../lib/categories";
import type { SelfSearchAt } from "../../../lib/intentFrame";
import type { Item, Suggestion } from "../../../lib/types";

export interface V82Env {
  byId: ReadonlyMap<string, Item>;
  /** The board's suggestions (useSuggestions): a suggested eSIM's or policy's "Plana koy" and "Gerek yok". */
  addSuggestion: ((s: Suggestion) => void) | null;
  dismissSuggestion: ((s: Suggestion) => void) | null;
  selfAt: SelfSearchAt;
  /** Opens a category (closing the others) and brings one of its intents into view with a flash. */
  goTo: (section: SectionId, intentKey: string | null) => void;
}

export const V82EnvContext = createContext<V82Env | null>(null);

export function useV82Env(): V82Env {
  const env = useContext(V82EnvContext);
  if (!env) throw new Error("The v82 intent boxes need V82EnvContext (CategoryPlan provides it).");
  return env;
}

/** An intent box on screen, by its need's key (its element says it in `data-intent`). */
export const intentEl = (key: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-intent="${CSS.escape(key)}"]`);
