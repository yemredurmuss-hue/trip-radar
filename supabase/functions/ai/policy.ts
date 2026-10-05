// The AI gate's rules (Trip Radar 0.36), kept free of Deno and Supabase so they're tested with the extension's
// own tests. What may pass: a known, open ticket, under its daily number of requests and the month's budget,
// asking one of the allowed models to generate content. What a call costs: its tokens at the configured prices.

export interface GateLimits {
  /** Requests per ticket per day. */
  dailyRequests: number;
  /** The month's budget for all tickets together, in US dollars. */
  monthlyCapUsd: number;
  /** Prices per million tokens (USD), input and output (thinking counts as output). */
  priceIn: number;
  priceOut: number;
  /** Models a ticket may ask for. */
  models: string[];
}

/** From the function's environment; deliberately high prices by default, so the budget errs on the safe side. */
export function limitsFrom(env: (key: string) => string | undefined): GateLimits {
  const n = (key: string, fallback: number) => {
    const v = Number(env(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const models = (env("AI_MODELS") ?? "gemini-3-flash-preview,gemini-2.5-flash,gemini-2.5-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);
  return { dailyRequests: n("AI_DAILY_REQUESTS", 300), monthlyCapUsd: n("AI_MONTHLY_CAP_USD", 20), priceIn: n("AI_PRICE_IN", 1), priceOut: n("AI_PRICE_OUT", 4), models };
}

/** "…/v1beta/models/gemini-3-flash-preview:generateContent" → the model and the method; null for anything else. */
export function targetOf(pathname: string): { version: string; model: string; method: string } | null {
  const m = pathname.match(/\/(v1beta|v1)\/models\/([A-Za-z0-9._-]+):([A-Za-z]+)$/);
  return m ? { version: m[1], model: m[2], method: m[3] } : null;
}

export interface GateStatus {
  known: boolean;
  revoked: boolean;
  today_requests: number;
  month_usd: number;
}

export type Verdict = { ok: true } | { ok: false; status: number; reason: string; message: string };

const no = (status: number, reason: string, message: string): Verdict => ({ ok: false, status, reason, message });

/** Whether the call may pass. The messages are the traveller's (shown by the extension as the model's error). */
export function verdict(token: string, target: ReturnType<typeof targetOf>, limits: GateLimits, status: GateStatus | null): Verdict {
  if (!/^trk_[0-9a-f]{48}$/.test(token)) return no(401, "no-ticket", "Trip Radar AI: davet bileti yok. Daveti açan linkle tekrar katıl ya da Ayarlar'dan kendi anahtarını gir.");
  if (!target || target.method !== "generateContent") return no(404, "not-allowed", "Trip Radar AI: bu istek desteklenmiyor.");
  if (!limits.models.includes(target.model)) return no(400, "model", `Trip Radar AI: ${target.model} modeli açık değil.`);
  if (!status?.known) return no(401, "unknown", "Trip Radar AI: bu davet bileti tanınmıyor.");
  if (status.revoked) return no(403, "revoked", "Trip Radar AI: bu davet kapatıldı. Davet edene sor ya da kendi anahtarını gir.");
  if (Number(status.month_usd) >= limits.monthlyCapUsd) return no(429, "budget", "Trip Radar AI: bu ayın AI bütçesi doldu. Ay başında yeniden açılır; acele ise kendi anahtarını gir.");
  if (Number(status.today_requests) >= limits.dailyRequests) return no(429, "daily", "Trip Radar AI: bugünkü sınırına ulaştın. Yarın yeniden açılır.");
  return { ok: true };
}

/** Tokens and cost of a Gemini answer, from its usageMetadata (nothing when it has none). */
export function costOf(usage: unknown, limits: GateLimits): { input: number; output: number; usd: number } {
  const u = (usage ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  const input = num(u.promptTokenCount);
  const output = num(u.candidatesTokenCount) + num(u.thoughtsTokenCount);
  return { input, output, usd: (input * limits.priceIn + output * limits.priceOut) / 1_000_000 };
}

/** A fresh ticket: "trk_" and 48 hex characters (192 random bits). */
export function newTicket(random: (bytes: Uint8Array) => Uint8Array): string {
  return `trk_${[...random(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Google's own error shape, so the extension's Gemini client reads it as any API error. */
export const googleError = (status: number, message: string, reason: string) => ({
  error: { code: status, message, status: status === 429 ? "RESOURCE_EXHAUSTED" : status === 401 ? "UNAUTHENTICATED" : status === 403 ? "PERMISSION_DENIED" : "INVALID_ARGUMENT", details: [{ reason }] },
});
