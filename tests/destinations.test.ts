// The hero's main places (revizyon 1): a town inside a destination folds into it (Gaula → Madeira); the
// Plan keeps every place. The model's answer is checked; before it, a guess from the stays' addresses.
import { afterEach, describe, expect, it } from "vitest";
import { acceptParents, answerParents, answersAny, fallbackParents, isMobileStay, mainPlaceOf, mainPlaces, placesKey, placesPrompt, placesSystemPrompt, resolveParents, tableParents } from "../src/lib/destinations";
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
  // Stays saved from pages in a country (the evidence a member needs).
  const inCountry = (code: string, ...cities: string[]) => cities.map((c) => stay(c, null, null, { countryCode: code }));
  it("folds a Madeira parish into Madeira when Madeira isn't one of the trip's places", () => {
    const items = [stay("Porto", "Rua do Almada 10, Porto", null, { countryCode: "PT" }), stay("Gaula", "Gaula, Portugal", null, { countryCode: "PT" })];
    expect(tableParents(["Porto", "Gaula"], items)).toEqual({ gaula: "Madeira" });
    expect(mainPlaces(["Porto", "Gaula"], resolveParents(["Porto", "Gaula"], items, null)).map((p) => p.name)).toEqual(["Porto", "Madeira"]);
    // Every parish listed goes to the island once the trip is in Portugal; Funchal (a city the app knows) always.
    expect(tableParents(["Câmara de Lobos", "Machico", "Funchal"], inCountry("PT", "Câmara de Lobos", "Machico"))).toEqual({ "camara de lobos": "Madeira", machico: "Madeira", funchal: "Madeira" });
    expect(tableParents(["Funchal"], [])).toEqual({ funchal: "Madeira" });
  });
  it("folds Gaula from its address alone: no country code, no model (the campervan on Emre's board)", () => {
    const van = stay("Gaula", "Gaula, Madeira, Portugal", null, { name: "Renault Campervan 'Bawhee'" });
    expect(tableParents(["Porto", "Gaula"], [stay("Porto"), van])).toEqual({ gaula: "Madeira" });
    expect(mainPlaces(["Porto", "Gaula"], resolveParents(["Porto", "Gaula"], [stay("Porto"), van], null)).map((p) => p.name)).toEqual(["Porto", "Madeira"]);
    // With nothing to go on (a plan said in the chat: no country, no address), a member isn't folded.
    expect(tableParents(["Porto", "Gaula"], [stay("Porto"), stay("Gaula")])).toEqual({});
  });
  it("keeps Porto Santo its own island, and real cities their own stops", () => {
    expect(tableParents(["Funchal", "Porto Santo"], [])).toEqual({ funchal: "Madeira" });
    expect(mainPlaces(["Funchal", "Porto Santo"], tableParents(["Funchal", "Porto Santo"], [])).map((p) => p.name)).toEqual(["Madeira", "Porto Santo"]);
    expect(tableParents(["Porto", "Lizbon", "Faro"], inCountry("PT", "Porto", "Lizbon", "Faro"))).toEqual({});
    expect(tableParents(["Palermo", "Catania", "Taormina"], inCountry("IT", "Palermo", "Catania", "Taormina"))).toEqual({ taormina: "Sicilya" });
    expect(tableParents(["Heraklion", "Chania", "Elounda"], inCountry("GR", "Heraklion", "Chania", "Elounda"))).toEqual({ elounda: "Girit" });
  });
  it("knows the islands and regions asked for, in the board's language", () => {
    expect(tableParents(["Albufeira", "Faro"], inCountry("PT", "Albufeira", "Faro"))).toEqual({ albufeira: "Algarve" });
    expect(tableParents(["Ponta Delgada", "Furnas"], inCountry("PT", "Furnas"))).toEqual({ "ponta delgada": "São Miguel", furnas: "São Miguel" });
    expect(tableParents(["Palma", "Sóller"], inCountry("ES", "Sóller"))).toEqual({ palma: "Mallorca", soller: "Mallorca" });
    expect(tableParents(["Sant Antoni de Portmany", "Ciutadella"], inCountry("ES", "Sant Antoni de Portmany", "Ciutadella"))).toEqual({ "sant antoni de portmany": "İbiza", ciutadella: "Menorca" });
    const canaries = ["Costa Adeje", "Maspalomas", "Playa Blanca", "Corralejo"];
    expect(tableParents(canaries, inCountry("ES", ...canaries))).toEqual({ "costa adeje": "Tenerife", maspalomas: "Gran Canaria", "playa blanca": "Lanzarote", corralejo: "Fuerteventura" });
    expect(tableParents(["Oia", "Ornos"], inCountry("GR", "Oia", "Ornos"))).toEqual({ oia: "Santorini", ornos: "Mikonos" });
    expect(tableParents(["Alghero", "Ubud"], [...inCountry("IT", "Alghero"), ...inCountry("ID", "Ubud")])).toEqual({ alghero: "Sardinya", ubud: "Bali" });
    setLang("en");
    const four = ["Elounda", "Taormina", "Alghero", "Ornos"];
    expect(tableParents(four, [...inCountry("GR", "Elounda", "Ornos"), ...inCountry("IT", "Taormina", "Alghero")])).toEqual({ elounda: "Crete", taormina: "Sicily", alghero: "Sardinia", ornos: "Mykonos" });
  });
  it("never folds a name that is also a town elsewhere, unless the region is named (review probes)", () => {
    // Santa Cruz and Puerto de la Cruz on a Tenerife trip: Santa Cruz isn't Madeira's.
    expect(tableParents(["Santa Cruz", "Puerto de la Cruz"], inCountry("ES", "Santa Cruz", "Puerto de la Cruz"))).toEqual({ "puerto de la cruz": "Tenerife" });
    expect(tableParents(["Santa Cruz", "Puerto de la Cruz"], [stay("Santa Cruz"), stay("Puerto de la Cruz")])).toEqual({});
    // San Antonio (Texas), San José (Costa Rica): not Ibiza's, with or without their country.
    expect(tableParents(["San Antonio", "San José"], [...inCountry("US", "San Antonio"), ...inCountry("CR", "San José")])).toEqual({});
    expect(tableParents(["San Antonio", "San José"], [stay("San Antonio"), stay("San José")])).toEqual({});
    // Lagos (Nigeria): not the Algarve's; the Algarve's Lagos when its address says so.
    expect(tableParents(["Lagos"], inCountry("NG", "Lagos"))).toEqual({});
    expect(tableParents(["Lagos"], [stay("Lagos")])).toEqual({});
    expect(tableParents(["Lagos", "Faro"], [stay("Lagos", "Rua X, 8600 Lagos, Algarve, Portugal", null, { countryCode: "PT" })])).toEqual({ lagos: "Algarve" });
    // Santa Cruz on the mainland (Torres Vedras): Portugal, but not Madeira; Madeira's when the address says so.
    expect(tableParents(["Santa Cruz"], [stay("Santa Cruz", "Av. do Atlântico, 2560 Santa Cruz, Torres Vedras, Portugal", null, { countryCode: "PT" })])).toEqual({});
    expect(tableParents(["Santa Cruz"], [stay("Santa Cruz", "Estrada 12, 9100-123 Santa Cruz, Madeira", null, { countryCode: "PT" })])).toEqual({ "santa cruz": "Madeira" });
    // Kuta on Lombok: Indonesia, but not Bali.
    expect(tableParents(["Kuta"], inCountry("ID", "Kuta"))).toEqual({});
    expect(tableParents(["Kuta"], [stay("Kuta", "Jl. Pantai Kuta, Kuta, Bali", null, { countryCode: "ID" })])).toEqual({ kuta: "Bali" });
  });
  it("reads a stay's address or area; a street named after the island isn't the island", () => {
    expect(tableParents(["Hotelito"], [stay("Hotelito", null, "Madeira")])).toEqual({ hotelito: "Madeira" });
    expect(tableParents(["Porto"], [stay("Porto", "Rua da Madeira 4, Porto", null, { countryCode: "PT" })])).toEqual({});
    // A stay of the place in another country never folds, even into a region it names.
    expect(tableParents(["Hotelito"], [stay("Hotelito", null, "Madeira", { countryCode: "ES" })])).toEqual({});
  });
  it("takes a campervan where its page says it goes: its city is only the pickup", () => {
    const van = stay("Caniçal Depot", null, null, { name: "Renault Campervan 'Bawhee'", summary: "A campervan to explore Madeira at your own pace", countryCode: "PT" });
    expect(isMobileStay(van)).toBe(true);
    expect(isMobileStay(stay("Porto"))).toBe(false);
    expect(tableParents(["Porto", "Caniçal Depot"], [stay("Porto"), van])).toEqual({ "canical depot": "Madeira" });
    // A hotel's summary naming the island isn't where the hotel is.
    expect(tableParents(["Porto"], [stay("Porto", null, null, { summary: "Day trips to Madeira" })])).toEqual({});
  });
  it("lets a valid model answer win, keeps what it kept on purpose, and fills in only what it didn't answer", () => {
    const items = [stay("Porto"), stay("Gaula", "Gaula, Madeira, Portugal")];
    // The answer the 0.35.3 board had stored: nothing folded, nothing kept on purpose.
    expect(resolveParents(["Porto", "Gaula"], items, {})).toEqual({ gaula: "Madeira" });
    expect(resolveParents(["Porto", "Gaula"], items, { gaula: "Ilha da Madeira" })).toEqual({ gaula: "Madeira" });
    // The model said null for Gaula: kept as "", the table doesn't override it; a capital it kept isn't renamed either.
    const kept = answerParents(["Porto", "Gaula"], [{ place: "Porto", parent: null }, { place: "Gaula (Portugal)", parent: null }]);
    expect(kept).toEqual({ porto: "", gaula: "" });
    // Hard evidence beats the model's null: Gaula's own address names Madeira.
    expect(resolveParents(["Porto", "Gaula"], items, kept)).toEqual({ gaula: "Madeira" });
    // Only the weaker evidence (saves in Portugal): the model's null stands.
    expect(resolveParents(["Porto", "Gaula"], inCountry("PT", "Porto", "Gaula"), kept)).toEqual({});
    expect(tableParents(["Porto", "Gaula"], inCountry("PT", "Porto", "Gaula"))).toEqual({ gaula: "Madeira" });
    expect(resolveParents(["Palma", "Sóller"], inCountry("ES", "Sóller"), { palma: "" })).toEqual({ soller: "Mallorca" });
    // A place the model didn't answer for is the table's.
    expect(resolveParents(["Palma", "Sóller"], inCountry("ES", "Sóller"), { soller: "Mallorca" })).toEqual({ soller: "Mallorca", palma: "Mallorca" });
    expect(resolveParents(["Lagos", "Burgau"], inCountry("PT", "Burgau"), { lagos: "Western Algarve" })).toEqual({ lagos: "Western Algarve", burgau: "Algarve" });
    expect(mainPlaces(["Elounda", "Malia"], resolveParents(["Elounda", "Malia"], inCountry("GR", "Malia"), { elounda: "Crete" })).map((p) => p.name)).toEqual(["Girit"]);
    // An empty answer list folds nothing and keeps nothing (it's cached as {}).
    expect(answerParents(["Porto", "Gaula"], [])).toEqual({});
  });
});
