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
}

export type Intake = LinkIntake | FileIntake;

let list: readonly Intake[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
let seq = 0;

export function addIntake<T extends Intake>(entry: Omit<T, "id" | "at">): T {
  const made = { ...entry, id: `in-${Date.now().toString(36)}-${++seq}`, at: Date.now() } as T;
  list = [...list, made];
  emit();
  return made;
}

export function updateIntake(id: string, patch: Partial<FileIntake>): void {
  list = list.map((e) => (e.id === id ? ({ ...e, ...patch } as Intake) : e));
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
