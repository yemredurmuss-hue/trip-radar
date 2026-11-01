// The advisor's reviews started from the board (omurga Tur 23, Emre 2026-11-01): when a stay is settled (chosen or booked:
// "resort belli olunca o adanın çevresi belli olur"), once the plan is first opened after it was made (its logic errors,
// a bike for all 33 days), and as the trip draws near (30 and 7 days). Each event once (reviewTrip keeps its key); the
// review never runs while the traveller's own turn does, and stops when they write.
import { useEffect, useRef } from "react";
import { reviewTrip } from "../lib/assistant";
import { L } from "../lib/i18n";
import { nightsBetween } from "../lib/items";
import type { Item, Trip } from "../lib/types";

/** How long after the board opens the first look waits (the start's own searches settle first: a 429 at 8 s). */
const FIRST_LOOK_MS = 25_000;

export function useAdvisorReviews(trip: Trip, items: Item[]): void {
  const seen = useRef<Map<string, string> | null>(null);
  // A stay settled: that stop's days thought again for the place.
  useEffect(() => {
    const stays = items.filter((i) => i.tripId === trip.id && i.category === "stay");
    const now = new Map(stays.map((i) => [i.id, i.status as string]));
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    const settled = stays.find((i) => (i.status === "chosen" || i.status === "booked") && before.has(i.id) && before.get(i.id) !== i.status && before.get(i.id) !== "booked");
    if (!settled) return;
    const where = settled.city ? ` (${settled.city})` : "";
    void reviewTrip(
      trip.id,
      L(`Konaklama kesinleşti: ${settled.name}${where}. Bu durağın günlerini bu yere göre düşün: etkinlikler ve oraya ulaşım.`, `A stay is settled: ${settled.name}${where}. Think that stop's days again for this place: its activities and the way there.`),
      `stay:${settled.id}:${settled.status}`,
    );
  }, [items, trip.id]);

  // The plan first opened after it was made; the trip 30 and 7 days away.
  useEffect(() => {
    const start = trip.confirmedDates?.start ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const left = start ? nightsBetween(today, start) : null;
    const why =
      trip.startGuide && !trip.advisorReviews?.length
        ? { key: "first", text: L("Plan yeni kuruldu: bir kez baştan sona bak.", "The plan was just made: look at it once from start to end.") }
        : left != null && left >= 0 && left <= 7
          ? { key: "d7", text: L("Geziye bir hafta kaldı: son kez bak.", "A week to go: one last look.") }
          : left != null && left >= 0 && left <= 30
            ? { key: "d30", text: L("Geziye bir ay kaldı: planı gözden geçir.", "A month to go: look over the plan.") }
            : null;
    if (!why || trip.advisorReviews?.some((r) => r.key === why.key)) return;
    const timer = setTimeout(() => void reviewTrip(trip.id, why.text, why.key), FIRST_LOOK_MS);
    return () => clearTimeout(timer);
  }, [trip.id]);
}
