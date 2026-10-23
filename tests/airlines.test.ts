// The airline library (lib/airlines.ts, lib/airlineData.ts; 0.46.0): every active airline's name, 786 logos in the extension.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { airlineByName, airlineCode, airlineLogos } from "../src/lib/airlines";
import { LOGO_CODES } from "../src/lib/airlineData";

describe("airlineCode", () => {
  it("Patagonia's airlines by their names, as the sites write them", () => {
    expect(airlineCode("Aerolíneas Argentinas")).toBe("AR");
    expect(airlineCode("Aerolineas Argentinas S.A.")).toBe("AR");
    expect(airlineCode("LATAM Airlines")).toBe("LA");
    expect(airlineCode("JetSMART")).toBe("JA");
    expect(airlineCode("Flybondi")).toBe("FO");
    expect(airlineCode("Sky Airline")).toBe("H2");
  });
  it("any active airline from the library; the flight number first", () => {
    expect(airlineCode("Air Europa")).toBe("UX");
    expect(airlineCode("Norwegian Air Shuttle")).toBe("DY");
    expect(airlineCode("whatever", "IB 3101")).toBe("IB");
  });
  it("a name of generic words alone, or a train's operator, is no airline", () => {
    expect(airlineByName("Airlines")).toBeNull();
    expect(airlineByName("Express")).toBeNull();
    expect(airlineCode("Comboios de Portugal", null, false)).toBeNull();
    expect(airlineCode("Casa Azul", null, false)).toBeNull();
  });
});

describe("the logos in the extension", () => {
  it("every code the library lists has its file; Patagonia's among them; one not there is read from Kiwi", () => {
    const codes = LOGO_CODES.split(" ");
    expect(codes.length).toBeGreaterThan(700);
    for (const c of ["AR", "LA", "JA", "H2", "TK", "PC"]) expect(codes).toContain(c);
    for (const c of codes) expect(existsSync(`static/logos/airlines/${c}.png`)).toBe(true);
    expect(airlineLogos("AR")[0]).toBe("logos/airlines/AR.png");
    expect(airlineLogos("FO")[0]).toBe("https://images.kiwi.com/airlines/64/FO.png");
  });
});
