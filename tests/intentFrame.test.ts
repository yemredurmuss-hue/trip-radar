// What an intent box draws in its fixed frame (lib/intentFrame.ts, v82 geçişi aşama 3a): the form of each state, the chip
// and the rail's dot, the side column's price, the main action's words, Değiştir's options (the chosen one among them, in
// place), the options' header, a booking's hours, the empty frame's lines, "Kendin ara" from the providers' register, and
// the plan's decisions in the order the head's count goes to them (F5).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import {
  bookedWhen,
  bookWord,
  changeList,
  currentOption,
  decideCount,
  emptyLine,
  emptyTitle,
  headName,
  unlessEmpty,
  firstDecision,
  frameForm,
  optionPrice,
  optionsHead,
  railState,
  ratingParts,
  selfSearches,
  sidePrice,
  sourceBadge,
  statusChip,
} from "../src/lib/intentFrame";
import type { IntentStatus, IntentVM, OptionVM } from "../src/lib/intents";
import { makeItem } from "./fixtures/makeItem";

const opt = (id: string, place: number, over: Partial<OptionVM> = {}): OptionVM => ({
  id, item: makeItem({ id, url: `https://www.booking.com/hotel/${id}.html` }), title: id, brand: null, source: null, image: null, gallery: [], price: null, ticket: null,
  score: null, place, rating: null, where: null, cancel: null, checks: [], badges: [], ours: false, leg: null, current: false, carrier: null, near: [], topics: [], ...over,
});

const vm = (status: IntentStatus, over: Partial<IntentVM> = {}): IntentVM => ({
  key: `k-${status}`, section: "stay", frame: "stay", kind: "stay", status, word: status,
  head: { name: "Osaka", route: null, parts: [], kindWord: null, word: null, wants: [], image: null, city: "Osaka", date: "2027-04-12", nights: 4 },
  options: [], optionCount: 0, chosen: null, planned: [], access: null, paid: null, estimate: null, note: null, suggestions: [], wanted: [], cover: null, ticket: null, modes: [], itemIds: [], domKeys: [], ...over,
});

describe("the frame's form, the chip and the rail", () => {
  it("each state its own form; an Aranıyor with options shows them; Gerek yok has none", () => {
    expect(frameForm(vm("searching"))).toBe("searching");
    expect(frameForm(vm("searching", { options: [opt("a", 1)] }))).toBe("options");
    expect(frameForm(vm("deciding", { options: [opt("a", 1)] }))).toBe("options");
    expect(["suggested", "chosen", "booked", "arranged", "included"].map((s) => frameForm(vm(s as IntentStatus)))).toEqual(["suggested", "chosen", "booked", "arranged", "included"]);
    expect(frameForm(vm("skipped"))).toBeNull();
  });
  it("the prototype's data-st and chip tones; our pick asks to be confirmed", () => {
    expect((["searching", "deciding", "suggested", "chosen", "booked", "arranged", "included", "skipped"] as IntentStatus[]).map(railState)).toEqual(["todo", "todo", "ai", "sel", "ok", "arr", "inc", "skip"]);
    expect(statusChip(vm("suggested", { word: "Önerimiz" }))).toEqual({ tone: "ai", text: "✨ Önerimiz · onayla", tick: false });
    expect(statusChip(vm("booked", { word: "Rezerve" }))).toEqual({ tone: "ok", text: "Rezerve", tick: true });
    // K80: a booking says "Rezerve" whatever was booked (a ticket too, its word was "Alındı").
    expect(statusChip(vm("booked", { word: "Alındı" }))).toEqual({ tone: "ok", text: "Rezerve", tick: true });
    expect(statusChip(vm("searching", { word: "Aranıyor" })).tone).toBe("none");
    expect(withLang("en", () => statusChip(vm("suggested", { word: "Our pick" })).text)).toBe("✨ Our pick · confirm");
  });
});

describe("the side column", () => {
  it("a stay's price by the night, its nights' total under it; anything else as given", () => {
    expect(sidePrice({ text: "€639", label: "3 gece toplam", perNight: "€213 / gece", provisional: false })).toEqual({ big: "€213", small: "/ gece · €639" });
    expect(sidePrice({ text: "€9", label: "kişi başı", perNight: null, provisional: false })).toEqual({ big: "€9", small: "kişi başı" });
    expect(sidePrice(null)).toBeNull();
    expect(optionPrice({ text: "€639", label: "3 gece toplam", perNight: "€213 / gece", provisional: false })).toEqual({ amount: "€213", unit: "/ gece" });
  });
  it("the action's words by kind, in both languages", () => {
    expect([bookWord("stay"), bookWord("esim"), bookWord("insurance"), bookWord("train")]).toEqual(["Rezerve et", "Satın al", "Satın al", "Bileti al"]);
    expect(withLang("en", () => bookWord("stay"))).toBe("Book");
  });
  it("a rating split as the frame draws it; who added an option", () => {
    expect(ratingParts("8,9 · 1.204 yorum")).toEqual({ score: "8,9", star: false, reviews: "1.204 yorum" });
    expect(ratingParts("★ 4,9")).toEqual({ score: "★ 4,9", star: true, reviews: null });
    expect(sourceBadge(opt("a", 1, { ours: true }))?.tone).toBe("best");
    expect(sourceBadge(opt("a", 1, { source: { kind: "person", name: "sabine" } }))).toEqual({ tone: "mine", text: "sabine ekledi", initial: "S" });
    expect(sourceBadge(opt("a", 1))).toBeNull();
  });
});

describe("Değiştir: the options in place, the chosen one marked", () => {
  const options = [opt("b", 1), opt("c", 2), opt("d", 3), opt("e", 4)];
  it("the chosen one in its place of fit; beyond the third it takes the third's place", () => {
    expect(changeList(vm("chosen", { chosen: opt("a", 2), options })).map((o) => o.id)).toEqual(["b", "a", "c"]);
    expect(changeList(vm("chosen", { chosen: opt("a", 5), options })).map((o) => o.id)).toEqual(["b", "c", "a"]);
    expect(currentOption(vm("chosen", { chosen: opt("a", 2) }))).toBe("a");
  });
  it("our pick isn't the traveller's: its need's options as they stand, nothing marked", () => {
    expect(changeList(vm("suggested", { chosen: options[0], options })).map((o) => o.id)).toEqual(["b", "c", "d"]);
    expect(currentOption(vm("suggested", { chosen: options[0] }))).toBeNull();
  });
  it("the header: how many and where the rest are; while changing, the mark", () => {
    expect(optionsHead(vm("deciding", { optionCount: 4 }), false)).toEqual({ title: "Seçenekler", caption: "4 · ilk 3, tümü Pano'da" });
    expect(optionsHead(vm("deciding", { optionCount: 2 }), false).caption).toBe("2");
    expect(optionsHead(vm("chosen", { optionCount: 3, chosen: opt("a", 1) }), true)).toEqual({ title: "Başka bir seçenek seç", caption: "seçtiğin işaretli" });
  });
});

describe("a booking's hours and the empty frame", () => {
  const loft = makeItem({ category: "stay", dates: { start: "2026-10-11", end: "2026-10-14", source: "page" } });
  it("a stay's check-in and check-out with their hours, else its days", () => {
    expect(bookedWhen(loft, { when: "11–14 Eki", checkIn: "15:00", checkOut: "11:00" }, "stay")).toBe("Giriş 11 Eki 15:00 · Çıkış 14 Eki 11:00");
    expect(bookedWhen(loft, { when: "11–14 Eki", checkIn: "15:00", checkOut: null }, "stay")).toBe("Giriş 11 Eki 15:00 · Çıkış 14 Eki");
    expect(bookedWhen(loft, { when: "11–14 Eki", checkIn: null, checkOut: null }, "stay")).toBe("11–14 Eki");
    expect(bookedWhen(loft, { when: "1 Nis", checkIn: null, checkOut: null }, "esim")).toBe("1 Nis");
  });
  it("where to stay in a city; only what is known on the second line (C19)", () => {
    expect(emptyTitle(vm("searching"))).toBe("Osaka'da nerede kalınır");
    expect(withLang("en", () => emptyTitle(vm("searching")))).toBe("Where to stay in Osaka");
    expect(emptyTitle(vm("searching", { kind: "insurance", head: { ...vm("searching").head, name: "Seyahat sağlık sigortası", city: null } }))).toBe("Seyahat sağlık sigortası");
    // Nights with no city yet: never "Konaklama yok" (C19).
    const nowhere = vm("searching", { head: { ...vm("searching").head, name: "Konaklama yok", city: null } });
    expect(headName(nowhere)).toBe("Konaklama");
    expect(emptyTitle(nowhere)).toBe("Bu geceler için nerede kalınır");
    expect(headName(vm("searching"))).toBe(vm("searching").head.name);
    expect(emptyLine(vm("searching", { estimate: { label: "~€90–160", unit: "night", n: 3 } }))).toBe("tahmini ~€90–160");
    expect(emptyLine(vm("searching"))).toBeNull();
    expect(emptyLine(vm("searching", { kind: "insurance" }))).toBe("zorunlu değil ama önerilir");
  });
});

describe("Kendin ara: the providers' register", () => {
  const at = { countries: ["JP"], countryNames: ["Japonya"], adults: 2 };
  it("a stay: the traveller's link's site first, the nights and the head count in the search; Agoda waits for phase 7", () => {
    const links = selfSearches(vm("deciding", { options: [opt("a", 1)] }), at);
    expect(links.map((l) => l.id)).toEqual(["booking", "airbnb"]);
    expect(links[0].url).toContain("checkin=2027-04-12");
    expect(links[0].url).toContain("checkout=2027-04-16");
  });
  it("an eSIM by the country; insurance its comparison search", () => {
    expect(selfSearches(vm("searching", { kind: "esim" }), at).map((l) => l.id)).toEqual(["airalo", "holafly"]);
    const ins = selfSearches(vm("searching", { kind: "insurance" }), at);
    expect(ins).toHaveLength(1);
    expect(ins[0].url).toContain("Japonya");
  });
});

describe("the plan's decisions (F5)", () => {
  const col = (id: "flight" | "stay" | "other", intents: IntentVM[], decide: number) => ({
    section: { id }, intents, summary: { counts: { booked: 0, chosen: 0, decide, arranged: 0, skipped: 0 } },
  });
  it("the head counts every one; the first is our pick waiting, then one with options, then one to find", () => {
    const cols = [
      col("flight", [vm("searching", { key: "f1", section: "flight" })], 1),
      col("stay", [vm("deciding", { key: "s1", options: [opt("a", 1)] }), vm("suggested", { key: "s2" })], 2),
    ];
    expect(decideCount(cols as never)).toBe(3);
    expect(firstDecision(cols as never)).toMatchObject({ section: "stay", intent: { key: "s2" } });
    expect(firstDecision([cols[0]] as never)).toMatchObject({ section: "flight", intent: { key: "f1" } });
    expect(firstDecision([col("other", [vm("booked")], 0)] as never)).toBeNull();
  });
});

describe("what the start only made room for", () => {
  const trip = { startGuide: undefined };
  const bare = makeItem({ id: "ph", name: "Otel", category: "stay", origin: "chat", status: "chosen", url: null, provider: null });
  it("a bare chat stay planned is Aranıyor, never Seçildi (Emre's rule); a real one stays chosen", () => {
    // Named by the traveller, it's theirs.
    const named = { ...bare, name: "Casa do Rio" };
    expect(unlessEmpty(vm("chosen", { chosen: opt("ph", 1, { item: named }) }), trip, [named], () => 0).status).toBe("chosen");
    const made = { ...bare, name: "Konaklama · Ubud" };
    expect(unlessEmpty(vm("chosen", { chosen: opt("ph", 1, { item: made }) }), trip, [made], () => 0).status).toBe("searching");
    const shown = unlessEmpty(vm("chosen", { chosen: opt("ph", 1, { item: bare }) }), trip, [bare], () => 0);
    expect(shown).toMatchObject({ status: "searching", word: "Aranıyor", chosen: null });
    const real = { ...bare, url: "https://www.booking.com/hotel/x.html" };
    expect(unlessEmpty(vm("chosen", { chosen: opt("ph", 1, { item: real }) }), trip, [real], () => 0).status).toBe("chosen");
    // A file on it says it's real.
    expect(unlessEmpty(vm("chosen", { chosen: opt("ph", 1, { item: bare }) }), trip, [bare], () => 1).status).toBe("chosen");
  });
});
