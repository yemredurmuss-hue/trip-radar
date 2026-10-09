import { describe, expect, it } from "vitest";
import { photoFromOffers, sameTour } from "../src/lib/offerSource";

const offers = [
  { title: "Madeira: Whale and Dolphin Watching Tour from Funchal", url: "https://v/whale", photo: "https://img/whale.jpg" },
  { title: "Madeira 4x4 Jeep Safari: Porto Moniz, Lava Pools & Fanal Forest", url: "https://v/jeep", photo: "https://img/jeep.jpg" },
  { title: "Porto Sunset River Cruise", url: "https://v/cruise", photo: null },
];

describe("photoFromOffers (a tour put on the plan keeps the source's photo)", () => {
  it("its own page first", () => {
    expect(photoFromOffers({ name: "anything", url: "https://v/jeep" }, offers)).toBe("https://img/jeep.jpg");
  });
  it("the same tour by name, said shorter in the chat", () => {
    expect(photoFromOffers({ name: "Whale and Dolphin Watching Tour", url: null }, offers)).toBe("https://img/whale.jpg");
  });
  it("nothing for a different tour, or an offer with no photo", () => {
    expect(photoFromOffers({ name: "Canyoning Adventure", url: null }, offers)).toBeNull();
    expect(photoFromOffers({ name: "Porto Sunset River Cruise", url: null }, offers)).toBeNull();
    expect(photoFromOffers({ name: "Madeira", url: null }, offers)).toBeNull();
  });
});

describe("sameTour (an offer already on the plan isn't suggested again)", () => {
  it("by page or by name", () => {
    expect(sameTour({ name: "Sunset River Cruise", url: null }, { title: "Porto Sunset River Cruise", url: "x" })).toBe(true);
    expect(sameTour({ name: "x", url: "https://v/a" }, { title: "Other", url: "https://v/a" })).toBe(true);
    expect(sameTour({ name: "Livraria Lello", url: null }, { title: "Porto Sunset River Cruise", url: "x" })).toBe(false);
  });
});
