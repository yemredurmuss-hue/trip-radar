// The share code: one string that carries everything the other traveller needs (which server, its
// public key, which trip), so joining is a single paste. "TR1:" + base64url(JSON).
import { L } from "../i18n";

export interface ShareCode {
  /** Supabase project address, e.g. https://abcd.supabase.co */
  url: string;
  /** The project's publishable (anon) key: public by design, it only lets the RPC functions be called. */
  anonKey: string;
  /** The shared trip's secret id: knowing it is access to the trip. */
  shareId: string;
  /** Trip title when the code was made (shown before joining). */
  title: string | null;
}

const PREFIX = "TR1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a Supabase project's own address (https, *.supabase.co, no path): a code can't point anywhere else. */
export function normalizeServerUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) return null;
    return `https://${url.hostname.toLowerCase()}`;
  } catch {
    return null;
  }
}

export const isShareId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeShareCode(code: ShareCode): string {
  const url = normalizeServerUrl(code.url);
  if (!url || !code.anonKey.trim() || !isShareId(code.shareId)) throw new Error(L("Paylaşım kodu oluşturulamadı: ayarlar eksik.", "Couldn't make the share code: settings are missing."));
  return PREFIX + toBase64Url(JSON.stringify({ u: url, k: code.anonKey.trim(), t: code.shareId, n: code.title ?? undefined }));
}

/** The code as pasted (surrounding text from a chat message is fine), or null. */
export function decodeShareCode(pasted: string): ShareCode | null {
  const match = pasted.match(/TR1:\s*([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    const raw = JSON.parse(fromBase64Url(match[1])) as { u?: unknown; k?: unknown; t?: unknown; n?: unknown };
    const url = typeof raw.u === "string" ? normalizeServerUrl(raw.u) : null;
    const anonKey = typeof raw.k === "string" ? raw.k.trim() : "";
    if (!url || !anonKey || anonKey.length > 1000 || !isShareId(raw.t)) return null;
    return { url, anonKey, shareId: raw.t.toLowerCase(), title: typeof raw.n === "string" ? raw.n.slice(0, 120) : null };
  } catch {
    return null;
  }
}
