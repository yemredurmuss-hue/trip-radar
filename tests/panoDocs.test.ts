// Pano > Belgeler (lib/panoDocs.ts, C5): the files by the kind of their card, newest first; a booking with none yet ("Belge
// eklenmedi", with its code), a plan chosen and not bought waiting for its file, a file on no card under "Bağlanmamış" last; a
// file a replaced plan handed on counts for its new card.
import { describe, expect, it } from "vitest";
import { cardLabel, docRowsOf, docWord } from "../src/lib/panoDocs";
import type { DocMeta, Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const doc = (over: Partial<DocMeta>): DocMeta => ({ id: "d", itemId: "", tripId: "t1", name: "file.pdf", type: "application/pdf", size: 120 * 1024, addedAt: new Date(2026, 9, 3, 12).getTime(), ...over });
const flight = (id: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({ id, category: "flight", name: `TAP ${id}`, needKey: `flight:${id}`, status, flight: { from: "OPO", to: "LIS", departure: null, arrival: null, carrier: null, flightNumber: null, stops: 0 }, ...over });

describe("Belgeler's rows", () => {
  it("groups the files by their card, then what is still to come, then the files on no card", () => {
    const items = [
      flight("f1", "booked"),
      flight("f2", "booked", { bookingRef: "ABC123" }),
      flight("f3", "chosen"),
      makeItem({ id: "s1", category: "stay", name: "Jardim Stay", provider: "Booking.com", status: "booked" }),
      makeItem({ id: "i1", category: "other", name: "Seyahat sağlık sigortası", provider: "Allianz", status: "saved" }),
      makeItem({ id: "r1", category: "food", name: "Taberna", status: "booked" }),
    ];
    const docs = [
      doc({ id: "a", itemId: "f1", name: "eticket.pdf", addedAt: 1 }),
      doc({ id: "b", itemId: "s1", name: "onay.png", type: "image/png" }),
      doc({ id: "c", itemId: "", name: "police.pdf", kind: "insurance" }),
      doc({ id: "d", itemId: "gone", name: "eski.pdf" }),
    ];
    const groups = docRowsOf(docs, items);
    expect(groups.map((g) => [g.id, g.rows.map((r) => [r.state, r.name])])).toEqual([
      ["flight", [["ok", "eticket.pdf"], ["add", "E-bilet · Porto → Lizbon"], ["wait", "E-bilet · Porto → Lizbon"]]],
      ["stay", [["ok", "onay.png"]]],
      ["unlinked", [["link", "police.pdf"], ["link", "eski.pdf"]]],
    ]);
    const stay = groups[1].rows[0];
    expect(stay.sub).toBe("görsel · Jardim Stay · Booking.com kartına bağlı · 3 Ekim · 120 KB");
    expect(groups[0].rows[1].sub).toBe("belge eklenmedi · ABC123");
    expect(groups[0].rows[2].sub).toBe("alınınca gelir");
    expect(groups[2].rows[0].sub).toMatch(/^PDF · 3 Ekim · 120 KB · bir karta bağla$/);
  });

  it("counts a file handed on by a replaced plan for its new card", () => {
    const items = [flight("f1", "booked")];
    expect(docRowsOf([doc({ itemId: "old" })], items, new Map([["f1", ["old"]]])).flatMap((g) => g.rows.map((r) => r.state))).toEqual(["link"]);
    expect(docRowsOf([], items).flatMap((g) => g.rows.map((r) => r.state))).toEqual(["add"]);
  });

  it("is empty for a trip with nothing booked or chosen and no file", () => {
    expect(docRowsOf([], [makeItem({ status: "saved" })])).toEqual([]);
  });

  it("names what each kind's file is", () => {
    expect([docWord("flight"), docWord("stay"), docWord("train"), docWord("insurance"), docWord("note")]).toEqual(["E-bilet", "Onay", "Bilet", "Poliçe", "Belge"]);
    expect(cardLabel(makeItem({ name: "Seyahat sağlık sigortası", provider: "Allianz" }))).toBe("Seyahat sağlık sigortası · Allianz");
    expect(cardLabel(makeItem({ name: "Allianz Travel", provider: "Allianz" }))).toBe("Allianz Travel");
  });
});
