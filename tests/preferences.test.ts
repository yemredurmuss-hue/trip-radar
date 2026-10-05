// The hero card's "Tercihler": what was understood, in at most two rows (label · word), the rest counted.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { preferenceRows, type Pref } from "../src/lib/preferences";

afterEach(() => setLang("tr"));

describe("preference rows", () => {
  it("groups the priorities said by level, highest first, labels joined with ' + '", () => {
    const prefs: Pref[] = [
      { kind: "priority", topic: "Konfor/temizlik", level: 3 },
      { kind: "priority", topic: "Fiyat", level: 4 },
      { kind: "priority", topic: "Konum", level: 4 },
      { kind: "priority", topic: "Bagaj", level: 1 },
    ];
    const { rows, rest } = preferenceRows(prefs);
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Fiyat + konum", "Çok önemli"],
      ["Konfor/temizlik", "Önemli"],
      ["Bagaj", "Az"],
    ]);
    expect(rest).toBe(1); // the two rows stand for three of the four
  });

  it("then a category's own, the musts, the wishes, confirmed guesses, notes, what's fine and what rules out", () => {
    const prefs: Pref[] = [
      { kind: "matters", topic: "Yan binada inşaat" },
      { kind: "note", topic: "sessiz bir oda olsun" },
      { kind: "fine", topic: "Dar merdiven" },
      { kind: "signal", topic: "Puan/yorumlar", up: false },
      { kind: "signal", topic: "İptal esnekliği", up: true },
      { kind: "amenity", topic: "mutfak" },
      { kind: "amenity", topic: "Klima" },
      { kind: "requirement", topic: "Mutfak" },
      { kind: "category", scope: "Konaklama", topic: "Konum", level: 3 },
      { kind: "priority", topic: "Fiyat", level: 4 },
    ];
    const { rows, rest } = preferenceRows(prefs, 99);
    expect(rows.map((r) => `${r.label} | ${r.value}`)).toEqual([
      "Fiyat | Çok önemli",
      "Konaklama · konum | Önemli",
      "Mutfak | Şart",
      "Mutfak + klima | İstiyorsun",
      "İptal esnekliği | Önemli",
      "Puan/yorumlar | İkinci planda",
      "Sessiz bir oda olsun | Not",
      "Dar merdiven | Sorun değil",
      "Yan binada inşaat | Eler",
    ]);
    expect(rest).toBe(0);
  });

  it("counts what's left after the two rows shown; nothing understood, nothing to show", () => {
    const notes: Pref[] = Array.from({ length: 9 }, (_, i) => ({ kind: "note", topic: `not ${i}` }));
    expect(preferenceRows(notes).rest).toBe(7);
    expect(preferenceRows([])).toEqual({ rows: [], rest: 0 });
  });

  it("speaks the board's language", () => {
    setLang("en");
    const { rows } = preferenceRows([
      { kind: "priority", topic: "Price", level: 4 },
      { kind: "requirement", topic: "Kitchen" },
    ]);
    expect(rows.map((r) => r.value)).toEqual(["Very important", "Must"]);
  });
});
