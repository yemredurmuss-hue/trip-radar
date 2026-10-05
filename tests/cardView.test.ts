// tests/cardView.test.ts
import { describe, expect, it } from "vitest";
import { footOf, groundOf, menuFor, ringOf, topDate } from "../src/lib/cardView";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const train = (over: Partial<Item> = {}) => makeItem({ category: "transport", name: "CP Alfa Pendular", ...over });
const state = (f: ReturnType<typeof footOf>) => (f.left.kind === "state" ? [f.left.tone, f.left.text, f.left.sub] : ["nav"]);

describe("the ring and the ground", () => {
  it("dashed while open, amber when chosen, green when done", () => {
    expect(ringOf(train(), "train")).toBe("open");
    expect(ringOf(train({ status: "chosen" }), "train")).toBe("half");
    expect(ringOf(train({ status: "booked" }), "train")).toBe("done");
    expect([groundOf("open"), groundOf("half"), groundOf("done")]).toEqual(["sand", "sand", "green"]);
  });
  it("a taxi or a note needs no booking: planned is done", () => {
    expect(ringOf(train({ status: "chosen" }), "taxi")).toBe("done");
    expect(ringOf(makeItem({ category: "other", status: "chosen" }), "note")).toBe("done");
  });
});

describe("the bottom strip, per the spec's action table", () => {
  it("an option: the navigator with several, 'Karar bekliyor' alone; the action picks it", () => {
    expect(footOf(train(), "train", { options: 2 })).toEqual({ left: { kind: "nav" }, action: { label: "Plana seç", does: "choose" } });
    expect(state(footOf(train(), "train"))).toEqual(["wait", "Karar bekliyor", null]);
  });
  it("chosen: what is still missing and the one action", () => {
    expect(footOf(train({ status: "chosen" }), "train")).toMatchObject({ action: { label: "Bileti aldım", does: "book" } });
    expect(state(footOf(train({ status: "chosen" }), "train"))).toEqual(["wait", "Seçildi", "bilet alınmadı"]);
    expect(state(footOf(train({ status: "chosen", origin: "chat" }), "train"))).toEqual(["wait", "Planlanıyor", "bilet alınmadı"]);
    expect(footOf(train({ status: "chosen" }), "car")).toMatchObject({ left: { sub: "rezerve edilmedi" }, action: { label: "Rezerve ettim" } });
    expect(footOf(makeItem({ category: "activity", status: "chosen" }), "activity")).toMatchObject({ action: { label: "Bileti aldım" } });
    expect(footOf(makeItem({ category: "esim", status: "chosen" }), "esim")).toMatchObject({ left: { sub: "satın alınmadı" }, action: { label: "Satın aldım" } });
    expect(footOf(makeItem({ category: "other", status: "chosen" }), "insurance")).toMatchObject({ left: { sub: "poliçe alınmadı" }, action: { label: "Poliçe aldım" } });
  });
  it("a taxi: planned, no booking, no button", () => {
    expect(footOf(train({ status: "chosen" }), "taxi")).toEqual({
      left: { kind: "state", tone: "done", text: "Planlandı", sub: "rezervasyon gerekmez", alert: null },
      action: null,
    });
  });
  it("booked: done, with the note said with it or the free-cancellation day", () => {
    expect(state(footOf(train({ status: "booked" }), "flight"))).toEqual(["done", "Alındı", null]);
    expect(state(footOf(train({ status: "booked", statusNote: "PNR X7K2LQ" }), "flight"))).toEqual(["done", "Alındı", "PNR X7K2LQ"]);
    expect(state(footOf(train({ status: "booked", cancellation: { summary: null, freeUntil: "2026-10-13", source: "page" } }), "activity"))).toEqual(["done", "Alındı", "ücretsiz iptal: 13 Ekim"]);
    expect(state(footOf(train({ status: "booked" }), "car"))).toEqual(["done", "Rezerve", null]);
  });
  it("an eSIM: bought, then installed", () => {
    const esim = makeItem({ category: "esim", status: "booked" });
    expect(footOf(esim, "esim")).toMatchObject({ left: { tone: "wait", text: "Alındı", sub: "kurulmadı" }, action: { label: "Kurdum", does: "install" } });
    expect(footOf({ ...esim, installedAt: 5 }, "esim")).toMatchObject({ left: { tone: "done", text: "Kuruldu" }, action: null });
  });
  it("ruled out: it can come back", () => {
    expect(footOf(train({ status: "dismissed" }), "train")).toMatchObject({ left: { tone: "plain", text: "Elendi" }, action: { label: "Geri al", does: "restore" } });
  });
  it("time running out replaces the small line", () => {
    const f = footOf(train({ status: "chosen" }), "train", { alert: { tone: "red", text: "Ücretsiz iptal için 2 gün kaldı" } });
    expect(f.left).toMatchObject({ sub: "Ücretsiz iptal için 2 gün kaldı", alert: "red" });
  });
});

describe("the date on the top line", () => {
  it("a day for a trip, a span for a rental or an eSIM, the hour for an activity", () => {
    expect(topDate(makeItem({ category: "flight", dates: { start: "2026-10-12", end: null, source: "page" }, flight: { from: "LIS", to: "FNC", departure: "2026-10-12T08:15", arrival: null, carrier: null, flightNumber: null, stops: 0 } }), "flight")).toBe("12 Ekim");
    expect(topDate(train({ dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } }), "car")).toBe("12–15 Ekim");
    expect(topDate(makeItem({ category: "esim", dates: { start: "2026-10-07", end: "2026-10-18", source: "page" } }), "esim")).toBe("7–18 Ekim");
    expect(topDate(makeItem({ category: "activity", dates: { start: "2026-10-09", end: null, source: "page" }, flight: { from: null, to: null, departure: "2026-10-09T16:00", arrival: null, carrier: null, flightNumber: null, stops: null } }), "activity")).toBe("9 Ekim · 16:00");
    expect(topDate(train(), "train")).toBeNull();
  });
});

describe("the ••• menu", () => {
  it("edit a plan made by hand or in the chat, rule out a saved option, delete anything", () => {
    expect(menuFor(train())).toEqual(["dismiss", "delete"]);
    expect(menuFor(train({ origin: "chat", status: "chosen" }))).toEqual(["edit", "delete"]);
    expect(menuFor(train({ status: "chosen" }))).toEqual(["delete"]);
  });
});
