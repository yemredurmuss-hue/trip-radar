import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { updateTrip } from "../src/app/actions";
import { db } from "../src/lib/db";
import type { Trip } from "../src/lib/types";

const trip = (id: string): Trip => ({ id, title: id, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 5 });

describe("updateTrip", () => {
  it("applies concurrent changes without losing any (read and write in one transaction)", async () => {
    const d = await db();
    await d.put("trips", { ...trip("t1"), cityImages: {} });
    await Promise.all(Array.from({ length: 20 }, (_, n) => updateTrip("t1", (t) => ({ ...t, cityImages: { ...t.cityImages, [`c${n}`]: `u${n}` } }))));
    expect(Object.keys((await d.get("trips", "t1"))!.cityImages!)).toHaveLength(20);
  });
  it("bumps updatedAt by default and keeps it with touch: false", async () => {
    const d = await db();
    await d.put("trips", trip("t2"));
    await updateTrip("t2", (t) => ({ ...t, mood: { key: "k", text: "x" } }), { touch: false });
    const cached = (await d.get("trips", "t2"))!;
    expect(cached.mood?.text).toBe("x");
    expect(cached.updatedAt).toBe(5);
    await updateTrip("t2", (t) => ({ ...t, title: "new" }));
    expect((await d.get("trips", "t2"))!.updatedAt).toBeGreaterThan(5);
  });
  it("does nothing for a trip that is gone", async () => {
    await expect(updateTrip("nope", (t) => t)).resolves.toBeUndefined();
    expect(await (await db()).get("trips", "nope")).toBeUndefined();
  });
});
