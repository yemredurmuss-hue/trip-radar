// Fikir havuzu v1: an idea's kind from its words (then a restaurant's meal); the traveller's pick wins.
import { describe, expect, it } from "vitest";
import { ideaKindOf } from "../src/lib/ideaKinds";
import { ideaMapUrl } from "../src/lib/ideas";
import { makeItem } from "./fixtures/makeItem";

const todo = (name: string, over = {}) => ideaKindOf(makeItem({ name, category: "activity", ...over }));
const food = (name: string, over = {}) => ideaKindOf(makeItem({ name, category: "food", ...over }));

describe("an idea's kind", () => {
  it("things to do, as in the draft", () => {
    expect(todo("Dom Luís köprüsünden gün batımı")).toBe("view");
    expect(todo("Pico do Arieiro'da gün doğumu")).toBe("view");
    expect(todo("Livraria Lello")).toBe("culture");
    expect(todo("Madeira Story Centre")).toBe("culture");
    expect(todo("Bolhão pazarı")).toBe("shop");
    expect(todo("Porto şarabı al")).toBe("shop");
    expect(todo("Jardins do Palácio de Cristal")).toBe("nature");
    expect(todo("Levada do Caldeirão Verde")).toBe("nature");
    expect(todo("Funchal eski şehir")).toBe("walk");
    expect(todo("Ribeira yürüyüşü")).toBe("walk");
    expect(todo("Kleopatra")).toBeNull();
  });
  it("restaurants: words, then the meal, else dinner", () => {
    expect(food("Majestic Café", { meal: "lunch" })).toBe("coffee");
    expect(food("Manteigaria · pastel de nata")).toBe("sweet");
    expect(food("Wine bar do Castelo")).toBe("bar");
    expect(food("Taberna dos Mercadores", { meal: "lunch" })).toBe("lunch");
    expect(food("Armazém do Sal")).toBe("dinner");
  });
  it("the traveller's pick wins, if it's a kind of that section", () => {
    expect(todo("Bolhão pazarı", { ideaKind: "culture" })).toBe("culture");
    expect(todo("Bolhão pazarı", { ideaKind: "sweet" })).toBe("shop");
  });
});

describe("one map link", () => {
  it("its own Maps page when saved from Maps, else a search for the place", () => {
    expect(ideaMapUrl(makeItem({ name: "Jardins", city: "Porto", url: "https://maps.app.goo.gl/abc" }))).toBe("https://maps.app.goo.gl/abc");
    expect(ideaMapUrl(makeItem({ name: "Livraria Lello", city: "Porto", url: "https://www.instagram.com/reel/x/" }))).toBe("https://www.google.com/maps/search/?api=1&query=Livraria%20Lello%2C%20Porto");
  });
});
