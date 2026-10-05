// "Sabine tarihleri değiştirdi: 7–18 Ekim → 8–18 Ekim · Geri al · Tamam" (paylaşım güvenliği, 0.37). When a
// sync brings the other traveller's change of the shared settings, what was here before is kept as a notice
// until it's dismissed; "Geri al" writes back only the fields that change touched, as a normal local edit
// (the trip's updatedAt moves on), so the next sync pushes it like any other change and the server logs it too.
//
// Kept under its own key, next to the sync state: the state is written whole at the end of every sync, and a
// "Tamam" pressed on the board meanwhile must not be lost under it.
import { addEvent, db, notifyChanged } from "../db";
import { L } from "../i18n";
import { applyFields, changedFields, type SyncedField, type SyncedSettings } from "./settings";
import { chromeKV, type KV } from "./store";

export const MAX_NOTICES = 20;
const MAX_UNDONE = 100;

export interface SettingsNotice {
  /** The server change it's about: its time and author (the same change never makes two notices). */
  id: string;
  author: string;
  /** When the change was written on the server (ISO), and when it arrived here (ms). */
  at: string;
  seenAt: number;
  /** The shared settings before (this computer's) and after (the other traveller's). */
  prev: SyncedSettings;
  next: SyncedSettings;
  fields: SyncedField[];
}

/** A shared-settings change taken back from here: by whom and when (the history greys it out). */
export interface UndoneMark {
  /** The notice id or `h:<server history id>`. */
  id: string;
  /** The server time of the change taken back (ISO), to match it in the server's history. */
  at: string | null;
  by: string;
  undoneAt: number;
}

interface NoticeBox {
  notices: SettingsNotice[];
  undone: UndoneMark[];
}

export const noticesKey = (tripId: string) => `shareNotices:${tripId}`;

export const noticeId = (at: string, author: string) => `${at}|${author.trim().toLowerCase()}`;

const sameName = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

async function readBox(tripId: string, kv: KV): Promise<NoticeBox> {
  const box = await kv.get<Partial<NoticeBox>>(noticesKey(tripId));
  return { notices: Array.isArray(box?.notices) ? box.notices : [], undone: Array.isArray(box?.undone) ? box.undone : [] };
}

export async function getNotices(tripId: string, kv: KV = chromeKV): Promise<SettingsNotice[]> {
  return (await readBox(tripId, kv)).notices;
}

export async function getUndone(tripId: string, kv: KV = chromeKV): Promise<UndoneMark[]> {
  return (await readBox(tripId, kv)).undone;
}

/**
 * Keeps a notice for a change that just arrived. None for my own change (the same name: my other computer),
 * none when nothing differs, never twice for the same server change; the newest 20 are kept. True when kept.
 */
export async function addNotice(
  tripId: string,
  change: { author: string | null; at: string; prev: SyncedSettings; next: SyncedSettings; me: string; now: number },
  kv: KV = chromeKV,
): Promise<boolean> {
  const author = change.author?.trim();
  if (!author || sameName(author, change.me)) return false;
  const fields = changedFields(change.prev, change.next);
  if (!fields.length) return false;
  const box = await readBox(tripId, kv);
  const id = noticeId(change.at, author);
  if (box.notices.some((n) => n.id === id)) return false;
  const notice: SettingsNotice = { id, author, at: change.at, seenAt: change.now, prev: change.prev, next: change.next, fields };
  box.notices = [notice, ...box.notices].slice(0, MAX_NOTICES);
  await kv.set(noticesKey(tripId), box);
  return true;
}

/** "Tamam": the notice goes; the change stays. */
export async function dismissNotice(tripId: string, id: string, kv: KV = chromeKV): Promise<void> {
  const box = await readBox(tripId, kv);
  const notices = box.notices.filter((n) => n.id !== id);
  if (notices.length !== box.notices.length) await kv.set(noticesKey(tripId), { ...box, notices });
}

/** Notes that a change was taken back (from a notice or from the history), newest kept. */
export async function markUndone(tripId: string, mark: UndoneMark, kv: KV = chromeKV): Promise<void> {
  const box = await readBox(tripId, kv);
  box.undone = [mark, ...box.undone.filter((m) => m.id !== mark.id)].slice(0, MAX_UNDONE);
  await kv.set(noticesKey(tripId), box);
}

/**
 * Writes these fields of `prev` back into the trip as a local edit (updatedAt moves on: the next sync pushes
 * it). Fields not in the list stay as they are now. False when the trip isn't there.
 */
export async function restoreSettings(tripId: string, prev: SyncedSettings, fields: readonly SyncedField[]): Promise<boolean> {
  if (!fields.length) return false;
  const tx = (await db()).transaction("trips", "readwrite");
  const trip = await tx.store.get(tripId);
  if (!trip) {
    await tx.done;
    return false;
  }
  await tx.store.put({ ...applyFields(trip, prev, fields), updatedAt: Math.max(Date.now(), trip.updatedAt + 1) });
  await tx.done;
  notifyChanged();
  return true;
}

/** "Geri al" on a notice: its fields back as they were here, the notice gone, the change marked as taken back. */
export async function undoNotice(tripId: string, notice: SettingsNotice, me: string, kv: KV = chromeKV): Promise<boolean> {
  const done = await restoreSettings(tripId, notice.prev, notice.fields);
  await dismissNotice(tripId, notice.id, kv);
  if (!done) return false;
  await markUndone(tripId, { id: notice.id, at: notice.at, by: me, undoneAt: Date.now() }, kv);
  await addEvent(tripId, L(`Ortak ayar geri alındı (${notice.author} değiştirmişti)`, `Shared setting undone (${notice.author} had changed it)`));
  notifyChanged();
  return true;
}
