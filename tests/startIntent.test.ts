// tests/startIntent.test.ts — the start chat understands what the trip is for (2026-10-06, the owner's English test:
// "I want to go burning man africa with my friends and partner"): events and themes from the code's own table
// (Turkish endings too, never a word that only looks like one), their dates the next time as an estimate with the
// official site, only the total length asked, the event's own route (gateway → event → gateway), the title from the
// intent, and the trip making itself once the essentials are known (the countdown's arming and stopping).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setLang, withLang } from "../src/lib/i18n";
import { eventById, EVENTS, findEvent, intentOf, nextFullMoon, nextOccurrence, TABLE_LAST_YEAR } from "../src/lib/startEvents";
import {
  acceptExtraction, applyAnswer, applyText, autoHeld, autoPrint, autoSeconds, memoAfterGenerate, nextLine, routeForGenerate as routeMade, waitingInstead, withGuessTaken, checklist, creationOf, essentialsDone, eventLine, isComplete, isGoCommand, lineLink, mergeExtracted,
  newStart, nextQuestion, parseStartText, questionOf, replyText, routeForGenerate, shouldAutoStart, skip, startName, totalNights, tripDates, tripTitle,
  withTypedLang, type RawExtraction, type StartCtx, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-06";
const OWNER = "I want to go burning man africa with my friends and partner";
const ctx: StartCtx = { myName: "Emre", fromGuess: "İstanbul", today: TODAY };

/** One typed line as the chat takes it without the model: the language, then the code's reading bound to the question. */
function typed(s: StartState, text: string, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const out = applyText(asked, text, mergeExtracted(parseStartText(text, TODAY, q), null), at, q);
    return out.understood ? out.state : asked;
  });
}
/** The chat's line said after it (the countdown waits for the assistant's word). */
const answered = (s: StartState): StartState => ({ ...s, messages: [...s.messages, { role: "assistant" as const, text: "…", at: 99 }] });

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("the owner's sentence (English, no model)", () => {
  it("AfrikaBurn at once: Tankwa Karoo, South Africa, Cape Town, the dates next time estimated, friends", () => {
    const read = withLang("en", () => parseStartText(OWNER, TODAY, "where"));
    expect(read.intent).toMatchObject({ kind: "event", id: "afrikaburn", name: "AfrikaBurn", place: "Tankwa Karoo", code: "ZA", gateway: "Cape Town" });
    expect(read.intent?.dates).toEqual({ start: "2027-04-26", end: "2027-05-02", approx: true });
    expect(read.where).toEqual({ place: "Tankwa Karoo", country: "South Africa", code: "ZA" });
    // Friends and a partner: a group, its size not said (asked).
    expect(read.who).toEqual({ kind: "friends", names: [] });
    const s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    expect(s.lang).toBe("en");
    expect(s.where?.place).toBe("Tankwa Karoo");
    expect(s.intent?.name).toBe("AfrikaBurn");
    // Where and when come from the event: the length is the next question.
    expect(nextQuestion(s)).toBe("duration");
  });

  it("says the dates honestly and asks only the total length, with the event's chips", () => {
    const s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    withLang("en", () => {
      const line = replyText(newStart("ab", "plan", 1, "en"), s, ctx);
      expect(line).toBe(
        "AfrikaBurn 2027 usually runs late April to early May (estimated 26 April – 2 May; check the official site).\nHow many days in total: just AfrikaBurn, or some days in Cape Town before and after?",
      );
      expect(lineLink(s, line)).toBe("https://www.afrikaburn.org");
      expect(lineLink(s, "Where are you leaving from?")).toBeNull();
      const q = questionOf(s, "duration", ctx);
      expect(q.chips.map((c) => c.label)).toEqual(["Just AfrikaBurn (7 days)", "+2 days in Cape Town", "+4 days in Cape Town", "These dates are right"]);
      expect(q.hint).toBe("Estimated dates: 26 April – 2 May · check the official site.");
      expect(q.eventDate).toBe(true);
      const when = checklist(s, ctx).find((r) => r.id === "when")!;
      expect(when.value).toBe("26 April – 2 May (estimated) · how many days in all?");
      expect(checklist(s, ctx).find((r) => r.id === "where")!.value).toBe("AfrikaBurn · Tankwa Karoo · South Africa");
    });
    // In Turkish, the owner's own words.
    const inTurkish = typed(newStart("ab", "plan", 1, "tr"), "Burning man africa'ya arkadaşlarımla gitmek istiyorum");
    expect(inTurkish.intent?.id).toBe("afrikaburn");
    const tr = withLang("tr", () => eventLine(inTurkish.intent!));
    expect(tr).toBe("AfrikaBurn 2027 genelde Nisan sonu – Mayıs başı (tahmini 26 Nisan – 2 Mayıs; resmî siteden kontrol et).");
  });

  it("+4 days: Cape Town 2 → Tankwa Karoo 6 → Cape Town 2, then where from, then how many; the essentials then done", () => {
    let s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    const asked = s;
    s = withLang("en", () => applyAnswer(s, { q: "duration", duration: { unit: "day", n: 11 } }, 3));
    // Said back exactly, never as a month only ("April · 11 days"): the days, estimated, and the route.
    expect(withLang("en", () => replyText(asked, s, ctx, false, true))).toBe(
      "The trip: 24 April – 4 May · 10 nights (estimated) (Cape Town 2 · Tankwa Karoo 6 · Cape Town 2 nights).\nWhere are you leaving from?",
    );
    expect(tripDates(s)).toEqual({ start: "2027-04-24", end: "2027-05-04" });
    expect(s.start).toEqual({ date: "2027-04-24", approx: true, event: true });
    expect(totalNights(s)).toBe(10);
    expect(s.route).toMatchObject({ source: "event", confirmed: true, arrive: "Cape Town", leave: "Cape Town" });
    expect(s.route!.stops.map((x) => [x.city, x.nights, x.code])).toEqual([["Cape Town", 2, "ZA"], ["Tankwa Karoo", 6, "ZA"], ["Cape Town", 2, "ZA"]]);
    // Not a "which day in April" question: the event's start is no month only.
    expect(nextQuestion(s)).toBe("from");
    expect(essentialsDone(s)).toBe(false);
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 4);
    expect(nextQuestion(s)).toBe("count");
    expect(withLang("en", () => questionOf(s, "count", ctx).text)).toBe("How many of you are going, you included?");
    expect(essentialsDone(s)).toBe(false);
    // Typed: "4".
    s = withLang("en", () => applyText(s, "4", parseStartText("4", TODAY, "count"), 5, "count").state);
    expect(s.who).toEqual({ kind: "friends", names: [], count: 4 });
    expect(essentialsDone(s)).toBe(true);
    // Style is optional (asked, never holding the trip back).
    expect(nextQuestion(s)).toBe("want");
    const c = withLang("en", () => creationOf(s))!;
    expect(c.title).toBe("AfrikaBurn 2027");
    expect(c.dates).toEqual({ start: "2027-04-24", end: "2027-05-04" });
    expect(c.stays.map((x) => `${x.city} ${x.date}..${x.end_date}`)).toEqual(["Cape Town 2027-04-24..2027-04-26", "Tankwa Karoo 2027-04-26..2027-05-02", "Cape Town 2027-05-02..2027-05-04"]);
    expect(c.travel.map((x) => `${x.date} ${x.from}→${x.to}`)).toEqual(["2027-04-24 İstanbul→Cape Town", "2027-05-04 Cape Town→İstanbul"]);
    expect(c.travellers).toEqual({ names: [], count: 4 });
    expect(c.approxStart).toBe("2027-04-24");
  });

  it("'whenever it is' to the length is just the event; Atla too", () => {
    const s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    const just = typed(s, "Burning man africa ne zamansa o zaman?");
    expect(just.duration).toEqual({ unit: "day", n: 7 });
    expect(tripDates(just)).toEqual({ start: "2027-04-26", end: "2027-05-02" });
    expect(just.route!.stops.map((x) => x.city)).toEqual(["Tankwa Karoo"]);
    expect(just.route!.arrive).toBe("Cape Town");
    expect(skip(s, "duration", 3).duration).toEqual({ unit: "day", n: 7 });
  });

  it("the dates confirmed, or another start: no longer estimated", () => {
    let s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    s = applyAnswer(s, { q: "duration", duration: { unit: "day", n: 9 } }, 3);
    expect(s.start).toEqual({ date: "2027-04-25", approx: true, event: true });
    const sure = applyAnswer(s, { q: "event", confirm: true }, 4);
    expect(sure.intent?.dates).toEqual({ start: "2027-04-26", end: "2027-05-02", approx: false });
    expect(sure.start).toEqual({ date: "2027-04-25", approx: false, event: true });
    expect(replyText(s, sure, ctx, false, true)).toMatch(/^Tamam, AfrikaBurn: 26 Nisan – 2 Mayıs\./);
    const moved = applyAnswer(s, { q: "event", start: "2027-04-27" }, 4);
    expect(moved.intent?.dates).toEqual({ start: "2027-04-27", end: "2027-05-03", approx: false });
    expect(tripDates(moved)).toEqual({ start: "2027-04-26", end: "2027-05-04" });
    expect(withLang("tr", () => eventLine(moved.intent!))).toBe("AfrikaBurn 2027: 27 Nisan – 3 Mayıs.");
  });

  it("another place picked drops the event (its title and its dates)", () => {
    let s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    s = applyAnswer(s, { q: "duration", duration: { unit: "day", n: 9 } }, 3);
    const bali = applyAnswer(s, { q: "where", place: "Bali", country: "Endonezya", code: "ID" }, 4);
    expect(bali.intent).toBeNull();
    expect(bali.start).toBeNull();
    expect(creationOf(bali)!.title).toBe("Bali Gezisi");
  });
});

describe("the events' table", () => {
  it("Turkish endings and other spellings", () => {
    expect(findEvent("AfrikaBurn'e gidiyoruz")?.entry.id).toBe("afrikaburn");
    expect(findEvent("Oktoberfest'e gidelim")?.entry.id).toBe("oktoberfest");
    expect(findEvent("Tomorrowland'e 3 gün")?.entry.id).toBe("tomorrowland");
    expect(findEvent("oktoberfeste gidelim")?.entry.id).toBe("oktoberfest");
    expect(findEvent("africa burn")?.entry.id).toBe("afrikaburn");
    expect(findEvent("Afrika Burn'e")?.entry.id).toBe("afrikaburn");
    expect(findEvent("burning man in south africa")?.entry.id).toBe("afrikaburn");
    expect(findEvent("Holi'ye Hindistan'a")?.entry.id).toBe("holi");
    expect(findEvent("Monza GP'ye gidelim")?.entry.id).toBe("f1-italy");
    expect(findEvent("F1 İstanbul")?.entry.id).toBe("f1-turkey");
    expect(findEvent("kuzey ışıklarını görmek istiyorum")).toBeNull(); // an ending on a word of two: not read (the model's)
    expect(findEvent("kuzey ışıkları için Norveç")?.entry.id).toBe("northern-lights");
  });

  it("never a word that only looks like one", () => {
    for (const text of ["I'm burning out", "carnival cruise", "Holiday in Bali", "holidays with the kids", "a man burning toast", "hacker news", "edcba"]) {
      expect(findEvent(text), text).toBeNull();
      expect(parseStartText(text, TODAY, "where").intent, text).toBeUndefined();
    }
    expect(parseStartText("Holiday in Bali", TODAY, "where").where?.place).toBe("Bali");
  });

  it("Oktoberfest'e gidelim 5 gün: Munich, within the festival", () => {
    const s = typed(newStart("ok", "plan", 1, "tr"), "Oktoberfest'e gidelim 5 gün");
    expect(s.where).toMatchObject({ place: "Münih", code: "DE" });
    expect(s.intent?.dates).toEqual({ start: "2027-09-18", end: "2027-10-03", approx: true });
    const d = tripDates(s)!;
    expect(d).toEqual({ start: "2027-09-18", end: "2027-09-22" });
    expect(d.start >= s.intent!.dates!.start && d.end <= s.intent!.dates!.end).toBe(true);
    expect(nextQuestion(s)).toBe("from");
    expect(creationOf(s)!.title).toBe("Oktoberfest 2027");
    // A long event: a few of its days, or all of it.
    expect(questionOf({ ...s, duration: null }, "duration", ctx).chips.slice(0, 4).map((c) => c.label)).toEqual(["3 gün", "5 gün", "7 gün", "Tümü (16 gün)"]);
  });

  it("Full moon party: Koh Phangan, the next full moon", () => {
    const read = parseStartText("Full moon party", TODAY, "where");
    expect(read.where).toMatchObject({ place: "Koh Phangan", code: "TH" });
    expect(read.intent?.dates).toEqual({ start: "2026-10-26", end: "2026-10-27", approx: true });
    expect(nextFullMoon("2026-10-26")[0]).toBe("2026-11-24");
  });

  it("burning man alone: Black Rock City, US, by way of Reno", () => {
    const read = withLang("en", () => parseStartText("burning man", TODAY, "where"));
    expect(read.intent).toMatchObject({ id: "burningman", place: "Black Rock City", code: "US", gateway: "Reno" });
    expect(read.intent?.dates).toEqual({ start: "2027-08-29", end: "2027-09-06", approx: true });
  });

  it("the lunar and irregular year tables still reach this year (extend them once this fails)", () => {
    expect(Object.keys(TABLE_LAST_YEAR).sort()).toEqual(["cny", "diwali", "hajj", "holi"]);
    // The real clock, on purpose: fails once today passes the last year of any table.
    const year = new Date().getUTCFullYear();
    for (const [id, last] of Object.entries(TABLE_LAST_YEAR)) expect(year, `${id}'s table ends in ${last}`).toBeLessThanOrEqual(last);
    expect(Math.min(...Object.values(TABLE_LAST_YEAR))).toBe(2028);
    expect(Math.max(...Object.values(TABLE_LAST_YEAR))).toBe(2029);
  });

  it("forty entries, each with names, a place, a country, its typical time and a site; dates ahead of today", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    for (const e of EVENTS) {
      expect(e.aliases.length, e.id).toBeGreaterThan(0);
      expect(e.code, e.id).toMatch(/^[A-Z]{2}$/);
      expect(e.url, e.id).toMatch(/^https:\/\//);
      const next = nextOccurrence(e, TODAY);
      if (next) {
        expect(next[0] > TODAY, e.id).toBe(true);
        expect(next[1] >= next[0], e.id).toBe(true);
      }
    }
    // Rio and Venice follow Easter (28 March 2027); Glastonbury rests in 2026.
    expect(nextOccurrence(EVENTS.find((e) => e.id === "rio-carnival")!, TODAY)).toEqual(["2027-02-05", "2027-02-10"]);
    expect(nextOccurrence(EVENTS.find((e) => e.id === "glastonbury")!, "2026-01-01")).toEqual(["2027-06-23", "2027-06-27"]);
  });

  it("a theme: its places as the route (proposed), or its season said and the days asked", () => {
    let s = typed(newStart("sk", "plan", 1, "tr"), "Kiraz çiçekleri için Japonya'ya 10 gün");
    expect(s.intent).toMatchObject({ kind: "theme", id: "cherry-blossom" });
    expect(s.where?.code).toBe("JP");
    expect(tripDates(s)).toEqual({ start: "2027-03-25", end: "2027-04-03" });
    expect(s.route).toMatchObject({ source: "event", confirmed: false });
    expect(s.route!.stops.map((x) => x.city)).toEqual(["Tokyo", "Kyoto"]);
    expect(routeForGenerate(s)?.confirmed).toBe(true);
    expect(creationOf(s)!.title).toBe("Kiraz Çiçekleri 2027");
    s = typed(newStart("nl", "plan", 1, "tr"), "Kuzey ışıkları görmek istiyoruz");
    expect(s.intent).toMatchObject({ kind: "theme", place: "Tromsø", dates: null });
    expect(nextQuestion(s)).toBe("duration");
    expect(eventLine(s.intent!)).toBe("Kuzey Işıkları için en iyi dönem genelde Eylül sonu – Mart, karanlık gecelerde (resmî siteden kontrol et).");
    expect(tripTitle(s)).toBe("Kuzey Işıkları Gezisi");
  });
});

describe("the model's reading of an event", () => {
  const raw = (over: Partial<RawExtraction>): RawExtraction => ({
    destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
    duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
  });
  it("a name the table knows: the table's (its dates computed, its site)", () => {
    const got = acceptExtraction(raw({ event: "AfrikaBurn", event_start: "2027-05-01", event_end: "2027-05-09", event_dates_sure: true }), TODAY);
    expect(got.intent).toMatchObject({ id: "afrikaburn", url: "https://www.afrikaburn.org", dates: { start: "2027-04-26", end: "2027-05-02", approx: true } });
    expect(got.where?.place).toBe("Tankwa Karoo");
  });
  it("one it doesn't: the model's, its dates estimated unless it is sure, dropped when they make no sense", () => {
    const got = acceptExtraction(raw({ event: "Fusion Festival", event_kind: "event", event_place: "Lärz", event_country_code: "DE", event_start: "2027-06-24", event_end: "2027-06-28" }), TODAY);
    expect(got.intent).toMatchObject({ kind: "event", name: "Fusion Festival", place: "Lärz", code: "DE", dates: { start: "2027-06-24", end: "2027-06-28", approx: true }, url: null });
    expect(got.where).toMatchObject({ place: "Lärz", code: "DE" });
    expect(acceptExtraction(raw({ event: "Fusion Festival", event_place: "Lärz", event_start: "2027-06-24", event_end: "2027-06-28", event_dates_sure: true }), TODAY).intent?.dates?.approx).toBe(false);
    expect(acceptExtraction(raw({ event: "Fusion Festival", event_place: "Lärz", event_start: "2025-06-24", event_end: "2025-06-28" }), TODAY).intent?.dates).toBeNull();
    expect(acceptExtraction(raw({ event: "", event_place: "Lärz" }), TODAY).intent).toBeUndefined();
  });
  it("the code's event wins over the model's place", () => {
    const code = parseStartText(OWNER, TODAY, "where");
    const model = acceptExtraction(raw({ destination: "Cape Town", destination_country_code: "ZA" }), TODAY);
    expect(mergeExtracted(code, model).where?.place).toBe("Tankwa Karoo");
    expect(mergeExtracted(code, model).intent?.id).toBe("afrikaburn");
  });
});

describe("making the trip by itself", () => {
  const ready = () => {
    let s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    s = applyAnswer(s, { q: "duration", duration: { unit: "day", n: 11 } }, 3);
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 4);
    return s;
  };
  it("starts once the essentials are known, never before nor twice for the same answers", () => {
    const fresh = { for: null, stopped: false };
    const s = ready();
    expect(shouldAutoStart(answered(s), ctx, fresh)).toBe(false); // how many, still
    const go = answered(applyAnswer(s, { q: "count", n: 4 }, 5));
    expect(shouldAutoStart(go, ctx, fresh)).toBe(true);
    // Not while the traveller's line waits for the chat's.
    expect(shouldAutoStart({ ...go, messages: [...go.messages, { role: "user", text: "x", at: 100 }] }, ctx, fresh)).toBe(false);
    expect(shouldAutoStart(go, ctx, { for: autoPrint(go, ctx), stopped: false })).toBe(false);
    // Who skipped counts as said; where from too.
    const skipped = answered(skip(skip(typed(newStart("x", "plan", 1, "tr"), "Bali'ye 10 gün"), "from", 3), "who", 4));
    expect(essentialsDone(skipped)).toBe(true);
    expect(shouldAutoStart(skipped, ctx, fresh)).toBe(true);
    // A loose spelling still to confirm holds it.
    expect(essentialsDone({ ...skipped, guess: { typed: "Balli", place: { place: "Bali", country: null }, slot: "where" } })).toBe(false);
  });
  it("stopped by the traveller: a later answer doesn't start it, a full checklist does", () => {
    const go = answered(applyAnswer(ready(), { q: "count", n: 4 }, 5));
    const stopped = { for: autoPrint(go, ctx), stopped: true };
    const styled = answered(applyAnswer(go, { q: "want", styles: [], budget: null }, 6));
    expect(isComplete(styled)).toBe(false);
    expect(shouldAutoStart(styled, ctx, stopped)).toBe(false);
    const full = answered(applyAnswer(go, { q: "want", styles: ["adventure"], budget: null }, 6));
    expect(isComplete(full)).toBe(true);
    expect(shouldAutoStart(full, ctx, stopped)).toBe(true);
  });
  it("6 seconds when the style question shows as it starts (time to read its chips), else 3", () => {
    const go = applyAnswer(ready(), { q: "count", n: 4 }, 5);
    expect(nextQuestion(go)).toBe("want");
    expect(autoSeconds(go)).toBe(6);
    const styled = applyAnswer(go, { q: "want", styles: ["adventure"], budget: null }, 6);
    expect(nextQuestion(styled)).toBeNull();
    expect(autoSeconds(styled)).toBe(3);
  });
  it("the last line says it makes itself; stopped, it waits", () => {
    const done = applyAnswer(applyAnswer(ready(), { q: "count", n: 4 }, 5), { q: "want", styles: ["adventure"], budget: null }, 6);
    const tr = withLang("tr", () => nextLine(done, ctx));
    expect(tr).toBe("Hazırım, birkaç saniye içinde oluşturuyorum. Eklemek istediğin bir şey varsa yaz.");
    expect(withLang("tr", () => waitingInstead(`Tamam, rota bu.\n${tr}`))).toBe("Tamam, rota bu.\nTamam, bekliyorum. Hazır olunca Oluştur'a bas ya da 'oluştur' yaz.");
    expect(withLang("en", () => nextLine(done, ctx))).toBe("I'm ready and will build it in a few seconds. Write if you want to add anything.");
    expect(withLang("en", () => waitingInstead("I'm ready and will build it in a few seconds. Write if you want to add anything."))).toBe(
      "OK, I'll wait. Press Generate or type 'generate' when you're ready.",
    );
    // A question on screen stays as it is.
    expect(withLang("en", () => waitingInstead("What are you after on this trip? (pick as many as you like)"))).toBeNull();
  });
  it("asked for in words", () => {
    for (const t of ["tamam oluştur", "Hadi", "generate", "let's go!", "Tamam, oluştur.", "go ahead"]) expect(isGoCommand(t), t).toBe(true);
    for (const t of ["hadi Bali'ye gidelim", "tamam", "let's go to Bali", "oluşturma"]) expect(isGoCommand(t), t).toBe(false);
  });
});

describe("the title from the intent", () => {
  it("the trip's and the start screen's", () => {
    const s = typed(newStart("ab", "plan", 1, "tr"), OWNER);
    expect(tripTitle(s)).toBe("AfrikaBurn 2027");
    expect(startName(s)).toBe("AfrikaBurn");
    const bali = typed(newStart("b", "plan", 1, "tr"), "Bali'ye gidelim");
    expect(tripTitle(bali)).toBe("Bali Gezisi");
    expect(startName(bali)).toBe("Bali");
    expect(withLang("en", () => tripTitle(bali))).toBe("Bali trip");
    expect(intentOf(EVENTS.find((e) => e.id === "f1-turkey")!, TODAY).dates).toBeNull();
  });
});

// --- the review of 3cbda03 (one test per finding) -------------------------------------------------------------------

describe("review 1: 'Sohbete dön' never makes the trip again by itself", () => {
  it("the answers as made are taken as counted down and stopped (the confirmed route changes the checklist)", () => {
    let s = newStart("x", "plan", 1, "tr");
    s = applyAnswer(s, { q: "where", place: "Portekiz", country: "Portekiz", code: "PT" }, 2);
    s = applyAnswer(s, { q: "duration", duration: { unit: "day", n: 10 } }, 2);
    s = applyAnswer(s, { q: "start", date: "2026-11-10", approx: false }, 2);
    s = applyAnswer(applyAnswer(s, { q: "from", city: "İzmir" }, 2), { q: "who", kind: "partner" }, 2);
    s = answered(s);
    const g = withGuessTaken(s, 6);
    const made = { ...g, route: routeMade(g) ?? g.route, editingRoute: false, asking: null };
    // Before the fix: the memo of the countdown (not of what was made) let it start again.
    expect(shouldAutoStart(made, ctx, { for: autoPrint(s, ctx), stopped: false })).toBe(true);
    expect(shouldAutoStart(made, ctx, memoAfterGenerate(made, ctx))).toBe(false);
  });
});

describe("review 2: never over a half-typed message", () => {
  it("held while words are typed, a word is composed or the tab is hidden", () => {
    expect(autoHeld({ typing: "", composing: false, hidden: false })).toBe(false);
    expect(autoHeld({ typing: "   ", composing: false, hidden: false })).toBe(false);
    expect(autoHeld({ typing: "Cape To", composing: false, hidden: false })).toBe(true);
    expect(autoHeld({ typing: "", composing: true, hidden: false })).toBe(true);
    expect(autoHeld({ typing: "", composing: false, hidden: true })).toBe(true);
  });
});

describe("review 8: no flight from a place to itself", () => {
  it("leaving from the gateway: the stays, no flights", () => {
    let s = typed(newStart("e", "plan", 1, "tr"), "AfrikaBurn'e gitmek istiyorum");
    s = applyAnswer(applyAnswer(s, { q: "duration", duration: { unit: "day", n: 9 } }, 3), { q: "from", city: "Cape Town" }, 4);
    expect(creationOf(s)!.travel).toEqual([]);
    let m = newStart("m", "plan", 1, "tr");
    m = applyAnswer(m, { q: "where", place: "Münih", country: "Almanya", code: "DE" }, 2);
    m = applyAnswer(applyAnswer(m, { q: "duration", duration: { unit: "day", n: 5 } }, 2), { q: "from", city: "Münih" }, 2);
    expect(creationOf(m)!.travel).toEqual([]);
  });
});
