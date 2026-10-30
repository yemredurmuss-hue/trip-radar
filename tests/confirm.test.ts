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
  it("a payment that went through says it's done too, and the label may carry a note before its number (Pegasus)", () => {
    const text = "Ödeme başarılı. İyi seyahatler dileriz. Rezervasyon (PNR) No 2JB52G PNR No Paylaş Seyahat Detayları";
    expect(confirmationOf({ title: "Pegasus", text })).toMatchObject({ code: "2JB52G" });
    expect(confirmationOf({ text: "Payment successful! Booking reference (PNR): 7HG2KQ" })).toMatchObject({ code: "7HG2KQ" });
    expect(confirmationOf({ text: "İşleminiz başarıyla tamamlandı. PNR kodu: Q4ZT9K" })).toMatchObject({ code: "Q4ZT9K" });
    expect(confirmationOf({ text: "ÖDEME BAŞARILI · REZERVASYON (PNR) NO 2JB52G" })).toMatchObject({ code: "2JB52G" });
  });
  it("the address rule Chrome matches by itself (the icon's green ✓): only a confirmation's path, never its host or query", async () => {
    const { CONFIRM_URL } = await import("../src/lib/confirm");
    expect(CONFIRM_URL.startsWith("(?i)")).toBe(true);
    // (RE2 has no lookbehind; Chrome refuses the rule with one)
    expect(CONFIRM_URL).not.toMatch(/\(\?<[=!]/);
    const re = new RegExp(CONFIRM_URL.slice(4), "i");
    for (const yes of ["https://web.flypgs.com/booking/payment-success", "https://x.com/checkout/confirmation?id=1", "https://otel.com.tr/rezervasyon/onay", "https://h.com/thank-you", "https://h.com/tr/tesekkurler.html", "https://h.com/Success#top", "https://h.com/order-complete/123"])
      expect(re.test(yes), yes).toBe(true);
    for (const no of ["https://successfactors.com/home", "https://h.com/booking/passengers", "https://h.com/search?next=/success", "https://h.com/onaylar", "https://h.com/"])
      expect(re.test(no), no).toBe(false);
  });
  it("a number run into the next word ends where that word begins, a Turkish İ too", () => {
    expect(confirmationOf({ text: "Ödemeniz başarılı Rezervasyon (PNR) No 2JB52Gİstanbul → Atina" })).toMatchObject({ code: "2JB52G" });
    expect(confirmationOf({ text: "Ödemeniz başarılı Rezervasyon (PNR) No 2JB52GToplam 86 €" })).toMatchObject({ code: "2JB52G" });
  });
  it("a label with no number after it is passed over for the next one that has one", () => {
    expect(confirmationOf({ text: "Ödeme başarılı. PNR No Paylaş · Rezervasyon kodu: 2JB52G" })).toMatchObject({ code: "2JB52G" });
  });
  it("the confirmation page's own address says it's done when its words don't", () => {
    expect(confirmationOf({ url: "https://web.example-air.com/booking/payment-success", text: "Rezervasyon (PNR) No 2JB52G" })).toMatchObject({ code: "2JB52G" });
    expect(confirmationOf({ url: "https://secure.example.com/confirmation.html?aid=1", text: "Booking number: 4821993107" })).toMatchObject({ code: "4821993107" });
    expect(confirmationOf({ url: "https://www.example-air.com/booking/passengers", text: "Rezervasyon (PNR) No 2JB52G" })).toBeNull();
  });
  it("nothing without both: a hotel's page, a word with no number, a number with no confirming word", () => {
    expect(confirmationOf({ text: "Ödeme başarılı. PNR No Paylaş" })).toBeNull();
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

