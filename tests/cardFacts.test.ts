// What each decision card shows for the sample trip: source, what it is, the price for these nights,
// where it stands, and the short pros and cons (the reason an option is out first).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { cardFacts, hostOf } from "../src/lib/cardFacts";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";

async function demo() {
  const id = await loadDemoTrip();
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const result = await loadDecisions(trip, items);
  const facts = (name: string) => {
    const item = items.find((i) => i.name === name)!;
    const decision = [...result.decisions.values()].find((d) => d.options.some((o) => o.item.id === item.id));
    return cardFacts(item, decision, result.ctx);
  };
  return { facts };
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
    // The biggest plus and minus first, then a few more; each a word or three.
    expect(jardim.pros).toEqual(["Yakın", "Ücretsiz iptal", "Sessiz odalar", "Kahvaltı çok iyi"]);
    expect(jardim.cons.map((c) => c.text)).toEqual(["Odalar küçük", "€45 pahalı", "TV yok"]);
    for (const tag of [...jardim.pros, ...jardim.cons.map((c) => c.text)]) expect(tag.split(" ").length).toBeLessThanOrEqual(3);

    const casa = facts("Casa Azul");
    expect(casa.subtitle).toBe("Daire · 1 yatak odası");
    expect(casa.out).toBe(true);
    expect(casa.status).toEqual({ text: "Elendi", tone: "warning" });
    expect(casa.cons[0]).toEqual({ text: "Elendi: Yan binada inşaat var", strong: true });
    // Far by the comparison and weak location in the reviews: one tag, not two.
    expect(casa.cons.filter((c) => /Uzak|Konum/.test(c.text))).toHaveLength(1);
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
});
