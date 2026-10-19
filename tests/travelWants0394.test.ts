// 0.39.4 (Emre: "hostel örneği verdim, akıllı AI dedim, sadece tür ekleyerek çözme"): what the traveller said of how they
// travel reaches the trip (Trip.wants) and every suggestion reads it: the stay picks' fit, the hotels' search words, the
// AI review's prompt, the chat's find_offers. A kind asked for is never filtered away; a kind ruled out never comes.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { chatWants, offersNeed } from "../src/lib/assistant";
import { db } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import type { StayCandidate } from "../src/lib/offerSources";
import { queryOf } from "../src/lib/offerSources";
import { runStep, stepsFor, wouldMake } from "../src/lib/startCreate";
import { acceptRoute, applyAnswer, applyText, creationOf, mergeExtracted, newStart, parseStartText, type StartState } from "../src/lib/startTrip";
import { fitsTrip, pickList, pickThree, stayFitOf } from "../src/lib/stayPicks";
import { reviewPrompt, tripTaste } from "../src/lib/suggestReview";
import { mergeWants, stayQueryOf, stayWishesIn, wantsFromStart, wantsIn, wantsLine } from "../src/lib/travelWants";
import type { Trip } from "../src/lib/types";
import { stayQuery, stayWordsOk } from "../supabase/functions/offers/shape";

setLang("tr");
const TODAY = "2026-10-06";

const cand = (id: string, name: string, nightly: number, rating = 4.5): StayCandidate => ({
  id, name, rating, reviews: 400, photo: null, geo: null, area: null, labels: [], url: `https://x.test/${id}`,
  nightly, total: nightly * 5, nights: 5, priceRange: null, source: "google", currency: "EUR", fetchedAt: 1,
});
const kandy = [cand("h1", "Kandy Grand Hotel", 120), cand("h2", "Queens Hotel", 90), cand("d1", "Clock Inn Kandy Hostel", 18, 4.6), cand("h3", "Earl's Regent", 140, 4.7)];
const need = { adults: 2, start: "2026-12-10", end: "2026-12-15" };
const trip = (over: Partial<Trip> = {}) => ({ travellers: { names: ["Sabin"], count: 2 }, style: null, budget: null, confirmedDates: null, ...over }) as Partial<Trip>;

describe("what is said: any kind of stay, asked for or ruled out, the money, where", () => {
  it("reads the kinds in Turkish and English, with their endings, and a 'no' said with them", () => {
    expect(stayWishesIn("Bu hosteli ekle")).toEqual({ stays: ["hostel"], avoid: [] });
    expect(stayWishesIn("hostel olmasın, villa kiralarız")).toEqual({ stays: ["villa"], avoid: ["hostel"] });
    expect(stayWishesIn("kampta kalacağız, glamping de olur").stays).toEqual(["camp"]);
    expect(stayWishesIn("apart ya da pansiyon bakalım").stays).toEqual(["apartment", "guesthouse"]);
    expect(stayWishesIn("we'd rather rent a whole house, no hostels please")).toEqual({ stays: ["house"], avoid: ["hostel"] });
    // "Kampanya" is no camp; "apartman" no flat.
    expect(stayWishesIn("kampanyalı uçuş, apartmanın önünde").stays).toEqual([]);
  });
  it("the money level and where to stay", () => {
    expect(wantsIn("Ekonomik bir gezi, şehir merkezinde hostel")).toEqual({ budget: "low", stays: ["hostel"], near: ["city centre"] });
    expect(wantsIn("lüks bir tatil, deniz kenarı resort").budget).toBe("high");
  });
  it("said again, the newer word wins: a kind asked for now is no longer ruled out", () => {
    const first = mergeWants(null, { budget: "low", avoid: ["hostel"] });
    expect(mergeWants(first, { stays: ["hostel"] })).toEqual({ budget: "low", stays: ["hostel"] });
    expect(mergeWants(null, {})).toBeNull();
  });
  it("in the chat: a kind or a 'no' is the trip's intent; a plain 'otel' or a passing 'daha ucuz' isn't", () => {
    expect(chatWants("Kandy'de bize hostel bakar mısın?")).toEqual({ stays: ["hostel"] });
    expect(chatWants("villa olmasın, merkezde bir apart")).toEqual({ stays: ["apartment"], avoid: ["villa"], near: ["city centre"] });
    expect(chatWants("bu otel daha ucuz mu?")).toBeNull();
  });
});

describe("the start chat's intent reaches the trip", () => {
  function interview(): StartState {
    const text = "Arkadaşlarla 10 Aralık'tan 2 hafta Sri Lanka, ucuza hostellerde kalırız";
    let s = newStart(`s-${Math.random()}`, "plan", 1);
    s = { ...s, messages: [{ role: "user", text, at: 1 }] };
    s = applyText(s, text, mergeExtracted(parseStartText(text, TODAY), null), 2).state;
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    s = applyAnswer(s, { q: "want", styles: ["nature"], budget: "low" }, 4);
    const route = acceptRoute({ stops: [{ city: "Kandy", nights: 7, country_code: "LK" }, { city: "Ella", nights: 7, country_code: "LK" }], arrival_airport_city: "Kolombo", departure_airport_city: "Kolombo" }, 14)!;
    return { ...s, route: { ...route, confirmed: true } };
  }
  it("'Ekonomik', who goes and the hostels said are on the trip made (only the amount used to be)", async () => {
    const s = interview();
    expect(wantsFromStart(s)).toMatchObject({ budget: "low", stays: ["hostel"] });
    expect(wouldMake(s)!.trip.wants).toMatchObject({ budget: "low", stays: ["hostel"] });
    let state = s;
    for (const step of stepsFor(state, creationOf(state)!)) {
      const { tripId } = await runStep(step.id, state, { provider: "gemini" });
      if (step.id === "trip") state = { ...state, tripId };
    }
    const made = (await (await db()).get("trips", state.tripId!))!;
    expect(made.wants).toMatchObject({ budget: "low", stays: ["hostel"] });
    expect(made.wants?.company ?? null).toBe(s.who?.kind ?? null);
  });
});

describe("every suggestion reads it", () => {
  it("an economical trip for two: the dorm isn't filtered away any more, and a hostel is among the three", () => {
    // Before: no amount, so not cheap, and two going: the hostel was filtered out.
    expect(fitsTrip(kandy[2], stayFitOf(need, trip()))).toBe(false);
    const fit = stayFitOf(need, trip({ wants: { budget: "low" } }));
    expect(fit.cheap).toBe(true);
    expect(fitsTrip(kandy[2], fit)).toBe(true);
    const picks = pickList(pickThree(kandy, { centre: null, trip: trip({ wants: { budget: "low" } }), fit }));
    expect(picks.map((p) => p.pick.cand.id)).toContain("d1");
  });
  it("a kind asked for always passes, even on a romantic trip, and is weighed first; a kind ruled out never comes", () => {
    const romantic = trip({ style: { key: "k", ids: ["romantic"] }, wants: { stays: ["hostel"] } });
    const fit = stayFitOf(need, romantic);
    expect(fitsTrip(kandy[2], fit)).toBe(true);
    expect(pickList(pickThree(kandy, { centre: null, trip: romantic, fit })).map((p) => p.pick.cand.id)).toContain("d1");
    // Two of the kind asked for: "Sana en uygun" is one of them, not a hotel.
    const two = [...kandy, cand("d2", "Kandy Backpackers", 22, 4.4)];
    expect(["d1", "d2"]).toContain(pickThree(two, { centre: null, trip: romantic, fit }).best?.cand.id);
    // Asked in the chat for this search only ("hostel bul"): the search's words carry it.
    expect(fitsTrip(kandy[2], stayFitOf({ ...need, stay: "hostel" }, trip({ style: { key: "k", ids: ["romantic"] } })))).toBe(true);
    // Ruled out, even alone and on a budget.
    expect(fitsTrip(kandy[2], stayFitOf({ ...need, adults: 1 }, trip({ wants: { budget: "low", avoid: ["hostel"] } })))).toBe(false);
    // A luxury trip: no dorm bed unless asked.
    expect(fitsTrip(kandy[2], stayFitOf({ ...need, adults: 1 }, trip({ wants: { budget: "high" } })))).toBe(false);
  });
  it("the hotels' search asks for what was said: any kind, an economical trip's hostels, where", () => {
    expect(stayQueryOf(null)).toBeNull();
    expect(stayQueryOf({ budget: "low" })).toBe("budget hotels and hostels");
    expect(stayQueryOf({ budget: "low", avoid: ["hostel"] })).toBeNull();
    expect(stayQueryOf({ stays: ["villa"], near: ["beachfront"] })).toBe("villas beachfront");
    expect(stayQueryOf({ budget: "low" }, "treehouse with a view!")).toBe("treehouse with a view");
    const n = offersNeed({ kind: "stay", city: "Kandy", start: "2026-12-10", end: "2026-12-15", wish: "hostel" }, [], 2, { budget: "high" });
    expect(typeof n !== "string" && n.stay).toBe("hostel");
    const q = new URLSearchParams(queryOf({ key: "k", section: "stay", kind: "stay", city: "Kandy", start: "2026-12-10", end: "2026-12-15", adults: 2, stay: "hostels" }, "tr")!);
    expect(q.get("stay")).toBe("hostels");
  });
  it("the offers function: the words kept plain, hotels when none (as before), its own cache key", () => {
    expect(stayWordsOk("Hostels")).toBe("hostels");
    expect(stayWordsOk("villas <script>")).toBeNull();
    expect(stayQuery("Kandy", "Sri Lanka", null)).toBe("Kandy, Sri Lanka hotels");
    expect(stayQuery("Kandy", "Sri Lanka", "hostels")).toBe("Kandy, Sri Lanka hostels");
  });
  it("the AI review's prompt carries the intent in one line", () => {
    const t = { ...trip({ wants: { budget: "low", company: "friends", stays: ["hostel"] } }), intent: null } as Trip;
    const taste = tripTaste(t);
    expect(taste.wants).toBe(wantsLine(t.wants));
    expect(taste.wants).toContain("bütçe ekonomik");
    expect(taste.wants).toContain("istenen konaklama: hostel");
    const data = JSON.parse(reviewPrompt({ mains: [], nights: {}, range: null, items: [], sectionOf: () => "stay", suggestions: [], ...taste }).split("\n")[1]);
    expect(data.wants).toBe(taste.wants);
    // Nothing said: no line at all (the prompts as they were).
    expect(tripTaste(trip() as Trip).wants).toBeUndefined();
  });
});
