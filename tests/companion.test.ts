// Benle gezen eklenti, seviye 2 (lib/companion.ts): what a result's own text says, and where it stands against the deck.
import { describe, expect, it } from "vitest";
import { cardFacts, cardLabel, companionSiteOf, isResultText } from "../src/lib/companion";
import { setLang } from "../src/lib/i18n";

setLang("tr");

describe("cardFacts", () => {
  it("hours, price and stops as Skyscanner and Kiwi write them", () => {
    expect(cardFacts("Turkish Airlines 15:15 BKK 11 sa 15 dk Direkt 22:30 IST €326 Seç")).toEqual({ dep: "15:15", arr: "22:30", price: 326, currency: "EUR", stops: 0 });
    expect(cardFacts("Qatar Airways 20:05 – 06:40+1 1 aktarma DOH 14 sa 35 dk 12.354 TL")).toEqual({ dep: "20:05", arr: "06:40", price: 12354, currency: "TRY", stops: 1 });
    expect(cardFacts("Emirates 9:40 AM 7:55 PM 1 stop $1,288.50")).toEqual({ dep: "09:40", arr: "19:55", price: 1288, currency: "USD", stops: 1 });
  });
  it("a result's text is two hours and a price, not a whole list", () => {
    expect(isResultText("Pegasus 07:05 18:10 1 aktarma €412")).toBe(true);
    expect(isResultText("Bangkok → İstanbul, 2 Nis")).toBe(false);
    expect(isResultText("x".repeat(800) + " 07:05 18:10 €412")).toBe(false);
  });
});

describe("cardLabel", () => {
  const deck = [
    { name: "Turkish Airlines", dep: "15:15", arr: "22:30", price: 326, currency: "EUR", stops: 0 },
    { name: "Qatar Airways", dep: "20:05", arr: "06:40", price: 354, currency: "EUR", stops: 1 },
  ];
  it("in the deck already, cheaper than its best, the cheapest direct in view", () => {
    expect(cardLabel(cardFacts("TK 15:15 22:30 Direkt €340"), deck, [])).toBe("Destende var");
    expect(cardLabel(cardFacts("Emirates 09:40 19:55 1 aktarma €288"), deck, [])).toBe("Destedekinden €38 ucuz");
    const a = cardFacts("Thai 11:25 19:05 Direkt €402"), b = cardFacts("Thai 23:10 06:50 Direkt €450");
    expect(cardLabel(a, deck, [a, b])).toBe("Direktlerin en ucuzu");
    expect(cardLabel(b, deck, [a, b])).toBeNull();
  });
  it("another currency is never set beside the deck's price", () => {
    expect(cardLabel(cardFacts("Emirates 09:40 19:55 1 aktarma 9.900 TL"), deck, [])).toBeNull();
  });
});

describe("companionSiteOf", () => {
  it("only the sites it may come along on, by their own host", () => {
    expect(companionSiteOf("https://www.skyscanner.com.tr/transport/flights/bkk/ist/270402/")).toBe("https://www.skyscanner.com.tr/*");
    expect(companionSiteOf("https://www.kiwi.com/tr/search/results/x/y/2027-04-02")).toBe("https://www.kiwi.com/*");
    expect(companionSiteOf("https://evil.example/skyscanner.com")).toBeNull();
    expect(companionSiteOf("http://www.kiwi.com/")).toBeNull();
  });
});

describe("the manifest asks for exactly these sites, each one optional", () => {
  it("optional_host_permissions is COMPANION_SITES; none of them is asked at install", async () => {
    const { readFileSync } = await import("node:fs");
    const { COMPANION_SITES } = await import("../src/lib/companion");
    const m = JSON.parse(readFileSync("static/manifest.json", "utf8"));
    expect(m.optional_host_permissions).toEqual([...COMPANION_SITES]);
    expect(m.host_permissions.some((h: string) => /skyscanner|kiwi/.test(h))).toBe(false);
    expect(m.content_scripts).toBeUndefined();
    expect(m.permissions).toContain("tabGroups");
    expect(m.permissions).not.toContain("tabs");
  });
});
