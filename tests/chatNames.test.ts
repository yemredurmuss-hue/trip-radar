// Sohbette seçenek adı tıklanır: only real names of the trip's records are linked.
import { describe, expect, it } from "vitest";
import { nameTargets, splitNames } from "../src/lib/chatNames";
import { makeItem } from "./fixtures/makeItem";

const items = [
  makeItem({ id: "j", tripId: "t1", name: "Jardim Stay" }),
  makeItem({ id: "c", tripId: "t1", name: "Casa Azul" }),
  makeItem({ id: "p", tripId: "t1", name: "Pegasus · direkt" }),
  makeItem({ id: "t1", tripId: "t1", name: "TAP · Lizbon → İstanbul" }),
  makeItem({ id: "t2", tripId: "t1", name: "TAP · Lizbon aktarmalı" }),
  makeItem({ id: "x", tripId: "t1", name: "Ribeira Rooms", status: "dismissed" }),
  makeItem({ id: "o", tripId: "other", name: "Hotel Elsewhere" }),
];
const targets = nameTargets(items, "t1");
const linked = (text: string) => splitNames(text, targets).flatMap((p) => (typeof p === "string" ? [] : [[p.text, p.id]]));

describe("sohbette seçenek adı", () => {
  it("only this trip's options and plans are names; a ruled-out one and another trip's are not", () => {
    expect(targets.map((t) => t.id)).toEqual(["j", "c", "p", "t1", "t2"]);
    expect(linked("Ribeira Rooms ve Hotel Elsewhere uygun değil.")).toEqual([]);
  });

  it("a real name in the reply is a link to its record, with the words around it unchanged", () => {
    const pieces = splitNames("**Jardim Stay** merkezde; Casa Azul €45 daha ucuz.", targets);
    expect(pieces.map((p) => (typeof p === "string" ? p : p.text)).join("")).toBe("**Jardim Stay** merkezde; Casa Azul €45 daha ucuz.");
    expect(linked("**Jardim Stay** merkezde; Casa Azul €45 daha ucuz.")).toEqual([["Jardim Stay", "j"], ["Casa Azul", "c"]]);
  });

  it("whole words only, Turkish suffixes after an apostrophe still count, case is ignored", () => {
    expect(linked("Jardim Stay'i seçelim.")).toEqual([["Jardim Stay", "j"]]);
    expect(linked("jardim stay güzel")).toEqual([["jardim stay", "j"]]);
    expect(linked("Jardim Stayler")).toEqual([]);
    expect(linked("Xjardim Stay")).toEqual([]);
  });

  it("a name that is not a record is never linked", () => {
    expect(linked("Porto'da bir otel daha bulabilirim.")).toEqual([]);
    expect(linked("")).toEqual([]);
  });

  it("the part before ' · ' is a name only when it means one record", () => {
    expect(linked("Pegasus uçuşu daha kısa.")).toEqual([["Pegasus", "p"]]);
    // TAP means two records: nothing is guessed.
    expect(linked("TAP daha ucuz.")).toEqual([]);
    expect(linked("TAP · Lizbon aktarmalı daha ucuz.")).toEqual([["TAP · Lizbon aktarmalı", "t2"]]);
  });

  it("the longest name wins when one holds another", () => {
    const two = nameTargets([makeItem({ id: "a", tripId: "t1", name: "Casa" }), makeItem({ id: "b", tripId: "t1", name: "Casa Azul" })], "t1");
    expect(splitNames("Casa Azul", two)).toEqual([{ text: "Casa Azul", id: "b" }]);
  });

  it("two records with the same name: the first takes it", () => {
    const dup = nameTargets([makeItem({ id: "a", tripId: "t1", name: "Casa Azul" }), makeItem({ id: "b", tripId: "t1", name: "casa azul" })], "t1");
    expect(splitNames("Casa Azul", dup)).toEqual([{ text: "Casa Azul", id: "a" }]);
  });
});
