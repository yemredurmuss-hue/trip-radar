// Tek bakış (lib/tripGlance.ts, 0.45.0): the popup's "Biriktirdiklerim" is the Pano's own count; and the trip's next thing.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { tripGlance } from "../src/lib/tripGlance";

const TODAY = "2026-10-05";

describe("tripGlance on the sample trip", () => {
  it("counts what the Pano counts as Biriktirdiklerim (16), and says a next step from the plan", async () => {
    const id = await loadDemoTrip({ today: TODAY });
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const g = tripGlance(trip, items, TODAY);
    expect(g.mine).toBe(16);
    expect(g.next).not.toBeNull();
    expect(g.next!.text.length).toBeGreaterThan(0);
    expect(g.next!.act).toMatch(/Seç|Ara|Rezerve et|Bileti al/);
  });
  it("another trip's records are not counted; an empty trip has nothing next", async () => {
    const id = await loadDemoTrip({ today: TODAY });
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const empty = { ...trip, id: "empty" };
    expect(tripGlance(empty, items, TODAY).mine).toBe(0);
  });
});
