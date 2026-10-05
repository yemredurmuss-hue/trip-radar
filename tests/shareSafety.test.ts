// tests/shareSafety.test.ts — paylaşım güvenliği (0.37): the other traveller's change of the shared settings
// shows as a notice with "Geri al", in words; the server's history when it has one, nothing broken when not.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { ShareError, type Rpc } from "../src/lib/share/client";
import { addNotice, dismissNotice, getNotices, getUndone, MAX_NOTICES, undoNotice } from "../src/lib/share/notices";
import { applyFields, asSettings, changedFields, settingsOf, stableJson, type SyncedSettings } from "../src/lib/share/settings";
import { changeHeadline, diffSettings, lineText } from "../src/lib/share/settingsDiff";
import { fetchSettingsHistory, fromHistoryRows } from "../src/lib/share/settingsHistory";
import { freshState, syncTrip } from "../src/lib/share/sync";
import { getSyncState, memoryKV, setSyncState } from "../src/lib/share/store";
import type { Trip } from "../src/lib/types";

afterEach(() => setLang("tr"));

const SHARE_ID = "3f1c2b8e-9a4d-4e7f-8b21-5c6d7e8f9a0b";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1",
  title: "Porto ve Madeira",
  confirmedDates: { start: "2026-10-07", end: "2026-10-18" },
  budget: { amount: 100000, currency: "TRY" },
  heroImage: null,
  shareId: SHARE_ID,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const s = (over: Partial<SyncedSettings> = {}): SyncedSettings => ({ ...settingsOf(trip()), ...over });

// --- the words --------------------------------------------------------------------------------------

describe("what changed, in words", () => {
  it("each field, in Turkish", () => {
    const text = (over: Partial<SyncedSettings>) => diffSettings(s(), s(over)).map(lineText);
    expect(text({ confirmedDates: { start: "2026-10-08", end: "2026-10-18" } })).toEqual(["Tarihler: 7–18 Ekim → 8–18 Ekim"]);
    expect(text({ budget: { amount: 80000, currency: "TRY" } })).toEqual(["Bütçe: ₺100.000 → ₺80.000"]);
    expect(text({ budget: null })).toEqual(["Bütçe: ₺100.000 → yok"]);
    expect(text({ title: "Porto & Lizbon" })).toEqual(["Ad: Porto ve Madeira → Porto & Lizbon"]);
    expect(diffSettings(s({ priorities: { price: 4 } }), s({ priorities: { price: 3 } })).map(lineText)).toEqual(["Öncelikler: Fiyat çok önemli → önemli"]);
    expect(diffSettings(s(), s({ priorities: { location: 4 } })).map(lineText)).toEqual(["Öncelikler: Konum varsayılan → çok önemli"]);
    expect(diffSettings(s(), s({ categoryPriorities: { stay: { price: 1 } } })).map(lineText)).toEqual(["Öncelikler: Konaklama · Fiyat varsayılan → az"]);
    expect(text({ wantedAmenities: ["mutfak", "klima"] })).toEqual(["İstenen olanaklar: yok → mutfak, klima"]);
    expect(text({ requirements: [{ kind: "free_cancellation" }, { kind: "direct_flight" }] })).toEqual(["Şartlar: yok → ücretsiz iptal, direkt uçuş"]);
  });

  it("each field, in English", () => {
    setLang("en");
    const text = (over: Partial<SyncedSettings>) => diffSettings(s(), s(over)).map(lineText);
    expect(text({ confirmedDates: { start: "2026-10-08", end: "2026-10-18" } })).toEqual(["Dates: 7–18 October → 8–18 October"]);
    // (en-GB writes the lira as "TRY 80,000"; the euro as below.)
    expect(diffSettings(s({ budget: { amount: 1500, currency: "EUR" } }), s({ budget: { amount: 1200, currency: "EUR", ceiling: 1400 } })).map(lineText)).toEqual([
      "Budget: €1,500 → €1,200 (at most €1,400)",
    ]);
    expect(text({ title: "Porto & Lisbon" })).toEqual(["Name: Porto ve Madeira → Porto & Lisbon"]);
    expect(diffSettings(s({ priorities: { price: 4 } }), s({ priorities: { price: 3 } })).map(lineText)).toEqual(["Priorities: Price very important → important"]);
    expect(text({ wantedAmenities: ["mutfak"] })).toEqual(["Wanted amenities: none → kitchen"]);
    expect(text({ requirements: [{ kind: "free_cancellation" }] })).toEqual(["Requirements: none → free cancellation"]);
    expect(changeHeadline("Sabine", ["budget"])).toBe("Sabine changed the budget");
  });

  it("the headline names the field, or the settings when several changed", () => {
    expect(changeHeadline("Sabine", ["confirmedDates"])).toBe("Sabine tarihleri değiştirdi");
    expect(changeHeadline("Sabine", ["budget"])).toBe("Sabine bütçeyi değiştirdi");
    expect(changeHeadline("Sabine", ["priorities", "categoryPriorities"])).toBe("Sabine öncelikleri değiştirdi");
    expect(changeHeadline("Sabine", ["budget", "title"])).toBe("Sabine gezi ayarlarını değiştirdi");
  });

  it("key order and junk from the server don't make a change", () => {
    expect(changedFields(s({ budget: { amount: 1, currency: "EUR" } }), s({ budget: { currency: "EUR", amount: 1 } as never }))).toEqual([]);
    expect(diffSettings(null, { title: 5, budget: "x", confirmedDates: { start: 1 } }).map(lineText)).toEqual([]);
    expect(asSettings("nonsense").title).toBeNull();
  });

  it("restores only the fields asked for; a missing title never empties the name", () => {
    const now = trip({ title: "Yeni ad", budget: { amount: 80000, currency: "TRY" } });
    const back = applyFields(now, s(), ["budget"]);
    expect(back.budget).toEqual({ amount: 100000, currency: "TRY" });
    expect(back.title).toBe("Yeni ad");
    expect(applyFields(now, asSettings({}), ["title"]).title).toBe("Yeni ad");
    expect(applyFields(trip({ priorities: { price: 3 } }), s(), ["priorities"]).priorities).toBeUndefined();
  });
});

// --- notices ------------------------------------------------------------------------------------------

describe("notices", () => {
  const change = (at: string, over: Partial<SyncedSettings> = { budget: { amount: 80000, currency: "TRY" } }, author = "Sabine") => ({
    author,
    at,
    prev: s(),
    next: s(over),
    me: "Emre",
    now: 1,
  });

  it("one per server change, newest first, at most 20", async () => {
    const kv = memoryKV();
    expect(await addNotice("t1", change("2026-10-05T10:00:00Z"), kv)).toBe(true);
    expect(await addNotice("t1", change("2026-10-05T10:00:00Z"), kv)).toBe(false); // the same change again
    for (let i = 1; i <= 25; i++) await addNotice("t1", change(`2026-10-05T11:${String(i).padStart(2, "0")}:00Z`), kv);
    const notices = await getNotices("t1", kv);
    expect(notices).toHaveLength(MAX_NOTICES);
    expect(notices[0].at).toBe("2026-10-05T11:25:00Z");
    expect(new Set(notices.map((n) => n.id)).size).toBe(MAX_NOTICES);
    expect(notices[0]).toMatchObject({ author: "Sabine", fields: ["budget"] });
  });

  it("none for my own change (my other computer), none without an author, none when nothing differs", async () => {
    const kv = memoryKV();
    expect(await addNotice("t1", change("a", undefined, " emre "), kv)).toBe(false);
    expect(await addNotice("t1", { ...change("b"), author: null }, kv)).toBe(false);
    expect(await addNotice("t1", { ...change("c"), next: s() }, kv)).toBe(false);
    expect(await getNotices("t1", kv)).toEqual([]);
  });

  it("'Tamam' takes one away; the others stay", async () => {
    const kv = memoryKV();
    await addNotice("t1", change("1"), kv);
    await addNotice("t1", change("2"), kv);
    const [newest] = await getNotices("t1", kv);
    await dismissNotice("t1", newest.id, kv);
    expect((await getNotices("t1", kv)).map((n) => n.at)).toEqual(["1"]);
  });
});

// --- with the sync ------------------------------------------------------------------------------------

/** The sharing server in memory; `history` logs like history.sql's trigger. `old`: a server without history.sql or profiles.sql. */
function fakeServer({ old = false } = {}) {
  const trips = new Map<string, { trip: unknown; members: string[]; updated_at: string; updated_by: string | null }>();
  const history: { id: number; trip_id: string; author: string | null; prev: unknown; next: unknown; created_at: string }[] = [];
  let clock = Date.parse("2026-10-05T18:00:00Z");
  const ts = () => new Date((clock += 60_000)).toISOString();
  const calls: string[] = [];
  const need = (id: unknown) => {
    const t = trips.get(String(id));
    if (!t) throw new ShareError("not found", "not_found");
    return t;
  };
  const rpc = (async (fn: string, rawArgs: Record<string, unknown>) => {
    calls.push(fn);
    const a = JSON.parse(JSON.stringify(rawArgs)) as Record<string, any>;
    switch (fn) {
      case "get_shared_trip": {
        const t = need(a.p_id);
        if (a.p_author && !t.members.includes(a.p_author)) t.members.push(a.p_author);
        return [{ ...t }];
      }
      case "put_trip_settings": {
        const t = need(a.p_id);
        const prev = t.trip;
        Object.assign(t, { trip: a.p_trip, updated_at: ts(), updated_by: a.p_author });
        if (stableJson(prev) !== stableJson(a.p_trip)) history.push({ id: history.length + 1, trip_id: a.p_id, author: a.p_author, prev, next: a.p_trip, created_at: t.updated_at });
        return t.updated_at;
      }
      case "captures_since":
      case "votes_for":
        need(a.p_trip_id);
        return [];
      case "settings_history_for":
        if (old) break;
        need(a.p_id);
        return history.filter((h) => h.trip_id === a.p_id).reverse().slice(0, a.p_limit).map(({ trip_id: _t, ...h }) => h);
    }
    // PostgREST for a function that isn't there.
    throw new ShareError("Sunucu kurulumu eksik", "setup");
  }) as Rpc;
  return {
    rpc,
    trips,
    history,
    calls,
    /** Sabine changes the shared settings on her computer. */
    sabine(change: Partial<SyncedSettings>) {
      const t = need(SHARE_ID);
      return rpc("put_trip_settings", { p_id: SHARE_ID, p_trip: { ...(t.trip as object), ...change }, p_author: "Sabine" });
    },
  };
}

async function sharedTrip(server: ReturnType<typeof fakeServer>, kv = memoryKV()) {
  const t = trip();
  await (await db()).put("trips", t);
  server.trips.set(SHARE_ID, { trip: settingsOf(t), members: ["Emre", "Sabine"], updated_at: "2026-10-05T17:00:00.000Z", updated_by: "Emre" });
  await setSyncState(t.id, { ...freshState(SHARE_ID), settingsBase: stableJson(settingsOf(t)), settingsAt: "2026-10-05T17:00:00.000Z" }, kv);
  return { kv, sync: () => syncTrip(t.id, { rpc: server.rpc, me: "Emre", kv }) };
}

describe("the sync brings a notice", () => {
  it("Sabine's change arrives with what was here before; 'Geri al' pushes the old dates back up", async () => {
    const server = fakeServer();
    const { kv, sync } = await sharedTrip(server);
    await server.sabine({ confirmedDates: { start: "2026-10-08", end: "2026-10-18" } });
    await sync();

    const d = await db();
    expect((await d.get("trips", "t1"))?.confirmedDates).toEqual({ start: "2026-10-08", end: "2026-10-18" });
    const [notice] = await getNotices("t1", kv);
    expect(notice).toMatchObject({ author: "Sabine", fields: ["confirmedDates"] });
    expect(diffSettings(notice.prev, notice.next).map(lineText)).toEqual(["Tarihler: 7–18 Ekim → 8–18 Ekim"]);
    expect(changeHeadline(notice.author, notice.fields)).toBe("Sabine tarihleri değiştirdi");

    // The next sync brings nothing new: no second notice.
    await sync();
    expect(await getNotices("t1", kv)).toHaveLength(1);

    // Geri al: the dates back here, then pushed through the normal settings path (a new change on the server).
    expect(await undoNotice("t1", notice, "Emre", kv)).toBe(true);
    expect((await d.get("trips", "t1"))?.confirmedDates).toEqual({ start: "2026-10-07", end: "2026-10-18" });
    expect(await getNotices("t1", kv)).toEqual([]);
    expect((await getUndone("t1", kv)).map((m) => m.id)).toEqual([notice.id]);
    await sync();
    expect(server.trips.get(SHARE_ID)).toMatchObject({ updated_by: "Emre", trip: { confirmedDates: { start: "2026-10-07", end: "2026-10-18" } } });
    expect(server.history.map((h) => h.author)).toEqual(["Sabine", "Emre"]);
    expect((await listMessages("t1")).map((m) => m.text)).toContain("Ortak ayar geri alındı (Sabine değiştirmişti)");
    // My own change coming back from the server is no notice.
    await sync();
    expect(await getNotices("t1", kv)).toEqual([]);
  });

  it("'Geri al' on one change leaves a later change of another field as it is", async () => {
    const server = fakeServer();
    const { kv, sync } = await sharedTrip(server);
    await server.sabine({ budget: { amount: 80000, currency: "TRY" } });
    await sync();
    await server.sabine({ title: "Porto & Lizbon" });
    await sync();
    const notices = await getNotices("t1", kv);
    expect(notices.map((n) => n.fields)).toEqual([["title"], ["budget"]]);
    await undoNotice("t1", notices[1], "Emre", kv);
    const t = await (await db()).get("trips", "t1");
    expect(t).toMatchObject({ title: "Porto & Lizbon", budget: { amount: 100000, currency: "TRY" } });
  });

  it("no notice for my own change made on my other computer", async () => {
    const server = fakeServer();
    const { kv, sync } = await sharedTrip(server);
    const t = server.trips.get(SHARE_ID)!;
    await server.rpc("put_trip_settings", { p_id: SHARE_ID, p_trip: { ...(t.trip as object), title: "Laptoptan" }, p_author: "Emre" });
    await sync();
    expect((await (await db()).get("trips", "t1"))?.title).toBe("Laptoptan");
    expect(await getNotices("t1", kv)).toEqual([]);
  });

  it("an old server (no history.sql, no profiles.sql): the sync goes through, the history is just empty", async () => {
    const server = fakeServer({ old: true });
    const { kv, sync } = await sharedTrip(server);
    await server.sabine({ budget: { amount: 80000, currency: "TRY" } });
    await sync();
    const state = await getSyncState("t1", kv);
    expect(state?.error).toBeNull();
    expect(state?.lastSyncAt).toBeGreaterThan(0);
    expect(await getNotices("t1", kv)).toHaveLength(1); // the notice needs no server help
    expect(await fetchSettingsHistory(server.rpc, SHARE_ID)).toBeNull();
    expect(await fetchSettingsHistory(null, SHARE_ID)).toBeNull();
    expect(await fetchSettingsHistory(server.rpc, undefined)).toBeNull();
  });

  it("a server with history.sql gives every change, newest first, with who and what", async () => {
    const server = fakeServer();
    await sharedTrip(server);
    await server.sabine({ budget: { amount: 80000, currency: "TRY" } });
    await server.sabine({ confirmedDates: { start: "2026-10-08", end: "2026-10-18" } });
    const history = await fetchSettingsHistory(server.rpc, SHARE_ID);
    expect(history?.map((h) => [h.author, h.fields])).toEqual([
      ["Sabine", ["confirmedDates"]],
      ["Sabine", ["budget"]],
    ]);
    expect(fromHistoryRows([{ id: 1, author: "x", prev: {}, next: {}, created_at: "t" }, { nonsense: true }, null])).toEqual([]);
    expect(fromHistoryRows("nope")).toEqual([]);
  });
});
