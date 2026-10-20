// F33 (2026-10-20): the free Gemini requests come back at midnight Pacific time (Google's rate-limits doc), said on the
// traveller's own clock ("Kota yarın 10:00'da yenilenir"), right on both sides of the US clock changes; a short (per-minute)
// limit still says "wait a minute". Fake 429s only: nothing here reaches Gemini.
import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextQuotaReset, quotaResetLine, resetWhen, trAt } from "../src/lib/aiQuota";
import { setLang } from "../src/lib/i18n";
import { describeGeminiError, GeminiSpentError } from "../src/lib/llm/gemini";
import { isTransient } from "../src/lib/process";

const IST = "Europe/Istanbul";
const at = (iso: string) => Date.parse(iso);

describe("when the free requests come back (midnight Pacific time)", () => {
  it("Istanbul in October (US summer time): 10:00, tomorrow or today", () => {
    expect(nextQuotaReset(at("2026-10-20T12:00:00Z"))).toBe(at("2026-10-21T07:00:00Z"));
    expect(resetWhen(at("2026-10-20T12:00:00Z"), IST)).toBe("yarın 10:00'da"); // 15:00 in Istanbul
    expect(resetWhen(at("2026-10-21T05:00:00Z"), IST)).toBe("bugün 10:00'da"); // 08:00 in Istanbul, 22:00 the day before in LA
    expect(quotaResetLine(at("2026-10-20T12:00:00Z"), IST)).toBe("Kota yarın 10:00'da yenilenir");
  });

  it("the US clocks go back on 1 November: 10:00 before, 11:00 after, and the 25-hour Pacific day", () => {
    expect(resetWhen(at("2026-10-31T12:00:00Z"), IST)).toBe("yarın 10:00'da"); // last Pacific midnight on summer time
    expect(nextQuotaReset(at("2026-10-31T12:00:00Z"))).toBe(at("2026-11-01T07:00:00Z"));
    expect(resetWhen(at("2026-11-01T12:00:00Z"), IST)).toBe("yarın 11:00'de");
    expect(nextQuotaReset(at("2026-11-01T12:00:00Z"))).toBe(at("2026-11-02T08:00:00Z"));
    // Half an hour after the summer-time midnight: the next one is 25 hours on, at 11:00.
    expect(nextQuotaReset(at("2026-11-01T07:30:00Z"))).toBe(at("2026-11-02T08:00:00Z"));
    expect(resetWhen(at("2026-11-01T07:30:00Z"), IST)).toBe("yarın 11:00'de");
  });

  it("the US clocks go forward on 14 March 2027: 11:00 before, 10:00 after", () => {
    expect(nextQuotaReset(at("2027-03-13T12:00:00Z"))).toBe(at("2027-03-14T08:00:00Z"));
    expect(resetWhen(at("2027-03-13T12:00:00Z"), IST)).toBe("yarın 11:00'de");
    expect(nextQuotaReset(at("2027-03-14T12:00:00Z"))).toBe(at("2027-03-15T07:00:00Z"));
    expect(resetWhen(at("2027-03-14T12:00:00Z"), IST)).toBe("yarın 10:00'da");
    // Just before the 23-hour Pacific day starts: still the winter-time midnight.
    expect(nextQuotaReset(at("2027-03-14T07:59:00Z"))).toBe(at("2027-03-14T08:00:00Z"));
    expect(resetWhen(at("2027-03-14T07:59:00Z"), IST)).toBe("bugün 11:00'de");
  });

  it("another clock (London: the week between the UK's change and the US's) and English", () => {
    expect(resetWhen(at("2026-10-20T14:00:00Z"), "Europe/London")).toBe("yarın 08:00'de");
    expect(resetWhen(at("2026-10-27T14:00:00Z"), "Europe/London")).toBe("yarın 07:00'de");
    setLang("en");
    try {
      expect(quotaResetLine(at("2026-10-20T12:00:00Z"), IST)).toBe("Quota resets tomorrow at 10:00");
      expect(resetWhen(at("2026-10-21T05:00:00Z"), IST)).toBe("today at 10:00");
    } finally {
      setLang("tr");
    }
  });

  it("the Turkish ending follows the spoken time", () => {
    const cases: Record<string, string> = {
      "10:00": "10:00'da", "11:00": "11:00'de", "13:00": "13:00'te", "14:00": "14:00'te", "16:00": "16:00'da", "09:00": "09:00'da",
      "08:00": "08:00'de", "07:00": "07:00'de", "12:00": "12:00'de", "20:00": "20:00'de", "00:00": "00:00'da", "10:30": "10:30'da",
      "12:45": "12:45'te", "10:40": "10:40'ta", "10:50": "10:50'de", "10:20": "10:20'de", "10:10": "10:10'da", "10:06": "10:06'da",
    };
    for (const [time, said] of Object.entries(cases)) expect(trAt(time)).toBe(said);
  });

});

const daily = (model: string) => new ApiError({ message: `Quota exceeded for metric: generate_content_free_tier_requests, quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier, model: ${model}`, status: 429 });
const perMinute = () => new ApiError({ message: "Quota exceeded for metric: generate_content_free_tier_requests, quotaId GenerateRequestsPerMinutePerProjectPerModel-FreeTier", status: 429 });

describe("what a used-up quota says", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("2026-10-20T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    setLang("tr");
  });
  const when = /(bugün|yarın) \d\d:\d\d'(da|de|ta|te)/;

  it("per minute: wait a minute, and the board tries again by itself", () => {
    const m = describeGeminiError(perMinute())!;
    expect(m).toBe("Gemini'nin dakikalık ücretsiz kotası doldu. Bir dakika bekleyip 'Tekrar dene'ye bas.");
    expect(isTransient(m)).toBe(true);
    setLang("en");
    const en = describeGeminiError(perMinute())!;
    expect(en).toContain("Wait a minute");
    expect(isTransient(en)).toBe(true);
  });

  it("per day: when it comes back, on the clock, and no pointless retries before then", () => {
    const m = describeGeminiError(daily("gemini-3-flash-preview"))!;
    expect(m).toMatch(new RegExp(`^Gemini'nin bugünkü ücretsiz hakkı doldu; kota ${when.source} yenilenir\\.$`));
    expect(m).not.toMatch(/biraz bekle/i);
    expect(isTransient(m)).toBe(false);
    setLang("en");
    const en = describeGeminiError(daily("gemini-3-flash-preview"))!;
    expect(en).toMatch(/^Gemini's free requests for today are used up; they come back (today|tomorrow) at \d\d:\d\d\.$/);
    expect(isTransient(en)).toBe(false);
  });

  it("every model spent: the same day message, with Claude as the way on", () => {
    const m = new GeminiSpentError().message;
    expect(m).toMatch(new RegExp(`^Gemini'nin bugünkü ücretsiz hakkı doldu; kota ${when.source} yenilenir\\. Ayarlar'dan Claude anahtarı eklersen o devam eder\\.$`));
    expect(m).not.toContain("yarın yenilenir");
    expect(isTransient(m)).toBe(false);
    setLang("en");
    expect(isTransient(new GeminiSpentError().message)).toBe(false);
  });
});
