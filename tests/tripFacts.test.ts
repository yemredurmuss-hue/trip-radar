import { describe, expect, it } from "vitest";
import { COUNTRIES, countryInfo } from "../src/lib/countries";
import { visaFor, VISA_CHECKED } from "../src/lib/visa";

describe("country table", () => {
  it("knows Portugal", () => {
    const pt = countryInfo("PT")!;
    expect(pt.currency).toBe("EUR");
    expect(pt.timeZone).toBe("Europe/Lisbon");
    expect(pt.plugs).toEqual(["C", "F"]);
    expect(pt.language.tr).toBe("Portekizce");
  });
  it("every entry has a currency and a time zone", () => {
    for (const [code, c] of Object.entries(COUNTRIES)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(c.timeZone).toContain("/");
    }
  });
});

describe("visa table (Turkish passport)", () => {
  it("Schengen needs a visa", () => {
    expect(visaFor("TR", "PT")).toMatchObject({ kind: "visa", label: "Schengen vizesi" });
  });
  it("visa-free where we know it", () => {
    expect(visaFor("TR", "JP")).toMatchObject({ kind: "free", days: 90 });
  });
  it("own country needs nothing", () => {
    expect(visaFor("TR", "TR")).toMatchObject({ kind: "none" });
  });
  it("unknown country or passport: only the official link", () => {
    expect(visaFor("TR", "ZZ")).toMatchObject({ kind: "unknown" });
    expect(visaFor("DE", "PT")).toMatchObject({ kind: "unknown" });
    expect(visaFor("TR", "ZZ").link).toMatch(/^https:\/\//);
  });
  it("records when the rules were checked", () => {
    expect(VISA_CHECKED).toMatch(/^\d{4}-\d{2}$/);
  });
});
