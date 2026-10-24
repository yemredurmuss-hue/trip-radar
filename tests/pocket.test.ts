// Gezi cebi (lib/pocket.ts, 0.44.0): the trip's last added with how each stands, the trip it shows, × and "tekrar".
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { pocketFor, pocketRemove, pocketRetry, pocketRows, pocketTrip } from "../src/lib/pocket";
import type { Capture, Item, Trip } from "../src/lib/types";

const store: Record<string, unknown> = {};
beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => void Object.assign(store, o) } },
  };
});

const trip = (id: string, title: string, start: string | null = null, end: string | null = null, updatedAt = 1): Trip =>
  ({ id, title, confirmedDates: start && end ? { start, end } : null, budget: null, heroImage: null, createdAt: 1, updatedAt }) as Trip;
const item = (id: string, tripId: string, name: string, createdAt: number, extra: Partial<Item> = {}): Item =>
  ({ id, tripId, name, category: "stay", status: "saved", imageUrl: null, createdAt, updatedAt: createdAt, captureIds: [], dates: { start: null, end: null, source: "none" }, ...extra }) as Item;
const capture = (id: string, status: Capture["status"], capturedAt: number, extra: Partial<Capture> = {}): Capture =>
  ({ id, kind: "extension", url: "https://www.booking.com/hotel/id/maya.html", title: "Maya Ubud", pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: null, capturedAt, status, error: null, itemId: null, ...extra }) as Capture;

describe("pocketRows: newest first, each with its state", () => {
  const now = 10_000_000;
  const items = [item("a", "bali", "Ayodya Resort", now - 5000, { imageUrl: "https://x/a.jpg" }), item("k", "bali", "Komaneka", now - 9000), item("o", "other", "Elsewhere", now - 1), item("d", "bali", "Gone", now - 2, { status: "dismissed" })];
  it("reading, failed and its records; another trip's and dismissed ones left out", () => {
    const caps = [capture("r", "processing", now - 1000, { forTripId: "bali" }), capture("f", "error", now - 3000, { forTripId: "bali", title: "Komaneka Tanggayuda" }), capture("x", "pending", now - 10, { forTripId: "other" })];
    const rows = pocketRows("bali", caps, items, now);
    expect(rows.map((r) => [r.id, r.state])).toEqual([
      ["c:r", "reading"],
      ["c:f", "failed"],
      ["i:a", "in"],
      ["i:k", "in"],
    ]);
    expect(rows[0].sub).toBe("Booking.com");
    expect(rows[2]).toMatchObject({ title: "Ayodya Resort", sub: "Konaklama", photo: "https://x/a.jpg" });
  });
  it("a save made into a record shows once, as the record; one with no trip yet shows a day; at most five", () => {
    const caps = [capture("done", "done", now - 100, { forTripId: "bali", itemId: "a" }), capture("loose", "pending", now - 50), capture("old", "pending", now - 2 * 86_400_000)];
    expect(pocketRows("bali", caps, items, now).map((r) => r.id)).toEqual(["c:loose", "i:a", "i:k"]);
    const many = Array.from({ length: 8 }, (_, n) => item(`m${n}`, "bali", `M${n}`, now - n));
    expect(pocketRows("bali", [], many, now)).toHaveLength(5);
  });
  it("a save waiting for its answer (which trip) is asked on the board, not here", () => {
    const held = capture("h", "done", now - 10, { forTripId: "bali", held: { reason: "trip" } as Capture["held"] });
    expect(pocketRows("bali", [held], [], now)).toEqual([]);
  });
});

describe("pocketTrip: the current trip, else the one saved into last; never a sample or one over", () => {
  const trips = [trip("old", "Lizbon", "2025-05-01", "2025-05-05", 99), trip("pt", "Portekiz", "2026-11-12", "2026-11-19", 2), trip("bali", "Bali", null, null, 3), trip("s", "Roma (örnek)", null, null, 50)];
  it("picks", () => {
    expect(pocketTrip(trips, [], "pt", "2026-10-23")?.id).toBe("pt");
    expect(pocketTrip(trips, [], "old", "2026-10-23")?.id).toBe("bali");
    expect(pocketTrip(trips, [item("i", "pt", "x", 500)], null, "2026-10-23")?.id).toBe("pt");
    expect(pocketTrip([trips[0], trips[3]], [], null, "2026-10-23")).toBeNull();
  });
});

describe("pocketFor, × and tekrar", () => {
  it("the trip with its count, the saves waiting for a key, a record into the trash, a failed save read again", async () => {
    const d = await db();
    await d.put("trips", trip("bali", "Bali balayı", "2027-01-10", "2027-01-25"));
    await d.put("items", item("a", "bali", "Ayodya Resort", 2000));
    await d.put("captures", capture("f", "error", 3000, { forTripId: "bali", error: "Sayfa yanıt vermedi" }));
    await d.put("captures", capture("p", "pending", 4000, { forTripId: "bali" }));
    const p = await pocketFor("bali");
    expect(p.trip).toMatchObject({ id: "bali", title: "Bali balayı", count: 1 });
    expect(p.key).toBe(false);
    expect(p.waiting).toBe(1);
    expect(p.rows.map((r) => r.id)).toEqual(["c:p", "c:f", "i:a"]);

    expect(await pocketRetry("c:f", () => undefined)).toBe(true);
    expect((await d.get("captures", "f"))?.status).toBe("pending");
    expect(await pocketRemove("i:a")).toBe(true);
    expect(await d.get("items", "a")).toBeUndefined();
    expect(await pocketRemove("c:p")).toBe(true);
    expect(await d.get("captures", "p")).toBeUndefined();
    expect(await pocketRemove("nope")).toBe(false);
  });
});
