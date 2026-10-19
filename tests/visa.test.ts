// The visa line (lib/visa.ts, 0.39.1, Emre: "say whether it's needed, and let me tick it"): the answer itself where the
// table is sure, "check the official source" for any other pair, which country it answers for (drawn whenever the trip
// goes abroad), and one mark shared by Belgeler's "Var"/"Yok" and Hazırlık's visa chore.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { prepTasks } from "../src/lib/prepDays";
import { visaAnswer, visaCountry, visaDoneOf, visaFor, withVisaDone } from "../src/lib/visa";

afterEach(() => setLang("tr"));

describe("the answer said directly", () => {
  it("a Turkish passport to Indonesia (Bali): on arrival or e-VOA, up to 30 days, a fee", () => {
    expect(visaAnswer(visaFor("TR", "ID"), false)).toEqual({ head: "Varışta vize ya da e-VOA", sub: "30 güne kadar · ücretli" });
    setLang("en");
    expect(visaAnswer(visaFor("TR", "ID"), false)).toEqual({ head: "Visa on arrival or e-VOA", sub: "up to 30 days · a fee is paid" });
  });
  it("visa-free, a visa to apply for, an ETA", () => {
    expect(visaAnswer(visaFor("TR", "JP"), false)).toEqual({ head: "Vize gerekmez", sub: "90 güne kadar" });
    expect(visaAnswer(visaFor("TR", "PT"), false)).toEqual({ head: "Vize gerekli · başvuru", sub: "Schengen vizesi" });
    expect(visaAnswer(visaFor("TR", "US"), false)).toEqual({ head: "Vize gerekli · başvuru", sub: "ABD vizesi" });
    expect(visaAnswer(visaFor("TR", "LK"), false)).toEqual({ head: "e-Vize (ETA) gerekli", sub: "Sri Lanka ETA (elektronik vize)" });
  });
  it("a pair the table doesn't know keeps the official source; no passport known asks which", () => {
    expect(visaAnswer(visaFor("TR", "ZZ"), false)).toEqual({ head: "Vize", sub: "Resmi kaynağa bak" });
    expect(visaAnswer(visaFor("GB", "ID"), false)).toEqual({ head: "Vize", sub: "Resmi kaynağa bak" });
    expect(visaAnswer(visaFor(null, "ID"), false)).toEqual({ head: "Vize", sub: "Pasaportun hangi ülke?" });
  });
  it("ticked: green 'Vize tamam', the answer beside it", () => {
    expect(visaAnswer(visaFor("TR", "ID"), true)).toEqual({ head: "Vize tamam", sub: "Varışta vize ya da e-VOA" });
    expect(visaAnswer(visaFor("TR", "ZZ"), true)).toEqual({ head: "Vize tamam", sub: null });
  });
});

describe("which country it answers for (shown whenever the trip goes abroad)", () => {
  it("the main country when abroad", () => {
    expect(visaCountry("ID", ["ID"], "TR")).toBe("ID");
  });
  it("a home place that outnumbers the rest (a Bodrum night before the flight) doesn't hide it", () => {
    expect(visaCountry("TR", ["ID"], "TR")).toBe("ID");
  });
  it("with no place abroad yet, where the flights land", () => {
    expect(visaCountry(null, ["ID"], "TR")).toBe("ID");
  });
  it("no passport known: still the trip's country (the row asks for the passport)", () => {
    expect(visaCountry("id", [], null)).toBe("ID");
  });
  it("nothing abroad: none", () => {
    expect(visaCountry("TR", [], "TR")).toBeNull();
    expect(visaCountry(null, [], "TR")).toBeNull();
  });
});

describe("one mark: Belgeler's Var/Yok and Hazırlık's visa chore", () => {
  const base = { visaDone: undefined, prepDone: { "checkin:f1": 1 } as Record<string, number> };
  const prep = (trip: Pick<typeof base, "visaDone" | "prepDone">) =>
    prepTasks({ chores: [], items: [], trip, range: { start: "2026-12-10", end: "2027-01-10" }, passport: "TR", countries: ["ID"], today: "2026-10-19" }).find((t) => t.key === "visa:ID")!;

  it("'Var' in Belgeler ticks Hazırlık's chore; 'Yok' takes it back", () => {
    const got = withVisaDone(base, true);
    expect(visaDoneOf(got)).toBe(true);
    expect(prep(got).done).toBe(true);
    const back = withVisaDone(got, false);
    expect(visaDoneOf(back)).toBe(false);
    expect(prep(back).done).toBe(false);
    // The other marks stay.
    expect(back.prepDone).toEqual({ "checkin:f1": 1 });
  });
  it("ticked in Hazırlık: Belgeler says 'Vize tamam'; taken back there, both are open again", () => {
    const got = withVisaDone(base, true, "visa:ID", 42);
    expect(got).toMatchObject({ visaDone: true, prepDone: { "checkin:f1": 1, "visa:ID": 42 } });
    expect(prep(got)).toMatchObject({ done: true, doneAt: 42 });
    const back = withVisaDone(got, false);
    expect(back.visaDone).toBeUndefined();
    expect(prep(back).done).toBe(false);
  });
  it("a visa chore ticked in Hazırlık before the two were one counts as sorted", () => {
    expect(visaDoneOf({ prepDone: { "visa:schengen": 5 } })).toBe(true);
    expect(visaDoneOf({ prepDone: { "checkin:f1": 5 } })).toBe(false);
  });
});
