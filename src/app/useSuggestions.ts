// The board's suggestions (lib/suggestions.ts): the rules' worked out on every render, with the AI's and the chat's
// stored on the trip; "Plana ekle" and "Gerek yok" with the board's "Geri al"; the AI review asked when it's due.
import { useEffect, useMemo, useRef } from "react";
import { sectionOfItem, type SectionId } from "../lib/categories";
import type { MainPlace } from "../lib/destinations";
import type { HiddenInput } from "../lib/history";
import type { Leg } from "../lib/legs";
import { newId } from "../lib/db";
import { cityKeyOf, type Plan } from "../lib/plan";
import { reviewDue, reviewKey, reviewPrompt, runReview } from "../lib/suggestReview";
import { bySection, ruleSuggestions, shownSuggestions } from "../lib/suggestions";
import type { Timeline } from "../lib/timeline";
import type { Item, Suggestion, Trip } from "../lib/types";
import type { Undoable } from "../lib/undoables";
import { addSuggested, dismissSuggestion, updateTrip } from "./actions";

export interface BoardSuggestions {
  bySection: Partial<Record<SectionId, Suggestion[]>>;
  /** Said not needed, for Geçmiş's "Geri getir". */
  dismissed: HiddenInput[];
  add: (s: Suggestion) => void;
  dismiss: (s: Suggestion) => void;
}

export function useSuggestions(args: {
  trip: Trip;
  plan: Plan;
  items: Item[];
  timeline: Timeline;
  legs: Leg[];
  mains: MainPlace[];
  /** The traveller's passport country. */
  home: string;
  today: string;
  /** The main places are settled (the model answered, or couldn't): the review waits for them. */
  ready: boolean;
  offer: (u: Undoable) => void;
  /** Keeps the arrival toast quiet for a record that has its own "eklendi · Geri al" (arrive/useArrivals). */
  quiet: (itemId: string) => void;
  /** The record "Plana ekle" made, for the board to open its section and show it. */
  onAdded: (item: Item) => void;
}): BoardSuggestions {
  const { trip, plan, items, timeline, legs, mains, home, today, ready, offer, quiet, onAdded } = args;
  const rules = useMemo(
    () => ruleSuggestions({ trip, plan, items, timeline, legs, mains, home, today }),
    [trip, plan, items, timeline, legs, mains, home, today],
  );
  const shown = useMemo(() => shownSuggestions(trip.suggestions, rules), [trip.suggestions, rules]);
  const sections = useMemo(() => bySection(shown), [shown]);
  const dismissed = useMemo<HiddenInput[]>(
    () => (trip.suggestions ?? []).filter((s) => s.state === "dismissed").map((s) => ({ kind: "suggestion", key: s.key, label: s.title, at: s.stateAt ?? null })),
    [trip.suggestions],
  );
  // A double tap doesn't add the record twice.
  const busy = useRef(new Set<string>());
  const act = (s: Suggestion, work: () => Promise<void>) => {
    const id = `${trip.id}:${s.key}`;
    if (busy.current.has(id)) return;
    busy.current.add(id);
    void work()
      .catch((error) => console.warn("suggestion", error))
      .finally(() => busy.current.delete(id));
  };
  const add = (s: Suggestion) =>
    act(s, async () => {
      const id = newId();
      quiet(id);
      const u = await addSuggested(trip.id, s, id);
      if (!u) return;
      offer(u);
      if (u.kind === "suggestion" && u.item) onAdded(u.item);
    });
  const dismiss = (s: Suggestion) => act(s, async () => offer(await dismissSuggestion(trip.id, s)));

  // The AI review: once the trip has places and dates, then after a big change, at most once a day.
  const range = plan.range ?? trip.confirmedDates ?? null;
  const key = reviewKey(mains, range, items);
  const due = ready && !trip.demo && mains.length > 0 && !!range && range.end >= today && reviewDue(trip.suggestReview, key, Date.now());
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const at = `${trip.id}:${key}`;
    if (!due || asked.current.has(at)) return;
    asked.current.add(at);
    const nights: Record<string, number> = {};
    for (const m of mains) {
      const keys = new Set([m.name, ...m.members].map(cityKeyOf));
      nights[cityKeyOf(m.name) ?? m.name] = plan.stayBlocks.filter((b) => b.city && keys.has(cityKeyOf(b.city))).reduce((n, b) => n + b.nights, 0);
    }
    const prompt = reviewPrompt({ mains, nights, range, items, sectionOf: sectionOfItem, suggestions: trip.suggestions ?? [] });
    void runReview({ key, prompt, save: (change) => updateTrip(trip.id, change, { touch: false }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once per trip state (key)
  }, [trip.id, key, due]);

  return { bySection: sections, dismissed, add, dismiss };
}
