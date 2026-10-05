// tests/legCard.test.ts
import { describe, expect, it } from "vitest";
import { legCardView } from "../src/lib/cardView";
import type { Leg } from "../src/lib/legs";
import { plannedItem } from "../src/lib/planned";

const leg = (over: Partial<Leg> = {}): Leg => ({
  key: "2026-10-11:move:porto-lizbon", kind: "move", date: "2026-10-11", slot: 1,
  from: { label: "Porto", city: "Porto", item: null }, to: { label: "Lizbon", city: "Lizbon", item: null },
  after: null, before: null, options: [], mode: null, via: null, travel: null, status: "empty", statusText: "", choice: null, notes: [],
  ...over,
});
const choice = (mode: Leg["mode"], booked = false) => ({ mode, booked, note: null, updatedAt: 1 });
const state = (v: ReturnType<typeof legCardView>) => (v.foot.left.kind === "state" ? [v.foot.left.tone, v.foot.left.text, v.foot.left.sub] : ["nav"]);

describe("a transfer or a change of city as a card", () => {
  it("nothing planned: open ring, how will you go", () => {
    const v = legCardView(leg());
    expect([v.kind, v.label, v.ring, v.ariaLabel, v.searchUrl]).toEqual(["transport", "Şehir değişimi", "open", "Porto → Lizbon", null]);
    expect(state(v)).toEqual(["plain", "Planlanmadı", "nasıl geçeceksiniz?"]);
    expect([v.from, v.to]).toEqual([{ city: "Porto", sub: "11 Ekim", time: null }, { city: "Lizbon", sub: "11 Ekim", time: null }]);
  });
  it("by plane between cities: amber until the ticket, with a flight search", () => {
    const v = legCardView(leg({ choice: choice("flight"), status: "planned" }));
    expect([v.kind, v.label, v.ring]).toEqual(["flight", "Uçuş", "half"]);
    expect(state(v)).toEqual(["wait", "Planlanıyor", "bilet alınmadı"]);
    expect(v.foot.action).toEqual({ label: "Bileti aldım", does: "book" });
    expect(decodeURIComponent(v.searchUrl!)).toBe("https://www.google.com/travel/flights?q=Flights from Porto to Lizbon on 2026-10-11");
    const done = legCardView(leg({ choice: choice("flight", true), status: "booked" }));
    expect([done.ring, done.searchUrl]).toEqual(["done", null]);
    expect(state(done)).toEqual(["done", "Alındı", null]);
  });
  it("by metro from the airport: planned is done, no booking", () => {
    const v = legCardView(leg({ kind: "arrival", from: { label: "OPO havalimanı", city: "Porto", item: null }, to: { label: "Jardim Stay", city: "Porto", item: null }, choice: choice("metro"), status: "planned", after: "10:05" }));
    expect([v.kind, v.label, v.ring, v.middle]).toEqual(["transport", "Metro", "done", "Varış 10:05"]);
    expect(state(v)).toEqual(["done", "Planlandı", "rezervasyon gerekmez"]);
    expect([v.from.city, v.to.city]).toEqual(["OPO havalimanı", "Jardim Stay"]);
  });
  it("a taxi said in the chat: its name on the strip", () => {
    const taxi = plannedItem({ kind: "taxi", date: "2026-10-14", end_date: null, time: null, from: "Otel", to: "Havalimanı", city: "Lizbon", title: null, booked: false, note: null }, "t1", "x1", 1);
    const v = legCardView(leg({ kind: "departure", options: [taxi], mode: "taxi", status: "planned" }));
    expect([v.kind, v.label, v.ring]).toEqual(["taxi", "Taksi · transfer", "done"]);
    expect(state(v)).toEqual(["done", "Planlandı", "Taksi · Otel → Havalimanı"]);
  });
  it("saved options, nothing chosen: pick one in the details", () => {
    expect(state(legCardView(leg({ kind: "arrival", status: "options", options: [plannedItem({ kind: "transfer", date: "2026-10-08", end_date: null, time: null, from: null, to: "Otel", city: "Porto", title: null, booked: false, note: null }, "t1", "x2", 1)].map((i) => ({ ...i, status: "saved" as const })) })))).toEqual(["wait", "1 seçenek", "birini seç"]);
  });
});
