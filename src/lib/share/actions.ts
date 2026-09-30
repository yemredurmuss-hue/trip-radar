// What the board does with sharing: share a trip (→ one code to send), join one with that code, vote.
import { db, newId, notifyChanged } from "../db";
import type { Item, Trip } from "../types";
import { rpcClient, ShareError, type Rpc } from "./client";
import { decodeShareCode, encodeShareCode, normalizeServerUrl } from "./code";
import { applySettings, settingsFromServer, settingsOf, stableJson } from "./settings";
import {
  chromeKV,
  getShareConfig,
  getVotes,
  isConfigured,
  saveShareConfig,
  setSyncState,
  setVotes,
  stateKey,
  type KV,
  type ShareConfig,
} from "./store";
import { freshState, type RemoteTrip } from "./sync";
import { voteKeyOf, withVote, type VoteValue } from "./votes";

export interface ActionDeps {
  kv?: KV;
  /** Defaults to the configured server. */
  rpc?: Rpc;
}

async function ready(deps: ActionDeps): Promise<{ config: ShareConfig; rpc: Rpc; kv: KV }> {
  const kv = deps.kv ?? chromeKV;
  const config = await getShareConfig(kv);
  if (!isConfigured(config)) throw new ShareError("Önce Ayarlar → Paylaşım'da adını, Supabase adresini ve anahtarını yaz.", "setup");
  return { config, rpc: deps.rpc ?? rpcClient(config), kv };
}

/**
 * Shares the trip: a secret id on the server with its settings; its captures go up with the next sync.
 * Returns the code to send. Sharing a shared trip again just gives its code.
 */
export async function shareTrip(tripId: string, deps: ActionDeps = {}): Promise<string> {
  const { config, rpc, kv } = await ready(deps);
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip) throw new Error("Gezi bulunamadı.");
  if (trip.demo) throw new Error("Örnek gezi paylaşılamaz.");
  if (trip.shareId) return shareCodeOf(trip, config);

  const shareId = crypto.randomUUID();
  const settings = settingsOf(trip);
  const at = await rpc<string>("create_shared_trip", { p_id: shareId, p_trip: settings, p_author: config.name });
  const fresh = (await d.get("trips", tripId)) ?? trip;
  await d.put("trips", { ...fresh, shareId });
  await setSyncState(tripId, { ...freshState(shareId), settingsBase: stableJson(settings), settingsAt: at, members: [config.name] }, kv);
  notifyChanged();
  return shareCodeOf({ ...fresh, shareId }, config);
}

export function shareCodeOf(trip: Trip, config: Pick<ShareConfig, "url" | "anonKey">): string {
  if (!trip.shareId) throw new Error("Bu gezi paylaşılmıyor.");
  return encodeShareCode({ url: config.url, anonKey: config.anonKey, shareId: trip.shareId, title: trip.title });
}

/**
 * Joins a shared trip from its code: fills the server settings from the code when they're empty, makes
 * the local trip with the shared settings, and the next sync brings its captures and votes. Returns the
 * local trip id (the existing one if this computer already has the trip).
 */
export async function joinSharedTrip(pasted: string, name: string, deps: ActionDeps = {}): Promise<string> {
  const code = decodeShareCode(pasted);
  if (!code) throw new ShareError("Bu bir paylaşım kodu değil. Kod TR1: ile başlar; tamamını yapıştır.", "setup");
  const kv = deps.kv ?? chromeKV;
  const current = await getShareConfig(kv);
  const currentUrl = current.url ? normalizeServerUrl(current.url) : null;
  if (currentUrl && currentUrl !== code.url)
    throw new ShareError("Bu kod başka bir paylaşım sunucusuna ait. Ayarlar → Paylaşım'daki adresi silip tekrar dene.", "setup");
  const me = (name || current.name).trim();
  if (!me) throw new ShareError("Adını yaz (diğer kişi seni bu adla görür).", "setup");
  await saveShareConfig({ url: code.url, anonKey: current.anonKey || code.anonKey, name: me }, kv);

  const d = await db();
  const existing = (await d.getAll("trips")).find((t) => t.shareId === code.shareId);
  if (existing) return existing.id;

  const rpc = deps.rpc ?? rpcClient({ url: code.url, anonKey: current.anonKey || code.anonKey });
  const [remote] = (await rpc<RemoteTrip[]>("get_shared_trip", { p_id: code.shareId, p_author: me })) ?? [];
  if (!remote) throw new ShareError("Paylaşılan gezi sunucuda bulunamadı.", "not_found");
  const settings = settingsFromServer(remote.trip) ?? settingsFromServer({ title: code.title ?? "Paylaşılan gezi" })!;
  const now = Date.now();
  const trip = applySettings(
    { id: newId(), title: settings.title ?? "Paylaşılan gezi", confirmedDates: null, budget: null, heroImage: null, shareId: code.shareId, createdAt: now, updatedAt: now },
    settings,
  );
  await d.put("trips", trip);
  await setSyncState(
    trip.id,
    { ...freshState(code.shareId), settingsBase: stableJson(settingsOf(trip)), settingsAt: remote.updated_at, members: remote.members ?? [] },
    kv,
  );
  notifyChanged();
  return trip.id;
}

/** Stops sharing on this computer: the trip stays as it is, nothing more goes or comes. */
export async function stopSharing(tripId: string, deps: ActionDeps = {}): Promise<void> {
  const kv = deps.kv ?? chromeKV;
  const d = await db();
  const trip = await d.get("trips", tripId);
  if (!trip?.shareId) return;
  const { shareId: _dropped, ...rest } = trip;
  await d.put("trips", rest);
  await kv.remove(stateKey(tripId));
  notifyChanged();
}

/** This traveller's 👍 / 👎 (0 takes it back), kept here until the next sync sends it. */
export async function castVote(trip: Trip, item: Item, vote: VoteValue, deps: ActionDeps = {}): Promise<void> {
  const kv = deps.kv ?? chromeKV;
  const key = voteKeyOf(item);
  const { name } = await getShareConfig(kv);
  if (!trip.shareId || !key || !name) return;
  await setVotes(trip.shareId, withVote(await getVotes(trip.shareId, kv), key, name, vote), kv);
}

