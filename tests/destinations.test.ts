// The hero's main places (revizyon 1): a town inside a destination folds into it (Gaula → Madeira); the
// Plan keeps every place. The model's answer is checked; before it, a guess from the stays' addresses.
import { afterEach, describe, expect, it } from "vitest";
import { acceptParents, answersAny, fallbackParents, isMobileStay, mainPlaceOf, mainPlaces, placesKey, placesPrompt, placesSystemPrompt, resolveParents, tableParents } from "../src/lib/destinations";
import { setLang } from "../src/lib/i18n";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

const stay = (city: string, address: string | null = null, area: string | null = null, over: Partial<Item> = {}): Item =>
  makeItem({ name: `${city} otel`, category: "stay", city, location: { address, area, approximate: false }, ...over });

describe("main places", () => {
  it("folds places into their destination, in the order each first comes, each once", () => {
    expect(mainPlaces(["Porto", "Funchal", "Gaula"], { funchal: "Madeira", gaula: "Madeira" })).toEqual([
      { name: "Porto", members: ["Porto"] },
      { name: "Madeira", members: ["Funchal", "Gaula"] },
    ]);
    // A destination that is one of the trip's places keeps that place's spelling, at the first member's turn.
    expect(mainPlaces(["Gaula", "Porto", "Madeira"], { gaula: "madeira" })).toEqual([
      { name: "Madeira", members: ["Gaula", "Madeira"] },
      { name: "Porto", members: ["Porto"] },
    ]);
    // Case and accents don't make two places.
    expect(mainPlaces(["Câmara de Lobos", "camara de lobos", "Lizbon"], {})).toEqual([
      { name: "Câmara de Lobos", members: ["Câmara de Lobos"] },
      { name: "Lizbon", members: ["Lizbon"] },
    ]);
    expect(mainPlaces([], {})).toEqual([]);
  });

  it("calls a known city by its name in the board's language", () => {
    expect(mainPlaces(["Porto", "Lisbon"], {})).toEqual([
      { name: "Porto", members: ["Porto"] },
      { name: "Lizbon", members: ["Lisbon"] },
    ]);
    expect(mainPlaces(["Sintra", "Lisboa"], { sintra: "Lisbon" }).map((p) => p.name)).toEqual(["Lizbon"]);
    setLang("en");
    expect(mainPlaces(["Lizbon"], {}).map((p) => p.name)).toEqual(["Lisbon"]);
    expect(mainPlaces(["Funchal", "Gaula"], { gaula: "Madeira" }).map((p) => p.name)).toEqual(["Madeira"]);
  });

  it("names the destination a place belongs to", () => {
    const places = mainPlaces(["Porto", "Gaula"], { gaula: "Madeira" });
    expect(mainPlaceOf(places, "Gaula")).toBe("Madeira");
    expect(mainPlaceOf(places, "porto")).toBe("Porto");
    expect(mainPlaceOf(places, "Faro")).toBe("Faro");
    expect(mainPlaceOf(places, null)).toBeNull();
  });

  it("asks once per set of cities, whatever their order or spelling", () => {
    expect(placesKey(["Porto", "Gaula"])).toBe(placesKey(["gaula", "PORTO"]));
    expect(placesKey(["Porto", "Gaula"])).not.toBe(placesKey(["Porto"]));
    expect(placesPrompt(["Porto", "Gaula"], (c) => (c === "Gaula" ? "Portekiz" : null))).toBe("<places>\nPorto\nGaula (Portekiz)\n</places>");
    expect(placesSystemPrompt()).toMatch(/Porto ve Lizbon ayrı kalır/);
    setLang("en");
    expect(placesSystemPrompt()).toMatch(/Porto and Lisbon stay apart/);
  });
});

describe("the model's answer, checked", () => {
  const cities = ["Porto", "Funchal", "Gaula", "Lizbon"];
  it("keeps a trip place's bigger destination", () => {
    expect(
      acceptParents(cities, [
        { place: "Funchal", parent: "Madeira" },
        { place: "Gaula", parent: " Madeira " },
        { place: "Porto", parent: null },
      ]),
    ).toEqual({ funchal: "Madeira", gaula: "Madeira" });
  });
  it("drops a place inside itself, an empty or overlong name, and places not on the trip", () => {
    expect(
      acceptParents(cities, [
        { place: "Porto", parent: "porto" },
        { place: "Funchal", parent: "" },
        { place: "Gaula", parent: "x".repeat(41) },
        { place: "Sintra", parent: "Lizbon" },
      ]),
    ).toEqual({});
  });
  it("follows a chain to its end (at most three steps) and drops a loop", () => {
    expect(acceptParents(["Oia", "Fira"], { oia: "Fira", fira: "Santorini" })).toEqual({ oia: "Santorini", fira: "Santorini" });
    expect(mainPlaces(["Oia", "Fira"], acceptParents(["Oia", "Fira"], { oia: "Fira", fira: "Santorini" }))).toEqual([{ name: "Santorini", members: ["Oia", "Fira"] }]);
    expect(acceptParents(["Porto", "Gaia", "Matosinhos"], { matosinhos: "Gaia", gaia: "Porto" })).toEqual({ matosinhos: "Porto", gaia: "Porto" });
    expect(acceptParents(["A köy", "B köy", "C köy"], { "a koy": "B köy", "b koy": "C köy", "c koy": "A köy" })).toEqual({});
    expect(acceptParents(["A", "B", "C", "D"], { a: "B", b: "C", c: "D", d: "Bölge" })).toEqual({ b: "Bölge", c: "Bölge", d: "Bölge" }); // A: four steps
  });
  it("never merges two real stops: a known city doesn't move, a country isn't a destination, two stay towns stay apart", () => {
    expect(acceptParents(["Porto", "Lizbon"], { lizbon: "Porto" })).toEqual({});
    expect(acceptParents(["Porto", "Lizbon"], { porto: "Lizbon", lizbon: "Porto" })).toEqual({});
    expect(acceptParents(["Porto", "Lizbon"], [{ place: "Porto", parent: "Portugal" }, { place: "Lizbon", parent: "Portekiz" }])).toEqual({});
    expect(acceptParents(["Gaula", "Porto"], { gaula: "Portekiz" })).toEqual({});
    // Faro is a city the app knows (its airport): it stays; Lagos isn't: it goes into the region.
    expect(acceptParents(["Lagos", "Faro"], { lagos: "Algarve", faro: "Algarve" })).toEqual({ lagos: "Algarve" });
    // Two stay towns the app doesn't know: never one inside the other; a known destination may hold a town.
    expect(acceptParents(["Lagos", "Burgau"], { burgau: "Lagos" })).toEqual({});
    expect(acceptParents(["Sintra", "Lizbon"], { sintra: "Lizbon" })).toEqual({ sintra: "Lizbon" });
  });
  it("keeps another name for the same place (the app reads Madeira as Funchal): it names the destination", () => {
    // Funchal → Madeira is one city key here: Gaula → Funchal ends at Madeira.
    const parents = acceptParents(cities, { gaula: "Funchal", funchal: "Madeira" });
    expect(parents).toEqual({ gaula: "Madeira", funchal: "Madeira" });
    expect(mainPlaces(cities, parents)).toEqual([
      { name: "Porto", members: ["Porto"] },
      { name: "Madeira", members: ["Funchal", "Gaula"] },
      { name: "Lizbon", members: ["Lizbon"] },
    ]);
    // The real trip: a stay in "Madeira" and one in Gaula.
    expect(mainPlaces(["Porto", "Madeira", "Gaula"], acceptParents(["Porto", "Madeira", "Gaula"], [{ place: "Gaula", parent: "Madeira" }, { place: "Madeira", parent: "Madeira" }]))).toEqual([
      { name: "Porto", members: ["Porto"] },
      { name: "Madeira", members: ["Madeira", "Gaula"] },
    ]);
  });
});

describe("before the model answers", () => {
  it("folds a stay whose address names another of the trip's places", () => {
    const items = [stay("Porto", "Rua do Almada 10, Porto"), stay("Madeira", "Rua X, 9000 Funchal, Madeira"), stay("Gaula", "Caminho do Pico, 9100-200 Gaula, Madeira, Portugal")];
    expect(fallbackParents(["Porto", "Madeira", "Gaula"], items)).toEqual({ gaula: "Madeira" });
    expect(mainPlaces(["Porto", "Madeira", "Gaula"], fallbackParents(["Porto", "Madeira", "Gaula"], items)).map((p) => p.name)).toEqual(["Porto", "Madeira"]);
  });
  it("reads the area too, and nothing else folds (two real cities stay apart)", () => {
    expect(fallbackParents(["Porto", "Gaia"], [stay("Porto"), stay("Gaia", null, "Porto")])).toEqual({ gaia: "Porto" });
    expect(fallbackParents(["Porto", "Lizbon"], [stay("Porto", "Rua de Lisboa 5, Porto"), stay("Lizbon", "Rua Augusta, Lisboa")])).toEqual({});
    expect(fallbackParents(["Porto", "Gaula"], [stay("Porto"), stay("Gaula", "Gaula, Portugal")])).toEqual({});
    // A ruled-out stay says nothing.
    expect(fallbackParents(["Porto", "Gaia"], [stay("Porto"), stay("Gaia", null, "Porto", { status: "dismissed" })])).toEqual({});
  });
});

describe("the model's answer, as a model writes it", () => {
  it("reads a place copied back with its country (the list says \"Gaula (Portekiz)\")", () => {
    // 0.35.3: the prompt lists "Gaula (Portekiz)" and asks for the place as written; that answer was dropped.
    expect(acceptParents(["Porto", "Gaula"], [{ place: "Porto (Portugal)", parent: null }, { place: "Gaula (Portugal)", parent: "Madeira" }])).toEqual({ gaula: "Madeira" });
    expect(acceptParents(["Porto", "Gaula"], [{ place: "Gaula, Portugal", parent: "Madeira" }])).toEqual({ gaula: "Madeira" });
    expect(answersAny(["Porto", "Gaula"], [{ place: "Gaula (Portekiz)" }])).toBe(true);
    expect(answersAny(["Porto", "Gaula"], [{ place: "Sintra" }])).toBe(false);
    expect(placesSystemPrompt()).toMatch(/parantezdeki ülkesi olmadan/);
  });
});

describe("islands and regions the app knows (no model)", () => {
  it("folds a Madeira parish into Madeira when Madeira isn't one of the trip's places", () => {
    const items = [stay("Porto", "Rua do Almada 10, Porto"), stay("Gaula", "Gaula, Madeira, Portugal", null, { countryCode: "PT" })];
    expect(tableParents(["Porto", "Gaula"], items)).toEqual({ gaula: "Madeira" });
    expect(mainPlaces(["Porto", "Gaula"], resolveParents(["Porto", "Gaula"], items, null)).map((p) => p.name)).toEqual(["Porto", "Madeira"]);
    // The name alone is enough (a parish of the table), and every one listed goes to the island.
    expect(tableParents(["Câmara de Lobos", "Machico", "Funchal"], [])).toEqual({ "camara de lobos": "Madeira", machico: "Madeira", funchal: "Madeira" });
  });
  it("keeps Porto Santo its own island, and real cities their own stops", () => {
    expect(tableParents(["Funchal", "Porto Santo"], [])).toEqual({ funchal: "Madeira" });
    expect(mainPlaces(["Funchal", "Porto Santo"], tableParents(["Funchal", "Porto Santo"], [])).map((p) => p.name)).toEqual(["Madeira", "Porto Santo"]);
    expect(tableParents(["Porto", "Lizbon", "Faro"], [])).toEqual({});
    expect(tableParents(["Palermo", "Catania", "Taormina"], [])).toEqual({ taormina: "Sicilya" });
    expect(tableParents(["Heraklion", "Chania", "Elounda"], [])).toEqual({ elounda: "Girit" });
  });
  it("knows the islands and regions asked for, in the board's language", () => {
    expect(tableParents(["Lagos", "Albufeira", "Faro"], [])).toEqual({ lagos: "Algarve", albufeira: "Algarve" });
    expect(tableParents(["Ponta Delgada", "Furnas"], [])).toEqual({ "ponta delgada": "São Miguel", furnas: "São Miguel" });
    expect(tableParents(["Palma", "Sóller"], [])).toEqual({ palma: "Mallorca", soller: "Mallorca" });
    expect(tableParents(["Sant Antoni de Portmany", "Ciutadella"], [])).toEqual({ "sant antoni de portmany": "İbiza", ciutadella: "Menorca" });
    expect(tableParents(["Costa Adeje", "Maspalomas", "Playa Blanca", "Corralejo"], [])).toEqual({ "costa adeje": "Tenerife", maspalomas: "Gran Canaria", "playa blanca": "Lanzarote", corralejo: "Fuerteventura" });
    expect(tableParents(["Oia", "Ornos"], [])).toEqual({ oia: "Santorini", ornos: "Mikonos" });
    expect(tableParents(["Alghero", "Ubud"], [])).toEqual({ alghero: "Sardinya", ubud: "Bali" });
    setLang("en");
    expect(tableParents(["Elounda", "Taormina", "Alghero", "Ornos"], [])).toEqual({ elounda: "Crete", taormina: "Sicily", alghero: "Sardinia", ornos: "Mykonos" });
  });
  it("reads a stay's address or area, and a generic name only in its country", () => {
    expect(tableParents(["Porto", "Gaula"], [stay("Porto"), stay("Gaula", "Gaula, Portugal")])).toEqual({ gaula: "Madeira" });
    expect(tableParents(["Quinta X"], [stay("Quinta X", "Estrada 12, 9100-123 Santa Cruz, Portugal", null, { countryCode: "PT" })])).toEqual({ "quinta x": "Madeira" });
    expect(tableParents(["Hotelito"], [stay("Hotelito", null, "Madeira")])).toEqual({ hotelito: "Madeira" });
    // Santa Cruz in Bolivia isn't Madeira's; a street named after the island isn't the island.
    expect(tableParents(["Santa Cruz"], [stay("Santa Cruz", null, null, { countryCode: "BO" })])).toEqual({});
    expect(tableParents(["Porto"], [stay("Porto", "Rua da Madeira 4, Porto")])).toEqual({});
  });
  it("takes a campervan where its page says it goes: its city is only the pickup", () => {
    const van = stay("Caniçal Depot", null, null, { name: "Renault Campervan 'Bawhee'", summary: "A campervan to explore Madeira at your own pace", countryCode: "PT" });
    expect(isMobileStay(van)).toBe(true);
    expect(isMobileStay(stay("Porto"))).toBe(false);
    expect(tableParents(["Porto", "Caniçal Depot"], [stay("Porto"), van])).toEqual({ "canical depot": "Madeira" });
    // A hotel's summary naming the island isn't where the hotel is.
    expect(tableParents(["Porto"], [stay("Porto", null, null, { summary: "Day trips to Madeira" })])).toEqual({});
  });
  it("lets a valid model answer win, fills in what it didn't fold, and names one destination one way", () => {
    const items = [stay("Porto"), stay("Gaula", "Gaula, Madeira, Portugal")];
    // The answer the 0.35.3 board had stored: nothing folded.
    expect(resolveParents(["Porto", "Gaula"], items, {})).toEqual({ gaula: "Madeira" });
    expect(resolveParents(["Porto", "Gaula"], items, { gaula: "Ilha da Madeira" })).toEqual({ gaula: "Madeira" });
    expect(resolveParents(["Lagos", "Burgau"], [], { lagos: "Western Algarve" })).toEqual({ lagos: "Western Algarve", burgau: "Algarve" });
    expect(mainPlaces(["Elounda", "Malia"], resolveParents(["Elounda", "Malia"], [], { elounda: "Crete" })).map((p) => p.name)).toEqual(["Girit"]);
  });
});
