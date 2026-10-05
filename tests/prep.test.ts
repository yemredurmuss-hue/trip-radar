// 0.34.6 §3: "Yapılacak şeyler" is what's done at the destination (see, eat, visit, do); the chores before
// the trip (buy, apply, book, print, pack, change money, insurance/visa/eSIM tasks) are a quiet "Hazırlık"
// tick list at the end of Diğer. A policy, a visa or an eSIM said without a chore verb is its own record in
// Diğer, never a to-do. Read from the record as it is (no migration): its words, and the chat's kind `prep`.
import { describe, expect, it } from "vitest";
import { bookingOf, isIdea } from "../src/lib/booking";
import { cardKind } from "../src/lib/cardKinds";
import { categorize, sectionOfItem, type SectionId } from "../src/lib/categories";
import { quickIdea } from "../src/lib/ideas";
import { buildPlan } from "../src/lib/plan";
import { planToSave, type PlannedInput } from "../src/lib/planned";
import { choreText, isPaperwork, isPrep } from "../src/lib/prep";
import { buildTimeline } from "../src/lib/timeline";
import { isInsurance } from "../src/lib/travelKinds";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const said = (over: Partial<PlannedInput>): PlannedInput => ({
  kind: "todo", date: null, end_date: null, time: null, from: null, to: null, city: "Porto", title: null, booked: false, note: null, ...over,
});
const chat = (over: Partial<PlannedInput>): Item => planToSave(said(over), [], "t1", "c1", 1).item;
const quick = (line: string): Item => quickIdea(line, ["Porto"], "t1", "q", 1)!;

describe("chore words (TR + EN)", () => {
  it.each([
    "Decathlon'dan yağmurluk al",
    "Yağmurluk satın al",
    "Vize başvurusu yap",
    "Döviz bozdur",
    "Biletleri yazdır",
    "Bavulu hazırla",
    "Pasaportu yenile",
    "Seyahat sigortası al",
    "eSIM'i indir",
    "Buy a rain jacket at Decathlon",
    "Print the boarding passes",
    "Pack the bags",
    "Exchange money",
    "Apply for the visa",
    "Get travel insurance",
  ])("%s → a chore", (line) => expect(choreText(line)).toBe(true));

  it.each([
    "Porto Belo Pazarı",
    "Dom Luís'te gün batımı",
    "Outdoor alışverişi",
    "Ribeira'da yürüyüş",
    "Fado dinle",
    "Sé Katedrali",
    "Travel Health Insurance",
    "seyahat sağlık sigortası",
    "Walk along Ribeira",
    "Livraria Lello giriş bileti",
    "Mercado do Bolhão",
    "Portugal",
  ])("%s → not a chore", (line) => expect(choreText(line)).toBe(false));
});

describe("Hazırlık, Yapılacak şeyler and Diğer", () => {
  it.each<[string, Item, SectionId, boolean]>([
    ["Decathlon'dan yağmurluk al (quick line)", quick("Decathlon'dan yağmurluk al"), "other", true],
    ["Decathlon'dan yağmurluk al (chat todo)", chat({ title: "Decathlon'dan yağmurluk al" }), "other", true],
    ["Buy a rain jacket (chat activity)", chat({ kind: "activity", title: "Buy a rain jacket at Decathlon" }), "other", true],
    ["Döviz bozdur (chat prep)", chat({ kind: "prep", title: "Döviz bozdur" }), "other", true],
    ["Vize başvurusu yap", quick("Vize başvurusu yap"), "other", true],
    ["Porto Belo Pazarı", quick("Porto Belo Pazarı"), "todo", false],
    ["Dom Luís'te gün batımı", chat({ title: "Dom Luís'te gün batımı", date: "2026-10-09" }), "todo", false],
    ["Outdoor alışverişi", chat({ kind: "activity", title: "Outdoor alışverişi" }), "todo", false],
  ])("%s", (_, item, section, prep) => {
    expect(sectionOfItem(item)).toBe(section);
    expect(isPrep(item)).toBe(prep);
    if (prep) expect(isIdea(item)).toBe(true);
  });

  it("a policy said as anything is insurance in Diğer, never a to-do or a chore", () => {
    for (const item of [
      chat({ kind: "activity", title: "Travel Health Insurance" }),
      chat({ kind: "todo", title: "seyahat sağlık sigortası" }),
      chat({ kind: "other", title: "Seyahat sağlık sigortası · Allianz" }),
      quick("Seyahat sağlık sigortası"),
      makeItem({ category: "activity", name: "Travel Health Insurance", origin: "chat", plannedKind: "activity", status: "chosen" }),
    ]) {
      expect(sectionOfItem(item)).toBe("other");
      expect(isInsurance(item)).toBe(true);
      expect(isPaperwork(item)).toBe(true);
      expect(isPrep(item)).toBe(false);
      expect(bookingOf(item)).toBe("needed");
      expect(cardKind(item)).toBe("insurance");
    }
  });

  it("a visa or an eSIM without a chore verb is its own record in Diğer; with one, a chore", () => {
    expect(sectionOfItem(quick("Schengen vizesi"))).toBe("other");
    expect(isPaperwork(quick("Schengen vizesi"))).toBe(true);
    expect(isPrep(quick("Schengen vizesi"))).toBe(false);
    expect(isPaperwork(quick("eSIM"))).toBe(true);
    expect(isPrep(quick("eSIM'i indir"))).toBe(true);
    expect(sectionOfItem(quick("eSIM'i indir"))).toBe("other");
  });

  it("an activity page that mentions insurance in its text stays an activity", () => {
    const tour = makeItem({ category: "activity", name: "Douro Valley wine tour", summary: "Lunch and insurance included", url: "https://www.getyourguide.com/x" });
    expect(sectionOfItem(tour)).toBe("activity");
    expect(isInsurance(tour)).toBe(false);
  });

  it("a ticket on a page stays in Etkinlikler even with a chore word", () => {
    expect(sectionOfItem(chat({ kind: "activity", title: "Livraria Lello bileti al", note: "bileti aldım", booked: true }))).toBe("activity");
  });

  it("every live record is in exactly one section; the chores are the Diğer section's Hazırlık list", () => {
    const trip: Trip = { id: "t1", title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const items = [
      { ...quick("Decathlon'dan yağmurluk al"), id: "rain" },
      { ...quick("Döviz bozdur"), id: "money", doneAt: 5 },
      { ...quick("Porto Belo Pazarı"), id: "market" },
      { ...chat({ kind: "activity", title: "Travel Health Insurance" }), id: "policy" },
    ];
    const plan = buildPlan(trip, items);
    const sections = categorize({ plan, timeline: buildTimeline(plan, [], items, new Set()), items });
    const all = sections.flatMap((s) => s.entries.flatMap((e) => e.itemIds));
    for (const id of ["rain", "money", "market", "policy"]) expect(all.filter((x) => x === id)).toHaveLength(1);
    const other = sections.find((s) => s.id === "other")!;
    expect(other.prep.flatMap((e) => e.itemIds).sort()).toEqual(["money", "rain"]);
    // The chores aren't drawn in the section's timeline; the policy is.
    expect(other.days.flatMap((d) => d.entries.flatMap((e) => e.itemIds))).toEqual(["policy"]);
    expect(other.entries).toHaveLength(3);
    expect(other.settled).toBe(1); // the money changed
    expect(other.status?.text).toMatch(/1 hazırlık/);
    expect(sections.find((s) => s.id === "todo")!.entries.flatMap((e) => e.itemIds)).toEqual(["market"]);
  });
});

describe("the chat's kind, guarded in code", () => {
  it("a policy or an eSIM said as an activity, a to-do or other becomes that record", async () => {
    const { guardKind } = await import("../src/lib/planned");
    expect(guardKind(said({ kind: "activity", title: "Travel Health Insurance" })).kind).toBe("insurance");
    expect(guardKind(said({ kind: "todo", title: "Allianz", note: "poliçeyi attım" })).kind).toBe("insurance");
    expect(guardKind(said({ kind: "other", title: "Airalo eSIM" })).kind).toBe("esim");
    expect(guardKind(said({ kind: "todo", title: "Vize başvurusu yap" })).kind).toBe("todo");
    expect(guardKind(said({ kind: "todo", title: "Seyahat sigortası al" })).kind).toBe("todo");
    expect(guardKind(said({ kind: "flight", title: "Insurance Air" })).kind).toBe("flight");
    expect(guardKind(said({ kind: "activity", title: "Porto Belo Pazarı" })).kind).toBe("activity");
  });
});

describe("saved pages are what they are", () => {
  it("a page is never a chore; an insurance page named with a verb is still a policy to compare", () => {
    const page = makeItem({ category: "activity", name: "Buy tickets · Livraria Lello", url: "https://maps.app.goo.gl/x" });
    expect(isPrep(page)).toBe(false);
    const policyPage = makeItem({ category: "other", name: "Get travel insurance · World Nomads", url: "https://worldnomads.com" });
    expect(isInsurance(policyPage)).toBe(true);
    expect(sectionOfItem(policyPage)).toBe("other");
  });
});
