import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { processPending, saveSnapshot, type Deps } from "../src/lib/process";
import { castVote, joinSharedTrip, shareTrip, stopSharing } from "../src/lib/share/actions";
import { rpcClient, ShareError, type Rpc } from "../src/lib/share/client";
import { decodeShareCode, encodeShareCode, normalizeServerUrl } from "../src/lib/share/code";
import { resolveSettings, settingsOf, stableJson, type SyncedSettings } from "../src/lib/share/settings";
import { getShareConfig, getSyncState, getVotes, memoryKV, saveShareConfig } from "../src/lib/share/store";
import { fromShared, syncTrip, type RemoteCapture } from "../src/lib/share/sync";
import { mergeVotes, tallyVotes, voteKeyOf, withVote, type Vote } from "../src/lib/share/votes";
import type { Trip } from "../src/lib/types";

const SHARE_ID = "3f1c2b8e-9a4d-4e7f-8b21-5c6d7e8f9a0b";

// --- a fake sharing server: the RPC functions of supabase/schema.sql, in memory ------------------

function fakeServer() {
  const trips = new Map<string, { trip: unknown; members: string[]; updated_at: string; updated_by: string | null }>();
  const captures: (RemoteCapture & { trip_id: string })[] = [];
  const votes = new Map<string, { trip_id: string; item_key: string; author: string; vote: number; note: string | null; updated_at: string }>();
  let clock = Date.parse("2026-09-01T10:00:00Z");
  const ts = () => new Date((clock += 1000)).toISOString();
  const calls: string[] = [];
  let offline = false;
  const need = (id: unknown) => {
    const t = trips.get(String(id));
    if (!t) throw new ShareError("Paylaşılan gezi sunucuda bulunamadı.", "not_found");
    return t;
  };
  const rpc = (async (fn: string, rawArgs: Record<string, unknown>) => {
    if (offline) throw new ShareError("Paylaşım sunucusuna bağlanılamadı (internet?)", "offline");
    calls.push(fn);
    const a = JSON.parse(JSON.stringify(rawArgs)) as Record<string, any>; // over the wire
    switch (fn) {
      case "create_shared_trip": {
        if (!trips.has(a.p_id)) trips.set(a.p_id, { trip: a.p_trip, members: [a.p_author], updated_at: ts(), updated_by: a.p_author });
        return trips.get(a.p_id)!.updated_at;
      }
      case "get_shared_trip": {
        const t = need(a.p_id);
        if (a.p_author && !t.members.includes(a.p_author)) t.members.push(a.p_author);
        return [{ ...t }];
      }
      case "put_trip_settings": {
        const t = need(a.p_id);
        Object.assign(t, { trip: a.p_trip, updated_at: ts(), updated_by: a.p_author });
        return t.updated_at;
      }
      case "add_capture": {
        need(a.p_trip_id);
        const known = captures.find((c) => c.id === a.p_id);
        if (known) return known.seq;
        const row = { seq: captures.length + 1, id: a.p_id, trip_id: a.p_trip_id, author: a.p_author, created_at: ts(), capture: a.p_capture };
        captures.push(row);
        return row.seq;
      }
      case "captures_since": {
        need(a.p_trip_id);
        return captures
          .filter((c) => c.trip_id === a.p_trip_id && c.seq > a.p_since)
          .slice(0, a.p_limit)
          .map(({ trip_id: _t, ...c }) => c);
      }
      case "set_vote": {
        need(a.p_trip_id);
        votes.set(`${a.p_trip_id}|${a.p_item_key}|${a.p_author}`, {
          trip_id: a.p_trip_id,
          item_key: a.p_item_key,
          author: a.p_author,
          vote: a.p_vote,
          note: a.p_note ?? null,
          updated_at: ts(),
        });
        return clock;
      }
      case "votes_for": {
        need(a.p_trip_id);
        return [...votes.values()].filter((v) => v.trip_id === a.p_trip_id).map(({ trip_id: _t, ...v }) => v);
      }
    }
    throw new Error(`unknown rpc ${fn}`);
  }) as Rpc;
  return {
    rpc,
    trips,
    captures,
    votes,
    calls,
    ts,
    setOffline: (v: boolean) => (offline = v),
    /** Sabine saves a page into the shared trip on her computer. */
    addFrom(author: string, tripId: string, capture: Record<string, unknown>) {
      const row = { seq: captures.length + 1, id: crypto.randomUUID(), trip_id: tripId, author, created_at: ts(), capture: capture as never };
      captures.push(row);
      return row;
    },
  };
}

// --- the capture pipeline, offline ---------------------------------------------------------------

const base: Extraction = {
  category: "stay",
  name: "Jardim Stay",
  provider: "Booking.com",
  summary: "Ribeira'ya 10 dk",
  option_detail: null,
  city: "Porto",
  country: "Portekiz",
  country_code: "PT",
  location: { address: null, area: null, approximate: false },
  dates: { start: null, end: null, source: "none" },
  guests: { adults: null, children: null, rooms: null },
  price: { amount: 285, currency: "EUR", scope: "total", taxes_included: "yes", source: "page", evidence: "€ 285" },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null,
  metrics: null,
  highlights: [],
  concerns: [],
  review_summary: null,
  image_url: null,
  missing: [],
  trip: { existing_trip_id: null, new_trip_title: "Portekiz" },
  need_key: "stay:porto",
};

const deps: Deps = {
  // A Bangkok page would go to a new "Tayland" trip on its own: sharing must put it in the shared trip.
  extract: async (capture) =>
    capture.url?.includes("bangkok")
      ? { ...base, name: "Riva Bangkok", city: "Bangkok", country: "Tayland", country_code: "TH", trip: { existing_trip_id: null, new_trip_title: "Tayland" } }
      : capture.url?.includes("casa-azul")
        ? { ...base, name: "Casa Azul", price: { ...base.price, amount: 240, evidence: "€ 240" } }
        : base,
  heroImage: async () => null,
  geocode: async () => null,
};

const snapshot = (url: string, text: string) => ({ url, title: "t", pageText: text, viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] });

async function configured(name = "Emre") {
  const kv = memoryKV();
  await saveShareConfig({ url: "https://abcd1234.supabase.co", anonKey: "sb_publishable_test", name }, kv);
  return kv;
}

// --- tests ---------------------------------------------------------------------------------------

describe("share code", () => {
  it("carries server, key and trip in one pasteable string", () => {
    const code = encodeShareCode({ url: "https://AbCd1234.supabase.co/", anonKey: "sb_publishable_x", shareId: SHARE_ID, title: "Portekiz · Ekim ğüşıöç" });
    expect(code.startsWith("TR1:")).toBe(true);
    expect(code).toMatch(/^TR1:[A-Za-z0-9_-]+$/);
    expect(decodeShareCode(code)).toEqual({ url: "https://abcd1234.supabase.co", anonKey: "sb_publishable_x", shareId: SHARE_ID, title: "Portekiz · Ekim ğüşıöç" });
    // Pasted inside a message.
    expect(decodeShareCode(`Selam! Kod: ${code}\nGörüşürüz`)?.shareId).toBe(SHARE_ID);
  });

  it("refuses codes that aren't one or point anywhere but a Supabase project", () => {
    expect(decodeShareCode("merhaba")).toBeNull();
    expect(decodeShareCode("TR1:bm90LWpzb24")).toBeNull();
    const evil = "TR1:" + btoa(JSON.stringify({ u: "https://evil.example.com", k: "x", t: SHARE_ID })).replace(/=+$/, "");
    expect(decodeShareCode(evil)).toBeNull();
    const badId = "TR1:" + btoa(JSON.stringify({ u: "https://a.supabase.co", k: "x", t: "1" })).replace(/=+$/, "");
    expect(decodeShareCode(badId)).toBeNull();
    expect(normalizeServerUrl("http://a.supabase.co")).toBeNull();
    expect(normalizeServerUrl("https://a.supabase.co.evil.com")).toBeNull();
    expect(() => encodeShareCode({ url: "", anonKey: "k", shareId: SHARE_ID, title: null })).toThrow();
  });
});

describe("rpc client", () => {
  it("posts to /rest/v1/rpc/<fn> with the key; Authorization only for JWT keys", async () => {
    const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
    const fetchOk = (async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
      return new Response(JSON.stringify("trip-radar-share-1"), { status: 200 });
    }) as unknown as typeof fetch;
    await rpcClient({ url: "https://a.supabase.co/", anonKey: "sb_publishable_x" }, fetchOk)("share_ping", {});
    await rpcClient({ url: "https://a.supabase.co", anonKey: "eyJhbGci.x.y" }, fetchOk)("votes_for", { p_trip_id: SHARE_ID });
    expect(seen[0].url).toBe("https://a.supabase.co/rest/v1/rpc/share_ping");
    expect(seen[0].headers.apikey).toBe("sb_publishable_x");
    expect(seen[0].headers.Authorization).toBeUndefined();
    expect(seen[1].headers.Authorization).toBe("Bearer eyJhbGci.x.y");
    expect(JSON.parse(seen[1].body)).toEqual({ p_trip_id: SHARE_ID });
  });

  it("says what went wrong in Turkish", async () => {
    const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    const call = (f: typeof fetch) => rpcClient({ url: "https://a.supabase.co", anonKey: "k" }, f)("get_shared_trip", {}).then(() => { throw new Error("expected a failure"); }, (e: ShareError) => e);
    expect((await call(reply(400, { code: "P0002", message: "not_found" }))).code).toBe("not_found");
    expect((await call(reply(404, { code: "PGRST202", message: "Could not find the function" }))).code).toBe("setup");
    expect((await call(reply(401, { message: "Invalid API key" }))).code).toBe("auth");
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect((await call(offline)).message).toMatch(/bağlanılamadı/);
  });
});

describe("trip settings: last writer wins", () => {
  const s = (title: string): SyncedSettings => ({
    title,
    confirmedDates: null,
    budget: null,
    priorities: null,
    categoryPriorities: null,
    wantedAmenities: null,
    requirements: null,
  });
  const at = (iso: string) => Date.parse(iso);

  it("pushes a local change, pulls a remote one, adopts the same one", () => {
    const base = stableJson(s("A"));
    expect(resolveSettings({ local: s("A"), localAt: 0, base, remote: s("A"), remoteAt: "t1", seenAt: "t1" })).toBe("none");
    expect(resolveSettings({ local: s("B"), localAt: 0, base, remote: s("A"), remoteAt: "t1", seenAt: "t1" })).toBe("push");
    expect(resolveSettings({ local: s("A"), localAt: 0, base, remote: s("C"), remoteAt: "t2", seenAt: "t1" })).toBe("pull");
    expect(resolveSettings({ local: s("C"), localAt: 0, base, remote: s("C"), remoteAt: "t2", seenAt: "t1" })).toBe("adopt");
  });

  it("when both changed, the later change wins", () => {
    const base = stableJson(s("A"));
    const remoteAt = "2026-09-01T10:00:00.000Z";
    expect(resolveSettings({ local: s("B"), localAt: at("2026-09-01T10:05:00Z"), base, remote: s("C"), remoteAt, seenAt: "old" })).toBe("push");
    expect(resolveSettings({ local: s("B"), localAt: at("2026-09-01T09:55:00Z"), base, remote: s("C"), remoteAt, seenAt: "old" })).toBe("pull");
  });

  it("compares settings whatever the key order", () => {
    expect(stableJson({ b: 1, a: { d: 2, c: [1, { f: 1, e: 2 }] } })).toBe(stableJson({ a: { c: [1, { e: 2, f: 1 }], d: 2 }, b: 1 }));
  });
});

describe("votes", () => {
  it("keys an option the same on both computers, never by its local id", () => {
    expect(voteKeyOf({ key: "booking:pt/jardim-stay", url: null, captureIds: ["c1"], category: "stay" })).toBe("booking:pt/jardim-stay");
    expect(voteKeyOf({ key: null, url: null, captureIds: ["c1"], category: "stay" })).toBe("capture:c1");
    expect(voteKeyOf({ key: null, url: "https://www.skyscanner.net/transport/flights/ist/opo/", captureIds: ["c2"], category: "flight" })).toBe("capture:c2");
    expect(voteKeyOf({ key: null, url: null, captureIds: [], category: "stay", origin: "chat" })).toBeNull();
  });

  it("keeps a vote given offline until the server has it", () => {
    const remote: Vote[] = [
      { itemKey: "k1", author: "Emre", vote: -1, note: null, updatedAt: "t1" },
      { itemKey: "k1", author: "Sabine", vote: -1, note: null, updatedAt: "t1" },
    ];
    const local = withVote(remote, "k1", "Emre", 1);
    const merged = mergeVotes(local, remote, "Emre");
    expect(merged.find((v) => v.author === "Emre")).toMatchObject({ vote: 1, pending: true });
    // Once the server has it, it's no longer pending.
    const arrived = mergeVotes(merged, [{ ...remote[0], vote: 1, updatedAt: "t2" }, remote[1]], "Emre");
    expect(arrived.find((v) => v.author === "Emre")).toEqual({ itemKey: "k1", author: "Emre", vote: 1, note: null, updatedAt: "t2" });
  });

  it("tallies: me first, and 'both don't want it' only when everyone who voted said 👎", () => {
    const v = (author: string, vote: -1 | 0 | 1, itemKey = "k1"): Vote => ({ itemKey, author, vote, note: null, updatedAt: "t" });
    expect(tallyVotes([v("Sabine", -1), v("Emre", 1)], "k1", "Emre")).toEqual({ mine: 1, line: "Emre 👍 · Sabine 👎", allNo: false, allYes: false });
    expect(tallyVotes([v("Sabine", -1), v("Emre", -1)], "k1", "Emre").allNo).toBe(true);
    expect(tallyVotes([v("Sabine", -1)], "k1", "Emre").allNo).toBe(false); // one person isn't "both"
    expect(tallyVotes([v("Sabine", -1), v("Emre", 0)], "k1", "Emre")).toMatchObject({ mine: 0, line: "Sabine 👎", allNo: false });
    expect(tallyVotes([v("Sabine", 1), v("Emre", 1)], "k1", "Emre").allYes).toBe(true);
    expect(tallyVotes([v("Sabine", -1, "k2")], "k1", "Emre").line).toBeNull();
  });
});

describe("remote captures", () => {
  it("are checked like page input: only web links and image data", () => {
    const row = (capture: Record<string, unknown>): RemoteCapture => ({ seq: 1, id: "c9", author: "Sabine", created_at: "t", capture: capture as never });
    const c = fromShared(
      row({ kind: "extension", url: "javascript:alert(1)", pageText: "Otel", screenshot: "data:text/html,<b>", images: [{ src: "javascript:x", alt: "", inView: true }] }),
      "trip-1",
      "Emre",
      5,
    )!;
    expect(c).toMatchObject({ id: "c9", url: null, screenshot: null, images: [], status: "pending", forTripId: "trip-1", sharedBy: "Sabine", sharedAt: 5 });
    expect(fromShared(row({ kind: "extension" }), "trip-1", "Emre", 5)).toBeNull();
    // My own capture coming back (e.g. after reinstalling) isn't "added by" anyone.
    expect(fromShared({ ...row({ url: "https://a.com" }), author: "emre" }, "trip-1", "Emre", 5)?.sharedBy).toBeUndefined();
  });
});

describe("sharing a trip end to end (fake server)", () => {
  it("shares, uploads once, pulls the other traveller's pages into the trip, syncs settings and votes", async () => {
    const server = fakeServer();
    const kv = await configured("Emre");
    const sync = (tripId: string) => syncTrip(tripId, { rpc: server.rpc, me: "Emre", kv, shrink: async () => null });

    // Emre's trip with one saved stay.
    await saveSnapshot(snapshot("https://www.booking.com/hotel/pt/jardim-stay.html", "Jardim Stay € 285"), "data:image/jpeg;base64,AAAA");
    await processPending(deps);
    const [trip] = await listTrips();
    expect(trip.title).toBe("Portekiz");

    // Paylaş → one code; the server has the trip's settings.
    const code = await shareTrip(trip.id, { kv, rpc: server.rpc });
    const decoded = decodeShareCode(code)!;
    expect(decoded).toMatchObject({ url: "https://abcd1234.supabase.co", anonKey: "sb_publishable_test", title: "Portekiz" });
    const shared = (await db()).get("trips", trip.id);
    expect((await shared)?.shareId).toBe(decoded.shareId);
    expect(server.trips.get(decoded.shareId)?.trip).toMatchObject({ title: "Portekiz" });
    expect(await shareTrip(trip.id, { kv, rpc: server.rpc })).toBe(code); // same code again

    // The existing capture goes up once.
    expect(await sync(trip.id)).toEqual({ received: 0, uploaded: 1 });
    expect(server.captures).toHaveLength(1);
    expect(server.captures[0].capture).toMatchObject({ url: "https://www.booking.com/hotel/pt/jardim-stay.html", pageText: "Jardim Stay € 285", screenshot: null });
    expect(await sync(trip.id)).toEqual({ received: 0, uploaded: 0 });
    expect(server.captures).toHaveLength(1);

    // Sabine saves a Bangkok hotel into the shared trip: here it lands in the shared trip, not a new "Tayland".
    server.addFrom("Sabine", decoded.shareId, { kind: "extension", url: "https://www.booking.com/hotel/th/riva-bangkok.html", title: "Riva", pageText: "Riva Bangkok € 285", jsonLd: [], meta: {}, capturedAt: 1 });
    expect(await sync(trip.id)).toEqual({ received: 1, uploaded: 0 });
    await processPending(deps);
    expect((await listTrips()).map((t) => t.title)).toEqual(["Portekiz"]);
    expect((await listItems(trip.id)).map((i) => i.name).sort()).toEqual(["Jardim Stay", "Riva Bangkok"]);
    expect((await listMessages(trip.id)).some((m) => m.text.includes("Riva Bangkok kaydedildi") && m.text.includes("(Sabine ekledi)"))).toBe(true);
    // Her capture is never sent back, and nothing arrives twice.
    expect(await sync(trip.id)).toEqual({ received: 0, uploaded: 0 });
    expect(server.captures).toHaveLength(2);

    // A page Emre saves later into the trip goes up on the next sync.
    await saveSnapshot(snapshot("https://www.booking.com/hotel/pt/casa-azul.html", "Casa Azul € 240"), null);
    await processPending(deps);
    expect((await sync(trip.id)).uploaded).toBe(1);
    expect(server.captures).toHaveLength(3);

    // Settings: Sabine sets a budget → it arrives; Emre renames → it goes up.
    const remoteTrip = server.trips.get(decoded.shareId)!;
    await server.rpc("put_trip_settings", { p_id: decoded.shareId, p_trip: { ...(remoteTrip.trip as object), budget: { amount: 1500, currency: "EUR" } }, p_author: "Sabine" });
    await sync(trip.id);
    const afterPull = (await (await db()).get("trips", trip.id)) as Trip;
    expect(afterPull.budget).toEqual({ amount: 1500, currency: "EUR" });
    expect((await listMessages(trip.id)).some((m) => m.text === "Sabine gezinin ayarlarını güncelledi")).toBe(true);
    await (await db()).put("trips", { ...afterPull, title: "Porto & Lizbon", updatedAt: Date.now() });
    await sync(trip.id);
    expect(server.trips.get(decoded.shareId)?.trip).toMatchObject({ title: "Porto & Lizbon", budget: { amount: 1500, currency: "EUR" } });
    expect(server.trips.get(decoded.shareId)?.updated_by).toBe("Emre");

    // Votes: Emre 👍, Sabine 👎 → both see "Emre 👍 · Sabine 👎".
    const jardim = (await listItems(trip.id)).find((i) => i.name === "Jardim Stay")!;
    const current = (await (await db()).get("trips", trip.id)) as Trip;
    await castVote(current, jardim, 1, { kv });
    expect((await getVotes(decoded.shareId, kv))[0]).toMatchObject({ vote: 1, pending: true });
    await server.rpc("set_vote", { p_trip_id: decoded.shareId, p_item_key: voteKeyOf(jardim), p_author: "Sabine", p_vote: -1, p_note: null });
    await sync(trip.id);
    const votes = await getVotes(decoded.shareId, kv);
    expect(votes.every((v) => !v.pending)).toBe(true);
    expect(tallyVotes(votes, voteKeyOf(jardim), "Emre").line).toBe("Emre 👍 · Sabine 👎");

    // Status for the board.
    const state = await getSyncState(trip.id, kv);
    expect(state).toMatchObject({ error: null, members: ["Emre"] });
    expect(state?.lastSyncAt).toBeGreaterThan(0);

    // Offline: the error is kept in Turkish, a new vote waits, and goes when back online.
    server.setOffline(true);
    await castVote(current, jardim, -1, { kv });
    await sync(trip.id);
    expect((await getSyncState(trip.id, kv))?.error).toMatch(/bağlanılamadı/);
    server.setOffline(false);
    await sync(trip.id);
    expect((await getSyncState(trip.id, kv))?.error).toBeNull();
    expect(server.votes.get(`${decoded.shareId}|${voteKeyOf(jardim)}|Emre`)?.vote).toBe(-1);

    // Stop sharing: the trip stays, nothing is synced anymore.
    const callsBefore = server.calls.length;
    await stopSharing(trip.id, { kv });
    expect(((await (await db()).get("trips", trip.id)) as Trip).shareId).toBeUndefined();
    expect(await sync(trip.id)).toEqual({ received: 0, uploaded: 0 });
    expect(server.calls.length).toBe(callsBefore);
  });

  it("joins with a pasted code: settings from the code when empty, the trip from the server", async () => {
    const server = fakeServer();
    await server.rpc("create_shared_trip", {
      p_id: SHARE_ID,
      p_trip: { title: "Lizbon", confirmedDates: { start: "2026-10-08", end: "2026-10-12" }, budget: null, priorities: { price: 4 } },
      p_author: "Emre",
    });
    server.addFrom("Emre", SHARE_ID, { kind: "extension", url: "https://www.booking.com/hotel/pt/casa-azul.html", pageText: "Casa Azul € 240", capturedAt: 1 });
    const kv = memoryKV(); // Sabine hasn't set anything up
    const code = encodeShareCode({ url: "https://abcd1234.supabase.co", anonKey: "sb_publishable_test", shareId: SHARE_ID, title: "Lizbon" });

    await expect(joinSharedTrip(code, "", { kv, rpc: server.rpc })).rejects.toThrow(/Adını/);
    const tripId = await joinSharedTrip(`Kod: ${code}`, "Sabine", { kv, rpc: server.rpc });
    expect(await getShareConfig(kv)).toEqual({ url: "https://abcd1234.supabase.co", anonKey: "sb_publishable_test", name: "Sabine" });
    const trip = (await (await db()).get("trips", tripId)) as Trip;
    expect(trip).toMatchObject({ title: "Lizbon", shareId: SHARE_ID, confirmedDates: { start: "2026-10-08", end: "2026-10-12" }, priorities: { price: 4 } });
    expect(settingsOf(trip).title).toBe("Lizbon");
    expect(server.trips.get(SHARE_ID)?.members).toEqual(["Emre", "Sabine"]);
    // Joining again opens the same trip.
    expect(await joinSharedTrip(code, "Sabine", { kv, rpc: server.rpc })).toBe(tripId);

    // The first sync brings Emre's page; nothing goes back up; the settings don't bounce back.
    const putsBefore = server.calls.filter((c) => c === "put_trip_settings").length;
    expect(await syncTrip(tripId, { rpc: server.rpc, me: "Sabine", kv })).toEqual({ received: 1, uploaded: 0 });
    await processPending(deps);
    expect((await listItems(tripId)).map((i) => i.name)).toEqual(["Casa Azul"]);
    expect(await syncTrip(tripId, { rpc: server.rpc, me: "Sabine", kv })).toEqual({ received: 0, uploaded: 0 });
    expect(server.calls.filter((c) => c === "put_trip_settings").length).toBe(putsBefore);

    // A code for another server is refused (one sharing server per computer).
    const other = encodeShareCode({ url: "https://other9999.supabase.co", anonKey: "k", shareId: crypto.randomUUID(), title: null });
    await expect(joinSharedTrip(other, "Sabine", { kv, rpc: server.rpc })).rejects.toThrow(/başka bir paylaşım sunucusuna/);
    await expect(joinSharedTrip("TR1:bozuk", "Sabine", { kv, rpc: server.rpc })).rejects.toThrow(/paylaşım kodu değil/);
  });
});
