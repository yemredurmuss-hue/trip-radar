// A tiny client for the sharing server: plain fetch to Supabase's `/rest/v1/rpc/<fn>` (see
// supabase/schema.sql). No SDK: the extension only ever calls these functions.
import { L } from "../i18n";

export type Rpc = <T>(fn: RpcName, args: Record<string, unknown>) => Promise<T>;

export type RpcName =
  | "share_ping"
  | "create_shared_trip"
  | "get_shared_trip"
  | "put_trip_settings"
  | "add_capture"
  | "captures_since"
  | "set_vote"
  | "votes_for"
  | "put_profile"
  | "profiles_for"
  // supabase/history.sql (0.37): the shared settings' history; a server without it answers "setup".
  | "settings_history_for";

/** A failure said in the board's language; `code` tells the sync what kind it was. */
export class ShareError extends Error {
  constructor(
    message: string,
    readonly code: "offline" | "not_found" | "setup" | "auth" | "too_large" | "server",
  ) {
    super(message);
    this.name = "ShareError";
  }
}

export interface ServerConfig {
  url: string;
  anonKey: string;
}

export function rpcClient(server: ServerConfig, fetchImpl: typeof fetch = (...a) => fetch(...a)): Rpc {
  const base = server.url.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: server.anonKey };
  // Legacy anon keys are JWTs and go in Authorization too; the newer publishable keys (sb_publishable_…)
  // only go in `apikey` (the server then runs the call as the anonymous role).
  if (server.anonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${server.anonKey}`;

  return async <T>(fn: RpcName, args: Record<string, unknown>): Promise<T> => {
    let res: Response;
    try {
      res = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
    } catch {
      throw new ShareError(L("Paylaşım sunucusuna bağlanılamadı (internet?)", "Couldn't reach the sharing server (internet?)"), "offline");
    }
    const text = await res.text();
    if (!res.ok) throw errorOf(res.status, text);
    return (text ? JSON.parse(text) : null) as T;
  };
}

function errorOf(status: number, body: string): ShareError {
  let message = "";
  let code = "";
  try {
    const parsed = JSON.parse(body) as { message?: string; code?: string };
    message = parsed.message ?? "";
    code = parsed.code ?? "";
  } catch {
    message = body.slice(0, 200);
  }
  if (message.includes("not_found")) return new ShareError(L("Paylaşılan gezi sunucuda bulunamadı.", "The shared trip wasn't found on the server."), "not_found");
  if (message.includes("too_large")) return new ShareError(L("Kayıt paylaşmak için çok büyük.", "This save is too big to share."), "too_large");
  if (message.includes("trip_full")) return new ShareError(L("Paylaşılan gezi dolu (kayıt sınırı).", "The shared trip is full (save limit)."), "too_large");
  if (message.includes("bad_author")) return new ShareError(L("Ayarlar'da adını yaz.", "Add your name in Settings."), "setup");
  // PostgREST: function missing = the schema wasn't run on this project.
  if (status === 404 || code === "PGRST202" || code === "42883")
    return new ShareError(L("Sunucu kurulumu eksik: supabase/schema.sql çalıştırılmamış.", "Server setup is incomplete: supabase/schema.sql hasn't been run."), "setup");
  if (status === 401 || status === 403) return new ShareError(L("Supabase anahtarı geçersiz.", "The Supabase key isn't valid."), "auth");
  return new ShareError(L(`Paylaşım sunucusu hata verdi (${status})`, `The sharing server returned an error (${status})`) + (message ? `: ${message.slice(0, 120)}` : ""), "server");
}
