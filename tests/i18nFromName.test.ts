// "Kiwi.com'dan kaydettin" (Karar Masası, the drawer's own save): a name with its "from" ending.
import { describe, expect, it } from "vitest";
import { fromName, withLang } from "../src/lib/i18n";

describe("fromName", () => {
  it("follows the last vowel and hardens after a hard consonant", () => {
    expect(fromName("Kiwi.com")).toBe("Kiwi.com'dan");
    expect(fromName("Pegasus")).toBe("Pegasus'tan");
    expect(fromName("Airbnb")).toBe("Airbnb'den");
    expect(fromName("Turkish Airlines")).toBe("Turkish Airlines'tan");
    expect(fromName("Emirates")).toBe("Emirates'ten");
  });
  it("a brand said otherwise than spelled", () => {
    expect(fromName("Skyscanner")).toBe("Skyscanner'dan");
    expect(fromName("Booking.com")).toBe("Booking.com'dan");
  });
  it("in English", () => {
    expect(withLang("en", () => fromName("Kiwi.com"))).toBe("from Kiwi.com");
  });
});
