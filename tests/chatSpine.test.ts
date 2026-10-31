// tests/chatSpine.test.ts: the chat keeps the trip's spine (omurga Dilim A, 2026-10-31): "nasıl olur" only tries an
// idea; what is booked, chosen or past never moves quietly; a firm limit is kept; a new city says how the days were
// balanced; a stay outside the dates is settled with one question. The AI understands, the rules hold (TR and EN).
import { afterEach, describe, expect, it } from "vitest";
import { systemPrompt, todayTag } from "../src/lib/assistant";
import { setLang } from "../src/lib/i18n";

afterEach(() => setLang("tr"));

describe("the chat keeps the trip's spine", () => {
  it("says the rules in Turkish", () => {
    const p = systemPrompt();
    for (const said of [
      "Gezinin omurgası",
      "Kullanıcı bir fikri deniyorsa",
      "hiçbir aracı çağırma",
      "Uygulayayım mı?",
      "rezerve edilmiş ya da seçilmiş",
      "geçmiş günlere",
      "Kesin bir süre ya da tarih sınırı",
      "save_preference",
      "Yeni bir şehir",
      "en ucuz çözümü",
      "gezinin tarihlerinin",
      "Gizlenenler",
      "gezinin türüne uymayan",
      "Uçuşları aldın mı?",
      "<today>",
      "Tek yön",
      "örnek bir taslak",
      "Oraya nasıl gidiyorsun?",
      "henüz seçmediği bir şeyin ayrıntısını",
    ]) expect(p).toContain(said);
  });

  it("says the same rules in English", () => {
    setLang("en");
    const p = systemPrompt();
    for (const said of [
      "The trip's spine",
      "If the user is only trying an idea",
      "call no tool",
      "Shall I apply it?",
      "booked or chosen",
      "days already past",
      "A firm limit on length or dates",
      "save_preference",
      "A new city",
      "cheapest fix",
      "outside the trip's dates",
      "Hidden",
      "doesn't fit the kind of trip",
      "Did you get the flights?",
      "<today>",
      "One way",
      "a sample draft",
      "How are you getting there?",
      "the detail of something they haven't chosen yet",
    ]) expect(p).toContain(said);
  });
});

describe("today goes with every message", () => {
  it("as the traveller's own calendar day", () => {
    expect(todayTag(new Date(2026, 9, 31, 23, 30))).toBe("<today>2026-10-31</today>");
    expect(todayTag(new Date(2026, 0, 5, 0, 10))).toBe("<today>2026-01-05</today>");
  });
});
