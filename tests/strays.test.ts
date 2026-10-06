// Records saved before the place check that look like another trip's (strays.ts): asked about once per trip,
// never moved by themselves.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import { answerStray } from "../src/lib/routing";
import { askIfFar, checkStraysOnce, strayItems } from "../src/lib/strays";
import type { Item, Trip } from "../src/lib/types";

const trip = (id: string, title: string, over: Partial<Trip> = {}): Trip => ({ id, title, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });
let n = 0;
const item = (tripId: string, over: Partial<Item>): Item =>
  ({
    id: `i${++n}`, tripId, captureIds: [], key: null, category: "activity", needKey: "x", name: `Item ${n}`, provider: null, summary: "", optionDetail: null,
    url: null, imageUrl: null, city: null, country: null, countryCode: null, location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 }, priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1, ...over,
  }) as Item;

const pt = trip("pt", "Porto ve Madeira Gezisi");
const portugal = () => [
  item("pt", { name: "Jardim Stay", category: "stay", city: "Porto", countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } }),
  item("pt", { name: "Casa Verde", category: "stay", city: "Porto", countryCode: "PT", dates: { start: "2026-10-15", end: "2026-10-22", source: "url" } }),
];
const nusa = () => item("pt", { name: "Nusa Penida 2Day 1Night", city: "Denpasar", country: "Endonezya", countryCode: "ID", dates: { start: "2026-10-08", end: null, source: "page" } });

describe("the detector", () => {
  it("flags a Bali record in the Portugal trip", () => {
    const items = [...portugal(), nusa()];
    expect(strayItems(pt, items).map((s) => s.item.name)).toEqual(["Nusa Penida 2Day 1Night"]);
  });

  it("flags two Bali records among the Portugal ones (they don't make Indonesia the trip's)", () => {
    const items = [...portugal(), nusa(), item("pt", { name: "Ubud swing", countryCode: "ID" })];
    expect(strayItems(pt, items)).toHaveLength(2);
  });

  it("doesn't flag Sevilla (a country near the trip's) nor Funchal (Portugal, by the model's country code)", () => {
    const items = [
      ...portugal(),
      item("pt", { name: "Real Alcázar", city: "Sevilla", country: "İspanya", countryCode: "ES" }),
      item("pt", { name: "Levada walk", city: "Funchal", country: "Portekiz", countryCode: "PT" }),
    ];
    expect(strayItems(pt, items)).toEqual([]);
  });

  it("skips sample trips, flights, records said to stay, and hand-made ones known only by their city", () => {
    expect(strayItems({ ...pt, demo: true }, [...portugal(), nusa()])).toEqual([]);
    const items = [
      ...portugal(),
      { ...nusa(), placeOk: true },
      item("pt", { name: "Flight home", category: "flight", countryCode: "TR" }),
      item("pt", { name: "Bali plan", origin: "chat", city: "Bali" }),
    ];
    expect(strayItems(pt, items)).toEqual([]);
    // ...but a booked one whose own country code is far is asked about.
    expect(strayItems(pt, [...portugal(), { ...nusa(), status: "booked" }])).toHaveLength(1);
  });
});

describe("once per trip, then the answers", () => {
  beforeEach(async () => {
    const d = await db();
    for (const s of ["trips", "items", "messages", "trash", "trashData", "docs"] as const) await d.clear(s);
  });

  async function seed(withBali: boolean) {
    const d = await db();
    await d.put("trips", pt);
    for (const i of [...portugal(), { ...nusa(), id: "nusa" }]) await d.put("items", i);
    if (withBali) {
      await d.put("trips", trip("bali", "Bali"));
      await d.put("items", item("bali", { name: "Ubud Villa", category: "stay", countryCode: "ID" }));
    }
  }

  it("asks once in the trip, with the Bali trip to move it to; never again", async () => {
    await seed(true);
    expect(await checkStraysOnce()).toBe(1);
    const line = (await listMessages("pt")).find((m) => m.routing?.kind === "stray")!;
    expect(line.text).toBe("Bu başka bir geziye ait görünüyor: Nusa Penida 2Day 1Night (Endonezya)");
    expect(line.routing).toEqual({ kind: "stray", entries: [{ itemId: "nusa", name: "Nusa Penida 2Day 1Night", country: "Endonezya", toTripId: "bali" }] });
    expect((await (await db()).get("trips", "pt"))?.strayCheckedAt).toBeTypeOf("number");
    expect(await checkStraysOnce()).toBe(0);
    expect((await listMessages("pt")).filter((m) => m.routing?.kind === "stray")).toHaveLength(1);
    // Nothing moved by itself.
    expect((await (await db()).get("items", "nusa"))?.tripId).toBe("pt");

    await answerStray(line.id, "nusa", "move");
    expect((await (await db()).get("items", "nusa"))?.tripId).toBe("bali");
    expect((await (await db()).get("messages", line.id))?.routing).toMatchObject({ entries: [{ answer: "move" }] });
  });

  it("Burada kalsın marks it for good; Plandan çıkar puts it in the trash", async () => {
    await seed(false);
    await checkStraysOnce();
    const line = (await listMessages("pt")).find((m) => m.routing?.kind === "stray")!;
    expect(line.routing).toMatchObject({ entries: [{ toTripId: null }] });
    await answerStray(line.id, "nusa", "keep");
    expect((await (await db()).get("items", "nusa"))?.placeOk).toBe(true);

    const d = await db();
    await d.put("items", { ...nusa(), id: "nusa2" });
    await d.put("trips", { ...pt, strayCheckedAt: undefined });
    await checkStraysOnce();
    const second = (await listMessages("pt")).filter((m) => m.routing?.kind === "stray").at(-1)!;
    expect(second.routing).toMatchObject({ entries: [{ itemId: "nusa2" }] });
    await answerStray(second.id, "nusa2", "remove");
    expect(await d.get("items", "nusa2")).toBeUndefined();
    expect((await d.getAll("trash")).map((t) => t.label)).toContain("Nusa Penida 2Day 1Night");
  });

  it("a document read into a far place is asked about, not moved", async () => {
    await seed(true);
    const d = await db();
    const voucher = item("pt", { name: "Nusa Penida voucher", city: "Bali", status: "booked" });
    await d.put("items", voucher);
    expect(await askIfFar("pt", voucher, await d.getAll("items"))).toBe(true);
    expect((await d.get("items", voucher.id))?.tripId).toBe("pt");
    expect((await listMessages("pt")).some((m) => m.routing?.kind === "stray" && m.text.includes("Nusa Penida voucher (Endonezya)"))).toBe(true);
    const funchal = item("pt", { name: "Funchal hotel voucher", city: "Madeira" });
    expect(await askIfFar("pt", funchal, await d.getAll("items"))).toBe(false);
  });
});
