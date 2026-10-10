// The booking's window rows (v11 phase 3, lib/bookingRows.ts).
import { describe, expect, it } from "vitest";
import { bookingCopies, bookingRows, refFromNote } from "../src/lib/bookingRows";
import { makeItem } from "./fixtures/makeItem";

describe("a booking's rows", () => {
  it("a flight: its PNR, the flight, from and to with their hours, how many", () => {
    const flight = makeItem({
      name: "Turkish Airlines",
      category: "flight",
      status: "booked",
      bookingRef: "K7T2QX",
      guests: { adults: 2, children: null, rooms: null },
      flight: { from: "IST", to: "HND", departure: "2027-04-01T01:55", arrival: "2027-04-01T19:25", carrier: "TK", flightNumber: "TK52", stops: 0 },
    });
    const rows = bookingRows(flight, "flight");
    expect(rows[0]).toEqual(["PNR", "K7T2QX"]);
    expect(rows[1]).toEqual(["Uçuş", "TK TK52"]);
    expect(rows[2][0]).toBe("Kalkış");
    expect(rows[2][1]).toMatch(/IST · .*01:55$/);
    expect(rows.at(-1)).toEqual(["Kişi", "2 kişi"]);
  });

  it("a stay: its booking no. from an older note, the nights, the address, until when it's free to cancel", () => {
    const stay = makeItem({
      name: "Asakusa Ryokan",
      category: "stay",
      status: "booked",
      statusNote: "Rezervasyon no 88120",
      dates: { start: "2027-04-01", end: "2027-04-06", source: "url" },
      location: { address: "Asakusa 2-chome", area: "Asakusa", approximate: false },
      cancellation: { summary: null, freeUntil: "2027-03-01", source: "url" },
    });
    expect(bookingRows(stay, "stay").map(([k]) => k)).toEqual(["Rezervasyon no", "Giriş", "Çıkış", "Adres", "Ücretsiz iptal"]);
  });

  it("finds the reference in a note, or says nothing", () => {
    expect(refFromNote("PNR K7T2QX · 2 yolcu")).toBe("K7T2QX");
    expect(refFromNote("Bilet · MO-55120")).toBe("MO-55120");
    expect(refFromNote("ücretsiz iptal: 5 Eki")).toBeNull();
  });
});

describe("what a booking's rows can copy", () => {
  it("a flight: the PNR and the airport codes of its ends, labelled as the rows are", () => {
    const flight = makeItem({
      category: "flight",
      status: "booked",
      bookingRef: "K7T2QX",
      flight: { from: "IST", to: "HND", departure: "2027-04-01T01:55", arrival: "2027-04-01T19:25", carrier: "TK", flightNumber: "TK52", stops: 0 },
    });
    expect(bookingCopies(flight, "flight")).toEqual({
      PNR: { value: "K7T2QX" },
      Kalkış: { value: "IST", token: "IST" },
      Varış: { value: "HND", token: "HND" },
    });
  });
  it("a stay: its booking number and its address, and nothing it does not have", () => {
    const stay = makeItem({ category: "stay", status: "booked", statusNote: "Rezervasyon no 88120", location: { address: "Asakusa 2-chome", area: null, approximate: false } });
    expect(bookingCopies(stay, "stay")).toEqual({ "Rezervasyon no": { value: "88120" }, Adres: { value: "Asakusa 2-chome" } });
    expect(bookingCopies(makeItem({ category: "stay" }), "stay")).toEqual({});
  });
});
