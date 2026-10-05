// The hero card's "Tercihler": what was understood, in at most two rows (label · word), the rest counted.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { intentEntries } from "../src/app/IntentCard";
import type { Decisions } from "../src/app/useDecisions";
import type { Trip } from "../src/lib/types";
import { setLang } from "../src/lib/i18n";
import { noteCriteria, SAID_LEVEL } from "../src/lib/decision";
import { acceptNoteLabel, firstWords, noteLabelKey, preferenceRows, preferenceTags, type Pref } from "../src/lib/preferences";
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
    expect(noteCriteria("Geniş bir oturma alanı olsun")).toEqual(["space"]);
    expect(noteCriteria("A safe area with a nice view")).toEqual(["view", "safety"]);
  });

  it("doesn't name a note by a topic it only seems to speak of: a word starts where a word starts", () => {
    expect(noteCriteria("Son gün kalan saatlerde müze")).toEqual([]); // "kalan" isn't "alan"
    expect(noteCriteria("Otopark bedava olsun")).toEqual([]); // "bedava" isn't "bed"
    expect(noteCriteria("Booking review")).toEqual([]); // "review" isn't "view"
    expect(noteCriteria("unsafe after dark")).toEqual([]);
  });

  it("names a note by its topic only when the traveller hasn't set that topic's level, at the level it has now", () => {
    const decisions = (texts: string[]) =>
      ({ preferences: texts.map((text, n) => ({ id: `n${n}`, tripId: "t1", text, createdAt: n })), signals: [], ctx: { listings: new Map(), inferred: new Map() } }) as unknown as Decisions;
    const trip: Trip = { id: "t1", title: "x", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const notes = (t: Trip, texts: string[]) => intentEntries(t, decisions(texts)).entries.flatMap((e) => (e.pref.kind === "note" ? [e.pref] : []));
    expect(notes(trip, ["Sessiz bir yer istiyoruz"])).toMatchObject([{ label: "Sessizlik", level: 3 }]);
    // They said quiet matters a lot themselves: that's its own row; the note falls back to its words.
    expect(notes({ ...trip, priorities: { quiet: 4 } }, ["Sessiz bir yer istiyoruz"])).toMatchObject([{ label: null, level: null }]);
    expect(notes({ ...trip, categoryPriorities: { stay: { quiet: 1 } } }, ["Sessiz bir yer istiyoruz"])).toMatchObject([{ label: null, level: null }]);
    // Misread words fall through to the model's label, else the first words.
    const [museum] = notes(trip, ["Son gün kalan saatlerde müze"]);
    expect(museum).toMatchObject({ label: null, level: null });
    expect(preferenceRows([museum]).rows[0]).toMatchObject({ label: "Son gün kalan…", value: "Not" });
    const labelled = notes({ ...trip, prefLabels: { [museum.labelKey!]: "Son gün müze" } }, ["Son gün kalan saatlerde müze"]);
    expect(labelled).toMatchObject([{ label: "Son gün müze", level: null }]);
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
    // …and in the board's language: switching asks once more.
    const tr = noteLabelKey("n1", "Balkon olsun");
    setLang("en");
    expect(noteLabelKey("n1", "Balkon olsun")).not.toBe(tr);
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

describe("the hero's tags (0.35.4)", () => {
  it("each topic once, a must and 'Çok önemli' first and strong; what's fine or rules out stays in the window", () => {
    const prefs: Pref[] = [
      { kind: "category", scope: "Konaklama", topic: "temizlik", level: 3 },
      { kind: "priority", topic: "fiyat", level: 4 },
      { kind: "category", scope: "Konaklama", topic: "fiyat", level: 4 },
      { kind: "requirement", topic: "Wi-Fi" },
      { kind: "priority", topic: "manzara", level: 1 },
      { kind: "fine", topic: "Gürültü" },
      { kind: "note", topic: "Sessiz bir yer istiyoruz", label: "Sessizlik", level: 3 },
    ];
    const { tags, rest } = preferenceTags(prefs);
    expect(tags.map((t) => [t.label, t.strong, t.title])).toEqual([
      ["Wi-Fi", true, "Şart"],
      ["Fiyat", true, "Çok önemli"],
      ["Temizlik", false, "Önemli"],
      ["Sessizlik", false, "Önemli"],
    ]);
    expect(rest).toBe(2); // "manzara" (a little) and what's fine: in the window
    expect(preferenceTags(prefs, 2)).toMatchObject({ rest: 4 });
    expect(preferenceTags([])).toEqual({ tags: [], rest: 0 });
  });
});
