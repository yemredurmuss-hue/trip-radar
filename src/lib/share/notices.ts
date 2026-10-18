// "Sabine tarihleri değiştirdi: 7–18 Ekim → 8–18 Ekim · Geri al · Tamam" (paylaşım güvenliği, 0.37). When a
// sync brings the other traveller's change of the shared settings, what was here before is kept as a notice;
// "Geri al" writes back only the fields that change touched, and only those still as that change left them (a
// field changed again since is never overwritten), as a normal local edit: the next sync pushes it like any
// other change and the server logs it too.
//
// Kept under its own key, next to the sync state (the state is written whole at the end of every sync). The
// board and the service worker both write it: every write goes through one queue here and a version check
// against what's stored (retried when another page wrote in between).
import { addEvent, db, notifyChanged } from "../db";
import { L } from "../i18n";
import { joinAnd } from "../i18nText";
import { applyFields, asSettings, changedFields, settingsOf, stableJson, type SyncedField, type SyncedSettings } from "./settings";
import { fieldLabel } from "./settingsDiff";
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
  /** Fields that can't be taken back from here any more: a newer change of them came, or they were taken back. */
  closed?: SyncedField[];
  /** Fields "Geri al" left as they were because they had changed again since (said on the banner). */
  stale?: SyncedField[];
  /** Taken back from here: by whom, when (ms), which fields. */
  undone?: { by: string; at: number; fields: SyncedField[] };
  /** "Tamam" pressed (or nothing left on it): off the board, kept for the history. */
  dismissed?: boolean;
}

/** A shared-settings change taken back from here: by whom and when (the history greys it out). */
export interface UndoneMark {
  /** The notice id or `h:<server history id>:<field>`. */
  id: string;
  /** The server time of the change taken back (ISO), to match it in the server's history. */
  at: string | null;
  by: string;
  undoneAt: number;
  /** The fields taken back (older marks: all of that change). */
  fields?: SyncedField[];
}

interface NoticeBox {
  notices: SettingsNotice[];
  undone: UndoneMark[];
  /** Bumped on every write: a write based on an older box is redone. */
  v?: number;
}

export const noticesKey = (tripId: string) => `shareNotices:${tripId}`;

export const noticeId = (at: string, author: string) => `${at}|${author.trim().toLowerCase()}`;

const sameName = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
const msOf = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

async function readBox(tripId: string, kv: KV): Promise<Required<NoticeBox>> {
  const box = await kv.get<Partial<NoticeBox>>(noticesKey(tripId));
  return {
    notices: Array.isArray(box?.notices) ? box.notices : [],
    undone: Array.isArray(box?.undone) ? box.undone : [],
    v: typeof box?.v === "number" ? box.v : 0,
  };
}

// One write at a time per key in this page; across pages (board, worker) the version check below.
const queues = new Map<string, Promise<unknown>>();

/**
 * Changes the box: `change` edits it (false: nothing to write). Before writing, the stored version is read
 * again; if another page wrote meanwhile, the change is made again on the fresh box (a few times at most).
 */
async function updateBox(tripId: string, kv: KV, change: (box: Required<NoticeBox>) => boolean): Promise<boolean> {
  const key = noticesKey(tripId);
  const run = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const box = await readBox(tripId, kv);
      const seen = box.v;
      if (!change(box)) return false;
      if ((await readBox(tripId, kv)).v !== seen) continue;
      await kv.set(key, { notices: box.notices, undone: box.undone, v: seen + 1 });
      return true;
    }
    return false;
  };
  const next = (queues.get(key) ?? Promise.resolve()).then(run, run);
  queues.set(key, next.catch(() => undefined));
  return next;
}

/** The notices on the board: not dismissed, newest first. */
export async function getNotices(tripId: string, kv: KV = chromeKV): Promise<SettingsNotice[]> {
  return (await readBox(tripId, kv)).notices.filter((n) => !n.dismissed);
}

/** Every notice kept (dismissed ones too): the history's settings rows when the server has none. */
export async function getAllNotices(tripId: string, kv: KV = chromeKV): Promise<SettingsNotice[]> {
  return (await readBox(tripId, kv)).notices;
}

export async function getUndone(tripId: string, kv: KV = chromeKV): Promise<UndoneMark[]> {
  return (await readBox(tripId, kv)).undone;
}

/** The fields of a notice that "Geri al" can still take back. */
export const openFields = (n: SettingsNotice): SyncedField[] => n.fields.filter((f) => !(n.closed ?? []).includes(f));

/**
 * Keeps a notice for a change that just arrived. None for my own change (the same name: my other computer),
 * none when nothing differs, never twice for the same server change; the newest 20 are kept. A newer change of
 * a field closes it on the older notices (their "Geri al" would undo the newer one). True when kept.
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
  const id = noticeId(change.at, author);
  return updateBox(tripId, kv, (box) => {
    if (box.notices.some((n) => n.id === id)) return false;
    const older = box.notices.map((n) => {
      const overlap = n.fields.filter((f) => fields.includes(f) && !(n.closed ?? []).includes(f));
      if (!overlap.length) return n;
      const closed = [...(n.closed ?? []), ...overlap];
      return { ...n, closed, dismissed: n.dismissed || n.fields.every((f) => closed.includes(f)) };
    });
    box.notices = [{ id, author, at: change.at, seenAt: change.now, prev: change.prev, next: change.next, fields }, ...older].slice(0, MAX_NOTICES);
    return true;
  });
}

/** "Tamam": off the board; the change stays (and the notice stays in the history). */
export async function dismissNotice(tripId: string, id: string, kv: KV = chromeKV): Promise<void> {
  await updateBox(tripId, kv, (box) => {
    const n = box.notices.find((x) => x.id === id);
    if (!n || n.dismissed) return false;
    n.dismissed = true;
    return true;
  });
}

export interface UndoResult {
  /** Fields put back. */
  restored: SyncedField[];
  /** Fields left as they are: changed again since that change. */
  changedSince: SyncedField[];
}

/**
 * Writes back the fields of `prev` that are still as `next` left them (a field changed again since stays as it
 * is now). A local edit: updatedAt moves on and the next sync pushes it.
 */
export async function restoreSettings(tripId: string, prev: SyncedSettings, next: SyncedSettings, fields: readonly SyncedField[]): Promise<UndoResult> {
  const result: UndoResult = { restored: [], changedSince: [] };
  if (!fields.length) return result;
  const tx = (await db()).transaction("trips", "readwrite");
  const trip = await tx.store.get(tripId);
  if (!trip) {
    await tx.done;
    return result;
  }
  const now = settingsOf(trip);
  const after = asSettings(next);
  for (const f of fields) (stableJson(now[f]) === stableJson(after[f]) ? result.restored : result.changedSince).push(f);
  if (result.restored.length) await tx.store.put({ ...applyFields(trip, prev, result.restored), updatedAt: Math.max(Date.now(), trip.updatedAt + 1) });
  await tx.done;
  if (result.restored.length) notifyChanged();
  return result;
}

/** "Tarihler o zamandan beri yine değişti; geri alınmadı." */
export function changedSinceText(fields: readonly SyncedField[]): string {
  const names = joinAnd([...new Set(fields.map(fieldLabel))]);
  return L(`${names} o zamandan beri yine değişti; geri alınmadı.`, `${names} changed again since; not undone.`);
}

/**
 * "Geri al" on a shared-settings change (a notice or a row of the history): the fields still as that change
 * left them go back, the change is marked as taken back (per field), its notice on the board closes for them,
 * one history line. The next sync pushes it.
 */
export async function undoSettingsChange(
  tripId: string,
  change: { prev: SyncedSettings; next: SyncedSettings; fields: readonly SyncedField[]; author: string | null; mark: { id: string; at: string | null } },
  me: string,
  kv: KV = chromeKV,
): Promise<UndoResult> {
  const result = await restoreSettings(tripId, change.prev, change.next, change.fields);
  const by = me || L("Ben", "Me");
  const undoneAt = Date.now();
  const at = msOf(change.mark.at);
  await updateBox(tripId, kv, (box) => {
    if (result.restored.length) box.undone = [{ id: change.mark.id, at: change.mark.at, by, undoneAt, fields: result.restored }, ...box.undone.filter((m) => m.id !== change.mark.id)].slice(0, MAX_UNDONE);
    // The banner of the same change: what was taken back, or can't be any more, closes; nothing left → off the board.
    for (const n of box.notices) {
      if (n.id !== change.mark.id && (at == null || msOf(n.at) !== at)) continue;
      const touched = [...result.restored, ...result.changedSince].filter((f) => n.fields.includes(f));
      if (!touched.length) continue;
      n.closed = [...new Set([...(n.closed ?? []), ...touched])];
      if (result.restored.length) n.undone = { by, at: undoneAt, fields: [...new Set([...(n.undone?.fields ?? []), ...result.restored.filter((f) => n.fields.includes(f))])] };
      const stale = result.changedSince.filter((f) => n.fields.includes(f));
      if (stale.length) n.stale = [...new Set([...(n.stale ?? []), ...stale])];
      if (n.fields.every((f) => n.closed!.includes(f)) && !n.stale?.length) n.dismissed = true;
    }
    return true;
  });
  if (result.restored.length) {
    const who = change.author?.trim();
    await addEvent(
      tripId,
      who && !sameName(who, me)
        ? L(`Ortak ayar geri alındı (${who} değiştirmişti)`, `Shared setting undone (${who} had changed it)`)
        : L("Ortak ayar geri alındı", "Shared setting undone"),
    );
    notifyChanged();
  }
  return result;
}

/** "Geri al" on a notice: its open fields back as they were here (those not changed again since). */
export async function undoNotice(tripId: string, notice: SettingsNotice, me: string, kv: KV = chromeKV): Promise<UndoResult> {
  return undoSettingsChange(tripId, { prev: notice.prev, next: notice.next, fields: openFields(notice), author: notice.author, mark: { id: notice.id, at: notice.at } }, me, kv);
}
