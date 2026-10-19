// The plan as a PDF (PrintPlan.tsx): a photo at the size paper needs, from the sources that can scale it.
import { describe, expect, it } from "vitest";
import { paperSize } from "../src/app/PrintPlan";
import { printAccess } from "../src/lib/printBookings";
import { makeItem } from "./fixtures/makeItem";

describe("paperSize", () => {
  it("asks Unsplash and Pexels for about 1600 px; anything else as it is", () => {
    const u = new URL(paperSize("https://images.unsplash.com/photo-1?ixid=abc&w=6000"));
    expect([u.hostname, u.searchParams.get("w"), u.searchParams.get("q"), u.searchParams.get("ixid")]).toEqual(["images.unsplash.com", "1600", "80", "abc"]);
    expect(new URL(paperSize("https://images.pexels.com/photos/1/a.jpeg")).searchParams.get("w")).toBe("1600");
    expect(paperSize("https://upload.wikimedia.org/x.jpg")).toBe("https://upload.wikimedia.org/x.jpg");
    expect(paperSize("data:image/png;base64,xx")).toBe("data:image/png;base64,xx");
  });
});

describe("printAccess (the PDF's Rezervasyonlar, row 24)", () => {
  it("a stay: its code, its hours from the page's rules, its address; nothing it doesn't know", () => {
    const stay = makeItem({ category: "stay", status: "booked", bookingRef: "88120", location: { address: "Rua das Flores 12, Porto", area: "Ribeira", approximate: false }, dates: { start: "2026-10-08", end: "2026-10-11", source: "page" } });
    expect(printAccess(stay, "stay", { checkInFrom: "15:00'ten itibaren", checkOutUntil: "11:00" })).toEqual({ code: "Rezervasyon no 88120", hours: "Giriş 15:00 · Çıkış 11:00", address: "Rua das Flores 12, Porto" });
    expect(printAccess({ ...stay, bookingRef: undefined, location: { address: null, area: null, approximate: false } }, "stay", null)).toEqual({ code: null, hours: null, address: null });
  });
  it("a flight: its PNR and when it leaves; a code its note says already is not said twice", () => {
    const flight = makeItem({ category: "flight", status: "booked", bookingRef: "K7T2QX", flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: null, carrier: "TP", flightNumber: "TP1760", stops: 0 } });
    expect(printAccess(flight, "flight")).toMatchObject({ code: "PNR K7T2QX", hours: "Kalkış 07:10" });
    expect(printAccess({ ...flight, bookingRef: undefined, statusNote: "PNR K7T2QX" }, "flight").code).toBeNull();
  });
});
