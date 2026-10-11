import { describe, expect, it } from "vitest";
import { brandOf } from "../src/lib/brands";

describe("brandOf", () => {
  it("names a known site in its own colour", () => {
    expect(brandOf("Booking.com", "booking.com")).toEqual({ label: "Booking.com", color: "#003b95" });
    expect(brandOf(null, "www.airbnb.com.tr")).toEqual({ label: "Airbnb", color: "#c8174f" });
    expect(brandOf("Klook")?.color).toBe("#b23c00");
  });
  it("matches the provider before the host", () => {
    expect(brandOf("Viator", "tripadvisor.com")?.label).toBe("Viator");
  });
  it("keeps an unknown name on a grey label", () => {
    expect(brandOf("Yumoto Onsen Ryokan")).toEqual({ label: "Yumoto Onsen Ryokan", color: null });
    expect(brandOf(null, "www.hakone-ryokan.jp")).toEqual({ label: "hakone-ryokan.jp", color: null });
  });
  it("says nothing when nothing says where it's from", () => {
    expect(brandOf(null)).toBeNull();
    expect(brandOf("  ", "")).toBeNull();
  });
  it("tells JR from a word that only contains the letters", () => {
    expect(brandOf("JR East")?.label).toBe("JR");
    expect(brandOf("Fjord Cruises")?.color).toBeNull();
  });
});
