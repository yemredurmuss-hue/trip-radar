// "X yerine Y seçildi · Geri al" (plan v13 K82, review finding 6): the undo takes back everything Seç did, the place set
// aside for the nights included, never only the two statuses.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { chooseItem, undo } from "../src/app/actions";
import { db } from "../src/lib/db";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip: Trip = { id: "pu", title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, travellers: { names: [], count: 2 } };
const nights = { start: "2026-10-08", end: "2026-10-11", source: "url" as const };
const stay = (id: string, status: Item["status"], extra: Partial<Item> = {}) =>
  makeItem({ id, tripId: "pu", name: id, category: "stay", city: "Porto", countryCode: "PT", needKey: "stay:porto", url: `https://www.booking.com/hotel/pt/${id}.html`, dates: nights, status, ...extra });
const get = async (id: string) => (await (await db()).get("items", id))!;

beforeEach(async () => {
  const d = await db();
  for (const i of await d.getAll("items")) await d.delete("items", i.id);
  await d.put("trips", trip);
});

describe("undo of a pick beside the plan", () => {
  it("brings the one chosen before back, with the start's place it had set aside", async () => {
    const d = await db();
    await d.put("items", stay("jardim", "chosen"));
    await d.put("items", stay("ribeira", "saved"));
    await d.put("items", stay("ph", "dismissed", { replacedBy: "jardim", dismissedFrom: "saved" }));
    await chooseItem(await get("ribeira"), [await get("jardim")]);
    expect((await get("ph")).replacedBy).toBe("ribeira");
    await undo({ kind: "picked", item: await get("ribeira"), prev: await get("jardim") });
    expect((await get("jardim")).status).toBe("chosen");
    expect((await get("ribeira")).status).toBe("saved");
    expect((await get("ph")).replacedBy).toBe("jardim");
  });

  it("with nothing chosen before, the start's place it set aside comes back", async () => {
    const d = await db();
    await d.put("items", stay("ribeira", "chosen"));
    await d.put("items", stay("ph", "dismissed", { replacedBy: "ribeira", dismissedFrom: "saved" }));
    await undo({ kind: "picked", item: await get("ribeira"), prev: null });
    expect((await get("ribeira")).status).toBe("saved");
    expect((await get("ph")).status).toBe("saved");
  });
});
