// The AI gate, the extension's side (0.36, supabase/functions/ai): who was invited calls the model through the
// inviter's sharing server with the ticket that came in the invite, so they need no AI key of their own. The
// inviter (who holds the gate's admin secret) makes one ticket per shared trip and it goes inside the share
// code. Someone with their own key keeps using it: the gate is only the way when there's no key.
import { chromeKV, getShareConfig, type KV } from "./store";
import { normalizeServerUrl } from "./code";

const TICKET_KEY = "aiTicket";
const ADMIN_KEY = "aiAdminSecret";
const tripTicketKey = (tripId: string) => `aiTicket:${tripId}`;
export const isTicket = (v: unknown): v is string => typeof v === "string" && /^trk_[0-9a-f]{48}$/.test(v);

/** The gate to use (its address and this computer's ticket), or null when there's none. */
export async function aiGate(kv: KV = chromeKV): Promise<{ baseUrl: string; ticket: string } | null> {
  const [ticket, config] = await Promise.all([kv.get<string>(TICKET_KEY), getShareConfig(kv)]);
  const url = normalizeServerUrl(config.url);
  return isTicket(ticket) && url ? { baseUrl: `${url}/functions/v1/ai`, ticket } : null;
}

/** The ticket that came with an invite; a later one replaces it (the newest invite is the one in use). */
export async function saveAiTicket(ticket: string | null | undefined, kv: KV = chromeKV): Promise<void> {
  if (isTicket(ticket)) await kv.set(TICKET_KEY, ticket);
}

export async function getAdminSecret(kv: KV = chromeKV): Promise<string> {
  return (await kv.get<string>(ADMIN_KEY)) ?? "";
}
export async function saveAdminSecret(secret: string, kv: KV = chromeKV): Promise<void> {
  await kv.set(ADMIN_KEY, secret.trim());
}

type Fetch = typeof fetch;

async function admin<T>(body: Record<string, unknown>, deps: { kv?: KV; fetch?: Fetch } = {}): Promise<T | null> {
  const kv = deps.kv ?? chromeKV;
  const [secret, config] = await Promise.all([getAdminSecret(kv), getShareConfig(kv)]);
  const url = normalizeServerUrl(config.url);
  if (!url || secret.length < 24) return null;
  const res = await (deps.fetch ?? fetch)(`${url}/functions/v1/ai-admin`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status === 401 ? "AI kapısı: yönetici anahtarı tutmuyor." : `AI kapısı: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * The ticket for a shared trip's invite: made once and kept; null when this computer isn't the gate's owner
 * (no admin secret) or the gate can't be reached (the code then goes without one; nothing else changes).
 */
export async function inviteTicket(tripId: string, name: string, deps: { kv?: KV; fetch?: Fetch } = {}): Promise<string | null> {
  const kv = deps.kv ?? chromeKV;
  const kept = await kv.get<string>(tripTicketKey(tripId));
  if (isTicket(kept)) return kept;
  try {
    const made = await admin<{ token?: string }>({ action: "mint", name }, deps);
    if (!isTicket(made?.token)) return null;
    await kv.set(tripTicketKey(tripId), made.token);
    return made.token;
  } catch {
    return null;
  }
}

export interface AiUsage {
  tickets: { token_tail: string; name: string; created_at: string; revoked: boolean; month_requests: number; month_usd: number }[];
  capUsd: number;
  dailyRequests: number;
  aiReady: boolean;
}

/** This month's use of the gate (the owner's settings); null without an admin secret. */
export const aiUsage = (deps: { kv?: KV; fetch?: Fetch } = {}) => admin<AiUsage>({ action: "usage" }, deps);
/** Closes an invite's ticket (by its last six characters). */
export const revokeTicket = (tail: string, deps: { kv?: KV; fetch?: Fetch } = {}) => admin<{ closed: number }>({ action: "revoke", tail }, deps);
