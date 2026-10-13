// The card's "neden" line: only from the traveller's own words, and no line when nothing of theirs stands behind the card.
import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { cardWhy, whyText } from "../src/lib/cardWhy";
import { needsFor } from "../src/lib/cardFacts";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { setLang } from "../src/lib/i18n";
import type { NeedCheck } from "../src/lib/needs";
import { makeItem } from "./fixtures/makeItem";

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T10:00:00Z") }));
afterAll(() => vi.useRealTimers());

const need = (over: Partial<NeedCheck>): NeedCheck => ({ key: "c:stops", label: "Direkt", state: "yes", text: "Direkt", covers: [], ...over });
const flight = makeItem({ category: "flight", name: "Pegasus · direkt" });

describe("cardWhy", () => {
  it("a must they set: 'Direkt · direkt şart dediğin için'", () => {
    expect(whyText(cardWhy(flight, [need({ source: { kind: "requirement" } })])!)).toBe("Direkt · direkt şart dediğin için");
  });

  it("an amenity they ticked, a note they wrote (their words, quoted), a level they gave", () => {
    const stay = makeItem({ category: "stay", name: "Jardim Stay" });
    expect(whyText(cardWhy(stay, [need({ key: "a:mutfak", label: "Mutfak", source: { kind: "amenity" } })])!)).toBe("Mutfak · mutfak istediğin için");
    expect(whyText(cardWhy(stay, [need({ key: "t:noise", label: "Sessiz", source: { kind: "note", text: "Sessiz bir yer istiyoruz" } })])!)).toBe("Sessiz · “Sessiz bir yer istiyoruz” dediğin için");
    expect(whyText(cardWhy(stay, [need({ key: "c:location", label: "Yakın konum", source: { kind: "level", criterion: "location", level: 4 } })])!)).toBe("Yakın konum · konum çok önemli dediğin için");
  });

  it("a long note is quoted by its first words", () => {
    const stay = makeItem({ category: "stay" });
    const long = "Odada mutlaka bir şarap kadehi ve güzel bir manzara olsun lütfen";
    expect(cardWhy(stay, [need({ label: "Manzara", source: { kind: "note", text: long } })])!.because).toBe("“Odada mutlaka bir şarap kadehi ve…” dediğin için");
  });

  it("a guess they confirmed says it was read from their choices, and where, in the tooltip", () => {
    const why = cardWhy(flight, [need({ source: { kind: "inferred", evidence: "Jardim'i seçtin: €45 daha pahalı" } })])!;
    expect(why.because).toBe("seçimlerinden anladığım için");
    expect(why.title).toBe("Jardim'i seçtin: €45 daha pahalı");
  });

  it("no line without their word: no needs, a need that isn't met, a need with no source", () => {
    expect(cardWhy(flight, [])).toBeNull();
    expect(cardWhy(flight, [need({ state: "no", source: { kind: "requirement" } })])).toBeNull();
    expect(cardWhy(flight, [need({ state: "unknown", source: { kind: "requirement" } })])).toBeNull();
    expect(cardWhy(flight, [need({})])).toBeNull();
  });

  it("the first met need is the reason (they come in the order they matter)", () => {
    const stay = makeItem({ category: "stay" });
    const why = cardWhy(stay, [need({ label: "Mutfak", state: "no", source: { kind: "amenity" } }), need({ label: "Sessiz", source: { kind: "note", text: "sessiz olsun" } }), need({ label: "Direkt", source: { kind: "requirement" } })])!;
    expect(why.what).toBe("Sessiz");
  });

  it("a thing to do named in a note: their own word in its name; never a stay, a ticket, or the city", () => {
    const notes = ["Şarap tadımı yapmak istiyoruz"];
    const wine = makeItem({ category: "activity", name: "Douro şarap turu", city: "Porto" });
    expect(whyText(cardWhy(wine, [], notes)!)).toBe("Şarap · “Şarap tadımı yapmak istiyoruz” dediğin için");
    expect(cardWhy(makeItem({ category: "stay", name: "Şarap Evi Oteli" }), [], notes)).toBeNull();
    expect(cardWhy(makeItem({ category: "activity", name: "Fado gecesi" }), [], notes)).toBeNull();
    // The city's own name in a note is not a reason.
    expect(cardWhy(makeItem({ category: "activity", name: "Porto yürüyüşü", city: "Porto" }), [], ["Porto'da kalmak istiyoruz"])).toBeNull();
    // Filler words match nothing.
    expect(cardWhy(makeItem({ category: "food", name: "Güzel Lokanta" }), [], ["Mutlaka güzel bir yer olsun"])).toBeNull();
  });
});

describe("cardWhy in English", () => {
  it("says the same things in the traveller's own words", () => {
    setLang("en");
    try {
      const stay = makeItem({ category: "stay", name: "Jardim Stay" });
      expect(whyText(cardWhy(flight, [need({ label: "Direct", source: { kind: "requirement" } })])!)).toBe("Direct · you made direct a must");
      expect(whyText(cardWhy(stay, [need({ label: "Quiet", source: { kind: "note", text: "We want a quiet place" } })])!)).toBe("Quiet · you said “We want a quiet place”");
      expect(whyText(cardWhy(stay, [need({ label: "Kitchen", source: { kind: "amenity" } })])!)).toBe("Kitchen · you wanted kitchen");
      expect(whyText(cardWhy(stay, [need({ label: "Close by", source: { kind: "level", criterion: "location", level: 4 } })])!)).toBe("Close by · you said location is very important");
      expect(cardWhy(stay, [need({ source: { kind: "inferred", evidence: "x" } })])!.because).toBe("I read it from your choices");
    } finally {
      setLang("tr");
    }
  });
});

describe("the sample trip", () => {
  it("the quiet they asked for is the reason on Jardim Stay; a flight nobody asked anything of has no line; a must makes one", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const result = await loadDecisions(trip, items);
    const decisionOf = (name: string) => [...result.decisions.values()].find((d) => d.options.some((o) => o.item.name === name))!;
    const whyOf = (name: string, ctx = result.ctx) => {
      const item = items.find((i) => i.name === name)!;
      const why = cardWhy(item, needsFor(item, decisionOf(name), ctx), ctx.preferences);
      return why && whyText(why);
    };
    expect(whyOf("Jardim Stay")).toBe("Sessiz · “Sessiz bir yer istiyoruz” dediğin için");
    expect(whyOf("Pegasus · direkt")).toBeNull();
    const direct = { ...result.ctx, trip: { ...result.ctx.trip, requirements: [{ kind: "direct_flight" as const }] } };
    expect(whyOf("Pegasus · direkt", direct)).toBe("Direkt · direkt şart dediğin için");
    // The other flight isn't direct: it doesn't meet what they asked, so it doesn't claim to be here for it.
    expect(whyOf("TAP · Lizbon aktarmalı", direct)).toBeNull();
    const level = { ...result.ctx, trip: { ...result.ctx.trip, priorities: { cancellation: 4 as const } } };
    expect(whyOf("Jardim Stay", level)).toMatch(/dediğin için$/);
  });
});
