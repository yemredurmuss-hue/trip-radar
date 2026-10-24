// The live offers source (src/lib/offerSources): what it asks the `offers` function for a need, what it keeps, and
// that a failure is simply no offers.
import { describe, expect, it } from "vitest";
import type { Need, Offer } from "../src/lib/offerSource";
import { cityTours, countryNeed, makeLiveSource, queryOf, tourWords, type StayCandidate } from "../src/lib/offerSources";
import { memoryKV } from "../src/lib/share/store";
import { sectionLooking } from "../src/lib/looking";

const flight: Need = { key: "f", section: "flight", kind: "flight", from: "İstanbul", to: "Denpasar", start: "2026-11-10", adults: 2 };
const stay: Need = { key: "s", section: "stay", kind: "stay", city: "Ubud", country: "ID", start: "2026-11-12", end: "2026-11-16", adults: 2 };
const offer = (id: string): Offer => ({ id, kind: "stay", title: "Maya Ubud", url: "https://tp.media/r?x", why: "", source: "Booking", fetchedAt: 1, price: 836 });

describe("the question for a need", () => {
  it("asks a flight by its airports (the codes given, else the table's) and day", () => {
    expect(queryOf(flight, "tr")).toBe("kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr");
    expect(queryOf({ ...flight, fromCode: "SAW" }, "en")).toContain("from=SAW");
    expect(queryOf({ ...flight, to: "Bilinmeyenköy" }, "tr")).toBeNull();
    expect(queryOf({ ...flight, start: null }, "tr")).toBeNull();
  });

  it("asks a stay by its place, its country by name, its nights and head-count", () => {
    expect(queryOf(stay, "tr")).toBe("kind=stay&city=Ubud&start=2026-11-12&end=2026-11-16&adults=2&lang=tr&country=Indonesia");
    expect(queryOf({ ...stay, country: null }, "tr")).not.toContain("country");
    expect(queryOf({ ...stay, end: "2026-11-12" }, "tr")).toBeNull();
    expect(queryOf({ ...stay, city: " " }, "tr")).toBeNull();
  });

  it("narrows when the chat asks for cheaper ones or a ceiling", () => {
    expect(queryOf(stay, "tr", { prefer: "cheap", max: 80.4 })).toBe("kind=stay&city=Ubud&start=2026-11-12&end=2026-11-16&adults=2&lang=tr&country=Indonesia&prefer=cheap&max=80");
    expect(queryOf(flight, "tr", { prefer: null, max: 0 })).toBe("kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr");
    expect(queryOf(flight, "tr", { prefer: "cheap", live: true })).toBe("kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr&prefer=cheap&live=1");
  });

  it("asks an activity by its city, the days when known and the card's own words", () => {
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: "Ubud" }, "tr")).toBe("kind=activity&city=Ubud&adults=1&lang=tr");
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: "Porto", start: "2026-10-08", end: "2026-10-11", adults: 2, query: "Tekne turu" }, "en")).toBe(
      "kind=activity&city=Porto&adults=2&lang=en&start=2026-10-08&end=2026-10-11&q=Tekne+turu",
    );
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: " " }, "tr")).toBeNull();
  });

  it("asks an eSIM by its country's code and the trip's days", () => {
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "pt", start: "2026-10-08", end: "2026-10-14" }, "tr")).toBe("kind=esim&country=PT&lang=tr&start=2026-10-08&end=2026-10-14");
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "ID" }, "en")).toBe("kind=esim&country=ID&lang=en");
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "Portugal" }, "tr")).toBeNull();
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: null }, "tr")).toBeNull();
  });

  it("asks a way between two cities by their names and head-count", () => {
    const t: Need = { key: "t", section: "transport", kind: "transfer", from: "Lizbon", to: "Porto", start: "2026-10-08", adults: 2 };
    expect(queryOf(t, "tr")).toBe("kind=transfer&from=Lizbon&to=Porto&adults=2&lang=tr");
    expect(queryOf({ ...t, to: "lizbon" }, "tr")).toBeNull();
    expect(queryOf({ ...t, from: null }, "tr")).toBeNull();
  });
});

describe("asking", () => {
  const answer = (offers: Offer[], ok = true) => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      return { ok, json: async () => ({ offers }) } as Response;
    }) as unknown as typeof fetch;
    return { calls, fetcher };
  };

  it("asks the server once, keeps the answer for hours, asks again after", async () => {
    const kv = memoryKV();
    let t = 1_000_000;
    const { calls, fetcher } = answer([offer("a")]);
    const src = makeLiveSource({ kv, fetcher, now: () => t, server: "https://srv" });
    expect(await src.offers(stay)).toHaveLength(1);
    expect(calls[0]).toBe("https://srv/functions/v1/offers?kind=stay&city=Ubud&start=2026-11-12&end=2026-11-16&adults=2&lang=tr&country=Indonesia");
    await src.offers(stay);
    expect(calls).toHaveLength(1);
    t += 7 * 36e5;
    await src.offers(stay);
    expect(calls).toHaveLength(2);
  });

  it("the chat's find asks the narrowed question, apart from the cards' own", async () => {
    const { calls, fetcher } = answer([offer("a")]);
    const src = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    await src.offers(stay);
    await src.find(stay, { prefer: "cheap" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("prefer=cheap");
  });

  it("asks a stay's candidates apart, a flight's never", async () => {
    const calls: string[] = [];
    const cand = { id: "xo:a", name: "A" } as StayCandidate;
    const fetcher = (async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({ offers: [offer("a")], candidates: [cand] }) } as Response;
    }) as unknown as typeof fetch;
    const src = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    expect(await src.candidates(stay)).toEqual([cand]);
    expect(calls[0].endsWith("&candidates=1")).toBe(true);
    expect(await src.candidates(flight)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("answers asked at once are all kept: a board opened again asks none of them (no write overwrites another's)", async () => {
    const kv = memoryKV();
    const { calls, fetcher } = answer([offer("a")]);
    const cities = ["Ubud", "Canggu", "Sidemen", "Amed"];
    const first = makeLiveSource({ kv, fetcher, server: "https://srv" });
    await Promise.all(cities.map((city) => first.offers({ ...stay, key: city, city })));
    expect(calls).toHaveLength(4);
    // The next page (a new source, the same storage): every answer read back, nothing asked again.
    const again = makeLiveSource({ kv, fetcher, server: "https://srv" });
    await Promise.all(cities.map((city) => again.offers({ ...stay, key: city, city })));
    expect(calls).toHaveLength(4);
  });

  it("two cards asking the same at once make one call", async () => {
    const { calls, fetcher } = answer([offer("a")]);
    const src = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    await Promise.all([src.offers(stay), src.offers({ ...stay, key: "other" })]);
    expect(calls).toHaveLength(1);
  });

  it("a failing or unconfigured server is no offers; a need it can't search asks nothing", async () => {
    const down = answer([], false);
    expect(await makeLiveSource({ kv: memoryKV(), fetcher: down.fetcher }).offers(stay)).toEqual([]);
    const thrown = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await makeLiveSource({ kv: memoryKV(), fetcher: thrown }).offers(stay)).toEqual([]);
    const idle = answer([offer("a")]);
    expect(await makeLiveSource({ kv: memoryKV(), fetcher: idle.fetcher }).offers({ ...stay, city: null })).toEqual([]);
    expect(idle.calls).toHaveLength(0);
  });
});

describe("a town the source doesn't know (Emre's Ahangama, 19 Ekim)", () => {
  const ahangama: Need = { key: "activity:ahangama", section: "activity", kind: "activity", city: "Ahangama", start: "2026-11-02", end: "2026-11-09", adults: 2 };
  const tour = (id: string): Offer => ({ id, kind: "activity", title: "Sörf dersi", url: "https://www.viator.com/t", why: "", source: "Viator", fetchedAt: 1 });

  it("asks again in the stay's country, by the town's name", () => {
    const wider = countryNeed(ahangama, "LK");
    expect(wider).toMatchObject({ city: "Sri Lanka", query: "Ahangama", country: null });
    expect(wider?.key).not.toBe(ahangama.key);
    expect(queryOf(wider!, "tr")).toBe("kind=activity&city=Sri+Lanka&adults=2&lang=tr&start=2026-11-02&end=2026-11-09&q=Ahangama");
    expect(countryNeed(ahangama, null)).toBeNull();
    expect(countryNeed({ ...ahangama, query: "Tekne turu" }, "LK")).toBeNull();
    expect(countryNeed({ ...ahangama, city: "Singapore" }, "SG")).toBeNull();
  });

  it("an empty answer brings the second question; none without a country, none when the first has tours", async () => {
    const asked: Need[] = [];
    const empty = { offers: async (n: Need) => (asked.push(n), n.query ? [tour("v1")] : []) };
    expect((await cityTours(empty, ahangama, "LK")).map((o) => o.id)).toEqual(["v1"]);
    // One of its own is few: the country's popular ones are asked too (none here).
    expect(asked.map((n) => [n.city, n.query ?? null])).toEqual([["Ahangama", null], ["Sri Lanka", "Ahangama"], ["Sri Lanka", null]]);

    asked.length = 0;
    expect(await cityTours(empty, ahangama, null)).toEqual([]);
    expect(asked).toHaveLength(1);

    asked.length = 0;
    const many = ["v2", "v3", "v4", "v5"].map((id, i) => ({ ...tour(id), title: `Tur ${i}`, url: `https://www.viator.com/${id}` }));
    const full = { offers: async (n: Need) => (asked.push(n), [...many, { ...tour("h"), kind: "stay" as const }]) };
    expect((await cityTours(full, ahangama, "LK")).map((o) => o.id)).toEqual(["v2", "v3", "v4", "v5"]);
    expect(asked).toHaveLength(1);

    const failing = { offers: async () => Promise.reject(new Error("down")) };
    expect(await cityTours(failing, ahangama, "LK")).toEqual([]);
  });

  it("few of its own: the trip's nearby cities and the country's popular tours join the town's row, once each, saying where (0.38.4)", async () => {
    const asked: Need[] = [];
    const by: Record<string, Offer[]> = {
      "Ahangama|": [],
      "Sri Lanka|Ahangama": [{ ...tour("surf"), title: "Ahangama sörf dersi", url: "https://www.viator.com/surf" }],
      "Colombo|": [
        { ...tour("cmb"), title: "Colombo yemek turu", url: "https://www.viator.com/cmb" },
        { ...tour("surf"), title: "Ahangama sörf dersi", url: "https://www.viator.com/surf" },
      ],
      "Sri Lanka|": [
        { ...tour("galle"), title: "Galle kalesi yürüyüşü", url: "https://www.viator.com/galle" },
        { ...tour("cmb2"), title: "Colombo Yemek Turu", url: "https://www.viator.com/cmb2" },
      ],
    };
    const source = { offers: async (n: Need) => (asked.push(n), by[`${n.city}|${n.query ?? ""}`] ?? []) };
    const near = [{ city: "Colombo", label: "Kolombo" }, { city: "Ahangama", label: "Ahangama" }];
    const list = await cityTours(source, ahangama, "LK", near);
    // The town's own first, then Kolombo's, then the country's; the same tour (by id, page or name) once.
    expect(list.map((o) => [o.id, o.place])).toEqual([["surf", "Ahangama"], ["cmb", "Kolombo"], ["galle", "Sri Lanka"]]);
    // The town itself isn't asked twice; a nearby city is asked in the country, by no words.
    expect(asked.map((n) => [n.city, n.query ?? null, n.country ?? null])).toEqual([
      ["Ahangama", null, null], ["Sri Lanka", "Ahangama", null], ["Colombo", null, "LK"], ["Sri Lanka", null, null],
    ]);
    expect(new Set(asked.map((n) => n.key)).size).toBe(asked.length);

    // A card that names its kind ("Sörf dersi") stays with what it asked for; no country, no wider question.
    asked.length = 0;
    await cityTours(source, { ...ahangama, query: "Sörf dersi" }, "LK", near);
    expect(asked.map((n) => n.city)).toEqual(["Ahangama"]);
    asked.length = 0;
    await cityTours(source, ahangama, null, []);
    expect(asked.map((n) => n.city)).toEqual(["Ahangama"]);
  });

  it("the trip's kind and style ask the source by their words, its tours first (0.38.5: a surf trip gets surf lessons)", async () => {
    expect(tourWords({ intent: { playbook: "custom", label: "Sörf tatili" }, style: { key: "k", ids: ["nature", "beach"] } })).toEqual(["surf", "safari", "hiking"]);
    expect(tourWords({ intent: { playbook: "custom", label: "Dalış gezisi" }, style: null })).toEqual(["diving"]);
    expect(tourWords({ intent: { playbook: "ski", label: null }, style: null })).toEqual(["ski"]);
    expect(tourWords({ intent: null, style: { key: "k", ids: ["luxury", "city"] } })).toEqual([]);
    expect(tourWords(null)).toEqual([]);

    // A town the source knows: the town by "surf"; the trip's kind first, the town's own after, once each.
    const asked: Need[] = [];
    const weligama: Need = { ...ahangama, key: "activity:weligama", city: "Weligama" };
    const by: Record<string, Offer[]> = {
      "Weligama|": [1, 2, 3, 4].map((i) => ({ ...tour(`w${i}`), title: `Weligama turu ${i}`, url: `https://www.viator.com/w${i}` })),
      "Weligama|surf": [{ ...tour("s1"), title: "Weligama sörf dersi", url: "https://www.viator.com/s1" }, { ...tour("w1"), title: "Weligama turu 1", url: "https://www.viator.com/w1" }],
      "Weligama|safari": [{ ...tour("y1"), title: "Yala safari", url: "https://www.viator.com/y1" }],
    };
    const source = { offers: async (n: Need) => (asked.push(n), by[`${n.city}|${n.query ?? ""}`] ?? []) };
    const list = await cityTours(source, weligama, "LK", [], ["surf", "safari"]);
    expect(list.map((o) => o.id)).toEqual(["s1", "w1", "y1", "w2", "w3", "w4"]);
    expect(asked.map((n) => [n.city, n.query ?? null])).toEqual([["Weligama", null], ["Weligama", "surf"], ["Weligama", "safari"]]);
    expect(queryOf(asked[1], "tr")).toContain("&q=surf");

    // A town it doesn't know (Ahangama): its country by the town's name and the word; only Viator's answers, none made up.
    asked.length = 0;
    const lk: Record<string, Offer[]> = { "Sri Lanka|surf Ahangama": [{ ...tour("s2"), title: "Ahangama surf camp", url: "https://www.viator.com/s2" }] };
    const wide = { offers: async (n: Need) => (asked.push(n), lk[`${n.city}|${n.query ?? ""}`] ?? []) };
    expect((await cityTours(wide, ahangama, "LK", [], ["surf"])).map((o) => [o.id, o.place])).toEqual([["s2", "Ahangama"]]);
    expect(asked.map((n) => [n.city, n.query ?? null])).toEqual([["Ahangama", null], ["Sri Lanka", "Ahangama"], ["Sri Lanka", "surf Ahangama"], ["Sri Lanka", null]]);
    expect(new Set(asked.map((n) => n.key)).size).toBe(asked.length);
  });
});

describe("a question that goes to the server marks its category while it is out (the Plan row's search)", () => {
  it("a stay's offers mark Konaklama until they answer, a failure too; an answer kept from before marks nothing", async () => {
    let release: () => void = () => undefined;
    let asked: () => void = () => undefined;
    const sent = new Promise<void>((resolve) => (asked = resolve));
    const answered = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const fetcher = (async () => (calls++, asked(), await answered, { ok: true, json: async () => ({ offers: [offer("a")] }) } as Response)) as unknown as typeof fetch;
    const kv = memoryKV();
    const src = makeLiveSource({ kv, fetcher, now: () => 1, server: "https://srv" });
    const first = src.offers(stay);
    await sent;
    expect(sectionLooking.has("stay")).toBe(true);
    expect(sectionLooking.has("flight")).toBe(false);
    release();
    await first;
    await Promise.resolve();
    expect(sectionLooking.has("stay")).toBe(false);
    // (opened again: the same question, kept, never goes out: no search, no motion)
    const again = src.offers(stay);
    expect(sectionLooking.has("stay")).toBe(false);
    await again;
    expect(calls).toBe(1);
  });
});
