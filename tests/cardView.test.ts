// tests/cardView.test.ts
import { describe, expect, it } from "vitest";
import { footOf, groundOf, mediaFace, menuFor, ringOf, topDate, transportFace } from "../src/lib/cardView";
import { EMPTY_METRICS } from "../src/lib/items";
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

describe("a trip's two ends", () => {
  it("a flight: where from and to, the day and the hour, duration and stops in the middle", () => {
    const f = makeItem({
      category: "flight", name: "TAP · Lizbon → İstanbul", metrics: { ...EMPTY_METRICS, durationMinutes: 295 },
      flight: { from: "LIS", to: "IST", departure: "2026-10-14T19:40", arrival: "2026-10-15T01:35", carrier: "TAP", flightNumber: "TP 1760", stops: 0 },
    });
    expect(transportFace(f, "flight")).toEqual({
      rental: false,
      from: { city: "LIS", sub: "14 Ekim", time: "19:40" },
      to: { city: "IST", sub: "15 Ekim", time: "01:35" },
      middle: "4 sa 55 dk · direkt",
    });
  });
  it("a rental: where it's picked up, then how many days and the return day", () => {
    const car = makeItem({ plannedKind: "car_rental", city: "Funchal", optionDetail: "Otomatik", location: { address: null, area: "Havalimanı", approximate: false }, dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } });
    expect(transportFace(car, "car")).toEqual({
      rental: true,
      from: { city: "Funchal", sub: "Havalimanı", time: "12 Ekim" },
      to: { city: "3 gün", sub: "iade 15 Ekim", time: null },
      middle: "Otomatik",
    });
  });
  it("nothing known of the route: no ends (the card shows its name)", () => {
    expect(transportFace(makeItem({ name: "Tren" }), "train")).toEqual({ rental: false, from: null, to: null, middle: null });
  });
});

describe("a media card's lines", () => {
  it("an activity: place, the hour in bold, duration, people; rating, reviews, the site", () => {
    const tour = makeItem({
      category: "activity", name: "Douro altı köprü tekne turu", imageUrl: "https://img/x.jpg",
      location: { address: null, area: "Ribeira iskelesi", approximate: false }, guests: { adults: 2, children: null, rooms: null },
      metrics: { ...EMPTY_METRICS, durationMinutes: 50 }, rating: { value: 4.8, scale: 5, count: 2140, source: "page" },
      flight: { from: null, to: null, departure: "2026-10-09T16:00", arrival: null, carrier: null, flightNumber: null, stops: null },
    });
    expect(mediaFace(tour, "activity", { label: "GetYourGuide", host: "getyourguide.com", url: "https://www.getyourguide.com/t" })).toEqual({
      title: "Douro altı köprü tekne turu",
      info: [{ text: "Ribeira iskelesi" }, { text: "16:00", strong: true }, { text: "50 dk" }, { text: "2 kişi" }],
      meta: [{ text: "★ 4,8", kind: "star" }, { text: "2.140 yorum", kind: "plain" }, { text: "GetYourGuide ↗", kind: "link", href: "https://www.getyourguide.com/t" }],
      image: "https://img/x.jpg",
      silhouette: null,
    });
  });
  it("an activity without a photo gets the museum drawing", () => {
    expect(mediaFace(makeItem({ category: "activity", name: "Serralves" }), "activity", null).silhouette).toBe("museum");
  });
  it("an eSIM: data and country, days, the shop and its site", () => {
    const esim = makeItem({ category: "esim", name: "Airalo Portekiz", country: "Portekiz", provider: "Airalo", status: "booked", metrics: { ...EMPTY_METRICS, dataGb: 10, validityDays: 15 } });
    expect(mediaFace(esim, "esim", { label: "Airalo", host: "airalo.com", url: "https://www.airalo.com/portugal" })).toEqual({
      title: "10 GB · Portekiz",
      info: [{ text: "15 gün" }, { text: "yola çıkmadan kur" }],
      meta: [{ text: "Airalo", kind: "plain" }, { text: "airalo.com ↗", kind: "link", href: "https://www.airalo.com/portugal" }],
      image: null,
      silhouette: "esim",
    });
  });
  it("insurance: people and days, the company, its rating and site; no cover listed", () => {
    const ins = makeItem({
      category: "other", name: "Seyahat sağlık sigortası", provider: "Allianz", guests: { adults: 2, children: null, rooms: null },
      dates: { start: "2026-10-07", end: "2026-10-18", source: "user" }, rating: { value: 4.4, scale: 5, count: null, source: "page" },
    });
    expect(mediaFace(ins, "insurance", { label: "Allianz", host: "allianz.com.tr", url: "https://www.allianz.com.tr/x" })).toMatchObject({
      title: "Seyahat sağlık sigortası",
      info: [{ text: "2 kişi" }, { text: "12 gün" }],
      meta: [{ text: "Allianz", kind: "plain" }, { text: "★ 4,4", kind: "star" }, { text: "allianz.com.tr ↗", kind: "link" }],
      silhouette: "shield",
    });
  });
});
