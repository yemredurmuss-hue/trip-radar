// tests/trash.test.ts — Çöp kutusu (paylaşım güvenliği, 0.37): nothing deleted is gone for 30 days.
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { db, DB_VERSION, exportAll, listMessages } from "../src/lib/db";
import { addDoc, listDocMeta, restoreDoc, takeDoc, takeDocsOf } from "../src/lib/docs";
import { deleteItem, restoreItem } from "../src/lib/removal";
import { daysLeft, dropTrash, emptyTrash, listTrash, purgeTrash, restoreTrash, trashTrip, TRASH_DAYS } from "../src/lib/trash";
import { removeItem, undo } from "../src/app/actions";
import type { Analysis, Capture, ChatMessage, Preference, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const DAY = 24 * 3600e3;

const trip = (over: Partial<Trip> = {}): Trip => ({ id: "t1", title: "Porto", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });
const capture = (id: string): Capture => ({
  id, kind: "extension", url: `https://example.com/${id}`, title: id, pageText: "x", viewportText: "", selection: "", jsonLd: [], meta: {},
  screenshot: "data:image/jpeg;base64,AAAA", capturedAt: 1, status: "done", error: null, itemId: null,
});
const message = (id: string, tripId: string, role: ChatMessage["role"] = "event"): ChatMessage => ({ id, tripId, role, content: null, text: id, choices: [], createdAt: 1 });

// First in the file: the database as 0.36 left it (version 4), with data, opened by this version.
describe("upgrading the database to the trash (v4 → v5)", () => {
  it("keeps every record and adds an empty trash", async () => {
    const old = await openDB("trip-radar", 4, {
      upgrade(d) {
        d.createObjectStore("trips", { keyPath: "id" });
        d.createObjectStore("captures", { keyPath: "id" }).createIndex("status", "status");
        const items = d.createObjectStore("items", { keyPath: "id" });
        items.createIndex("tripId", "tripId");
        items.createIndex("key", "key");
        d.createObjectStore("messages", { keyPath: "id" }).createIndex("tripId", "tripId");
        d.createObjectStore("preferences", { keyPath: "id" });
        d.createObjectStore("analyses", { keyPath: "key" }).createIndex("tripId", "tripId");
        d.createObjectStore("geocache", { keyPath: "query" });
        d.createObjectStore("listings", { keyPath: "key" });
        const docs = d.createObjectStore("docs", { keyPath: "id" });
        docs.createIndex("itemId", "itemId");
        docs.createIndex("tripId", "tripId");
      },
    });
    const kept = makeItem({ id: "old-item", tripId: "old-trip", name: "Casa do Rio" });
    await old.put("trips", trip({ id: "old-trip", title: "Eski gezi" }));
    await old.put("items", kept);
    await old.put("messages", message("old-msg", "old-trip"));
    await old.put("captures", capture("old-cap"));
    await old.put("docs", { id: "old-doc", itemId: "old-item", tripId: "old-trip", name: "a.pdf", type: "application/pdf", size: 1, blob: new Blob(["a"]), addedAt: 1 });
    old.close();

    const d = await db();
    expect(d.version).toBe(DB_VERSION);
    expect([...d.objectStoreNames].sort()).toEqual(["analyses", "captures", "docs", "geocache", "items", "listings", "messages", "preferences", "trash", "trashData", "trips"]);
    expect([...d.transaction("trash").store.indexNames].sort()).toEqual(["deletedAt", "tripId"]);
    expect((await d.get("trips", "old-trip"))?.title).toBe("Eski gezi");
    expect(await d.get("items", "old-item")).toEqual(kept);
    expect(await d.get("messages", "old-msg")).toBeTruthy();
    expect(await d.get("captures", "old-cap")).toBeTruthy();
    expect((await listDocMeta("old-trip")).map((x) => x.name)).toEqual(["a.pdf"]);
    expect(await d.count("trash")).toBe(0);

    // And the old records can be deleted and restored like new ones.
    const removed = await deleteItem(kept);
    expect(await d.count("trash")).toBe(1);
    await restoreItem(removed);
    expect(await d.get("items", "old-item")).toEqual(kept);
    expect(await d.count("trash")).toBe(0);
  });
});

describe("a deleted card waits in the trash", () => {
  it("goes there with its files; 'Geri getir' brings both back with their ids", async () => {
    const d = await db();
    const card = makeItem({ tripId: "c1", name: "Douro tekne turu", status: "chosen" });
    await d.put("items", card);
    await addDoc(card, new File(["a"], "bilet.pdf", { type: "application/pdf" }));
    const removed = await deleteItem(card);
    expect(removed.trashId).toBeTruthy();
    expect(await d.get("items", card.id)).toBeUndefined();

    const [entry] = await listTrash({ tripId: "c1" });
    expect(entry).toMatchObject({ id: removed.trashId, tripId: "c1", kind: "item", label: "Douro tekne turu" });
    expect(daysLeft(entry)).toBe(TRASH_DAYS);

    const result = await restoreTrash(entry.id);
    expect(result).toMatchObject({ restored: 2, skipped: 0 });
    expect(await d.get("items", card.id)).toEqual(card);
    expect((await listDocMeta("c1")).map((x) => x.name)).toEqual(["bilet.pdf"]);
    expect(await listTrash({ tripId: "c1" })).toEqual([]);
    expect((await listMessages("c1")).map((m) => m.text)).toEqual(["Douro tekne turu silindi", "Douro tekne turu çöp kutusundan geri getirildi"]);
  });

  it("the toast's 'Geri al' takes the entry out of the trash too", async () => {
    const card = makeItem({ tripId: "c2", name: "Tiyatro" });
    await (await db()).put("items", card);
    const removed = await deleteItem(card);
    expect(await listTrash({ tripId: "c2" })).toHaveLength(1);
    await restoreItem(removed);
    expect(await listTrash({ tripId: "c2" })).toEqual([]);
  });

  it("a record with the same id there again is left as it is and counted", async () => {
    const d = await db();
    const card = makeItem({ tripId: "c3", name: "Lagos otobüsü" });
    await d.put("items", card);
    const removed = await deleteItem(card);
    await d.put("items", { ...card, name: "Yeni hâli" });
    const result = await restoreTrash(removed.trashId!);
    expect(result).toMatchObject({ restored: 0, skipped: 1 });
    expect((await d.get("items", card.id))?.name).toBe("Yeni hâli");
    expect(await listTrash({ tripId: "c3" })).toEqual([]);
  });

  it("the board's callers keep working: removeItem goes to the trash, a one-tap add taken back doesn't", async () => {
    const d = await db();
    const card = makeItem({ tripId: "c4", name: "Majestic Café" });
    await d.put("items", card);
    const removed = await removeItem(card);
    expect(removed.item.name).toBe("Majestic Café");
    expect(await listTrash({ tripId: "c4" })).toHaveLength(1);
    await undo({ kind: "removed", removed });
    expect(await d.get("items", card.id)).toEqual(card);
    expect(await listTrash({ tripId: "c4" })).toEqual([]);

    const added = makeItem({ tripId: "c4", name: "Otobüs" });
    await d.put("items", added);
    await undo({ kind: "added", item: added, label: "Otobüs" });
    expect(await d.get("items", added.id)).toBeUndefined();
    expect(await listTrash({ tripId: "c4" })).toEqual([]);
  });

  it("a card that isn't there leaves no empty entry", async () => {
    const ghost = makeItem({ tripId: "c5", name: "Yok" });
    const removed = await deleteItem(ghost);
    expect(removed.trashId).toBeUndefined();
    expect(await listTrash({ tripId: "c5" })).toEqual([]);
  });
});

describe("a deleted trip waits in the trash", () => {
  async function seed() {
    const d = await db();
    const t = trip({ id: "p1", title: "Porto ve Madeira", shareId: "3f1c2b8e-9a4d-4e7f-8b21-5c6d7e8f9a0b" });
    const a = makeItem({ id: "p1-a", tripId: "p1", name: "Jardim Stay", captureIds: ["cap-a", "cap-shared"] });
    const b = makeItem({ id: "p1-b", tripId: "p1", name: "Douro", captureIds: ["cap-b"] });
    const other = makeItem({ id: "x-a", tripId: "other", name: "Bangkok", captureIds: ["cap-shared"] });
    for (const i of [a, b, other]) await d.put("items", i);
    for (const id of ["cap-a", "cap-b", "cap-shared"]) await d.put("captures", capture(id));
    await d.put("trips", t);
    await d.put("trips", trip({ id: "other", title: "Tayland" }));
    await addDoc(a, new File(["a"], "voucher.pdf", { type: "application/pdf" }));
    await d.put("docs", { id: "loose", itemId: "", tripId: "p1", name: "pasaport.png", type: "image/png", size: 1, blob: new Blob(["p"]), addedAt: 1 });
    await d.put("messages", message("m1", "p1", "user"));
    await d.put("messages", message("m2", "p1"));
    await d.put("messages", message("m3", "other"));
    const analysis: Analysis = { key: "p1|stay:porto", tripId: "p1", needKey: "stay:porto", inputHash: "h", createdAt: 1, verdict: "v", reasons: [], tradeoffs: [], risks: [], question: null, aiScores: [] };
    await d.put("analyses", analysis);
    const prefs: Preference[] = [
      { id: "pref-p1", tripId: "p1", text: "Sessiz", createdAt: 1 },
      { id: "pref-all", tripId: null, text: "Her gezide kahvaltı", createdAt: 1 },
    ];
    for (const p of prefs) await d.put("preferences", p);
    return { t, a, b, other };
  }

  it("takes everything that was only the trip's, in every store; 'Geri getir' brings it all back", async () => {
    const d = await db();
    const { t, a, b, other } = await seed();
    const entry = await trashTrip("p1");
    expect(entry).toMatchObject({ kind: "trip", tripId: "p1", label: "Porto ve Madeira", count: 11 });
    expect(entry!.size).toBeGreaterThan(2); // the two files' bytes and the records as text
    expect((await d.get("trashData", entry!.id))?.payload).toMatchObject({
      kind: "trip",
      trip: t,
      items: expect.arrayContaining([a, b]),
      captures: [expect.objectContaining({ id: "cap-a" }), expect.objectContaining({ id: "cap-b" })],
    });
    // The list reads the light row only.
    expect(Object.keys((await listTrash({ kinds: ["trip"] }))[0]).sort()).toEqual(["count", "deletedAt", "id", "kind", "label", "size", "tripId"]);

    expect(await d.get("trips", "p1")).toBeUndefined();
    expect(await d.getAllFromIndex("items", "tripId", "p1")).toEqual([]);
    expect(await d.getAllFromIndex("docs", "tripId", "p1")).toEqual([]);
    expect(await d.getAllFromIndex("messages", "tripId", "p1")).toEqual([]);
    expect(await d.getAllFromIndex("analyses", "tripId", "p1")).toEqual([]);
    expect(await d.get("captures", "cap-a")).toBeUndefined();
    expect(await d.get("preferences", "pref-p1")).toBeUndefined();
    // Another trip's card and the page it shares, the other trip's chat and the notes for every trip stay.
    expect(await d.get("items", other.id)).toEqual(other);
    expect(await d.get("captures", "cap-shared")).toBeTruthy();
    expect(await d.get("messages", "m3")).toBeTruthy();
    expect(await d.get("preferences", "pref-all")).toBeTruthy();

    expect((await listTrash({ kinds: ["trip"] })).map((e) => e.label)).toEqual(["Porto ve Madeira"]);
    const result = await restoreTrash(entry!.id);
    // trip + 2 items + 2 docs + 2 captures + 2 messages + 1 analysis + 1 preference
    expect(result).toMatchObject({ restored: 11, skipped: 0, detached: false });
    expect(await d.get("trashData", entry!.id)).toBeUndefined();
    expect(await d.get("trips", "p1")).toEqual(t);
    expect((await d.getAllFromIndex("items", "tripId", "p1")).map((i) => i.id).sort()).toEqual(["p1-a", "p1-b"]);
    expect((await listDocMeta("p1")).map((x) => x.name).sort()).toEqual(["pasaport.png", "voucher.pdf"]);
    expect(await d.get("captures", "cap-a")).toBeTruthy();
    expect(await d.get("analyses", "p1|stay:porto")).toBeTruthy();
    expect(await d.get("preferences", "pref-p1")).toBeTruthy();
    expect((await listMessages("p1")).map((m) => m.text)).toEqual(["m1", "m2", "Porto ve Madeira çöp kutusundan geri getirildi"]);
    expect(await listTrash({ kinds: ["trip"] })).toEqual([]);
  });

  it("a shared trip whose share was joined again meanwhile comes back apart from the sharing (two trips never sync one share)", async () => {
    const d = await db();
    const shareId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await d.put("trips", trip({ id: "s1", title: "Paylaşılan", shareId }));
    const entry = await trashTrip("s1");
    await d.put("trips", trip({ id: "s2", title: "Yeniden katılınan", shareId }));
    const result = await restoreTrash(entry!.id);
    expect(result).toMatchObject({ detached: true, restored: 1 });
    expect((await d.get("trips", "s1"))?.shareId).toBeUndefined();
    expect((await d.get("trips", "s2"))?.shareId).toBe(shareId);
    expect((await listMessages("s1")).map((m) => m.text)).toEqual(["Paylaşılan çöp kutusundan geri getirildi (paylaşımdan ayrı bir kopya olarak)"]);
    // Without another trip on that share it comes back shared, as it was.
    const again = await trashTrip("s2");
    expect((await restoreTrash(again!.id)).detached).toBe(false);
    expect((await d.get("trips", "s2"))?.shareId).toBe(shareId);
  });

  it("a trip that isn't there gives null", async () => {
    expect(await trashTrip("nope")).toBeNull();
  });
});

describe("30 days", () => {
  it("entries older than 30 days aren't listed, and the purge removes them with what they held", async () => {
    const d = await db();
    const now = Date.parse("2026-10-05T12:00:00Z");
    const put = async (id: string, deletedAt: number) => {
      await d.put("trash", { id, tripId: "z", kind: "item", deletedAt, label: id, size: 1, count: 1 });
      await d.put("trashData", { id, payload: { kind: "item", item: makeItem({ tripId: "z" }), docs: [] } });
    };
    await put("old", now - 31 * DAY);
    await put("new", now - 1 * DAY);
    expect((await listTrash({ tripId: "z" }, now)).map((e) => e.id)).toEqual(["new"]);
    expect(await purgeTrash(now)).toBe(1);
    expect(await d.get("trash", "old")).toBeUndefined();
    expect(await d.get("trashData", "old")).toBeUndefined();
    expect(daysLeft({ deletedAt: now - 1 * DAY }, now)).toBe(29);
    expect(await purgeTrash(now + 40 * DAY)).toBe(1);
    expect(await d.get("trash", "new")).toBeUndefined();
    expect(await d.get("trashData", "new")).toBeUndefined();
  });

  it("'Kalıcı sil' takes one entry for good; 'Çöp kutusunu boşalt' all of a trip's", async () => {
    const d = await db();
    const cards = [makeItem({ tripId: "k1", name: "A" }), makeItem({ tripId: "k1", name: "B" }), makeItem({ tripId: "k2", name: "C" })];
    const removed = [];
    for (const c of cards) {
      await d.put("items", c);
      removed.push(await deleteItem(c));
    }
    await dropTrash(removed[0].trashId!);
    expect((await listTrash({ tripId: "k1" })).map((e) => e.label)).toEqual(["B"]);
    expect(await d.get("trashData", removed[0].trashId!)).toBeUndefined();
    expect(await emptyTrash({ tripId: "k1" })).toBe(1);
    expect(await listTrash({ tripId: "k1" })).toEqual([]);
    expect(await listTrash({ tripId: "k2" })).toHaveLength(1); // another trip's stays
  });

  it("never purges in the middle of a restore", async () => {
    const d = await db();
    const card = makeItem({ tripId: "r1", name: "Geri gelen" });
    await d.put("items", card);
    const removed = await deleteItem(card);
    const restoring = restoreTrash(removed.trashId!);
    expect(await purgeTrash(Date.now() + 100 * DAY)).toBe(0);
    expect((await restoring).restored).toBe(1);
    expect(await d.get("items", card.id)).toEqual(card);
  });
});

describe("a deleted file waits in the trash", () => {
  it("Belgeler's and a card's Sil: the file goes to the trash; 'Geri getir' brings it back with its card", async () => {
    const card = makeItem({ tripId: "f1", name: "Uçuş" });
    await (await db()).put("items", card);
    const doc = await addDoc(card, new File(["%PDF"], "bilet.pdf", { type: "application/pdf" }));
    const taken = await takeDoc(doc.id);
    expect(taken?.name).toBe("bilet.pdf");
    expect(await listDocMeta("f1")).toEqual([]);
    const [entry] = await listTrash({ tripId: "f1" });
    expect(entry).toMatchObject({ kind: "doc", label: "bilet.pdf", count: 1 });
    expect(await restoreTrash(entry.id)).toMatchObject({ restored: 1, skipped: 0 });
    expect((await listDocMeta("f1")).map((x) => [x.name, x.itemId])).toEqual([["bilet.pdf", card.id]]);
  });

  it("the 8-second 'Geri al' takes its trash entry out too", async () => {
    const card = makeItem({ tripId: "f2" });
    const doc = await addDoc(card, new File(["x"], "qr.png", { type: "image/png" }));
    const taken = (await takeDoc(doc.id))!;
    expect(await listTrash({ tripId: "f2" })).toHaveLength(1);
    await restoreDoc(taken);
    expect(await listTrash({ tripId: "f2" })).toEqual([]);
    expect((await listDocMeta("f2")).map((x) => x.name)).toEqual(["qr.png"]);
  });

  it("a card's files taken together each wait in the trash", async () => {
    const card = makeItem({ tripId: "f3" });
    await addDoc(card, new File(["a"], "a.pdf", { type: "application/pdf" }));
    await addDoc(card, new File(["b"], "b.pdf", { type: "application/pdf" }));
    expect((await takeDocsOf(card.id)).map((x) => x.name).sort()).toEqual(["a.pdf", "b.pdf"]);
    expect((await listTrash({ tripId: "f3" })).map((e) => e.label).sort()).toEqual(["a.pdf", "b.pdf"]);
  });

  it("the backup lists the trash with what it holds, without file contents or screenshots", async () => {
    const card = makeItem({ tripId: "f4", name: "Yedeklenen" });
    await (await db()).put("items", card);
    await addDoc(card, new File(["a"], "x.pdf", { type: "application/pdf" }));
    await deleteItem(card);
    const backup = JSON.parse(await exportAll()) as { trash: { label: string; payload: { kind: string; item: { name: string }; docs: Record<string, unknown>[] } }[] };
    const mine = backup.trash.find((e) => e.label === "Yedeklenen")!;
    expect(mine.payload).toMatchObject({ kind: "item", item: { name: "Yedeklenen" }, docs: [expect.objectContaining({ name: "x.pdf" })] });
    expect("blob" in mine.payload.docs[0]).toBe(false);
  });
});
