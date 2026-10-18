// Which trip settings are shared, and who wins when both changed them: the later change (last writer
// wins). Kept small on purpose: what the trip is (name, dates, budget) and what matters on it.
// Chat, hidden transfers and each person's choices stay on their own computer.
import type { Trip } from "../types";

export const SYNCED_FIELDS = [
  "title",
  "confirmedDates",
  "budget",
  "priorities",
  "categoryPriorities",
  "wantedAmenities",
  "requirements",
  // Who goes (0.37): the names typed or said and the count, a fact about the trip like its dates. Never me (the
  // profile name) nor the shared trip's people: those come from sharing itself. Who comes from elsewhere
  // (kişiye özel rezervasyon, `travellers.from`: "Sabine" → "Alicante") rides inside it, so it syncs, is diffed
  // (settingsDiff) and goes into the settings' history with the names.
  "travellers",
] as const satisfies readonly (keyof Trip)[];

export type SyncedSettings = { [K in (typeof SYNCED_FIELDS)[number]]: Trip[K] | null };

export function settingsOf(trip: Trip): SyncedSettings {
  return Object.fromEntries(SYNCED_FIELDS.map((f) => [f, trip[f] ?? null])) as SyncedSettings;
}

/** Settings from the server, only the known fields, with a usable title. */
export function settingsFromServer(raw: unknown): SyncedSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out = Object.fromEntries(SYNCED_FIELDS.map((f) => [f, r[f] ?? null])) as SyncedSettings;
  if (typeof out.title !== "string" || !out.title.trim()) return null;
  return out;
}

/** Applies shared settings to the local trip (missing optional fields go back to their defaults). */
export function applySettings(trip: Trip, s: SyncedSettings): Trip {
  const next: Trip = { ...trip, title: s.title ?? trip.title, confirmedDates: s.confirmedDates ?? null, budget: s.budget ?? null };
  for (const f of ["priorities", "categoryPriorities", "wantedAmenities", "requirements"] as const) {
    if (s[f] == null) delete next[f];
    else (next as unknown as Record<string, unknown>)[f] = s[f];
  }
  // Who goes: missing from the server's settings means a board that doesn't know the field yet (an older version
  // on the other computer), never "nobody": the names here stay. Taking every name out is sent as `{ names: [] }`.
  if (isTravellers(s.travellers)) next.travellers = withCleanFrom(s.travellers);
  return next;
}

/** Who comes from where, as the other computer sent it: only names to places (text to text); none left, no field. */
function withCleanFrom(t: NonNullable<Trip["travellers"]>): NonNullable<Trip["travellers"]> {
  const { from, ...rest } = t;
  if (from == null) return rest;
  const clean =
    typeof from === "object" && !Array.isArray(from)
      ? Object.fromEntries(Object.entries(from).filter(([k, v]) => k.trim() && typeof v === "string" && v.trim()))
      : {};
  return Object.keys(clean).length ? { ...rest, from: clean } : rest;
}

const isTravellers = (v: unknown): v is NonNullable<Trip["travellers"]> =>
  Boolean(v && typeof v === "object" && Array.isArray((v as { names?: unknown }).names) && (v as { names: unknown[] }).names.every((n) => typeof n === "string"));

export type SyncedField = (typeof SYNCED_FIELDS)[number];

/** Any settings json (an old server row too) as the known fields, missing ones null; never throws. */
export function asSettings(raw: unknown): SyncedSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(SYNCED_FIELDS.map((f) => [f, r[f] ?? null])) as SyncedSettings;
}

/** The fields that differ between two settings, in SYNCED_FIELDS order (key order inside a field doesn't count). */
export function changedFields(a: unknown, b: unknown): SyncedField[] {
  const x = asSettings(a);
  const y = asSettings(b);
  return SYNCED_FIELDS.filter((f) => stableJson(x[f]) !== stableJson(y[f]));
}

/** Only these fields set back from `from` (a missing optional field goes back to its default), the rest as it is. */
export function applyFields(trip: Trip, from: SyncedSettings, fields: readonly SyncedField[]): Trip {
  const back = Object.fromEntries(fields.map((f) => [f, from[f] ?? null]));
  // Putting back a time before anyone was named: nobody named (sent as such, so the other side follows).
  if (fields.includes("travellers") && back.travellers == null) back.travellers = { names: [] };
  const merged = applySettings(trip, { ...settingsOf(trip), ...back } as SyncedSettings);
  // A title is never emptied: an old row without one keeps the current name.
  return fields.includes("title") && !(typeof from.title === "string" && from.title.trim()) ? { ...merged, title: trip.title } : merged;
}

/** JSON with sorted keys: the same settings always give the same text. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export interface SettingsSync {
  /** Settings on this computer now. */
  local: SyncedSettings;
  /** When the local trip last changed (ms). */
  localAt: number;
  /** stableJson of the settings both sides last agreed on (null: never synced). */
  base: string | null;
  /** Settings on the server now, and when they were written (ISO). */
  remote: SyncedSettings | null;
  remoteAt: string | null;
  /** The server's updated_at when we last synced. */
  seenAt: string | null;
}

export type SettingsAction = "none" | "push" | "pull" | "adopt";

/**
 * - only here changed → push; only there changed → pull;
 * - both changed to the same thing → adopt (just remember it);
 * - both changed differently → the later change wins.
 */
export function resolveSettings(s: SettingsSync): SettingsAction {
  const local = stableJson(s.local);
  const localChanged = local !== s.base;
  const remoteChanged = s.remote != null && s.remoteAt !== s.seenAt;
  if (!remoteChanged) return localChanged ? "push" : "none";
  const remote = stableJson(s.remote);
  if (remote === local) return "adopt";
  if (!localChanged) return "pull";
  const remoteAt = s.remoteAt ? Date.parse(s.remoteAt) : 0;
  return s.localAt > remoteAt ? "push" : "pull";
}
