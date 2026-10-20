// 0.39.13: the UX test's open start-chat items (K1). What was said is taken and never asked again.
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import {
  applyAnswer, applyText, checklist, companyCount, newStart, nextQuestion, parseStartText, pbCurrent, questionFits, stopsWanted, trimRoute, weekdayStart, withoutDayTrips,
  type StartRoute, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-20"; // a Tuesday
const ctx = { myName: null, fromGuess: null, today: TODAY };
const typed = (text: string, s: StartState = newStart("t", "plan", 1, "tr")) => applyText({ ...s, messages: [{ role: "user", text, at: 1 }] }, text, parseStartText(text, TODAY, nextQuestion(s)), 2, nextQuestion(s)).state;
const route = (stops: [string, number][]): StartRoute => ({ stops: stops.map(([city, nights]) => ({ city, nights })), arrive: null, leave: null, confirmed: false, source: "circuit" });

beforeEach(() => setLang("tr"));

describe("K1", () => {
  it("F04: walking is an active trip", () => {
    expect(parseStartText("Lizbon'da yürüyerek gezmeyi severiz", TODAY).styles).toContain("active");
  });
  it("F46: \"4 arkadaş gidiyoruz\" is four in all; \"4 arkadaşımla\" me and four", () => {
    expect(companyCount("4 arkadaş Sziget'e gidiyoruz", "friends")).toBe(4);
    expect(companyCount("4 arkadaşımla gidiyorum", "friends")).toBe(5);
  });
  it("F52: \"bu cuma\" is this Friday, \"gelecek cumartesi\" next week's", () => {
    expect(weekdayStart("Bu cuma Lizbon'a 3 gecelik kaçamak", TODAY)).toBe("2026-10-23");
    expect(weekdayStart("gelecek cumartesi Roma", TODAY)).toBe("2026-10-31");
    expect(parseStartText("Bu cuma Lizbon'a 3 gecelik kaçamak", TODAY).start).toEqual({ date: "2026-10-23", approx: false });
  });
  it("F53: \"en uygun uçuş\" is a budget trip; three nights don't ask the style", () => {
    expect(parseStartText("Lizbon'a en uygun uçuşla 3 gece", TODAY).budget).toBe("low");
    const s = typed("Bu cuma Lizbon'a 3 gecelik kaçamak");
    expect(nextQuestion(s)).not.toBe("want");
  });
  it("F54: one city said is its route, never asked; the checklist says it done", () => {
    const s = typed("Bu cuma Lizbon'a 3 gecelik kaçamak");
    expect(nextQuestion(s)).not.toBe("route");
    expect(checklist(s, ctx).find((r) => r.id === "route")).toMatchObject({ done: true, value: "Lizbon 3 gece" });
  });
  it("F59: \"iki resort\" is two stops; \"tek resort\" one", () => {
    const four = route([["Ubud", 4], ["Sidemen", 3], ["Canggu", 4], ["Uluwatu", 3]]);
    expect(trimRoute(four, 2, 14).stops.map((x) => [x.city, x.nights])).toEqual([["Ubud", 7], ["Canggu", 7]]);
    const s = typed("15 gün Bali balayı");
    expect(stopsWanted({ ...s, pbAnswers: { "honeymoon:resorts": "two" } })).toBe(2);
    expect(stopsWanted({ ...s, pbAnswers: { "honeymoon:resorts": "one" } })).toBe(1);
  });
  it("F60: a honeymoon is the two of them, never asked who", () => {
    const s = typed("15 gün Bali balayı");
    expect(s.who).toMatchObject({ kind: "partner", count: 2 });
  });
  it("F60: the model's question over other chips is not used", () => {
    expect(questionFits("day", "Yolculuğa kiminle çıkıyorsunuz?")).toBe(false);
    expect(questionFits("day", "Kasım'ın sonu mu, başı mı?")).toBe(true);
  });
  it("Amalfi: a place said as a day out gets no nights, the trip isn't a day out", () => {
    const e = parseStartText("7 gün Amalfi kıyısı, Capri'ye tekneyle günübirlik", TODAY);
    expect(e.dayTrips).toEqual(["Capri"]);
    expect(e.dayTrip).toBeFalsy();
    const r = withoutDayTrips(route([["Positano", 3], ["Capri", 1], ["Sorrento", 2]]), ["Capri"], 6);
    expect(r.stops.map((x) => [x.city, x.nights])).toEqual([["Positano", 4], ["Sorrento", 2]]);
  });
  it("F45: \"5 gece kamp yapacağız\" answers the festival's stay question", () => {
    const s = typed("Ağustosta Sziget festivaline 5 gece, kamp yapacağız");
    expect(s.pbAnswers).toMatchObject({ "festival:stay": "camp" });
    // (Asked next: the ticket, never the stay again.)
    expect(pbCurrent(s)?.key).not.toBe("festival:stay");
  });
  it("F70: \"Bansko, Bulgaristan\" is Bansko in Bulgaria; Bansko alone is read", () => {
    expect(parseStartText("Ocak sonunda Bansko, Bulgaristan'da kayak", TODAY).where).toMatchObject({ place: "Bansko", country: "Bulgaristan" });
    expect(parseStartText("Ocak'ta Bansko'da 4 gece kayak", TODAY).where?.place).toBe("Bansko");
    expect(parseStartText("Ocak sonunda Bansko'da kayak", TODAY).start).toMatchObject({ part: "end" });
  });
  it("a single route answer still works after these", () => {
    const s = applyAnswer({ ...typed("Kasım'da 10 gün Japonya") }, { q: "route", action: "single" }, 3);
    expect(s.route?.stops).toHaveLength(1);
  });
});
