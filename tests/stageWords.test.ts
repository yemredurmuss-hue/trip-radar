// The five looks and their words (plan v46, F0): one dictionary the cards, the counts, the key, the day's lines and the
// Board all read, in both languages; and what look each lifecycle stage wears.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import type { Stage } from "../src/lib/lifecycle";
import { LOOKS, lookOf, lookWord } from "../src/lib/stageWords";

afterEach(() => setLang("tr"));

describe("lookWord: the five words", () => {
  it("in Turkish, in the key's order", () => {
    expect(LOOKS.map((look) => lookWord(look))).toEqual(["Arıyoruz", "Önerimiz", "Seçildi", "Rezerve", "Ayarlandı"]);
  });
  it("in English", () => {
    setLang("en");
    expect(LOOKS.map((look) => lookWord(look))).toEqual(["Searching", "Our pick", "Chosen", "Booked", "Arranged"]);
  });
  it("a booked look says what was done: a ticket, a purchase, else a reservation", () => {
    expect([lookWord("booked", { as: "ticket" }), lookWord("booked", { as: "bought" }), lookWord("booked")]).toEqual(["Bilet alındı", "Alındı", "Rezerve"]);
    setLang("en");
    expect([lookWord("booked", { as: "ticket" }), lookWord("booked", { as: "bought" }), lookWord("booked")]).toEqual(["Ticket bought", "Bought", "Booked"]);
  });
  it("only a booked look takes the 'as'", () => {
    expect(lookWord("chosen", { as: "ticket" })).toBe("Seçildi");
    expect(lookWord("arranged", { as: "bought" })).toBe("Ayarlandı");
  });
  it("no word has a capital letter inside it, nor an em-dash", () => {
    for (const look of LOOKS) for (const as of [undefined, "ticket", "bought"] as const) expect(lookWord(look, { as })).not.toMatch(/[—–]|.[A-ZÇĞİÖŞÜ]/);
  });
});

describe("lookOf: what a lifecycle stage looks like", () => {
  it("the options and the plain 'to find' both read as searching", () => {
    expect(lookOf("search")).toBe("search");
    expect(lookOf("options")).toBe("search");
  });
  it("planned is chosen; booked, ready and used are booked", () => {
    expect([lookOf("planned"), lookOf("booked"), lookOf("ready"), lookOf("used")]).toEqual(["chosen", "booked", "booked", "booked"]);
  });
  it("what the traveller arranged herself wears its own look from the planned stage on", () => {
    expect([lookOf("planned", { arranged: true }), lookOf("booked", { arranged: true })]).toEqual(["arranged", "arranged"]);
    expect([lookOf("search", { arranged: true }), lookOf("options", { arranged: true })]).toEqual(["search", "search"]);
  });
  it("the side stages have no look", () => {
    const side: Stage[] = ["cancelled", "notNeeded"];
    expect(side.map((s) => lookOf(s))).toEqual([null, null]);
  });
});
