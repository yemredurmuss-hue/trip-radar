// The shared settings' history from the server (supabase/history.sql, 0.37): every earlier state of the name,
// dates, budget and priorities, who changed them and when. A nicety: a server without it (history.sql not run
// yet), no server, or no connection all give null, and nothing else is affected.
import type { Rpc } from "./client";
import { asSettings, changedFields, type SyncedField, type SyncedSettings } from "./settings";

export interface SettingsChange {
  /** The server row's id. */
  id: number;
  author: string | null;
  prev: SyncedSettings;
  next: SyncedSettings;
  /** ISO time of the change (the shared trip's updated_at then). */
  at: string;
  fields: SyncedField[];
}

interface RawRow {
  id: unknown;
  author: unknown;
  prev: unknown;
  next: unknown;
  created_at: unknown;
}

/** The rows as changes, newest first; rows that changed none of the shared fields are left out. */
export function fromHistoryRows(rows: unknown): SettingsChange[] {
  if (!Array.isArray(rows)) return [];
  return (rows as RawRow[])
    .filter((r) => r && (typeof r.id === "number" || typeof r.id === "string") && typeof r.created_at === "string")
    .map((r) => {
      const prev = asSettings(r.prev);
      const next = asSettings(r.next);
      return { id: Number(r.id), author: typeof r.author === "string" ? r.author : null, prev, next, at: r.created_at as string, fields: changedFields(prev, next) };
    })
    .filter((c) => Number.isFinite(c.id) && c.fields.length > 0)
    .sort((a, b) => b.id - a.id);
}

/** The history of one shared trip, or null when the server can't give it (old server, offline, no sharing). */
export async function fetchSettingsHistory(rpc: Rpc | null, shareId: string | undefined, limit = 50): Promise<SettingsChange[] | null> {
  if (!rpc || !shareId) return null;
  try {
    return fromHistoryRows(await rpc<unknown>("settings_history_for", { p_id: shareId, p_limit: limit }));
  } catch {
    return null;
  }
}
