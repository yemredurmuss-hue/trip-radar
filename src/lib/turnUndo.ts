// A chat turn taken back in one tap (omurga A4, Emre 2026-10-31: "kayıpsız + geri al"): the trip and its records are read
// before the turn, and after it what changed is kept on the reply as the history's own undo (eventUndo.ts): the trip's
// fields to their values before, each record the turn rewrote back to what it was, what it made gone again. Each part only
// while it is still as the turn left it (a later change is never undone by an older reply).
import { db, listItems } from "./db";
import { stableJson } from "./share/settings";
import type { ChatMessage, EventUndo, Item, Trip } from "./types";

export interface TurnBefore {
  at: number;
  trip: Trip | null;
  items: Item[];
}

/** The trip and its records as they are before a turn. */
export async function beforeTurn(tripId: string, now = Date.now()): Promise<TurnBefore> {
  return { at: now, trip: (await (await db()).get("trips", tripId)) ?? null, items: await listItems(tripId) };
}

/** The trip's fields written by the work around a turn, never by the turn's tools (photos, the start's guide, the reviews). */
const BACKGROUND = new Set<string>(["heroImage", "cityImages", "photoCredits", "coverLooked", "coverImage", "momentNames", "officialImage", "mood", "advisorReviews", "startGuide", "suggestions", "spine", "shareId"]);

/**
 * What the turn changed, as the history's undo; null when it changed nothing. Pure. `only`: the records the turn's own
 * tools touched (Tur 23: the searches running meanwhile add options too, and an undo must never take their work back).
 */
export function turnUndo(before: TurnBefore, trip: Trip | null, items: Item[], only: ReadonlySet<string> | null = null): Extract<EventUndo, { kind: "fields" }> | null {
  const was = new Map(before.items.map((i) => [i.id, i]));
  const ours = (id: string) => !only || only.has(id);
  const records = items.filter((i) => ours(i.id) && was.has(i.id) && stableJson(was.get(i.id)) !== stableJson(i)).map((i) => ({ before: was.get(i.id)!, afterAt: i.updatedAt }));
  const made = items.filter((i) => ours(i.id) && !was.has(i.id)).map((i) => i.id);
  const fields = (before.trip && trip ? (Object.keys({ ...before.trip, ...trip }) as (keyof Trip)[]) : []).filter(
    (f) => f !== "updatedAt" && f !== "createdAt" && !BACKGROUND.has(f) && stableJson(before.trip![f]) !== stableJson(trip![f]),
  );
  if (!records.length && !made.length && !fields.length) return null;
  const pick = (t: Trip | null) => Object.fromEntries(fields.map((f) => [f, t?.[f] ?? null])) as Partial<Trip>;
  return { kind: "fields", fields, before: pick(before.trip), after: pick(trip), records, made };
}

/** After the turn: what it changed kept on its last reply (the reply's "Geri al"). */
export async function keepTurnUndo(tripId: string, before: TurnBefore, only: ReadonlySet<string> | null = null): Promise<ChatMessage | null> {
  const d = await db();
  const undo = turnUndo(before, (await d.get("trips", tripId)) ?? null, await listItems(tripId), only);
  if (!undo) return null;
  const reply = (await d.getAllFromIndex("messages", "tripId", tripId))
    .filter((m) => m.role === "assistant" && m.createdAt >= before.at && m.text.trim() !== "")
    .sort((a, b) => a.createdAt - b.createdAt)
    .at(-1);
  if (!reply) return null;
  const kept = { ...reply, undo };
  await d.put("messages", kept);
  return kept;
}
