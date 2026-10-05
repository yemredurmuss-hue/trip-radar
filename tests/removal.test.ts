// tests/removal.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import { addDoc, listDocMeta } from "../src/lib/docs";
import { deleteItem, restoreItem } from "../src/lib/removal";
import { makeItem } from "./fixtures/makeItem";

describe("delete and undo", () => {
  it("takes the card and its files, and puts both back exactly", async () => {
    const d = await db();
    const card = makeItem({ tripId: "t1", name: "Douro tekne turu", status: "chosen" });
    const other = makeItem({ tripId: "t1", name: "Tiyatro" });
    await d.put("items", card);
    await d.put("items", other);
    await addDoc(card, new File(["a"], "bilet.pdf", { type: "application/pdf" }));
    await addDoc(card, new File(["b"], "qr.png", { type: "image/png" }));
    await addDoc(other, new File(["c"], "x.pdf", { type: "application/pdf" }));

    const removed = await deleteItem(card);
    expect(await d.get("items", card.id)).toBeUndefined();
    expect(removed.docs.map((x) => x.name).sort()).toEqual(["bilet.pdf", "qr.png"]);
    expect((await listDocMeta("t1")).map((x) => x.name)).toEqual(["x.pdf"]);

    await restoreItem(removed);
    expect(await d.get("items", card.id)).toEqual(card);
    expect((await listDocMeta("t1")).map((x) => x.name).sort()).toEqual(["bilet.pdf", "qr.png", "x.pdf"]);
    expect((await listMessages("t1")).map((m) => m.text)).toEqual(["Douro tekne turu silindi", "Douro tekne turu geri getirildi"]);
  });
  it("says its own line when asked (a plan taken off the board)", async () => {
    const plan = makeItem({ tripId: "t2", name: "Taksi" });
    await (await db()).put("items", plan);
    await deleteItem(plan, "Taksi plandan kaldırıldı");
    expect((await listMessages("t2")).map((m) => m.text)).toEqual(["Taksi plandan kaldırıldı"]);
  });
});
