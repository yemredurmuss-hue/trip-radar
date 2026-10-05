// The hero card's "Tercihler": what was understood, in at most two rows (label · word), the rest counted.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { noteCriteria, SAID_LEVEL } from "../src/lib/decision";
import { acceptNoteLabel, firstWords, noteLabelKey, preferenceRows, type Pref } from "../src/lib/preferences";
import { findingTag } from "../src/lib/proscons";

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
      { kind: "note", topic: "sessiz bir oda olsun", label: "Sessizlik", level: SAID_LEVEL },
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
      "Sessizlik | Önemli",
      "Dar merdiven | Sorun değil",
      "Yan binada inşaat | Eler",
    ]);
    expect(rest).toBe(0);
  });

  it("names a note in a few words: its topic, else the model's label, else its first three words and …", () => {
    const prefs: Pref[] = [
      { kind: "note", topic: "Sessiz bir yer istiyoruz", label: "Sessizlik", level: SAID_LEVEL },
      { kind: "note", topic: "Akşamları şarap tadımına gitmek istiyoruz", label: "şarap tadımı" },
      { kind: "note", topic: "Odada mutlaka bir çalışma masası olsun çünkü ikimiz de uzaktan çalışacağız", label: null },
      { kind: "note", topic: "Balkon" },
      { kind: "note", topic: "Gürültü olmasın lütfen", label: "Sessizlik", level: SAID_LEVEL },
    ];
    const { rows, rest } = preferenceRows(prefs, 99);
    expect(rows.map((r) => `${r.label} | ${r.value} | ${r.count}`)).toEqual([
      "Sessizlik | Önemli | 2", // two notes that come out the same are one row
      "Şarap tadımı | Not | 1",
      "Odada mutlaka bir… | Not | 1",
      "Balkon | Not | 1",
    ]);
    expect(rest).toBe(0);
    for (const r of rows) expect(r.label.split(/\s+/).length).toBeLessThanOrEqual(3);
  });

  it("reads a note's topics in the order the code knows them", () => {
    expect(noteCriteria("Sessiz bir yer istiyoruz")).toEqual(["quiet"]);
    expect(noteCriteria("Merkezi ve sessiz olsun")).toEqual(["quiet", "location"]);
    expect(noteCriteria("Akşamları şarap tadımına gitmek istiyoruz")).toEqual([]);
  });

  it("keeps the model's label only when it is one: a few words, no sentence", () => {
    expect(acceptNoteLabel(" şarap tadımı. ")).toBe("Şarap tadımı");
    expect(acceptNoteLabel('"Balkon"')).toBe("Balkon");
    expect(acceptNoteLabel("Akşamları şarap tadımına gitmek istiyoruz çünkü")).toBe("");
    expect(acceptNoteLabel("x".repeat(40))).toBe("");
    expect(acceptNoteLabel(null)).toBe("");
    expect(firstWords("Bir iki üç dört")).toBe("Bir iki üç…");
    expect(firstWords("tek kelime.")).toBe("Tek kelime");
    // Keyed by the note and its words: an edited note is named again.
    expect(noteLabelKey("n1", "Balkon olsun")).not.toBe(noteLabelKey("n1", "Balkon olmasın"));
    expect(noteLabelKey("n1", "Balkon olsun")).toBe(noteLabelKey("n1", "Balkon olsun"));
  });

  it("names a finding by its short tag", () => {
    expect(findingTag({ text: "Dar merdiven", topic: "access", polarity: "negative" })).toBe("Dar merdiven");
    expect(findingTag({ text: "Yan binada inşaat gürültüsü", topic: "condition", polarity: "negative" })).toBe("Gürültülü");
    expect(findingTag({ text: "Odaların hepsinden deniz görünüyor her sabah", topic: "view", polarity: "positive" })).toBe("Manzaralı");
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
