import { useEffect, useState } from "react";
import { loadDecisions, needsAnalysis, type TripDecisions } from "../lib/analysis";
import type { GroupDecision } from "../lib/decision";
import { requestAnalysis } from "../lib/browser";
import type { Item, Trip } from "../lib/types";

export interface Decisions extends TripDecisions {
  /** Decisions by group key (see plan.groupKeyOf). */
  byGroup: Map<string, GroupDecision>;
}

/** The decision engine's result for the trip on screen, recomputed whenever the board data changes. */
export function useDecisions(trip: Trip | null, items: Item[]): Decisions | null {
  const [state, setState] = useState<Decisions | null>(null);

  useEffect(() => {
    if (!trip) {
      setState(null);
      return;
    }
    let alive = true;
    loadDecisions(trip, items)
      .then((result) => alive && setState({ ...result, byGroup: result.decisions }))
      .catch((error) => console.error("decision engine", error));
    return () => {
      alive = false;
    };
  }, [trip, items]);

  // Groups whose AI review doesn't match the current inputs: ask the worker once things settle
  // (clicking through priorities shouldn't start a model call per click).
  const stale = state
    ? [...state.byGroup.values()]
        .filter((d) => needsAnalysis(d))
        .map((d) => d.inputHash)
        .join(",")
    : "";
  useEffect(() => {
    if (!stale) return;
    const timer = setTimeout(() => requestAnalysis(), 2500);
    return () => clearTimeout(timer);
  }, [stale]);

  return state;
}

export { decisionLabel, type DecisionLabel } from "../lib/labels";
