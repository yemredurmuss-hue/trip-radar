// Content arriving (arrive.ts): the guessed section for a waiting card, its moving line, which records are
// new since the last look, and what a chat chip says.
import { afterEach, describe, expect, it } from "vitest";
import { arrivedText, chipState, diffArrivals, eventItemName, hostOf, pendingSlot, predictSection, siteOf, stageText, STAGE_MS, STALE_MS, waitingLine } from "../src/lib/arrive";
import { setLang } from "../src/lib/i18n";

afterEach(() => setLang("tr"));

describe("predictSection", () => {
  const cases: [string, string | null, string?][] = [
    ["https://www.airbnb.com/rooms/123?check_in=2026-10-08", "stay"],
    ["https://www.airbnb.com.tr/rooms/9", "stay"],
    ["https://airbnb.pt/rooms/9", "stay"],
    ["https://www.booking.com/hotel/pt/jardim-stay.html", "stay"],
    ["https://flights.booking.com/flights/IST-OPO", "flight"],
    ["https://www.booking.com/cars/index.html", "transport"],
    ["https://www.vrbo.com/123", "stay"],
    ["https://tr.hotels.com/ho123", "stay"],
    ["https://www.agoda.com/casa/hotel/porto-pt.html", "stay"],
    ["https://www.skyscanner.com.tr/transport/flights/ist/opo/", "flight"],
    ["https://www.skyscanner.net/hotels/portugal/porto", "stay"],
    ["https://www.skyscanner.net/carhire", "transport"],
    ["https://www.google.com/travel/flights?q=IST-OPO", "flight"],
    ["https://www.google.com/flights", "flight"],
    ["https://www.kiwi.com/en/search/results/istanbul/porto", "flight"],
    ["https://www.flytap.com/en-pt/", "flight"],
    ["https://www.turkishairlines.com/tr-tr/", "flight"],
    ["https://www.ryanair.com/gb/en", "flight"],
    ["https://www.getyourguide.com/porto-l151/douro-t123/", "activity"],
    ["https://www.getyourguide.de/porto-l151/", "activity"],
    ["https://www.viator.com/tours/Porto/x", "activity"],
    ["https://www.tiqets.com/en/porto", "activity"],
    ["https://www.klook.com/activity/1", "activity"],
    ["https://indiecampers.com/campervan-hire/portugal", "transport"],
    ["https://www.indiecampers.pt/", "transport"],
    ["https://www.rentalcars.com/search", "transport"],
    ["https://www.sixt.pt/", "transport"],
    ["https://www.europcar.com/en", "transport"],
    ["https://www.omio.com/trains/lisbon-porto", "transport"],
    ["https://www.thetrainline.com/en/train-times/lisbon-to-porto", "transport"],
    ["https://global.flixbus.com/bus/porto", "transport"],
    ["https://www.cp.pt/passageiros/en", "transport"],
    ["https://www.google.com/maps/place/Livraria+Lello/@41.14,-8.61", "todo"],
    ["https://www.google.com/maps/place/Cafe+Santiago/@41.14,-8.61", "food"],
    ["https://www.google.pt/maps/place/Taberna+Santo+Ant%C3%B3nio", "food"],
    ["https://www.google.com/maps/place/Some+Spot", "food", "Tasca do Zé · Restaurant"],
    ["https://maps.app.goo.gl/abc123", "todo"],
    ["https://www.tripadvisor.com/Restaurant_Review-g189180-d1-Reviews-Cafe.html", "food"],
    ["https://www.tripadvisor.com.tr/Hotel_Review-g189180-d2.html", "stay"],
    ["https://www.tripadvisor.com/Attraction_Review-g189180-d3.html", "todo"],
    ["https://www.tripadvisor.com/Tourism-g189180-Porto.html", null],
    ["https://www.thefork.pt/restaurante/x", "food"],
    ["https://www.instagram.com/reel/abc/", "inspo"],
    ["https://www.tiktok.com/@x/video/1", "inspo"],
    ["https://www.youtube.com/watch?v=1", "inspo"],
    ["https://youtu.be/1", "inspo"],
    ["https://www.pinterest.com/pin/1/", "inspo"],
    ["https://pin.it/abc", "inspo"],
    ["https://someone.blogspot.com/2026/porto", "inspo"],
    ["https://example.com/blog/porto-guide", "inspo"],
    ["https://www.google.com/search?q=porto", null],
    ["https://example.com/porto", null],
    ["not a url", null],
    ["file:///Users/x/hotel.html", null],
  ];
  it.each(cases)("%s → %s", (url, want, title) => {
    expect(predictSection({ url, title })).toBe(want);
  });

  it("leaves documents and pictures to the reading (null, never a guess)", () => {
    expect(predictSection({ fileName: "policy.pdf", fileType: "application/pdf" })).toBeNull();
    expect(predictSection({ fileName: "IMG_0001.png", fileType: "image/png" })).toBeNull();
    expect(predictSection({ url: null })).toBeNull();
  });
});

describe("site names", () => {
  it("names the site the way the waiting line says it", () => {
    expect(hostOf("https://www.airbnb.com/rooms/1")).toBe("airbnb.com");
    expect(hostOf("chrome://extensions")).toBeNull();
    expect(siteOf("https://www.airbnb.com/rooms/1")).toBe("Airbnb");
    expect(siteOf("https://www.booking.com/hotel/x")).toBe("Booking.com");
    expect(siteOf("https://www.google.com/maps/place/x")).toBe("Google Maps");
    expect(siteOf("https://www.sixt.pt/")).toBe("Sixt");
    expect(siteOf("https://shop.example.co.uk/x")).toBe("Example");
    expect(siteOf(null)).toBeNull();
  });
});

describe("stageText", () => {
  const link = { status: "processing" as const, kind: "paste-link" as const };
  it("moves from reading the site to the details to placing it, by time", () => {
    expect(stageText(link, "Airbnb", "stay", 0)).toBe("Airbnb okunuyor…");
    expect(stageText(link, "Airbnb", "stay", STAGE_MS[0] + 1)).toBe("Fiyat ve tarihler bulunuyor…");
    expect(stageText(link, "Airbnb", "stay", STAGE_MS[1] + 1)).toBe("Plana yerleşiyor…");
    expect(stageText(link, null, null, STAGE_MS[0] + 1)).toBe("Ne olduğuna bakılıyor…");
  });
  it("says what it reads (a screenshot, a document) and when it couldn't", () => {
    expect(stageText({ status: "pending", kind: "image" }, null, null, 0)).toBe("Ekran görüntüsü okunuyor…");
    expect(stageText({ status: "processing", kind: "file" }, null, null, 0)).toBe("Belge okunuyor…");
    expect(stageText({ status: "error", kind: "paste-link" }, "Airbnb", "stay", 0)).toBe("Okunamadı");
    setLang("en");
    expect(stageText(link, "Airbnb", "stay", 0)).toBe("Reading Airbnb…");
  });
});

describe("waitingLine and pendingSlot", () => {
  const t0 = 1_000_000;
  it("moves only while read, says when it changes next, and stops at 'Bekliyor…'", () => {
    const queued = waitingLine({ status: "pending", kind: "paste-link", capturedAt: t0, since: null }, "Airbnb", "stay", t0 + 5000);
    expect(queued).toEqual({ text: "Airbnb okunuyor…", stale: false, next: t0 + STALE_MS });
    const reading = waitingLine({ status: "processing", kind: "paste-link", capturedAt: t0, since: t0 + 1000 }, "Airbnb", "stay", t0 + 2000);
    expect(reading).toEqual({ text: "Airbnb okunuyor…", stale: false, next: t0 + 1000 + STAGE_MS[0] });
    expect(waitingLine({ status: "processing", kind: "paste-link", capturedAt: t0, since: t0 }, "Airbnb", "stay", t0 + STAGE_MS[1] + 1).next).toBe(t0 + STALE_MS);
    expect(waitingLine({ status: "processing", kind: "paste-link", capturedAt: t0, since: t0 }, "Airbnb", "stay", t0 + STALE_MS)).toEqual({ text: "Bekliyor…", stale: true, next: null });
    expect(waitingLine({ status: "error", kind: "paste-link", capturedAt: t0, since: null }, null, null, t0).next).toBeNull();
  });
  it("puts a failed one under the Plan's header whatever its guess (a closed section would hide it)", () => {
    expect(pendingSlot({ section: "stay", status: "processing" })).toBe("stay");
    expect(pendingSlot({ section: null, status: "pending" })).toBe("lead");
    expect(pendingSlot({ section: "stay", status: "error" })).toBe("lead");
  });
});

describe("diffArrivals", () => {
  it("ignores the first look", () => {
    const { seen, fresh } = diffArrivals(null, "t1", ["a", "b"]);
    expect(fresh).toEqual([]);
    expect([...seen.ids]).toEqual(["a", "b"]);
  });
  it("ignores another trip coming on screen", () => {
    const first = diffArrivals(null, "t1", ["a"]).seen;
    const { seen, fresh } = diffArrivals(first, "t2", ["x", "y"]);
    expect(fresh).toEqual([]);
    expect(seen.tripId).toBe("t2");
  });
  it("finds the new ids, once", () => {
    let seen = diffArrivals(null, "t1", ["a"]).seen;
    const next = diffArrivals(seen, "t1", ["a", "b", "c"]);
    expect(next.fresh).toEqual(["b", "c"]);
    seen = next.seen;
    expect(diffArrivals(seen, "t1", ["a", "b", "c"]).fresh).toEqual([]);
  });
  it("doesn't call a record that comes back (an undo) new", () => {
    let seen = diffArrivals(null, "t1", ["a", "b"]).seen;
    seen = diffArrivals(seen, "t1", ["a"]).seen; // b deleted
    expect(diffArrivals(seen, "t1", ["a", "b"]).fresh).toEqual([]);
  });
  it("keeps the same object when nothing changed (no re-render work)", () => {
    const seen = diffArrivals(null, "t1", ["a"]).seen;
    expect(diffArrivals(seen, "t1", ["a"]).seen).toBe(seen);
  });
});

describe("chipState", () => {
  const ctx = { tripId: "t1", site: "Airbnb", tripTitle: (id: string) => (id === "t2" ? "Tayland" : null) };
  const cap = (status: "pending" | "processing" | "done" | "error", extra = {}) => ({ id: "c1", status, error: null, itemId: null, ...extra });
  it("works while the capture is queued or read (or not read back yet)", () => {
    expect(chipState(undefined, null, ctx)).toEqual({ tone: "work", text: "Airbnb okunuyor…" });
    expect(chipState(cap("pending"), null, ctx).tone).toBe("work");
    expect(chipState(cap("processing"), null, { ...ctx, screenshot: true }).text).toBe("Ekran görüntüsü okunuyor…");
  });
  it("says where it landed, with the card to go to", () => {
    expect(chipState(cap("done", { itemId: "i1" }), { id: "i1", tripId: "t1", section: "stay" }, ctx)).toEqual({ tone: "done", text: "✓ Konaklama'ya eklendi", itemId: "i1" });
    expect(chipState(cap("done", { itemId: "i1" }), { id: "i1", tripId: "t2", section: "stay" }, ctx)).toEqual({ tone: "done", text: "✓ Tayland gezisine eklendi", itemId: null });
    expect(chipState(cap("done"), null, ctx)).toEqual({ tone: "done", text: "✓ Eklendi", itemId: null });
  });
  it("fails with what to retry, and the reason kept for the tooltip", () => {
    expect(chipState(cap("error", { error: "API anahtarı yok" }), null, ctx)).toEqual({ tone: "error", text: "Okunamadı", captureId: "c1", detail: "API anahtarı yok" });
    expect(chipState(null, null, ctx).text).toBe("Kaldırıldı");
  });
  it("speaks English on an English board", () => {
    setLang("en");
    expect(chipState(cap("done", { itemId: "i1" }), { id: "i1", tripId: "t1", section: "food" }, ctx).text).toBe("✓ Added to Restaurants");
  });
});

describe("arrivedText and event lines", () => {
  it("names one arrival, counts several", () => {
    expect(arrivedText([{ name: "Casa Azul", section: "stay" }])).toBe("Konaklama'ya eklendi: Casa Azul");
    expect(arrivedText([{ name: "A", section: "stay" }, { name: "B", section: "food" }])).toBe("2 kayıt plana eklendi");
  });
  it("finds the record a chat event line is about", () => {
    expect(eventItemName("✓ OPO Vale Formoso I kaydedildi → Konaklama · Porto")).toBe("OPO Vale Formoso I");
    expect(eventItemName("✓ OPO Vale Formoso I saved → Stays · Porto")).toBe("OPO Vale Formoso I");
    expect(eventItemName("✓ Jardim Stay rezerve edildi · 8–11 Eki (onaydan); plan buna göre güncellendi")).toBe("Jardim Stay");
    expect(eventItemName("↻ Bolhão pazarı güncellendi")).toBe("Bolhão pazarı");
    expect(eventItemName("📎 x.pdf Belgeler'e kaydedildi; okunamadı")).toBeNull();
    expect(eventItemName("Yeni sohbet başladı")).toBeNull();
  });
});
