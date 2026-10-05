// tests/docs.test.ts
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { addDoc, checkDoc, deleteDoc, deleteTripDocs, docPill, getDoc, inheritedDocs, listDocMeta, moveDocs, moveDocsToTrip, putDocs, sizeText, takeDocsOf } from "../src/lib/docs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const pdf = (name = "bilet.pdf", body = "%PDF-1.4") => new File([body], name, { type: "application/pdf" });

describe("the docs store", () => {
  it("upgrades a version 3 database without losing anything", async () => {
    const old = await openDB("trip-radar", 3, {
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
      },
    });
    await old.put("trips", { id: "t-old", title: "Porto" });
    old.close();
    const d = await db();
    expect(d.version).toBe(4);
    expect([...d.objectStoreNames]).toContain("docs");
    expect(await d.get("trips", "t-old")).toMatchObject({ title: "Porto" });
  });

  it("adds, lists (names only), opens and deletes", async () => {
    const item = makeItem({ tripId: "t1" });
    const a = await addDoc(item, pdf(), 10);
    const b = await addDoc(item, new File(["x"], "QR.JPG", { type: "" }), 20);
    expect(b.type).toBe("image/jpeg");
    const meta = await listDocMeta("t1");
    expect(meta.map((m) => m.name)).toEqual(["bilet.pdf", "QR.JPG"]);
    expect("blob" in meta[0]).toBe(false);
    expect(await (await getDoc(a.id))!.blob.text()).toBe("%PDF-1.4");
    await deleteDoc(a.id);
    expect((await listDocMeta("t1")).map((m) => m.id)).toEqual([b.id]);
  });

  it("refuses other types and files over 15 MB", () => {
    expect(checkDoc({ name: "notlar.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 })).toMatch(/yalnız PDF, PNG ya da JPG/);
    // Chrome can't show a HEIC photo: refused, with or without its MIME type.
    expect(checkDoc({ name: "QR.HEIC", type: "", size: 10 })).toMatch(/yalnız PDF, PNG ya da JPG/);
    expect(checkDoc({ name: "IMG_1.heic", type: "image/heic", size: 10 })).toMatch(/yalnız PDF, PNG ya da JPG/);
    expect(checkDoc({ name: "foto.jpg", type: "image/jpeg", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
    expect(checkDoc({ name: "foto.png", type: "image/png", size: 1000 })).toBeNull();
  });

  it("a card's files go with it, come back with it, and move to the card that took a plan's place", async () => {
    const card = makeItem({ tripId: "t2" });
    const other = makeItem({ tripId: "t2" });
    await addDoc(card, pdf("a.pdf"));
    await addDoc(other, pdf("b.pdf"));
    const taken = await takeDocsOf(card.id);
    expect(taken.map((d) => d.name)).toEqual(["a.pdf"]);
    expect((await listDocMeta("t2")).map((d) => d.name)).toEqual(["b.pdf"]);
    await putDocs(taken);
    expect((await listDocMeta("t2")).map((d) => d.name).sort()).toEqual(["a.pdf", "b.pdf"]);
    await moveDocs(card.id, other.id);
    expect((await listDocMeta("t2")).every((d) => d.itemId === other.id)).toBe(true);
    await deleteTripDocs("t2");
    expect(await listDocMeta("t2")).toEqual([]);
  });

  it("a card moved to another trip takes its files: deleting the old trip leaves them", async () => {
    const card = makeItem({ tripId: "t3" });
    const stays = makeItem({ tripId: "t3" });
    await addDoc(card, pdf("bilet.pdf"));
    await addDoc(stays, pdf("kalan.pdf"));
    await moveDocsToTrip(card.id, "t4");
    await deleteTripDocs("t3");
    expect((await listDocMeta("t4")).map((d) => [d.name, d.itemId])).toEqual([["bilet.pdf", card.id]]);
    expect(await listDocMeta("t3")).toEqual([]);
  });

  it("the pill and sizes", () => {
    const m = (name: string) => ({ id: name, itemId: "i", tripId: "t", name, type: "application/pdf", size: 1, addedAt: 1 });
    expect(docPill([])).toBeNull();
    expect(docPill([m("bilet.pdf")])).toEqual({ name: "bilet.pdf", more: 0 });
    expect(docPill([m("a.pdf"), m("b.pdf"), m("c.pdf")])).toEqual({ name: "a.pdf", more: 2 });
    expect([sizeText(500), sizeText(820 * 1024), sizeText(1.2 * 1024 * 1024)]).toEqual(["1 KB", "820 KB", "1,2 MB"]);
  });
});

describe("files of a plan a saved page replaced", () => {
  it("show on the page's card", () => {
    const trip: Trip = { id: "t1", title: "x", confirmedDates: { start: "2026-10-07", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const said = plannedItem({ kind: "flight", date: "2026-10-08", end_date: null, time: null, from: "IST", to: "OPO", city: null, title: null, booked: false, note: null }, "t1", "plan", 1);
    const real = makeItem({
      id: "real", category: "flight", name: "Pegasus", needKey: said.needKey, status: "chosen", dates: { start: "2026-10-08", end: null, source: "page" },
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: "Pegasus", flightNumber: null, stops: 0 },
    });
    const plan = buildPlan(trip, [said, real]);
    expect(plan.closed.find((c) => c.item.id === "plan")?.by).toBe("real");
    expect([...inheritedDocs(plan.closed)]).toEqual([["real", ["plan"]]]);
  });
});
