// The event's dates looked up live in the start chat (2026-10-07): a sure answer replaces the table's estimate and is
// said once; a likely one is taken as "teyitsiz"; anything else changes nothing; the traveller's own dates stay; one
// search per event and year.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLang, withLang } from "../src/lib/i18n";
import { applyLiveDates, lookupFor, readLiveDates, startLookup, type DatesLookup } from "../src/lib/startEventDates";
import { applyAnswer, applyText, checklist, mergeExtracted, newStart, nextQuestion, parseStartText, withTypedLang, type StartCtx, type StartState } from "../src/lib/startTrip";
import type { WebSearchResult } from "../src/lib/webSearch";

const TODAY = "2026-10-07";
const ctx: StartCtx = { myName: "Emre", fromGuess: "İstanbul", today: TODAY };

function typed(s: StartState, text: string, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const out = applyText(asked, text, mergeExtracted(parseStartText(text, TODAY, q), null), at, q);
    return out.understood ? out.state : asked;
  });
}
const answered = (s: StartState): StartState => ({ ...s, messages: [...s.messages, { role: "assistant" as const, text: "…", at: 99 }] });

/** "AfrikaBurn'e gitmek istiyorum": the table's estimate (26 April – 2 May 2027), the chat's line said. */
const afrikaburn = () => answered(typed(newStart("s1", "plan", 1, "tr"), "AfrikaBurn'e gitmek istiyorum"));

const found = (start: string | null, end: string | null, confidence: "high" | "medium" | "low" | null, official = "https://www.afrikaburn.org/dates"): WebSearchResult => ({
  answer: "AfrikaBurn 2027 runs from …",
  sources: [{ title: "afrikaburn.org", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/x" }],
  kind: "event_dates",
  cached: false,
  at: "2026-10-07T10:00:00Z",
  event: { start, end, place: "Tankwa Karoo", official_url: official, confidence },
});
const missed = (reason: WebSearchResult["reason"]): WebSearchResult => ({ answer: null, sources: [], kind: "event_dates", cached: false, at: null, reason });

const apply = (s: StartState, r: WebSearchResult) => withLang(s.lang, () => applyLiveDates(s, lookupFor(s, TODAY)!, r, ctx, 500));
const whenRow = (s: StartState) => withLang(s.lang, () => checklist(s, ctx).find((r) => r.id === "when")!.value);

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("the look-up", () => {
  it("an event's name and its year, in English words", () => {
    const s = afrikaburn();
    expect(s.intent?.dates).toEqual({ start: "2027-04-26", end: "2027-05-02", approx: true });
    expect(lookupFor(s, TODAY)).toEqual({ key: "afrikaburn|2027", name: "AfrikaBurn", year: 2027, query: "AfrikaBurn 2027 dates" });
  });

  it("none for a place, a theme, or dates the traveller confirmed themselves", () => {
    expect(lookupFor(typed(newStart("s2", "plan", 1, "tr"), "Bali'ye gitmek istiyorum"), TODAY)).toBeNull();
    const confirmed = applyAnswer(afrikaburn(), { q: "event", confirm: true }, 3);
    expect(confirmed.intent?.dates?.approx).toBe(false);
    expect(lookupFor(confirmed, TODAY)).toBeNull();
  });

  it("one search per event and year, however often the chat changes", async () => {
    const search = vi.fn(async () => missed("no-result"));
    const asked = new Set<string>();
    let s = afrikaburn();
    const first = startLookup(s, TODAY, asked, search);
    expect(first?.look.key).toBe("afrikaburn|2027");
    expect(search).toHaveBeenCalledWith("AfrikaBurn 2027 dates", { kind: "event_dates", year: 2027, lang: "tr" });
    s = answered(typed(s, "10 gün"));
    expect(startLookup(s, TODAY, asked, search)).toBeNull();
    expect(startLookup(s, TODAY, asked, search)).toBeNull();
    expect(search).toHaveBeenCalledTimes(1);
    // Once applied, never looked up again (a draft opened later has it).
    const got = apply(s, found("2027-04-27", "2027-05-03", "high"));
    expect(lookupFor(got, TODAY)).toBeNull();
  });
});

describe("a sure answer (high)", () => {
  it("replaces the estimate, says so once with the site, and the trip's days follow", () => {
    const s = answered(typed(afrikaburn(), "10 gün"));
    expect(s.start).toMatchObject({ date: "2027-04-25", approx: true, event: true });
    const got = apply(s, found("2027-04-27", "2027-05-03", "high"));
    expect(got.intent?.dates).toEqual({ start: "2027-04-27", end: "2027-05-03", approx: false });
    expect(got.intent?.checked).toEqual({ sure: true, site: "afrikaburn.org", url: "https://www.afrikaburn.org/dates" });
    // 10 days around a 7-day event: 1 before, 2 after; no longer estimated.
    expect(got.start).toMatchObject({ date: "2027-04-26", approx: false, event: true });
    const added = got.messages.slice(s.messages.length);
    expect(added).toHaveLength(1);
    expect(added[0].text.split("\n")[0]).toBe("Resmî siteden teyit ettim: 27 Nisan – 3 Mayıs 2027 (afrikaburn.org).");
    expect(added[0].link).toBe("https://www.afrikaburn.org/dates");
    expect(added[0].text).not.toContain("—");
    expect(whenRow(got)).not.toContain("tahmini");
  });

  it("in English", () => {
    const s = answered(typed(newStart("s3", "plan", 1, "en"), "I want to go to AfrikaBurn"));
    const got = apply(s, found("2027-04-27", "2027-05-03", "high"));
    expect(got.messages.at(-1)!.text.split("\n")[0]).toBe("Checked on the official site: 27 April – 3 May 2027 (afrikaburn.org).");
  });
});

describe("a likely answer (medium)", () => {
  it("taken but labelled unconfirmed", () => {
    const s = afrikaburn();
    const got = apply(s, found("2027-04-27", "2027-05-03", "medium"));
    expect(got.intent?.dates).toEqual({ start: "2027-04-27", end: "2027-05-03", approx: true });
    expect(got.intent?.checked?.sure).toBe(false);
    expect(got.messages.at(-1)!.text).toContain("AfrikaBurn 2027 için 27 Nisan – 3 Mayıs 2027 görünüyor, henüz kesin değil (kaynak: afrikaburn.org).");
    expect(whenRow(got)).toContain("(teyitsiz)");
  });
});

describe("the traveller's own dates", () => {
  it("their start stays; the clash with the event's real days is said once", () => {
    // 25–27 April meets the estimate (26 April – 2 May), not the real days (1–7 May).
    const own: StartState = { ...answered(typed(afrikaburn(), "3 gün")), start: { date: "2027-04-25", approx: false } };
    const got = apply(own, found("2027-05-01", "2027-05-07", "high"));
    expect(got.start).toEqual({ date: "2027-04-25", approx: false });
    expect(got.duration).toEqual(own.duration);
    expect(got.intent?.dates).toEqual({ start: "2027-05-01", end: "2027-05-07", approx: false });
    const line = got.messages.at(-1)!.text;
    expect(line).toContain("Senin tarihlerin bu günlere denk gelmiyor.");
    // The clash question asked under it (its chips are the ones on screen now).
    expect(nextQuestion(got)).toBe("clash");
    expect(line.split("\n")).toHaveLength(2);
  });

  it("event dates they confirmed are never replaced", () => {
    const confirmed = answered(applyAnswer(afrikaburn(), { q: "event", start: "2027-04-28" }, 3));
    const look: DatesLookup = { key: "afrikaburn|2027", name: "AfrikaBurn", year: 2027, query: "AfrikaBurn 2027 dates" };
    const got = withLang("tr", () => applyLiveDates(confirmed, look, found("2027-04-27", "2027-05-03", "high"), ctx, 500));
    expect(got).toBe(confirmed);
  });
});

describe("no answer to stand behind", () => {
  it("a miss, a low confidence, dates that make no sense: nothing changes, nothing is said", () => {
    const s = afrikaburn();
    for (const r of [
      missed("capped"), missed("timeout"), missed("no-result"), missed("not-configured"),
      found("2027-04-27", "2027-05-03", "low"), found("2027-04-27", "2027-05-03", null),
      found("2028-04-27", "2028-05-03", "high"), // another year
      found("2027-05-03", "2027-04-27", "high"), // end before start
      found("2027-01-01", "2027-06-30", "high"), // months long
      found(null, null, "high"),
    ]) {
      const got = apply(s, r);
      expect(got).toBe(s);
    }
    expect(whenRow(s)).toContain("(tahmini)");
    expect(s.intent?.url).toBe("https://www.afrikaburn.org");
  });

  it("the intent changed meanwhile: dropped", () => {
    const s = afrikaburn();
    const look = lookupFor(s, TODAY)!;
    const elsewhere = typed(s, "Bali");
    expect(withLang("tr", () => applyLiveDates({ ...elsewhere, intent: null }, look, found("2027-04-27", "2027-05-03", "high"), ctx, 500)).intent).toBeNull();
  });

  it("only a site's name from the sources when there's no official link", () => {
    const r = { ...found("2027-04-27", "2027-05-03", "high"), event: { start: "2027-04-27", end: "2027-05-03", place: null, official_url: null, confidence: "high" as const } };
    expect(readLiveDates(r, lookupFor(afrikaburn(), TODAY)!, TODAY)).toEqual({ start: "2027-04-27", end: "2027-05-03", sure: true, site: "afrikaburn.org", url: null });
  });
});
