// What each decision card shows for the sample trip: source, what it is, the price for these nights,
// where it stands, and the short pros and cons (the reason an option is out first).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { cardFacts, hostOf } from "../src/lib/cardFacts";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { choiceOf, tradeText } from "../src/lib/choice";

async function demo() {
  const id = await loadDemoTrip();
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const result = await loadDecisions(trip, items);
  const decisionOf = (name: string) => [...result.decisions.values()].find((d) => d.options.some((o) => o.item.name === name))!;
  const facts = (name: string) => cardFacts(items.find((i) => i.name === name)!, decisionOf(name), result.ctx);
  const choice = (name: string) => {
    const c = choiceOf(decisionOf(name), result.ctx);
    return { headline: c.headline, cards: c.candidates.map((x) => [x.option.item.name, x.label, x.trade && tradeText(x.trade, result.ctx.currency)]), rest: c.rest.map((o) => [o.item.name, o.fit]) };
  };
  return { facts, choice };
}

describe("decision card facts", () => {
  it("stays: source, what it is, the price for these nights, the pros and cons as short tags", async () => {
    const { facts } = await demo();
    const jardim = facts("Jardim Stay");
    expect(jardim).toMatchObject({
      source: { label: "Booking.com" },
      title: "Jardim Stay",
      subtitle: "Otel odası", // not the district's name: that's in the details
      price: { text: "€285", label: "3 gece toplam", provisional: false },
      best: true,
      out: false,
    });
    expect(jardim.score).toBeGreaterThan(60);
    // What the traveller asked for comes first, checked: "sessiz bir yer istiyoruz" (said). Free
    // cancellation, read from their saves, is only a question until they confirm it.
    expect(jardim.needs.map((n) => [n.label, n.state, n.text])).toEqual([["Sessiz", "yes", "Sessiz odalar, iyi uyku · 3 yorum"]]);
    // Then what only this place has (the others' pages don't mention breakfast), then the rest with the
    // specifics ("6 dk", not "Yakın"); nothing a need already said.
    expect(jardim.pros.map((p) => [p.text, Boolean(p.unique)])).toEqual([
      ["Kahvaltı çok iyi", true],
      ["Gezeceğin yerlere 6 dk", false],
      ["Ücretsiz iptal · son gün 5 Ekim", false],
      ["Yorum puanları yüksek", false],
    ]);
    // Jardim is the average price of the three: no price line either way.
    expect(jardim.cons.map((c) => c.text)).toEqual(["Odalar küçük", "TV yok"]);
    // The river view is Ribeira's alone.
    expect(facts("Ribeira Rooms").pros[0]).toMatchObject({ text: "Odadan nehir manzarası", unique: true });
    // A need the page answers the other way is said as plainly: the noise.
    expect(facts("Ribeira Rooms").needs.map((n) => [n.state, n.text])).toEqual([["no", "Hafta sonu gece gürültüsü · 3 yorum"]]);

    const casa = facts("Casa Azul");
    expect(casa.subtitle).toBe("Daire · 1 yatak odası");
    expect(casa.out).toBe(true);
    expect(casa.status).toEqual({ text: "Elendi", tone: "warning" });
    expect(casa.cons[0]).toMatchObject({ text: "Elendi: Yan binada inşaat var; sessiz bir yer istiyorsun", strong: true, mine: true });
    // Far by the comparison and weak location in the reviews: one tag, not two, and it says how far.
    expect(casa.cons.filter((c) => /Uzak|Konum/.test(c.text)).map((c) => c.text)).toEqual(["Uzak · gezeceğin yerlere 43 dk"]);
    // Quiet, which they asked for: the construction noise answers it, whatever topic it was filed under.
    expect(casa.needs[0]).toMatchObject({ state: "no", text: "Yan binada inşaat gürültüsü · 3 yorum" });
    // A short finding keeps all its words: the bed is big, not the flat.
    expect(casa.pros.map((p) => p.text)).toContain("Geniş, rahat yatak");
  });

  it("flights, trains and eSIMs: times, stops and duration; bookings say so", async () => {
    const { facts } = await demo();
    expect(facts("Pegasus · direkt")).toMatchObject({ source: { label: "Pegasus" }, image: null, subtitle: "07:10–10:05 · Direkt · 4 sa 55 dk" });
    expect(facts("TAP · Lizbon → İstanbul")).toMatchObject({ subtitle: "19:40–01:35+1 · Direkt · 4 sa 55 dk", status: { text: "Rezerve ✓", tone: "success" } });
    expect(facts("CP Alfa Pendular · Porto → Lizbon").subtitle).toBe("13:09–16:04");
    expect(facts("Airalo Portekiz 5 GB").subtitle).toBe("5 GB · 7 gün");
    expect(facts("Holafly sınırsız").subtitle).toBe("Sınırsız · 7 gün");
  });

  it("reads the site from the link when the provider isn't known", () => {
    expect(hostOf("https://www.booking.com/hotel/pt/x.html?checkin=1")).toBe("booking.com");
    expect(hostOf("not a url")).toBeNull();
  });
  it("frames each decision by what matters: the strongest option for each, and the trade against the cheapest fit one", async () => {
    const { choice } = await demo();
    // Porto: Casa Azul is out (construction, and they asked for quiet); of the ones that fit, Jardim is
    // both the cheapest and the quietest: one card says it, the rest wait one tap away.
    expect(choice("Jardim Stay")).toEqual({
      headline: "Jardim Stay her açıdan önde: en ekonomik ve en sessiz.",
      cards: [["Jardim Stay", "En ekonomik ve en sessiz", null]],
      rest: [
        ["Ribeira Rooms", "fit"],
        ["Casa Azul", "unfit"],
      ],
    });
    // Flights, nothing asked: the best overall, and the cheapest with what the saving costs.
    expect(choice("Pegasus · direkt")).toMatchObject({
      headline: "Genel olarak Pegasus · direkt (+€30, bagaj dahil); tasarruf için TAP · Lizbon aktarmalı (€30 daha ucuz).",
      cards: [
        ["Pegasus · direkt", "Genel olarak en iyi", "+€30 · bagaj dahil, direkt, saatleri daha uygun · vazgeçtiğin: ücret kesintisiyle iade"],
        ["TAP · Lizbon aktarmalı", "En ekonomik", "€30 daha ucuz · ücret kesintisiyle iade · vazgeçtiğin: bagaj dahil, direkt, saatleri daha uygun"],
      ],
    });
    // eSIMs: the cheapest, and the one with more data for €10 more.
    expect(choice("Airalo Portekiz 5 GB").headline).toBe("Tasarruf için Airalo Portekiz 5 GB (€10 daha ucuz); veri için Holafly sınırsız (+€10, daha çok veri).");
  });
});
