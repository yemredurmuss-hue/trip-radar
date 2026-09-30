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
  it("numbers each decision best first, with what each is strongest on and why it stands there", async () => {
    const { choice } = await demo();
    // Porto: Jardim first (the cheapest that fits and the quietest), Ribeira second, Casa Azul out and last.
    expect(choice("Jardim Stay")).toMatchObject({
      headline: "Önerim Jardim Stay: en ekonomik ve en sessiz; 5 Eki'ye kadar ücretsiz iptal ve daha konforlu.",
      ranked: [
        [1, "Jardim Stay", "En ekonomik · En sessiz", "fit"],
        [2, "Ribeira Rooms", "", "fit"],
        [3, "Casa Azul", "", "unfit"],
      ],
    });
    expect(choice("Jardim Stay").why[1]).toBe("+€45 (gecelik +€15) · yorumlar daha iyi (9,2/10 – 8,9/10) · eksiği: hafta sonu gece gürültüsü · 3 yorum, iade yok, konforu daha zayıf");
    // Flights, nothing asked: the best one first, the cheaper one second with what the saving costs.
    expect(choice("Pegasus · direkt")).toMatchObject({
      headline: "Önerim Pegasus · direkt: €30 fazlasına bagaj dahil ve direkt. Tasarruf için 2. TAP · Lizbon aktarmalı (€30 daha ucuz).",
      ranked: [
        [1, "Pegasus · direkt", "", "fit"],
        [2, "TAP · Lizbon aktarmalı", "En ekonomik", "fit"],
      ],
      why: ["+€30 · bagaj dahil, direkt, saatleri daha uygun · eksiği: iade yok, ücretli değişiklik", "€30 daha ucuz · ücret kesintisiyle iade · eksiği: yalnız kabin, 1 aktarma, saatleri daha zor"],
    });
  });
});
