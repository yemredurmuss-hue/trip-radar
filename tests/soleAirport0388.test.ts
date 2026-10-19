// 0.38.8: a Patagonia box ("Buenos Aires → Ushuaia") searches by the airport table when the city has one airport only.
import { describe, expect, it } from "vitest";
import { airportCode } from "../src/lib/searchLinks";

describe("a city's airport for the search", () => {
  it("one airport in the table: that one; two (Buenos Aires): none, never the wrong one", () => {
    expect(airportCode("Ushuaia")).toBe("USH");
    expect(airportCode("El Calafate")).toBe("FTE");
    expect(airportCode("Buenos Aires")).toBeNull();
    expect(airportCode("İstanbul")).toBe("IST");
    expect(airportCode("Bali")).toBe("DPS");
  });
});
