// The site picker's and the pocket's photos (0.47.7, Emre: "açılırken çok kasılıyor, gereksiz fotoğraf yüklemesi"): asked
// for at the size they're drawn, a listed trip's one only, never a page's data: copy.
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { whereFor } from "../src/lib/companionWorker";
import { pocketFor } from "../src/lib/pocket";
import type { Item, Trip } from "../src/lib/types";

const store: Record<string, unknown> = {};
beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => void Object.assign(store, o) } },
  };
});

const hero = (n: number) => `https://images.unsplash.com/photo-${n}?ixlib=rb-4.0.3&w=2400`;
const trip = (id: string, n: number): Trip =>
  ({ id, title: `Gezi ${n}`, confirmedDates: null, budget: null, heroImage: hero(n), createdAt: 1, updatedAt: 100 - n }) as Trip;
const item = (id: string, tripId: string, imageUrl: string, at: number): Item =>
  ({ id, tripId, name: id, category: "stay", status: "saved", imageUrl, createdAt: at, updatedAt: at, captureIds: [], dates: { start: null, end: null, source: "none" } }) as Item;

describe("photos for the picker and the pocket", () => {
  it("thumbnail-sized, three for a suggested trip, one for a listed one, no data: picture", async () => {
    const d = await db();
    for (let n = 0; n < 6; n++) {
      await d.put("trips", trip(`t${n}`, n));
      await d.put("items", item(`a${n}`, `t${n}`, `https://images.pexels.com/photos/${n}/x.jpeg?h=1800`, 10 + n));
      await d.put("items", item(`b${n}`, `t${n}`, `data:image/jpeg;base64,${"A".repeat(90_000)}`, 20 + n));
    }
    const w = await whereFor("https://www.skyscanner.com.tr/transport/flights/bkk/ist/270402/", "");
    expect(w.picks).toHaveLength(3);
    for (const t of w.trips) {
      expect(t.photos.length).toBe(w.picks.includes(t.id) ? 2 : 1);
      for (const p of t.photos) {
        expect(p).toMatch(/^https:\/\//);
        expect(new URL(p).searchParams.get("w")).toBe("160");
      }
    }
    const p = await pocketFor("t0");
    expect(p.trip?.photo).toBe("https://images.unsplash.com/photo-0?ixlib=rb-4.0.3&w=160&q=70&auto=format&fit=crop");
    expect(p.rows.find((r) => r.id === "i:a0")?.photo).toBe("https://images.pexels.com/photos/0/x.jpeg?auto=compress&cs=tinysrgb&w=160");
  });
});
