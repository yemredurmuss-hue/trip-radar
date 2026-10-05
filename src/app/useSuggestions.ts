// The board's suggestions (lib/suggestions.ts): the rules' worked out on every render, with the AI's and the chat's
// stored on the trip; "Plana ekle" and "Gerek yok" with the board's "Geri al"; the AI review asked when it's due.
import { useEffect, useMemo, useRef, useState } from "react";
import { sectionOfItem, type SectionId } from "../lib/categories";
import type { MainPlace } from "../lib/destinations";
import type { HiddenInput } from "../lib/history";
import type { Leg } from "../lib/legs";
import { newId } from "../lib/db";
import { cityKeyOf, type Plan } from "../lib/plan";
import { reviewDue, reviewKey, reviewPrompt, runReview } from "../lib/suggestReview";
import { bySection, ruleSuggestions, shownSuggestions } from "../lib/suggestions";
import type { Timeline } from "../lib/timeline";
import type { InsertAt, TemplateId } from "../lib/templates";
import type { Item, Suggestion, Trip } from "../lib/types";
import type { Undoable } from "../lib/undoables";
import { addSuggested, dismissSuggestion, updateTrip } from "./actions";

export interface BoardSuggestions {
  bySection: Partial<Record<SectionId, Suggestion[]>>;
  /** Said not needed, for Geçmiş's "Geri getir". */
  dismissed: HiddenInput[];
  add: (s: Suggestion) => void;
  dismiss: (s: Suggestion) => void;
  /** Said under a card when its "Plana ekle" was refused, by key. */
  notes: Record<string, string>;
}

export function useSuggestions(args: {
  trip: Trip;
  plan: Plan;
  items: Item[];
  timeline: Timeline;
  legs: Leg[];
  mains: MainPlace[];
  /** The traveller's passport country as set in Settings; null while it's the default (nothing said about abroad). */
  home: string | null;
  /** "Plana ekle" on a suggestion the payload can't make whole: the template's add sheet, where it belongs. */
  openSheet: (s: Suggestion, template: TemplateId, at: InsertAt) => void;
  today: string;
  /** The main places are settled (the model answered, or couldn't): the review waits for them. */
  ready: boolean;
  offer: (u: Undoable) => void;
  /** Keeps the arrival toast quiet for a record that has its own "eklendi · Geri al" (arrive/useArrivals). */
  quiet: (itemId: string) => void;
  /** The record "Plana ekle" made, for the board to open its section and show it. */
  onAdded: (item: Item) => void;
  /** How many go, as the hero counts them (tripSettings.whoGoes); null when nothing says. Told to the AI review only. */
  travellers?: number | null;
}): BoardSuggestions {
  const { trip, plan, items, timeline, legs, mains, home, today, ready, offer, quiet, onAdded, openSheet, travellers = null } = args;
  const rules = useMemo(
    () => ruleSuggestions({ trip, plan, items, timeline, legs, mains, home, today }),
    [trip, plan, items, timeline, legs, mains, home, today],
  );
  const shown = useMemo(() => shownSuggestions(trip.suggestions, rules, items), [trip.suggestions, rules, items]);
  const sections = useMemo(() => bySection(shown), [shown]);
  const dismissed = useMemo<HiddenInput[]>(
    () => (trip.suggestions ?? []).filter((s) => s.state === "dismissed").map((s) => ({ kind: "suggestion", key: s.key, label: s.title, at: s.stateAt ?? null })),
    [trip.suggestions],
  );
  // A double tap doesn't add the record twice: a key is busy while it's being written, and stays busy once it's done
  // until the trip says it's open again (Geri al, Geri getir).
  const busy = useRef(new Set<string>());
  const done = useRef(new Set<string>());
  useEffect(() => {
    const state = new Map((trip.suggestions ?? []).map((s) => [`${trip.id}:${s.key}`, s.state]));
    for (const id of done.current) if (!id.startsWith(`${trip.id}:`) || (state.get(id) ?? "open") === "open") done.current.delete(id);
  }, [trip.id, trip.suggestions]);
  // What a card says under itself when "Plana ekle" was refused (a vehicle already covers those days).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = (s: Suggestion, work: () => Promise<boolean>) => {
    const id = `${trip.id}:${s.key}`;
    if (busy.current.has(id) || done.current.has(id)) return;
    busy.current.add(id);
    void work()
      .then((ok) => ok && done.current.add(id))
      .catch((error) => console.warn("suggestion", error))
      .finally(() => busy.current.delete(id));
  };
  const add = (s: Suggestion) =>
    act(s, async () => {
      const id = newId();
      quiet(id);
      const out = await addSuggested(trip.id, s, id);
      if (!out) return false;
      if (out.kind === "refused") {
        setNotes((n) => ({ ...n, [s.key]: out.text }));
        return false;
      }
      if (out.kind === "sheet") {
        openSheet(s, out.template, out.at);
        return false;
      }
      if (out.kind === "added") {
        offer(out.undo);
        if (out.undo.kind === "suggestion" && out.undo.item) onAdded(out.undo.item);
      }
      return true;
    });
  const dismiss = (s: Suggestion) =>
    act(s, async () => {
      offer(await dismissSuggestion(trip.id, s));
      return true;
    });

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
    const prompt = reviewPrompt({ mains, nights, range, items, sectionOf: sectionOfItem, suggestions: trip.suggestions ?? [], travellers });
    void runReview({ key, prompt, save: (change) => updateTrip(trip.id, change, { touch: false }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once per trip state (key)
  }, [trip.id, key, due]);

  return { bySection: sections, dismissed, add, dismiss, notes };
}
