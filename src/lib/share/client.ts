// A tiny client for the sharing server: plain fetch to Supabase's `/rest/v1/rpc/<fn>` (see
// supabase/schema.sql). No SDK: the extension only ever calls these functions.

export type Rpc = <T>(fn: RpcName, args: Record<string, unknown>) => Promise<T>;

export type RpcName =
  | "share_ping"
  | "create_shared_trip"
  | "get_shared_trip"
  | "put_trip_settings"
  | "add_capture"
  | "captures_since"
  | "set_vote"
  | "votes_for";

/** A failure said in Turkish; `code` tells the sync what kind it was. */
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
      throw new ShareError("Paylaşım sunucusuna bağlanılamadı (internet?)", "offline");
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
  if (message.includes("not_found")) return new ShareError("Paylaşılan gezi sunucuda bulunamadı.", "not_found");
  if (message.includes("too_large")) return new ShareError("Kayıt paylaşmak için çok büyük.", "too_large");
  if (message.includes("trip_full")) return new ShareError("Paylaşılan gezi dolu (kayıt sınırı).", "too_large");
  if (message.includes("bad_author")) return new ShareError("Ayarlar → Paylaşım'da adını yaz.", "setup");
  // PostgREST: function missing = the schema wasn't run on this project.
  if (status === 404 || code === "PGRST202" || code === "42883")
    return new ShareError("Sunucu kurulumu eksik: supabase/schema.sql çalıştırılmamış.", "setup");
  if (status === 401 || status === 403) return new ShareError("Supabase anahtarı geçersiz.", "auth");
  return new ShareError(`Paylaşım sunucusu hata verdi (${status})${message ? `: ${message.slice(0, 120)}` : ""}`, "server");
}
