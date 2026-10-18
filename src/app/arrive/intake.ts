// What this page was just handed (a link sent in the chat, a file dropped on the board), kept in memory for
// the session so the chat can put a chip under it and the board can follow it to its section. The captures
// themselves live in IndexedDB as always; this only remembers who handed what, where, and how a file's
// reading went (a document isn't a capture).
import { useSyncExternalStore } from "react";
import { db, notifyChanged } from "../../lib/db";
import type { SectionId } from "../../lib/categories";
import type { Capture } from "../../lib/types";

export type IntakeSource = "chat" | "board" | "home";

export interface LinkIntake {
  id: string;
  kind: "link";
  tripId: string | null;
  source: IntakeSource;
  at: number;
  url: string;
  captureId: string;
}

export interface FileIntake {
  id: string;
  kind: "file";
  tripId: string;
  source: IntakeSource;
  at: number;
  name: string;
  type: string;
  /** reading → done (kept in Belgeler, or put on a card) / error; a picture that wasn't a document → screenshot. */
  state: "reading" | "done" | "error" | "screenshot";
  /** A small picture for the chip (a screenshot's own), when there is one. */
  thumb?: string;
  captureId?: string;
  itemId?: string;
  itemName?: string;
  section?: SectionId;
  error?: string;
  /** Its failure is already a line in the chat ("📎 … okunamadı"): the chat shows that line, not a chip too. */
  logged?: boolean;
}

export type Intake = (LinkIntake | FileIntake) & {
  /** When its reading ended (landed or failed): what's kept of it is pruned a while after. */
  endedAt?: number;
};

/** Kept this long after it ended; never more than MAX in all (the oldest go first). */
export const KEEP_MS = 2 * 60_000;
export const MAX = 50;

let list: readonly Intake[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
let seq = 0;

/**
 * Pruned: a file's entry 2 minutes after its reading ended (its chip goes; the chat's own lines stay), a
 * screenshot's picture 2 minutes after its capture landed; at most MAX entries. A link sent in the chat
 * keeps its small entry (it's the only trace of the traveller's own message), within MAX.
 */
export function pruneIntake(entries: readonly Intake[], now: number): readonly Intake[] {
  const old = (e: Intake) => e.endedAt != null && now - e.endedAt >= KEEP_MS;
  let changed = false;
  let out = entries.flatMap((e): Intake[] => {
    if (!old(e) || e.kind === "link" || (e.state === "screenshot" && !e.thumb)) return [e];
    changed = true;
    if (e.state === "screenshot") {
      const { thumb: _thumb, ...rest } = e;
      return [rest];
    }
    return [];
  });
  if (out.length > MAX) {
    out = out.slice(out.length - MAX);
    changed = true;
  }
  return changed ? out : entries;
}

let sweep: ReturnType<typeof setTimeout> | null = null;
function prune() {
  const next = pruneIntake(list, Date.now());
  if (next !== list) list = next;
  // The next ended entry to come due.
  const due = list.flatMap((e) => (e.endedAt != null && (e.kind === "file" && (e.state !== "screenshot" || e.thumb)) ? [e.endedAt + KEEP_MS] : []));
  if (sweep) clearTimeout(sweep);
  sweep = due.length ? setTimeout(() => (prune(), emit()), Math.max(1000, Math.min(...due) - Date.now() + 50)) : null;
}

export function addIntake<T extends LinkIntake | FileIntake>(entry: Omit<T, "id" | "at">): T {
  const made = { ...entry, id: `in-${Date.now().toString(36)}-${++seq}`, at: Date.now() } as T;
  list = [...list, made];
  prune();
  emit();
  return made;
}

export function updateIntake(id: string, patch: Partial<FileIntake>): void {
  const ends = patch.state === "done" || patch.state === "error";
  list = list.map((e) => (e.id === id ? ({ ...e, ...patch, ...(ends && e.endedAt == null ? { endedAt: Date.now() } : {}) } as Intake) : e));
  prune();
  emit();
}

/** A link's or a screenshot's capture landed (or went): its keeping clock starts. */
export function endIntake(id: string): void {
  if (!list.some((e) => e.id === id && e.endedAt == null)) return;
  list = list.map((e) => (e.id === id ? { ...e, endedAt: Date.now() } : e));
  prune();
  emit();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const intakeNow = (): readonly Intake[] => list;
export function useIntake(): readonly Intake[] {
  return useSyncExternalStore(subscribe, intakeNow, intakeNow);
}

/** Tests only: a clean slate. */
export function resetIntake(): void {
  list = [];
  emit();
}

// --- going to a card from anywhere (the chat's chips and event lines → the board's reveal) -------------

const revealers = new Set<(itemId: string) => void>();
export function onRevealRequest(fn: (itemId: string) => void): () => void {
  revealers.add(fn);
  return () => void revealers.delete(fn);
}
export function requestReveal(itemId: string): void {
  revealers.forEach((fn) => fn(itemId));
}

// --- a capture as it stands now (a done one is no longer among the board's open captures) ----------------

export async function captureById(id: string): Promise<Capture | null> {
  return (await (await db()).get("captures", id)) ?? null;
}

/** "Kaldır" on a capture that couldn't be read: it never became a record, so it simply goes. */
export async function dropCapture(id: string): Promise<void> {
  const d = await db();
  const capture = await d.get("captures", id);
  if (capture?.status !== "error") return;
  await d.delete("captures", id);
  notifyChanged();
}
