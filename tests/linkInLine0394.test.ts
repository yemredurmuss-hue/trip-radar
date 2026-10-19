// 0.39.4 (Emre: "Bu hosteli ekle https://…" yazdım, eklenmedi): a link inside a chat line is saved as a candidate for the
// trip, the line without it as the card's note; only a line of bare links was taken before. A line that also asks
// something goes on to the chat as well.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addLinksInLine } from "../src/app/capture";
import { db } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { buildItem } from "../src/lib/items";
import { parseUrl, linksInText } from "../src/lib/url";

const URL1 = "https://www.booking.com/hotel/lk/clock-inn-kandy.html";
const URL2 = "https://www.hostelworld.com/pwa/hosteldetails.php/Mad-Monkey/Kandy/12345";

beforeEach(async () => {
  vi.stubGlobal("chrome", { runtime: { sendMessage: async () => undefined } });
  await (await db()).clear("captures");
});

describe("links inside a line", () => {
  it("finds each link, leaves the closing mark out of it, keeps the rest as the note", () => {
    expect(linksInText(`Bu hosteli ekle ${URL1}`)).toEqual({ urls: [URL1], note: "Bu hosteli ekle" });
    expect(linksInText(`Şunlara bak: ${URL1}, ${URL2}.`)).toEqual({ urls: [URL1, URL2], note: "Şunlara bak" });
    expect(linksInText(`Kahvaltılı olan (${URL1}) iyi`)).toEqual({ urls: [URL1], note: "Kahvaltılı olan iyi" });
    expect(linksInText(`Bu ${URL1}?`)).toEqual({ urls: [URL1], note: "Bu" });
    expect(linksInText("link yok burada")).toEqual({ urls: [], note: "link yok burada" });
    expect(linksInText(URL1)).toEqual({ urls: [URL1], note: "" });
  });
  it("saves each as a candidate for this trip, the line its note; a bare link as before; no link: the chat's", async () => {
    expect(await addLinksInLine(`Bu hosteli ekle ${URL1} kahvaltılı olan`, { tripId: "t1", source: "chat" })).toBe("links");
    const [c] = await (await db()).getAll("captures");
    expect([c.url, c.fromTripId, c.note, c.kind]).toEqual([URL1, "t1", "Bu hosteli ekle kahvaltılı olan", "paste-link"]);
    expect(await addLinksInLine(URL2, { tripId: "t1", source: "chat" })).toBe("links");
    expect((await (await db()).getAll("captures")).find((x) => x.url === URL2)?.note).toBeUndefined();
    expect(await addLinksInLine("Kandy'de hostel bul", { tripId: "t1", source: "chat" })).toBe(false);
  });
  it("a line that asks something: the link is saved and the chat answers the question too", async () => {
    expect(await addLinksInLine(`${URL1} bu merkeze yakın mı?`, { tripId: "t1", source: "chat" })).toBe("ask");
    expect(await addLinksInLine(`Bu otel merkeze yakın mı ${URL2}?`, { tripId: "t1", source: "chat" })).toBe("ask");
    expect((await (await db()).getAll("captures")).length).toBe(2);
  });
  it("the note is on the card made from it", () => {
    const x = { category: "stay", name: "Clock Inn", provider: "Booking", summary: "", option_detail: null, city: "Kandy", country: null, country_code: null,
      location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
      price: { amount: null, currency: null, scope: "unknown", taxes_included: "unknown", source: "none", evidence: null },
      cancellation: { summary: null, free_until: null, source: "none", evidence: null }, rating: { value: null, scale: null, count: null, source: "none", evidence: null },
      flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [], trip: { existing_trip_id: null, new_trip_title: null }, need_key: "stay:kandy" } as unknown as Extraction;
    const capture = { id: "c", kind: "paste-link", url: URL1, title: null, pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: null, capturedAt: 1, status: "pending", error: null, itemId: null, note: "Bu hosteli ekle" } as const;
    expect(buildItem(x, { ...capture, jsonLd: [], meta: {} }, parseUrl(URL1), "t1").statusNote).toBe("Bu hosteli ekle");
    expect(buildItem(x, { ...capture, jsonLd: [], meta: {}, note: undefined }, parseUrl(URL1), "t1").statusNote).toBeNull();
  });
});
