// The judge across listings: one passing problem two guests reported doesn't sink the best option, and
// what the reviews say is weighed against the others, not alone.
import { describe, expect, it } from "vitest";
import { choiceOf } from "../src/lib/choice";
import { decideGroup, makeContext } from "../src/lib/decision";
import { differencesOf } from "../src/lib/differences";
import { CONFIDENT, evidenceOf, FADED, holds, natureOf, questionFor, stillText, stillTrue } from "../src/lib/listing";
import type { Listing, Trip } from "../src/lib/types";
import { pivotalFindings } from "../src/lib/pivots";
import { finding, LATER_REVIEWS, review, SCAFFOLDING, scaffoldingScene, TODAY } from "./fixtures/scaffolding";

/** The scene decided, with trip settings that may name the scaffolding finding's key. */
function decide(over: (key: string) => Partial<Trip> = () => ({})) {
  const scene = scaffoldingScene();
  const key = `item:${scene.a.id}#condition:negative`;
  const trip = { ...scene.trip, ...over(key) };
  const ctx = makeContext(trip, scene.items, { listings: scene.listings, today: TODAY });
  const d = decideGroup(scene.items, ctx);
  const ranked = d.options.filter((o) => !o.excluded);
  const place = ranked.findIndex((o) => o.item.id === scene.a.id) + 1;
  return { ...scene, ctx, d, ranked, place, casa: ranked[place - 1], key };
}

describe("the scaffolding case", () => {
  it("keeps the best option near the top when one passing issue from March isn't mentioned since", () => {
    const { casa, place, ranked } = decide();
    expect(casa.eliminated).toBeNull();
    expect(casa.fit).not.toBe("unfit");
    expect(place).toBeLessThanOrEqual(2);
    expect(place).not.toBe(ranked.length);
  });

  it("rules it out only when the traveller says the scaffolding matters to them; 'sorun değil' takes it off", () => {
    const out = decide((key) => ({ confirmedFindings: [key] }));
    expect(out.place).toBe(out.ranked.length);
    expect(out.casa).toMatchObject({ fit: "unfit", eliminated: { reason: "Dışarıda iskele kuruldu (2 yorum); önemli dedin" } });
    const fine = decide((key) => ({ acceptedFindings: [key] }));
    expect(fine.place).toBe(1);
    expect(fine.casa.penalties).toEqual([]);
    expect(fine.casa.fitNotes).toEqual([]);
  });

  it("asks instead of taking points: first, flagged 'iskele hâlâ duruyor mu?' with why it's in doubt", () => {
    const { casa, place, d } = decide();
    expect(place).toBe(1);
    expect(casa.penalties).toEqual([]);
    expect(casa.fit).toBe("check");
    expect(casa.fitNotes).toEqual(["iskele hâlâ duruyor mu? (son söz Mar 2026, sonraki 10 yorum bahsetmiyor)"]);
    // Ranked with the ones that fit: a doubt read on the page isn't a must it fails.
    expect(d.options[0].item.name).toBe("Casa Andaime");
  });
});

describe("is it still so? (stillTrue)", () => {
  const base = () => scaffoldingScene();
  const casaListing = (s: ReturnType<typeof base>) => s.listings.get(`item:${s.a.id}`)!;

  it("lets a passing thing fade as later guests don't mention it; the page and lasting things don't fade", () => {
    const s = base();
    const listing = casaListing(s);
    const still = stillTrue(SCAFFOLDING, listing, TODAY);
    expect(still).toMatchObject({ nature: "event", lastSaid: "2026-03", laterSilent: 10, laterFor: 0, laterAgainst: 0, distinctMonths: 1 });
    expect(still.confidence).toBeLessThan(FADED);
    expect(evidenceOf(SCAFFOLDING, listing, TODAY)).toMatchObject({ count: 2, strength: 0.8, faded: true, stale: false });
    expect(stillText(still)).toBe("son söz Mar 2026, sonraki 10 yorum bahsetmiyor");
    // Thin walls stay thin, however many guests don't say so.
    const walls = finding({ text: "Duvarlar ince, ses geçiyor", polarity: "negative", topic: "noise", reviewIds: ["r1", "r2"] });
    expect(stillTrue(walls, listing, TODAY)).toMatchObject({ nature: "lasting", confidence: 1, laterSilent: 0 });
    // What the page itself states is so.
    const noLift = finding({ text: "Asansör yok, 3. kat", polarity: "negative", topic: "access", source: "description", quotes: ["No elevator"] });
    expect(stillTrue(noLift, listing, TODAY)).toMatchObject({ nature: "stated", confidence: 1 });
    expect(evidenceOf(noLift, listing, TODAY).strength).toBe(1);
  });

  it("each silent review counts: two since is a doubt, one since still holds", () => {
    const s = base();
    const listing = casaListing(s);
    const upTo = (month: string) => ({ ...listing, reviews: listing.reviews.filter((r) => !r.date || r.date <= month) });
    const oneLater = stillTrue(SCAFFOLDING, { ...listing, reviews: listing.reviews.slice(0, 3) }, TODAY);
    expect(oneLater.laterSilent).toBe(1);
    expect(oneLater.confidence).toBeGreaterThanOrEqual(CONFIDENT);
    expect(holds(evidenceOf(SCAFFOLDING, { ...listing, reviews: listing.reviews.slice(0, 3) }, TODAY))).toBe(true);
    const later = stillTrue(SCAFFOLDING, upTo("2026-05"), TODAY);
    expect(later.laterSilent).toBe(4);
    expect(later.confidence).toBeLessThan(CONFIDENT);
    expect(later.confidence).toBeGreaterThan(FADED);
  });

  it("brings it back when a later guest names it again, and drops it when one says it's over", () => {
    const s = base();
    const listing = casaListing(s);
    const again = { ...listing, reviews: [...listing.reviews, review("r9", "2026-09", "Scaffolding still up on the facade, but the flat is lovely.")] };
    expect(stillTrue(SCAFFOLDING, again, TODAY)).toMatchObject({ lastSaid: "2026-09", laterFor: 1, laterSilent: 0, confidence: 1 });
    // Only March and April: then an April guest says it came down.
    const april = listing.reviews.filter((r) => !r.date || r.date <= "2026-04");
    const over = { ...listing, reviews: [...april.slice(0, 2), review("r8", "2026-04", "The scaffolding has been removed, great view again!")] };
    const ended = stillTrue(SCAFFOLDING, over, TODAY);
    expect(ended).toMatchObject({ laterAgainst: 1, laterSilent: 0 });
    expect(ended.confidence).toBeLessThan(FADED);
    expect(stillText(ended)).toBe("son söz Mar 2026; sonraki 1 yorum geçtiğini söylüyor");
  });

  it("can't tell without dates: medium, a thing to check, never points off", () => {
    const s = base();
    const listing = casaListing(s);
    const undated = { ...listing, reviews: listing.reviews.map((r) => ({ ...r, date: null })) };
    const lasting = finding({ text: "Yatakta tahtakurusu", polarity: "negative", topic: "cleanliness", severity: "high", reviewIds: ["r1", "r2", "later1"] });
    expect(stillTrue(lasting, undated, TODAY)).toMatchObject({ dated: false, confidence: 0.6 });
    expect(holds(evidenceOf(lasting, undated, TODAY))).toBe(false);
    const withBugs = new Map(s.listings);
    withBugs.set(listing.key, { ...undated, findings: [lasting] });
    const d = decideGroup(s.items, makeContext(s.trip, s.items, { listings: withBugs, today: TODAY }));
    const casa = d.options.find((o) => o.item.id === s.a.id)!;
    expect(casa.penalties).toEqual([]);
    expect(casa.fitNotes).toEqual(["haşere sorunu giderildi mi, ilaçlama yapıldı mı? (yorumlar tarihsiz)"]);
  });

  it("reads what older readings didn't label: scaffolding is an event, the page's own words are stated", () => {
    expect(natureOf({ text: "Dışarıda iskele kuruldu", source: "reviews" })).toBe("event");
    expect(natureOf({ text: "Tadilat nedeniyle havuz kapalı", source: "reviews" })).toBe("event");
    expect(natureOf({ text: "Duvarlar ince", source: "reviews" })).toBe("lasting");
    expect(natureOf({ text: "Asansör yok", source: "description" })).toBe("stated");
    expect(natureOf({ text: "Dışarıda iskele kuruldu", source: "reviews", nature: "lasting" })).toBe("lasting"); // the reader said
    expect(questionFor({ text: "Dışarıda iskele kuruldu" })).toBe("İskele hâlâ duruyor mu?");
    expect(questionFor({ text: "Kapı kilidi zor açılıyor" })).toBe("“Kapı kilidi zor açılıyor”: hâlâ böyle mi?");
  });

  it("backs a finding by how many guests say it and in how many months", () => {
    const s = base();
    const listing = casaListing(s);
    const strength = (reviewIds: string[]) => evidenceOf(finding({ text: "Duvarlar ince", polarity: "negative", topic: "noise", reviewIds }), listing, TODAY).strength;
    expect(strength(["r1"])).toBe(0.4);
    expect(strength(["r1", "r2"])).toBe(0.8); // same month
    expect(strength(["r1", "later1"])).toBe(1); // March and April
    expect(strength(["later1", "later3", "later5"])).toBe(1);
  });
});

describe("the circuit breaker: a ranking that hangs on one thing says so", () => {
  /** The Airbnb at €285, with the scaffolding fresh: three guests this month, nobody since. */
  function freshScaffolding(over: (key: string) => Partial<Trip> = () => ({})) {
    const s = scaffoldingScene();
    const key = `item:${s.a.id}`;
    const l = s.listings.get(key)!;
    const listings = new Map(s.listings);
    listings.set(key, {
      ...l,
      reviews: [
        review("r1", "2026-09", "Scaffolding was put up outside, noisy in the morning."),
        review("r2", "2026-09", "Scaffolding on the building."),
        review("r3", "2026-09", "Scaffolding blocks the view."),
        ...LATER_REVIEWS.map((r) => ({ ...r, date: "2026-08" })),
      ],
      findings: [{ ...SCAFFOLDING, reviewIds: ["r1", "r2", "r3"] }, ...l.findings.slice(1)],
    });
    const items = s.items.map((i) => (i.id === s.a.id ? { ...i, price: { ...i.price, amount: 285 } } : i));
    const ctx = makeContext({ ...s.trip, ...over(`${key}#condition:negative`) }, items, { listings, today: TODAY });
    return { ...s, items, ctx, d: decideGroup(items, ctx) };
  }

  it("flags the one thing that keeps an option from first, with a question ready for the host", () => {
    const { a, d, ctx } = freshScaffolding();
    expect(d.options.map((o) => o.item.name)).toEqual(["Hotel Bravo", "Casa Andaime", "Loft Central"]);
    // Points only, no ruling: it's still in the race.
    expect(d.options[1]).toMatchObject({ penaltyPoints: 8, eliminated: null, fit: "fit" });
    // Better on every criterion, but not on the points the scaffolding costs: it doesn't make the first redundant.
    expect(d.options[0].dominatedBy).toBeNull();
    const [pivot] = pivotalFindings(d, ctx);
    expect(pivot).toMatchObject({
      itemId: a.id,
      from: 2,
      to: 1,
      evidence: "3 yorum, Eyl 2026",
      question: "İskele hâlâ duruyor mu?",
      finding: { text: "Dışarıda iskele kuruldu" },
    });
    expect(pivot.hostMessage).toBe(
      'Hi! We\'re considering your place for 8 Oct – 11 Oct. A review mentions: "Scaffolding was put up outside, noisy in the morning." Is the scaffolding still up? Thank you!',
    );
    expect(pivotalFindings(d, ctx, 1)).toHaveLength(1);
  });

  it("stops asking once the traveller answered, and never flags a doubt that costs nothing", () => {
    const fine = freshScaffolding((key) => ({ acceptedFindings: [key] }));
    expect(fine.d.options[0].item.name).toBe("Casa Andaime");
    expect(pivotalFindings(fine.d, fine.ctx).some((p) => p.finding.text === "Dışarıda iskele kuruldu")).toBe(false);
    const out = freshScaffolding((key) => ({ confirmedFindings: [key] }));
    expect(out.d.options.at(-1)).toMatchObject({ item: { name: "Casa Andaime" }, fit: "unfit" });
    expect(pivotalFindings(out.d, out.ctx).some((p) => p.finding.text === "Dışarıda iskele kuruldu")).toBe(false);
    // The March scaffolding, faded: a question on the card, no points, so nothing hangs on it.
    const { ctx, d } = decide();
    expect(pivotalFindings(d, ctx)).toEqual([]);
  });
});

describe("the difference table: only what differs moves the ranking", () => {
  it("clusters what the options say, marks what all have as neutral and a faded minus as not setting one apart", () => {
    const s = scaffoldingScene();
    const rows = differencesOf(s.items.map((i) => s.listings.get(`item:${i.id}`)), TODAY);
    const clean = rows.find((r) => r.topic === "cleanliness" && r.polarity === "positive")!;
    expect(clean).toMatchObject({ present: 3, read: 3, neutral: true, unique: false, text: "Tertemiz ve aydınlık" });
    expect(clean.cells[`item:${s.b.id}`]).toMatchObject({ state: "present", count: 1, newest: "2026-08" });
    const scaffolding = rows.find((r) => r.text === "Dışarıda iskele kuruldu")!;
    // Said only for the Airbnb, but probably over: it doesn't set the place apart.
    expect(scaffolding).toMatchObject({ present: 0, unique: false, neutral: false });
    expect(scaffolding.cells[`item:${s.b.id}`].state).toBe("absent");
    const breakfast = rows.find((r) => r.topic === "food")!;
    expect(breakfast).toMatchObject({ present: 1, unique: true });
    // Not read: unknown either way.
    const unread = differencesOf([s.listings.get(`item:${s.a.id}`), { ...s.listings.get(`item:${s.b.id}`)!, readAt: null }], TODAY);
    expect(unread.find((r) => r.topic === "cleanliness")!.cells[`item:${s.b.id}`].state).toBe("unread");
  });

  it("a serious problem every option shares costs none of them points; one only some have does", () => {
    const s = scaffoldingScene();
    const street = (reviewIds: string[]) =>
      finding({ id: `noise:negative:street${reviewIds[0]}`, text: "Sokak gece çok gürültülü", polarity: "negative", topic: "noise", severity: "high", reviewIds });
    const ids: Record<string, string[]> = { [s.a.id]: ["later1", "later2", "later3"], [s.b.id]: ["b1", "b2", "b3"], [s.c.id]: ["c1", "c2", "c3"] };
    const withStreet = (who: string[]) =>
      new Map([...s.listings].map(([k, l]) => [k, who.includes(k) ? { ...l, findings: [...l.findings, street(ids[k.slice(5)])] } : l]));
    const penalties = (listings: Map<string, Listing>) =>
      Object.fromEntries(decideGroup(s.items, makeContext(s.trip, s.items, { listings, today: TODAY })).options.map((o) => [o.item.name, o.penaltyPoints]));
    const everyone = withStreet(s.items.map((i) => `item:${i.id}`));
    expect(penalties(everyone)).toEqual({
      "Casa Andaime": 0,
      "Hotel Bravo": 0,
      "Loft Central": 0,
    });
    const onlyBravo = withStreet([`item:${s.b.id}`]);
    expect(penalties(onlyBravo)).toMatchObject({ "Hotel Bravo": 8, "Casa Andaime": 0 });
  });

  it("says against the first what its pages say that the first's don't, and what's unknown here but said there", () => {
    const s = scaffoldingScene({ priorities: {} });
    const ctx = makeContext(s.trip, s.items, { listings: s.listings, today: TODAY, preferences: ["sessiz bir yer istiyoruz"] });
    const d = decideGroup(s.items, ctx);
    const c = choiceOf(d, ctx);
    const bravo = c.ranked.find((r) => r.option.item.id === s.b.id)!;
    expect(bravo.vsRank).toBe(1);
    expect(bravo.trade!.gains).toContain("kahvaltı çok iyi · 2 yorum");
    expect(bravo.trade!.losses).toContain("oda küçük · 2 yorum");
    // Quiet was asked for: the Loft's guests speak of noise, the Airbnb's and the hotel's don't.
    expect(c.ranked.find((r) => r.option.item.id === s.a.id)!.unknown).toEqual(["sessizlik"]);
    expect(bravo.unknown).toEqual(["sessizlik"]);
    expect(c.ranked.find((r) => r.option.item.id === s.c.id)!.unknown).toEqual([]);
    // Nothing asked: nothing flagged (it would only be noise).
    const plain = makeContext(s.trip, s.items, { listings: s.listings, today: TODAY });
    expect(choiceOf(decideGroup(s.items, plain), plain).ranked.every((r) => r.unknown.length === 0)).toBe(true);
  });
});
