// What a chat tool really did to the board, read back after it ran (Sohbet Faz 1, 2026-10-24, Emre: "chat koydum dedi
// ama ulaşımda bir şey çıkmadı", "genel uber yolculukları diyor ama plana A noktası B noktası getiriyor"): the model sees
// what was added, changed and taken off, and what is on that part of the plan now, so it writes what is true and puts
// right what isn't (the old airport taxi still there) before it answers. Pure.
import { L } from "./i18n";
import { withEdits } from "./userEdits";
import type { Item } from "./types";

/** One record as the model reads it back: its id to point at, its kind, day and road. */
export interface BoardLine {
  id: string;
  name: string;
  kind: string;
  status: string;
  date: string | null;
  road: string | null;
}

export interface BoardChange {
  added: BoardLine[];
  changed: BoardLine[];
  removed: BoardLine[];
  /** What is on the plan now in the sections the change touched (at most SECTION_MAX). */
  now: BoardLine[];
}

const SECTION_MAX = 12;

export function lineOf(raw: Item): BoardLine {
  const i = withEdits(raw);
  const from = i.flight?.from ?? null;
  const to = i.flight?.to ?? null;
  return {
    id: i.id,
    name: i.name,
    kind: i.plannedKind ?? i.category,
    status: i.status,
    date: i.dates.start ?? null,
    road: from || to ? `${from ?? "?"} → ${to ?? "?"}` : null,
  };
}

/** What the record says that a change would show: its name, state, days, road, time and price. */
const print = (raw: Item): string => {
  const i = withEdits(raw);
  return JSON.stringify([i.name, i.status, i.dates.start, i.dates.end, i.flight?.from, i.flight?.to, i.flight?.departure, i.price.amount, i.price.currency, i.plannedKind, i.city]);
};

/** The board before and after a tool (the live records, dismissed ones out): what changed; null when nothing did. */
export function boardChange(before: readonly Item[], after: readonly Item[]): BoardChange | null {
  const live = (list: readonly Item[]) => new Map(list.filter((i) => i.status !== "dismissed").map((i) => [i.id, i]));
  const [was, is] = [live(before), live(after)];
  const added = [...is.values()].filter((i) => !was.has(i.id));
  const removed = [...was.values()].filter((i) => !is.has(i.id));
  const changed = [...is.values()].filter((i) => was.has(i.id) && print(was.get(i.id)!) !== print(i));
  if (!added.length && !removed.length && !changed.length) return null;
  const touched = new Set([...added, ...removed, ...changed].map((i) => i.category));
  const now = [...is.values()].filter((i) => touched.has(i.category)).slice(0, SECTION_MAX);
  return { added: added.map(lineOf), changed: changed.map(lineOf), removed: removed.map(lineOf), now: now.map(lineOf) };
}

const CHECK =
  "board_after is the board now, read back after the tool. Say only what it shows. If something the user asked is not there, or something they wanted gone (or a duplicate) is still in board_after.now, fix it with another tool call before you answer.";

/** The tool's own result with what the board really is now: in its JSON when it is one, else after it. */
export function withBoardChange(content: string, change: BoardChange): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return JSON.stringify({ ...parsed, board_after: change, check: CHECK });
  } catch {
    // (a plain sentence: the board after it)
  }
  return `${content}\n${JSON.stringify({ board_after: change, check: CHECK })}`;
}

/**
 * A turn's changes in one line, written by the code from what really happened (Sohbet Faz 1's verified summary): said
 * when the model wrote nothing ("Eklendi: Fado gösterisi · Kaldırıldı: Taksi · Havalimanı → Bonfim"). null: no change.
 */
export function summaryLine(changes: readonly BoardChange[]): string | null {
  const names = (pick: (c: BoardChange) => BoardLine[]) => [...new Set(changes.flatMap(pick).map((l) => l.name))];
  const added = names((c) => c.added);
  const removed = names((c) => c.removed);
  const changed = names((c) => c.changed).filter((n) => !added.includes(n));
  const parts = [
    added.length ? `${L("Eklendi", "Added")}: ${added.join(", ")}` : null,
    changed.length ? `${L("Güncellendi", "Updated")}: ${changed.join(", ")}` : null,
    removed.length ? `${L("Kaldırıldı", "Removed")}: ${removed.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
