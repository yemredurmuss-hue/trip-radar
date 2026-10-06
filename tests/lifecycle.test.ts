// Aşamalar (spec 2026-10-06-asamalar-design.md): every stage, the partial rule, a file making a booking Hazır,
// a cancellation reopening its need, the delete levels, the words in Turkish and English, the hero's numbers.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import {
  actionsFor,
  bestOf,
  countStages,
  deleteLevel,
  heroNumbers,
  needStage,
  needStageOf,
  openNeedsText,
  percentPossessive,
  plannedBookedText,
  stageLabel,
  stageOf,
  type Stage,
} from "../src/lib/lifecycle";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const rec = (status: Item["status"], over: Partial<Item> = {}) => makeItem({ status, dates: { start: "2026-10-08", end: "2026-10-11", source: "page" }, ...over });

afterEach(() => setLang("tr"));

describe("stageOf: one record", () => {
  it("each status, and what the caller knows", () => {
    expect(stageOf(rec("saved"))).toBe("options");
    expect(stageOf(rec("chosen"))).toBe("planned");
    expect(stageOf(rec("chosen"), { placeholder: true })).toBe("search");
    expect(stageOf(rec("chosen"), { empty: true })).toBe("search");
    expect(stageOf(rec("booked"))).toBe("booked");
    expect(stageOf(rec("dismissed"))).toBe("notNeeded");
  });

  it("a file on a booking makes it Hazır, whatever came first (a stage may be skipped)", () => {
    expect(stageOf(rec("booked"), { docs: 1 })).toBe("ready");
    expect(stageOf(rec("booked"), { docs: 0 })).toBe("booked");
    // A file doesn't make a plan a booking: the booking does.
    expect(stageOf(rec("chosen"), { docs: 1 })).toBe("planned");
  });

  it("an eSIM put in is Hazır", () => {
    expect(stageOf(rec("chosen", { category: "esim", installedAt: 5 }))).toBe("ready");
  });

  it("a booking whose days are over is Kullanıldı (only when today is known)", () => {
    expect(stageOf(rec("booked"), { today: "2026-10-12" })).toBe("used");
    expect(stageOf(rec("booked"), { today: "2026-10-11" })).toBe("booked");
    expect(stageOf(rec("booked"))).toBe("booked");
  });

  it("a cancelled booking (ruled out with the day it was cancelled) is İptal edildi; an unknown status is never an option", () => {
    expect(stageOf(rec("dismissed", { dismissedFrom: "booked", cancelledAt: 5 }))).toBe("cancelled");
    expect(stageOf({ ...rec("saved"), status: "cancelled" as Item["status"] })).toBe("cancelled");
    expect(stageOf({ ...rec("saved"), status: "somethingNew" as Item["status"] })).toBe("notNeeded");
  });
});

describe("a need: its alternatives and its parts", () => {
  it("of the alternatives, the furthest along; none left (all ruled out or cancelled): Aranacak", () => {
    expect(bestOf(["options", "planned", "options"])).toBe("planned");
    expect(bestOf(["options", "cancelled"])).toBe("options");
    expect(bestOf(["cancelled"])).toBe("search");
    expect(bestOf([])).toBe("search");
  });

  it("of the parts (night blocks, per-person tickets), the furthest behind", () => {
    expect(needStage(["booked", "planned"])).toBe("planned");
    expect(needStage(["ready", "booked"])).toBe("booked");
    expect(needStage(["ready", "search"])).toBe("search");
    // A part cancelled is a part to find again; a part over doesn't hold the rest back.
    expect(needStage(["booked", "cancelled"])).toBe("search");
    expect(needStage(["used", "planned"])).toBe("planned");
    expect(needStage(["used", "used"])).toBe("used");
    expect(needStage([])).toBe("search");
  });

  it("per person: Emre's ticket booked, Sabine's planned: Planlandı; both booked: Rezerve edildi", () => {
    const emre = rec("booked", { forWho: ["Emre"] });
    const sabine = rec("chosen", { forWho: ["Sabine"] });
    expect(needStageOf([emre, sabine])).toBe("planned");
    expect(needStageOf([emre, { ...sabine, status: "booked" }])).toBe("booked");
    // One for everyone is everyone's alternative: Sabine's saved option doesn't hold back the booking for both.
    expect(needStageOf([rec("booked"), rec("saved", { forWho: ["Sabine"] })])).toBe("booked");
    expect(needStageOf([emre, rec("saved", { forWho: ["Sabine"] })])).toBe("options");
  });

  it("a cancellation reopens its need: Aranacak, or the options still saved", () => {
    const cancelled = rec("dismissed", { dismissedFrom: "booked", cancelledAt: 5 });
    expect(needStageOf([cancelled])).toBe("search");
    expect(needStageOf([cancelled, rec("saved")])).toBe("options");
  });

  it("a file decides between booked and Hazır, record by record", () => {
    const a = rec("booked");
    expect(needStageOf([a], (i) => ({ docs: i.id === a.id ? 1 : 0 }))).toBe("ready");
  });
});

describe("what a stage allows", () => {
  it("actions per stage", () => {
    expect(actionsFor("search")).toEqual(["search", "paste", "notNeeded"]);
    expect(actionsFor("options")).toContain("pick");
    expect(actionsFor("planned")).toEqual(["book", "change"]);
    expect(actionsFor("booked")).toEqual(["addDoc", "cancel", "change"]);
    expect(actionsFor("ready")).toContain("openDoc");
    expect(actionsFor("cancelled")).toContain("search");
  });

  it("delete: at once with Geri al until it's booked; asked once booked or with a file, naming the others on a shared trip", () => {
    for (const s of ["search", "options", "planned", "cancelled", "notNeeded"] as Stage[]) expect(deleteLevel(s).level).toBe("undo");
    expect(deleteLevel("booked")).toEqual({ level: "confirm", text: "Bu rezervasyon onaylı. İptal ettiysen 'İptal ettim' de." });
    expect(deleteLevel("ready").text).toMatch(/^Belgesiyle birlikte çöpe gider/);
    expect(deleteLevel("booked", { shared: true }).text).toMatch(/diğer kişiler de etkilenir/);
    setLang("en");
    expect(deleteLevel("booked").text).toBe("This booking is confirmed. If you cancelled it, say 'I cancelled it'.");
  });
});

describe("words", () => {
  it("each stage in Turkish and English", () => {
    const all: Stage[] = ["search", "options", "planned", "booked", "ready", "cancelled", "notNeeded", "used"];
    expect(all.map((s) => stageLabel(s, { options: 3 }))).toEqual(["Aranacak", "Seçenekler (3)", "Planlandı · rezerve edilmedi", "Rezerve edildi", "Hazır", "İptal edildi", "Gerek yok", "Kullanıldı"]);
    expect(stageLabel("planned", { ticket: true })).toBe("Planlandı · bilet alınmadı");
    setLang("en");
    expect(all.map((s) => stageLabel(s, { options: 3 }))).toEqual(["To find", "Options (3)", "Planned · not booked", "Booked", "Ready", "Cancelled", "Not needed", "Used"]);
  });

  it("the percentage's Turkish suffix, as the number is read", () => {
    expect([0, 1, 2, 3, 6, 9, 10, 20, 30, 40, 50, 60, 67, 70, 80, 90, 100].map(percentPossessive)).toEqual([
      "%0'ı", "%1'i", "%2'si", "%3'ü", "%6'sı", "%9'u", "%10'u", "%20'si", "%30'u", "%40'ı", "%50'si", "%60'ı", "%67'si", "%70'i", "%80'i", "%90'ı", "%100'ü",
    ]);
  });
});

describe("the hero's numbers: over what's planned only", () => {
  it("(Rezerve + Hazır) ÷ (Planlandı + Rezerve + Hazır); what waits for a decision is a count beside it", () => {
    const c = countStages(["booked", "booked", "ready", "planned", "options", "options", "search", "used", "cancelled"]);
    expect(heroNumbers(c)).toEqual({ done: 3, planned: 1, inPlan: 4, open: 3, pct: 75 });
    expect(plannedBookedText(75)).toBe("Planlananların %75'i rezerve");
    expect(openNeedsText(3)).toBe("3 ihtiyaç karar bekliyor");
    setLang("en");
    expect(plannedBookedText(75)).toBe("75% of what's planned is booked");
  });

  it("nothing planned yet: no percentage", () => {
    expect(heroNumbers(countStages(["options", "search"]))).toMatchObject({ inPlan: 0, open: 2, pct: null });
  });
});
