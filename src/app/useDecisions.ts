import { useEffect, useState } from "react";
import { loadDecisions, needsAnalysis, type TripDecisions } from "../lib/analysis";
import { requestAnalysis } from "../lib/browser";
import { advantageOver, type GroupDecision } from "../lib/decision";
import type { Tone } from "../lib/items";
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
  if (option.excluded) return { text: "Farklı tarih", tone: "warning", score: null, best: false };
  if (option.score == null) {
    const missing = option.missing.slice(0, 2).join(", ");
    return { text: `Puan yok${missing ? ` · eksik: ${missing}` : ""}`, tone: "warning", score: null, best: false };
  }
  // The reasons sit right under the row (pros and cons), so the label stays short.
  if (option.eliminated) return { text: "Elendi", tone: "warning", score: option.score, best: false };
  if (option.unmet.length) return { text: "Şartına uymuyor", tone: "warning", score: option.score, best: false };
  const topTwo = decision.options.slice(0, 2).map((o) => o.item.id);
  if (decision.status === "tie" && topTwo.includes(item.id)) return { text: "Başa baş", tone: "accent", score: option.score, best: true };
  if (decision.winner?.item.id === item.id) {
    const why = decision.reasons[0]?.label.toLowerCase();
    return { text: why ? `En uygun · ${why}` : "En uygun", tone: "accent", score: option.score, best: true };
  }
  if (option.limited.length) {
    return { text: `Geçici puan · ${option.limited.join(", ")} eksik`, tone: "warning", score: option.score, best: false };
  }
  if (option.dominatedBy) return { text: "Elenebilir", tone: "warning", score: option.score, best: false };
  const advantage = decision.winner ? advantageOver(option, decision.winner, currency) : null;
  return { text: advantage ?? item.summary, tone: "muted", score: option.score, best: false };
}
