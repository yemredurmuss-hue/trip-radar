// The hero's "Sıradaki" (lib/nextStep.ts, F4 and C30): a visa first, then our pick to take, a decision, a need to find;
// "İlk kaydı ekle" with nothing saved, the PDF with every need on the plan, sharing (or all set) with every need bought.
// On the trip and after it, no visa and no decision.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import type { IntentStatus } from "../src/lib/intents";
import { allSet, intentLabel, nextLabel, nextShort, nextStep, type NextIntent } from "../src/lib/nextStep";
import type { TripMode } from "../src/lib/tripPhase";

const intent = (status: IntentStatus, over: Partial<NextIntent> = {}): NextIntent => ({
  key: `k-${status}`, section: "stay", kind: "stay", status, frame: "stay", domKeys: [], head: { name: "Porto", route: null }, ...over,
});
const go = (intents: NextIntent[], o: Partial<{ saved: boolean; visa: boolean; sharable: boolean; mode: TripMode }> = {}) => nextStep({ intents, saved: true, visa: false, sharable: true, ...o });

describe("nextStep", () => {
  it("is the first save with nothing saved and nothing to find", () => {
    expect(go([], { saved: false })).toEqual({ kind: "first" });
    expect(nextLabel({ kind: "first" })).toBe("İlk kaydı ekle");
  });

  it("puts a visa to get before everything else", () => {
    expect(go([intent("suggested")], { visa: true })).toEqual({ kind: "visa" });
    expect(nextLabel({ kind: "visa" })).toBe("Sıradaki: vize randevusu");
  });

  it("takes our pick first, then a decision, then a need to find", () => {
    const flight = intent("deciding", { key: "f", section: "flight", kind: "flight", frame: "ticket", head: { name: "İstanbul → Porto", route: { from: "İstanbul", to: "Porto" } } });
    const all = [intent("booked"), intent("chosen", { key: "c" }), intent("searching", { key: "s" }), flight, intent("suggested", { key: "a", head: { name: "Lizbon", route: null } })];
    expect(go(all)).toMatchObject({ kind: "intent", intent: { key: "a" } });
    expect(go(all.filter((i) => i.key !== "a"))).toMatchObject({ intent: { key: "f" } });
    expect(go(all.filter((i) => i.key !== "a" && i.key !== "f"))).toMatchObject({ intent: { key: "s" } });
    // Only told what's missing (a suggestion), nothing saved yet: that need is next.
    expect(go([intent("searching")], { saved: false })).toMatchObject({ kind: "intent" });
  });

  it("C30: every need on the plan (one only chosen): the PDF; every need bought: sharing, else all set", () => {
    expect(go([intent("booked"), intent("chosen", { key: "c" }), intent("skipped")])).toEqual({ kind: "pdf" });
    expect(nextLabel({ kind: "pdf" })).toBe("Planı PDF indir");
    expect(go([intent("booked"), intent("arranged"), intent("skipped"), intent("included")])).toEqual({ kind: "share" });
    expect(go([intent("booked"), intent("arranged")], { sharable: false })).toEqual({ kind: "ready" });
    expect(go([intent("included")])).toEqual({ kind: "share" });
    expect(nextLabel({ kind: "share" })).toBe("Paylaş");
    expect(nextLabel({ kind: "ready" })).toBe("Her şey hazır");
  });

  it("C24: the thin bar's all set is every need bought, not merely planned", () => {
    expect(allSet(go([intent("booked")]))).toBe(true);
    expect(allSet(go([intent("booked")], { sharable: false }))).toBe(true);
    expect(allSet(go([intent("chosen")]))).toBe(false);
    expect(allSet(go([intent("deciding")]))).toBe(false);
  });

  it("row 127: on the trip and after it, no visa and no decision; the PDF or sharing instead", () => {
    const open = [intent("booked"), intent("deciding", { key: "d" }), intent("suggested", { key: "a" })];
    expect(go(open, { visa: true, mode: "trip" })).toEqual({ kind: "pdf" });
    expect(go([intent("booked"), intent("chosen", { key: "c" })], { visa: true, mode: "archive" })).toEqual({ kind: "pdf" });
    expect(go([intent("booked")], { visa: true, mode: "archive" })).toEqual({ kind: "share" });
    expect(go([intent("booked")], { visa: true, mode: "archive", sharable: false })).toEqual({ kind: "ready" });
    // Before it the visa still comes first.
    expect(go(open, { visa: true, mode: "plan" })).toEqual({ kind: "visa" });
  });
});

describe("intentLabel", () => {
  it("names a stay by its city, a ticket by its ends, a row by its city", () => {
    expect(nextLabel({ kind: "intent", intent: intent("suggested") })).toBe("Sıradaki: Porto konaklaması");
    expect(intentLabel(intent("deciding", { section: "flight", kind: "flight", frame: "ticket", head: { name: "İstanbul → Porto", route: { from: "İstanbul", to: "Porto" } } }))).toBe("İstanbul → Porto uçuşu");
    expect(intentLabel(intent("deciding", { section: "transport", kind: "train", frame: "ticket", head: { name: "Porto → Lizbon", route: { from: "Porto", to: "Lizbon" } } }))).toBe("Porto → Lizbon treni");
    expect(intentLabel(intent("deciding", { section: "activity", kind: "activity", frame: "collection", head: { name: "Lizbon", route: null } }))).toBe("Lizbon'da etkinlikler");
    expect(intentLabel(intent("searching", { section: "other", kind: "esim", frame: "stay", head: { name: "eSIM · Portekiz", route: null } }))).toBe("eSIM · Portekiz");
    expect(intentLabel(intent("searching", { section: "flight", kind: "flight", frame: "ticket", head: { name: "Dönüş bileti", route: null } }))).toBe("Dönüş bileti");
  });

  it("reads in English too, and the thin bar's form has no colon", () => {
    expect(withLang("en", () => nextLabel({ kind: "intent", intent: intent("suggested") }))).toBe("Next: Porto stay");
    expect(withLang("en", () => nextLabel({ kind: "pdf" }))).toBe("Download the plan as PDF");
    expect(nextShort({ kind: "intent", intent: intent("suggested") })).toBe("Sıradaki Porto konaklaması");
    expect(nextShort({ kind: "share" })).toBe("Paylaş");
  });
});
