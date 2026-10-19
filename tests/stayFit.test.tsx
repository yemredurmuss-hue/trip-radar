// 0.38.6, Emre's Bali trip ("Bali'de 1 ay kalırız canggu da sabit sabinle", two going, 31 nights in Canggu, Romantik):
// the picks keep to the kinds of place the trip stays in (no hostel for two on a romantic month, a home first for a long
// stay), an option the box already holds is never shown again under it, and the box's option cards are the picks'
// cards (a 4:3 photo, never the thin strip), with the source's usual range when there's no price.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardEnvContext, type CardEnv } from "../src/app/cards/PlanCard";
import { OptionList } from "../src/app/plan/v82/OptionCompact";
import type { IntentVM, OptionVM } from "../src/lib/intents";
import type { StayCandidate } from "../src/lib/offerSources";
import { offerItem } from "../src/lib/offerSource";
import { candidateOffer, dormFits, fitsTrip, pickList, picksContext, pickThree, savedAlready, stayFitOf, typicalNight, type StayFit } from "../src/lib/stayPicks";
import type { Trip } from "../src/lib/types";

const cand = (name: string, over: Partial<StayCandidate> = {}): StayCandidate => ({
  id: name, name, rating: 4.8, reviews: 300, photo: `https://img.example.com/${encodeURIComponent(name)}.jpg`, geo: null, area: null, labels: [],
  url: `https://www.tripadvisor.com/${encodeURIComponent(name)}`, nightly: null, total: null, nights: 31, priceRange: { min: 21, max: 64 }, source: null, currency: "EUR", fetchedAt: 1, ...over,
});
// What the source gave for Canggu (as Emre saw it): one sanctuary, one beach hostel.
const canggu = () => [cand("Premadhan Sanctuary", { rating: 5, reviews: 402 }), cand("Roomates Beach Hostel Canggu", { rating: 4.9, reviews: 113 })];
const need = { city: "Canggu", start: "2026-12-01", end: "2027-01-01", adults: 2 };
const bali = { travellers: { names: ["Sabin"], count: 2 }, style: { key: "k", ids: ["romantic", "nature"] }, budget: null, confirmedDates: { start: "2026-12-01", end: "2027-01-01" } } as unknown as Trip;
const names = (cands: StayCandidate[], fit: StayFit | null, trip: Trip | null = bali) => pickList(pickThree(cands, { centre: null, trip, fit })).map((x) => x.pick.cand.name);

describe("the kind of place the trip stays in", () => {
  it("Emre's Bali month: two going, 31 nights, romantic", () => {
    expect(stayFitOf(need, bali)).toEqual({ people: 2, nights: 31, romantic: true, cheap: false });
    // Without the head count on the need, the trip's travellers say it (Sabin and me).
    expect(stayFitOf({ ...need, adults: null }, { ...bali, travellers: { names: ["Sabin"] } }).people).toBe(2);
  });
  it("a hostel for two on a romantic month is left out; the sanctuary stays", () => {
    expect(names(canggu(), stayFitOf(need, bali))).toEqual(["Premadhan Sanctuary"]);
    // The same through the board's context (OfferRow, find_offers).
    expect(pickList(pickThree(canggu(), picksContext(need, bali, []))).map((x) => x.pick.cand.name)).toEqual(["Premadhan Sanctuary"]);
  });
  it("dorms, bunks and capsules by their name or a label", () => {
    const fit = stayFitOf(need, bali);
    for (const c of [cand("Kosta Hostel"), cand("The Bunk House"), cand("Capsule Inn Canggu"), cand("Canggu Backpackers"), cand("Sun Rooms", { labels: ["Dorm"] })]) expect(fitsTrip(c, fit)).toBe(false);
    for (const c of [cand("Villa Sabin"), cand("Canggu Guest House"), cand("The Slow")]) expect(fitsTrip(c, fit)).toBe(true);
  });
  it("a dorm bed only alone or on a budget said cheap, never romantic", () => {
    const base: StayFit = { people: 2, nights: 31, romantic: false, cheap: false };
    expect(dormFits(base)).toBe(false);
    expect(dormFits({ ...base, people: 1 })).toBe(true);
    expect(dormFits({ ...base, cheap: true })).toBe(true);
    expect(dormFits({ ...base, people: 1, cheap: true, romantic: true })).toBe(false);
    expect(dormFits({ ...base, people: null })).toBe(false);
    // A low budget (per person a day under €70): cheap said.
    const low = { ...bali, style: null, budget: { amount: 1500, currency: "EUR" } } as unknown as Trip;
    expect(stayFitOf(need, low).cheap).toBe(true);
    // Alone, not romantic: the hostel is one of the candidates again (the best of the two by its rating stays first).
    expect(names([canggu()[1]], stayFitOf({ ...need, adults: 1 }, { ...bali, style: null } as unknown as Trip))).toEqual(["Roomates Beach Hostel Canggu"]);
    expect(names([canggu()[1]], stayFitOf(need, bali))).toEqual([]);
  });
  it("no fit known (older callers): every kind, as before", () => {
    expect(names(canggu(), null)).toEqual(expect.arrayContaining(["Premadhan Sanctuary"]));
    expect(fitsTrip(cand("Kosta Hostel"), null)).toBe(true);
  });
  it("a month in one place: a home of one's own comes first, the rest being equal", () => {
    const pair = [cand("Canggu Resort Hotel"), cand("Uma Villa Canggu")];
    expect(names(pair, stayFitOf(need, bali))[0]).toBe("Uma Villa Canggu");
    // A weekend: no lift for it (the first of equals stays first).
    expect(names(pair, stayFitOf({ ...need, end: "2026-12-03" }, bali))[0]).toBe("Canggu Resort Hotel");
  });
});

describe("an option the box holds is not shown again under it", () => {
  const saved = offerItem(candidateOffer(canggu()[0], "best", ""), { key: "k", section: "stay", kind: "stay", city: "Canggu", start: need.start, end: need.end, adults: 2 }, "t", "i1", 1);
  it("by its page, or the same name from the same site; one taken off is free again", () => {
    expect(saved.provider).toBe("Tripadvisor");
    expect(savedAlready(canggu()[0], [saved])).toBe(true);
    expect(savedAlready({ ...canggu()[0], url: "https://www.tripadvisor.com/other" }, [saved])).toBe(true);
    expect(savedAlready({ ...canggu()[0], url: "https://www.booking.com/x", source: "Booking" }, [saved])).toBe(false);
    expect(savedAlready(canggu()[1], [saved])).toBe(false);
    expect(savedAlready(canggu()[0], [{ ...saved, status: "dismissed" }])).toBe(false);
  });
  it("the row picks among the rest only", () => {
    const fresh = [...canggu(), cand("Uma Villa Canggu")].filter((c) => !savedAlready(c, [saved]));
    expect(names(fresh, stayFitOf(need, bali))).toEqual(["Uma Villa Canggu"]);
  });
});

describe("the box's option cards are the picks' cards", () => {
  const item = offerItem(candidateOffer(canggu()[0], "best", ""), { key: "k", section: "stay", kind: "stay", city: "Canggu", start: need.start, end: need.end, adults: 2 }, "t", "i1", 1);
  const option = { id: item.id, item, title: item.name, brand: null, source: null, image: item.imageUrl, price: null, ticket: null, score: null, place: 1, rating: "★ 5 · 402 yorum", where: null, cancel: null, checks: [], badges: [], ours: false, leg: null, carrier: null } as unknown as OptionVM;
  const vm = { optionCount: 1, status: "deciding", chosen: null, options: [option] } as unknown as IntentVM;
  const env = { focus: null, setFocus: () => {} } as unknown as CardEnv;
  const draw = (typical: ((o: OptionVM) => ReturnType<typeof typicalNight>) | null) =>
    renderToStaticMarkup(
      <CardEnvContext.Provider value={env}>
        <OptionList vm={vm} options={[option]} current={null} changing={false} art="illus/otel.png" links={[]} typical={typical} onPick={() => {}} onOpen={() => {}} onCancel={() => {}} onAsk={null} />
      </CardEnvContext.Provider>,
    );
  it("the row carries the card class whose photo is 4:3 (square when narrow), the strip nowhere", () => {
    expect(draw(null)).toContain('class="q-opts z-optc"');
    const css = readFileSync("static/v82/intent.css", "utf8");
    expect(css).toMatch(/\.z-optc \.z-op \{ aspect-ratio: 4 \/ 3; \}/);
    expect(css).toMatch(/\.z-optc \.z-op \{ aspect-ratio: 1; \}/);
    expect(css).toMatch(/\.z-int \.q-opts\.z-optc, \.q-opts\.z-optc \{ height: auto;/);
    expect(css).toMatch(/\.z-optc > \.z-ocs > \.z-oc \{ height: auto; grid-template-rows: auto auto; \}/);
  });
  it("no price: the source's usual range by the night, said as typical; none known: Fiyat ekle as before", () => {
    const html = draw(() => typicalNight({ min: 21, max: 64 }));
    expect(html).toContain('<span class="q-pr" title="tarihli fiyat yok"><b>tipik €21–64</b><small>/ gece</small></span>');
    expect(draw(() => null)).not.toContain("tipik");
    expect(typicalNight(null)).toBeNull();
  });
});
