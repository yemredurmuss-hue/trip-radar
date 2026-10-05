// Keeps a shared trip the same on both computers. Each run, per shared trip:
//  1. settings (name, dates, budget, priorities): last change wins;
//  2. this computer's captures in the trip go up (once each; the ones that came from the server never);
//  3. the other traveller's captures come down and go through the normal pipeline, but into this trip
//     (each computer runs its own AI; a capture's id is the same on both, so nothing is done twice);
//  4. votes go up and come down.
// Runs in the service worker every minute and when the board opens.
import { L } from "../i18n";
import { addEvent, db, listTrips, notifyChanged } from "../db";
import type { Capture, Trip } from "../types";
import { rpcClient, ShareError, type Rpc } from "./client";
import { shrinkScreenshot } from "./image";
import { applySettings, resolveSettings, settingsFromServer, settingsOf, stableJson } from "./settings";
import { chromeKV, getShareConfig, getSyncState, getVotes, isConfigured, setSyncState, setVotes, type KV, type SyncState } from "./store";
import { mergeVotes, type Vote, type VoteValue } from "./votes";
import { getPhoto, isPhoto } from "../profile";

export interface SyncDeps {
  rpc: Rpc;
  /** This traveller's name ("Emre"). */
  me: string;
  kv?: KV;
  /** Makes a screenshot small enough to share (null: share without it). */
  shrink?: (dataUrl: string) => Promise<string | null>;
  now?: () => number;
}

// --- what goes over the wire ---------------------------------------------------------------------

/** The raw capture as saved (what the AI reads), without this computer's processing state. */
export type SharedCapture = Pick<
  Capture,
  "kind" | "url" | "title" | "pageText" | "viewportText" | "selection" | "jsonLd" | "meta" | "screenshot" | "coords" | "images" | "capturedAt"
>;

export interface RemoteTrip {
  trip: unknown;
  members: string[] | null;
  updated_at: string;
  updated_by: string | null;
}

export interface RemoteCapture {
  seq: number;
  id: string;
  author: string;
  created_at: string;
  capture: SharedCapture;
}

export interface RemoteVote {
  item_key: string;
  author: string;
  vote: number;
  note: string | null;
  updated_at: string;
}

const PAGE_TEXT = 120_000;
const PAGE_TEXT_SMALL = 30_000;

/** The capture as shared: long texts cut, the screenshot small (or left out). */
export async function toShared(capture: Capture, shrink: SyncDeps["shrink"], small = false): Promise<SharedCapture> {
  const screenshot = !small && capture.screenshot ? await (shrink ?? shrinkScreenshot)(capture.screenshot).catch(() => null) : null;
  return {
    kind: capture.kind,
    url: capture.url,
    title: capture.title?.slice(0, 500) ?? null,
    pageText: capture.pageText.slice(0, small ? PAGE_TEXT_SMALL : PAGE_TEXT),
    viewportText: capture.viewportText.slice(0, 12_000),
    selection: capture.selection.slice(0, 5_000),
    jsonLd: small ? [] : capture.jsonLd.slice(0, 20).map((j) => j.slice(0, 20_000)),
    meta: capture.meta,
    screenshot,
    coords: capture.coords?.slice(0, 10),
    images: capture.images?.slice(0, 8),
    capturedAt: capture.capturedAt,
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const httpUrl = (v: unknown) => (typeof v === "string" && /^https?:\/\//i.test(v) ? v.slice(0, 4000) : null);

/**
 * A capture from the server as a new local capture waiting to be processed, into this trip. What the
 * other computer sent is checked like page input: only web links, only image data URLs.
 */
export function fromShared(row: RemoteCapture, tripId: string, me: string, now: number): Capture | null {
  const c = (row.capture ?? {}) as Partial<SharedCapture>;
  if (typeof row.id !== "string" || !row.id) return null;
  const kind = c.kind === "extension" || c.kind === "paste-link" || c.kind === "image" ? c.kind : "extension";
  const screenshot = typeof c.screenshot === "string" && c.screenshot.startsWith("data:image/") ? c.screenshot : null;
  const url = httpUrl(c.url);
  if (!url && !screenshot && !str(c.pageText, 1)) return null;
  const meta: Record<string, string> = {};
  if (c.meta && typeof c.meta === "object") for (const [k, v] of Object.entries(c.meta)) if (typeof v === "string") meta[k.slice(0, 100)] = v.slice(0, 1000);
  return {
    id: row.id,
    kind,
    url,
    title: str(c.title, 500) || null,
    pageText: str(c.pageText, 200_000),
    viewportText: str(c.viewportText, 12_000),
    selection: str(c.selection, 5_000),
    jsonLd: Array.isArray(c.jsonLd) ? c.jsonLd.filter((j): j is string => typeof j === "string").slice(0, 20) : [],
    meta,
    screenshot,
    coords: Array.isArray(c.coords)
      ? c.coords.filter((x) => x && Number.isFinite(x.lat) && Number.isFinite(x.lng)).slice(0, 10).map((x) => ({ lat: x.lat, lng: x.lng, source: str(x.source, 40) }))
      : undefined,
    images: Array.isArray(c.images)
      ? c.images.flatMap((x) => (x && httpUrl(x.src) ? [{ src: httpUrl(x.src)!, alt: str(x.alt, 120), inView: Boolean(x.inView) }] : [])).slice(0, 8)
      : undefined,
    capturedAt: typeof c.capturedAt === "number" && Number.isFinite(c.capturedAt) ? c.capturedAt : now,
    status: "pending",
    error: null,
    itemId: null,
    forTripId: tripId,
    sharedBy: row.author && row.author.trim().toLowerCase() !== me.trim().toLowerCase() ? row.author.slice(0, 40) : undefined,
    sharedAt: now,
  };
}

// --- one trip ------------------------------------------------------------------------------------

export const freshState = (shareId: string): SyncState => ({
  shareId,
  cursor: 0,
  settingsBase: null,
  settingsAt: null,
  members: [],
  lastSyncAt: null,
  error: null,
});

export interface TripSyncResult {
  /** Captures that came from the other traveller (waiting to be processed here). */
  received: number;
  uploaded: number;
}

export async function syncTrip(tripId: string, deps: SyncDeps): Promise<TripSyncResult> {
  const kv = deps.kv ?? chromeKV;
  const now = deps.now ?? Date.now;
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip?.shareId) return { received: 0, uploaded: 0 };
  const saved = await getSyncState(tripId, kv);
  const state = saved?.shareId === trip.shareId ? saved : freshState(trip.shareId);
  const result: TripSyncResult = { received: 0, uploaded: 0 };
  try {
    await syncSettings(trip.id, state, deps);
    result.uploaded = await uploadCaptures(trip.id, trip.shareId, deps);
    result.received = await pullCaptures(trip.id, state, deps, kv);
    await syncVotes(trip.shareId, { ...deps, kv });
    await syncProfiles(state, deps, kv, now());
    state.lastSyncAt = now();
    state.error = null;
  } catch (error) {
    state.error = error instanceof ShareError ? error.message : L(`Eşitlenemedi: ${error instanceof Error ? error.message : String(error)}`, `Couldn't sync: ${error instanceof Error ? error.message : String(error)}`);
  }
  await setSyncState(tripId, state, kv);
  if (result.received || result.uploaded) notifyChanged();
  return result;
}

async function syncSettings(tripId: string, state: SyncState, { rpc, me }: SyncDeps): Promise<void> {
  const [remote] = (await rpc<RemoteTrip[]>("get_shared_trip", { p_id: state.shareId, p_author: me })) ?? [];
  if (!remote) throw new ShareError(L("Paylaşılan gezi sunucuda bulunamadı.", "The shared trip wasn't found on the server."), "not_found");
  state.members = (remote.members ?? []).filter((m) => typeof m === "string");
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip) return;
  const local = settingsOf(trip);
  const remoteSettings = settingsFromServer(remote.trip);
  const action = resolveSettings({
    local,
    localAt: trip.updatedAt,
    base: state.settingsBase,
    remote: remoteSettings,
    remoteAt: remote.updated_at,
    seenAt: state.settingsAt,
  });
  if (action === "push") {
    state.settingsAt = await rpc<string>("put_trip_settings", { p_id: state.shareId, p_trip: local, p_author: me });
    state.settingsBase = stableJson(local);
  } else if (action === "pull" && remoteSettings) {
    // One transaction: merge into the trip as stored right now, so a concurrent cache write isn't overwritten.
    const tx = d.transaction("trips", "readwrite");
    const fresh = (await tx.store.get(tripId)) ?? trip;
    const next = applySettings(fresh, remoteSettings);
    await tx.store.put({ ...next, updatedAt: Date.now() });
    await tx.done;
    state.settingsBase = stableJson(settingsOf(next));
    state.settingsAt = remote.updated_at;
    if (remote.updated_by && remote.updated_by.trim().toLowerCase() !== me.trim().toLowerCase()) {
      await addEvent(tripId, L(`${remote.updated_by} gezinin ayarlarını güncelledi`, `${remote.updated_by} updated the trip settings`));
    }
    notifyChanged();
  } else if (action === "adopt") {
    state.settingsBase = stableJson(local);
    state.settingsAt = remote.updated_at;
  }
}

/** This computer's processed captures in the trip that the server doesn't have yet. */
export async function unsharedCaptures(tripId: string): Promise<Capture[]> {
  const d = await db();
  const items = await d.getAllFromIndex("items", "tripId", tripId);
  const ids = [...new Set(items.flatMap((i) => i.captureIds))];
  const captures = await Promise.all(ids.map((id) => d.get("captures", id)));
  return captures.filter((c): c is Capture => Boolean(c && c.status === "done" && !c.sharedAt)).sort((a, b) => a.capturedAt - b.capturedAt);
}

async function uploadCaptures(tripId: string, shareId: string, deps: SyncDeps): Promise<number> {
  const d = await db();
  const now = deps.now ?? Date.now;
  let count = 0;
  for (const capture of await unsharedCaptures(tripId)) {
    const send = async (small: boolean) =>
      deps.rpc<number>("add_capture", { p_trip_id: shareId, p_id: capture.id, p_author: deps.me, p_capture: await toShared(capture, deps.shrink, small) });
    try {
      await send(false);
    } catch (error) {
      // Too big even when trimmed: the smaller version (no screenshot, shorter text); else it stays here.
      if (!(error instanceof ShareError && error.code === "too_large")) throw error;
      await send(true).catch((e) => {
        if (!(e instanceof ShareError && e.code === "too_large")) throw e;
      });
    }
    const fresh = (await d.get("captures", capture.id)) ?? capture;
    await d.put("captures", { ...fresh, sharedAt: now() });
    count++;
  }
  return count;
}

const PAGE = 10;
const MAX_PAGES = 10;

async function pullCaptures(tripId: string, state: SyncState, deps: SyncDeps, kv: KV): Promise<number> {
  const d = await db();
  const now = deps.now ?? Date.now;
  let added = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = (await deps.rpc<RemoteCapture[]>("captures_since", { p_trip_id: state.shareId, p_since: state.cursor, p_limit: PAGE })) ?? [];
    for (const row of rows) {
      const known = await d.get("captures", row.id);
      if (!known) {
        const capture = fromShared(row, tripId, deps.me, now());
        if (capture) {
          await d.put("captures", capture);
          added++;
        }
      } else if (!known.sharedAt) {
        await d.put("captures", { ...known, sharedAt: now() });
      }
      state.cursor = Math.max(state.cursor, Number(row.seq) || 0);
    }
    await setSyncState(tripId, state, kv); // progress kept even if a later page fails
    if (rows.length < PAGE) break;
  }
  return added;
}

async function syncVotes(shareId: string, { rpc, me, kv = chromeKV }: SyncDeps): Promise<void> {
  const pending = (await getVotes(shareId, kv)).filter((v) => v.pending && v.author === me);
  for (const v of pending) {
    await rpc("set_vote", { p_trip_id: shareId, p_item_key: v.itemKey, p_author: me, p_vote: v.vote, p_note: v.note });
  }
  const rows = (await rpc<RemoteVote[]>("votes_for", { p_trip_id: shareId })) ?? [];
  const remote: Vote[] = rows
    .filter((r) => typeof r.item_key === "string" && typeof r.author === "string" && [-1, 0, 1].includes(r.vote))
    .map((r) => ({ itemKey: r.item_key, author: r.author, vote: r.vote as VoteValue, note: r.note ?? null, updatedAt: r.updated_at }));
  // Read again right before writing: a vote given on the board meanwhile stays pending.
  const merged = mergeVotes(await getVotes(shareId, kv), remote, me);
  const before = stableJson(await getVotes(shareId, kv));
  if (stableJson(merged) !== before) await setVotes(shareId, merged, kv);
}

// --- every shared trip ---------------------------------------------------------------------------

let running: Promise<number> | null = null;
let again = false;

/**
 * Syncs every shared trip; returns how many captures arrived (to be processed). Does nothing when
 * sharing isn't set up. A call during a run makes one more run after it (a capture just processed
 * isn't left for the next minute).
 */
export function syncAll(overrides: Partial<SyncDeps> = {}): Promise<number> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let received = 0;
    try {
      do {
        again = false;
        const kv = overrides.kv ?? chromeKV;
        const config = await getShareConfig(kv);
        if (!isConfigured(config) && !overrides.rpc) break;
        const deps: SyncDeps = { rpc: overrides.rpc ?? rpcClient(config), me: overrides.me ?? config.name, kv, shrink: overrides.shrink, now: overrides.now };
        for (const trip of (await listTrips()).filter((t: Trip) => t.shareId)) received += (await syncTrip(trip.id, deps)).received;
      } while (again);
    } finally {
      running = null;
    }
    return received;
  })();
  return running;
}

/** How often the others' photos are fetched again (a new member brings them sooner). */
const PHOTOS_EVERY_MS = 30 * 60_000;

/**
 * Profiles (0.36): my photo goes up when it changed; the others' come down every half hour or when someone
 * new joined. A server without the profiles functions (profiles.sql not run yet) is no error: no photos.
 */
async function syncProfiles(state: SyncState, { rpc, me }: SyncDeps, kv: KV, at: number): Promise<void> {
  try {
    const mine = await getPhoto(kv);
    if ((mine ?? null) !== (state.photoSent ?? null) && me) {
      await rpc("put_profile", { p_id: state.shareId, p_author: me, p_photo: mine });
      state.photoSent = mine;
    }
    const known = Object.keys(state.photos ?? {});
    const someoneNew = state.members.some((m) => !known.includes(m));
    if (state.photosAt && at - state.photosAt < PHOTOS_EVERY_MS && !someoneNew && mine === state.photoSent) return;
    const rows = (await rpc<{ author: string; photo: string }[]>("profiles_for", { p_id: state.shareId })) ?? [];
    state.photos = Object.fromEntries(rows.filter((r) => typeof r.author === "string" && isPhoto(r.photo)).map((r) => [r.author, r.photo]));
    state.photosAt = at;
  } catch {
    // profiles are a nicety: the trip syncs without them
  }
}
