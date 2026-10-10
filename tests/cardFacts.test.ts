// What each decision card shows for the sample trip: source, what it is, the price for these nights,
// where it stands, and the short pros and cons (the reason an option is out first).
import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { cardDetails, cardFacts, hostOf } from "../src/lib/cardFacts";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { choiceOf, tradeText } from "../src/lib/choice";
import { makeItem } from "./fixtures/makeItem";

// The sample trip's dates are fixed (its free cancellation ends 5 October 2026): read before the trip, so the
// test doesn't change with the calendar (it broke on 6 October).
beforeAll(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T10:00:00Z") }));
afterAll(() => vi.useRealTimers());

async function demo() {
  const id = await loadDemoTrip({ today: "2026-10-05" });
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const result = await loadDecisions(trip, items);
  const decisionOf = (name: string) => [...result.decisions.values()].find((d) => d.options.some((o) => o.item.name === name))!;
  const facts = (name: string) => cardFacts(items.find((i) => i.name === name)!, decisionOf(name), result.ctx);
  const choice = (name: string) => {
    const c = choiceOf(decisionOf(name), result.ctx);
    return { headline: c.headline, ranked: c.ranked.map((x) => [x.rank, x.option.item.name, x.badges.join(" · "), x.option.fit]), why: c.ranked.map((x) => x.trade && tradeText(x.trade, result.ctx.currency)) };
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
    // The assistant proposed ruling it out for the construction noise, but quiet is a wish, not a must:
    // that costs it points (it's last) and is a thing to check, never a verdict the traveller didn't give.
    expect(casa.out).toBe(false);
    expect(casa.status).toBeNull();
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
  it("numbers each decision best first, with what each is strongest on and why it stands there", async () => {
    const { choice } = await demo();
    // Porto: Jardim first (the quietest), Ribeira second, Casa Azul last: the cheapest, but with construction
    // noise next door, to check before choosing (not ruled out: quiet is a wish, not a must).
    expect(choice("Jardim Stay")).toMatchObject({
      headline: "Önerim Jardim Stay: en sessiz; 2.'ye göre €45 daha ucuz, 5 Eki'ye kadar ücretsiz iptal ve daha konforlu. Tasarruf için 3. Casa Azul (1.'ye göre €45 daha ucuz).",
      ranked: [
        [1, "Jardim Stay", "En sessiz", "fit"],
        [2, "Ribeira Rooms", "", "fit"],
        [3, "Casa Azul", "En ekonomik", "check"],
      ],
    });
    // What its pages say that the first's don't, concretely: the river view.
    expect(choice("Jardim Stay").why[1]).toBe("+€45 (gecelik +€15) · yorumlar daha iyi (9,2/10 – 8,9/10), odadan nehir manzarası · 3 yorum · eksiği: hafta sonu gece gürültüsü · 3 yorum, iade yok, konforu daha zayıf");
    // Flights, nothing asked: the best one first, the cheaper one second with what the saving costs.
    expect(choice("Pegasus · direkt")).toMatchObject({
      headline: "Önerim Pegasus · direkt: €30 fazlasına bagaj dahil ve direkt. Tasarruf için 2. TAP · Lizbon aktarmalı (1.'ye göre €30 daha ucuz).",
      ranked: [
        [1, "Pegasus · direkt", "", "fit"],
        [2, "TAP · Lizbon aktarmalı", "En ekonomik", "fit"],
      ],
      why: ["+€30 · bagaj dahil, direkt, saatleri daha uygun · eksiği: iade yok, ücretli değişiklik", "€30 daha ucuz · ücret kesintisiyle iade · eksiği: yalnız kabin, 1 aktarma, saatleri daha zor"],
    });
  });
});

describe("a trip's operator in the details", () => {
  it("carrier and flight number, else the provider", () => {
    const f = makeItem({ category: "flight", flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: null, carrier: "Pegasus", flightNumber: "PC 1201", stops: 0 } });
    expect(cardDetails(f, undefined, undefined).facts.find((x) => x.label === "İşletme")?.value).toBe("Pegasus · PC 1201");
    const bus = makeItem({ provider: "FlixBus", flight: { from: "Lizbon", to: "Lagos", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } });
    expect(cardDetails(bus, undefined, undefined).facts.find((x) => x.label === "İşletme")?.value).toBe("FlixBus");
  });
});
