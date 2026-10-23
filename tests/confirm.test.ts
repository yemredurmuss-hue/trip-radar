// Rezervasyon onayı (lib/confirm.ts, 0.45.0): said only with a confirming word and a number, or the JSON-LD's reservation.
import { describe, expect, it } from "vitest";
import { confirmationOf } from "../src/lib/confirm";
import { isInspiration } from "../src/lib/inspo";
import { sectionOfItem } from "../src/lib/categories";
import type { Item } from "../src/lib/types";

describe("confirmationOf", () => {
  it("a Booking confirmation in Turkish: its number and what was paid", () => {
    const c = confirmationOf({ title: "Booking.com: Onay", text: "Rezervasyonunuz onaylandı! Visesa Ubud Resort · 12 – 16 May. Onay numarası: 4821 993 107. Toplam: €378" });
    expect(c).toEqual({ code: "4821 993 107", name: null, paid: "€378" });
  });
  it("a page's text run together ends the number where a word begins", () => {
    expect(confirmationOf({ text: "Rezervasyonunuz onaylandıVisesa Ubud Resort · 12 – 16 MayOnay numarası: 4821 993 107Toplam: €378" })).toMatchObject({ code: "4821 993 107", paid: "€378" });
  });
  it("an English airline page; a PNR", () => {
    expect(confirmationOf({ text: "Thank you for your booking. Booking reference: XK7Q2M. Amount paid: 312 EUR" })).toMatchObject({ code: "XK7Q2M", paid: "312 EUR" });
  });
  it("the JSON-LD's reservation is enough, with the place it's for", () => {
    const ld = [{ "@context": "https://schema.org", "@type": "LodgingReservation", reservationNumber: "ABC12345", reservationFor: { "@type": "LodgingBusiness", name: "Visesa Ubud Resort" } }];
    expect(confirmationOf({ text: "", jsonLd: ld })).toEqual({ code: "ABC12345", name: "Visesa Ubud Resort", paid: null });
  });
  it("nothing without both: a hotel's page, a word with no number, a number with no confirming word", () => {
    expect(confirmationOf({ text: "Visesa Ubud Resort · €378 · Rezervasyon yap · Ücretsiz iptal" })).toBeNull();
    expect(confirmationOf({ text: "Rezervasyonunuz onaylandı. Teşekkürler!" })).toBeNull();
    expect(confirmationOf({ text: "Booking reference: XK7Q2M" })).toBeNull();
    expect(confirmationOf({ text: "Booking confirmed. Booking reference: pending" })).toBeNull();
    expect(confirmationOf({ text: "", jsonLd: [{ "@type": "Hotel", name: "x" }] })).toBeNull();
  });
});

describe("İlham'a ekle: Item.inspo", () => {
  const item = (x: Partial<Item>): Item => ({ id: "i", tripId: "t", category: "stay", status: "saved", url: "https://example.com/a", dates: { start: null, end: null, source: "none" }, ...x }) as Item;
  it("any page saved as inspiration waits in İlham until chosen or given a day; a flight never", () => {
    expect(sectionOfItem(item({ inspo: true }))).toBe("inspo");
    expect(isInspiration(item({ inspo: true, category: "food" }))).toBe(true);
    expect(sectionOfItem(item({ inspo: true, status: "chosen" }))).toBe("stay");
    expect(sectionOfItem(item({ inspo: true, dates: { start: "2027-05-02", end: null, source: "page" } }))).toBe("stay");
    expect(isInspiration(item({ inspo: true, category: "flight" }))).toBe(false);
    expect(sectionOfItem(item({}))).toBe("stay");
  });
});

describe("videoThumb: a video's own picture from its address", () => {
  it("YouTube's watch, short and youtu.be addresses; nothing else", async () => {
    const { videoThumb } = await import("../src/lib/popupWorker");
    expect(videoThumb("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(videoThumb("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(videoThumb("https://m.youtube.com/shorts/abcDEF12345")).toBe("https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg");
    expect(videoThumb("https://www.youtube.com/")).toBeNull();
    expect(videoThumb("https://www.booking.com/hotel/ar/x.html")).toBeNull();
  });
});
