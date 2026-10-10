// The AI gate (0.36): the server's rules (supabase/functions/ai/policy.ts) and the extension's side: the ticket
// rides in the share code, the inviter mints one per trip, the invited computer uses the gate only without a key.
import { describe, expect, it } from "vitest";
import { costOf, limitsFrom, newTicket, targetOf, verdict } from "../supabase/functions/ai/policy";
import { aiGate, inviteTicket, saveAdminSecret, saveAiTicket } from "../src/lib/share/ai";
import { decodeShareCode, encodeShareCode } from "../src/lib/share/code";
import { memoryKV, saveShareConfig } from "../src/lib/share/store";

const ticket = `trk_${"a1".repeat(24)}`;
const limits = limitsFrom(() => undefined);
const open = { known: true, revoked: false, today_requests: 3, month_usd: 1.2 };
const target = targetOf("/ai/v1beta/models/gemini-3-flash-preview:generateContent");

describe("the gate's rules", () => {
  it("reads the model and method from the SDK's path; anything else isn't a target", () => {
    expect(target).toEqual({ version: "v1beta", model: "gemini-3-flash-preview", method: "generateContent" });
    expect(targetOf("/ai/v1beta/models")).toBeNull();
    expect(targetOf("/ai/v1beta/models/x:generateContent/../../admin")).toBeNull();
  });
  it("lets a known, open ticket through under its limits", () => {
    expect(verdict(ticket, target, limits, open)).toEqual({ ok: true });
  });
  it("stops what it should, each with its reason", () => {
    const reason = (v: ReturnType<typeof verdict>) => (v.ok ? "ok" : `${v.status} ${v.reason}`);
    expect(reason(verdict("AIzaSomething", target, limits, open))).toBe("401 no-ticket");
    expect(reason(verdict(ticket, targetOf("/ai/v1beta/models/gemini-3-flash-preview:streamGenerateContent"), limits, open))).toBe("404 not-allowed");
    expect(reason(verdict(ticket, targetOf("/ai/v1beta/models/gemini-3-pro:generateContent"), limits, open))).toBe("400 model");
    expect(reason(verdict(ticket, target, limits, { ...open, known: false }))).toBe("401 unknown");
    expect(reason(verdict(ticket, target, limits, { ...open, revoked: true }))).toBe("403 revoked");
    expect(reason(verdict(ticket, target, limits, { ...open, month_usd: 20 }))).toBe("429 budget");
    expect(reason(verdict(ticket, target, limits, { ...open, today_requests: 300 }))).toBe("429 daily");
  });
  it("counts the tokens and the cost (thinking as output); limits come from the environment", () => {
    expect(costOf({ promptTokenCount: 10_000, candidatesTokenCount: 500, thoughtsTokenCount: 500 }, limits)).toEqual({ input: 10_000, output: 1000, usd: 0.014 });
    expect(costOf(null, limits)).toEqual({ input: 0, output: 0, usd: 0 });
    expect(limitsFrom((k) => ({ AI_MONTHLY_CAP_USD: "5", AI_DAILY_REQUESTS: "nope" })[k])).toMatchObject({ monthlyCapUsd: 5, dailyRequests: 300 });
  });
  it("a fresh ticket is 192 random bits", () => {
    expect(newTicket((b) => b.fill(255))).toBe(`trk_${"ff".repeat(24)}`);
  });
});

describe("the ticket in the share code", () => {
  const base = { url: "https://abcd.supabase.co", anonKey: "sb_publishable_x", shareId: "11111111-2222-4333-8444-555555555555", title: "Porto" };
  it("rides along, and older codes still read (no ticket)", () => {
    expect(decodeShareCode(encodeShareCode({ ...base, aiTicket: ticket }))?.aiTicket).toBe(ticket);
    expect(decodeShareCode(encodeShareCode(base))?.aiTicket).toBeNull();
    expect(decodeShareCode(encodeShareCode({ ...base, aiTicket: "not-a-ticket" }))?.aiTicket).toBeNull();
  });
});

describe("the extension's side", () => {
  it("an invited computer has the gate once it has a ticket and the server", async () => {
    const kv = memoryKV();
    expect(await aiGate(kv)).toBeNull();
    await saveShareConfig({ url: "https://abcd.supabase.co/" }, kv);
    await saveAiTicket("garbage", kv);
    expect(await aiGate(kv)).toBeNull();
    await saveAiTicket(ticket, kv);
    expect(await aiGate(kv)).toEqual({ baseUrl: "https://abcd.supabase.co/functions/v1/ai", ticket });
  });
  it("the owner mints one ticket per trip and keeps it; without the admin secret, none", async () => {
    const kv = memoryKV();
    await saveShareConfig({ url: "https://abcd.supabase.co" }, kv);
    let calls = 0;
    const fake = (async (_url: string, init: RequestInit) => {
      calls++;
      expect((init.headers as Record<string, string>)["x-admin-secret"]).toBe("s".repeat(30));
      return new Response(JSON.stringify({ token: ticket }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await inviteTicket("t1", "Porto", { kv, fetch: fake })).toBeNull();
    await saveAdminSecret("s".repeat(30), kv);
    expect(await inviteTicket("t1", "Porto", { kv, fetch: fake })).toBe(ticket);
    expect(await inviteTicket("t1", "Porto", { kv, fetch: fake })).toBe(ticket);
    expect(calls).toBe(1);
    // The gate down: the code just goes without a ticket.
    const down = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await inviteTicket("t2", "Lizbon", { kv, fetch: down })).toBeNull();
  });
});

describe("the profile photo (0.36)", () => {
  it("only a small JPEG is kept; removing it is allowed", async () => {
    const { getPhoto, isPhoto, savePhoto } = await import("../src/lib/profile");
    const kv = memoryKV();
    const jpeg = `data:image/jpeg;base64,${"A".repeat(100)}`;
    expect(isPhoto(jpeg)).toBe(true);
    expect(isPhoto("data:image/png;base64,AAAA")).toBe(false);
    expect(isPhoto(`data:image/jpeg;base64,${"A".repeat(70_000)}`)).toBe(false);
    await savePhoto(jpeg, kv);
    expect(await getPhoto(kv)).toBe(jpeg);
    await expect(savePhoto("data:image/png;base64,AAAA", kv)).rejects.toThrow();
    await savePhoto(null, kv);
    expect(await getPhoto(kv)).toBeNull();
  });
});

describe("the owner's one tick (0.36.2)", () => {
  it("claims with a secret it makes and keeps, then hands over the key once approved", async () => {
    const { claimGate, giveGateKey, getAdminSecret } = await import("../src/lib/share/ai");
    const kv = memoryKV();
    await saveShareConfig({ url: "https://abcd.supabase.co" }, kv);
    const sent: { action: string; secret: string; key?: string }[] = [];
    let approved = false;
    const fake = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { action: string; key?: string };
      sent.push({ ...body, secret: (init.headers as Record<string, string>)["x-admin-secret"] });
      const out = body.action === "status" ? { owned: approved, mine: approved, pending: !approved, hasKey: false } : { ok: true, pending: true };
      return new Response(JSON.stringify(out), { status: 200 });
    }) as unknown as typeof fetch;
    const standing = await claimGate({ kv, fetch: fake, random: (b) => b.fill(7) });
    expect(standing).toMatchObject({ pending: true, mine: false });
    expect(await getAdminSecret(kv)).toBe("07".repeat(24));
    expect(sent.map((s) => s.action)).toEqual(["claim", "status"]);
    expect(sent[0].secret).toBe("07".repeat(24));
    approved = true;
    expect(await giveGateKey("  AIzaSyKEYKEYKEYKEYKEYKEYKEYKEYKEYKEY  ", { kv, fetch: fake })).toBe(true);
    expect(sent.at(-1)).toMatchObject({ action: "set-key", key: "AIzaSyKEYKEYKEYKEYKEYKEYKEYKEYKEYKEY" });
    // A second claim keeps the same secret.
    await claimGate({ kv, fetch: fake, random: (b) => b.fill(9) });
    expect(await getAdminSecret(kv)).toBe("07".repeat(24));
  });
});
