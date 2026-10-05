// tests/dbUpgrade.test.ts — an update while an older version still holds the database open.
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { db } from "../src/lib/db";

describe("opening the database next to another version", () => {
  it("an older version that doesn't let go (0.30) gives a clear error, not a wait forever; once it's gone the next call opens", async () => {
    const old = await openDB("trip-radar", 3, { upgrade: (d) => void d.createObjectStore("trips", { keyPath: "id" }) });
    await expect(db()).rejects.toThrow(/eski bir sürümü/);
    old.close();
    const d = await db();
    expect(d.version).toBe(4);
    expect([...d.objectStoreNames]).toContain("docs");
  });

  it("a newer version asking for the database gets it: the connection it asked closes", async () => {
    const mine = await db();
    const newer = await openDB("trip-radar", 5);
    expect(newer.version).toBe(5);
    newer.close();
    expect(() => mine.transaction("trips")).toThrow();
  });
});
