// Hazırlık's "Telefonuna kur" (0.39.7, lib/phoneApps.ts): the table's apps by country and kind, the plan's ride apps,
// the eSIM providers instead of plan rows, the AI's lines, what's hidden.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acceptPhoneAi, phoneCount, phoneGroups, phoneSub, tripKinds, type PhoneInput, type PhoneTable } from "../src/lib/phoneApps";
import type { Item, Trip } from "../src/lib/types";

const table = JSON.parse(readFileSync("static/data/country-apps.json", "utf8")) as PhoneTable;
const names: Record<string, string> = { TH: "Tayland", VN: "Vietnam", JP: "Japonya", ID: "Endonezya", PT: "Portekiz" };
const input = (over: Partial<PhoneInput> = {}): PhoneInput => ({
  table,
  countries: ["TH"],
  countryName: (c) => names[c] ?? c,
  kinds: [],
  rides: [],
  days: 12,
  ai: null,
  hidden: [],
  lang: "tr",
  ...over,
});
const keys = (g: ReturnType<typeof phoneGroups>) => g.flatMap((x) => x.apps.map((a) => a.key));

describe("the table: a country's apps by kind, then the internet", () => {
  it("Thailand: Grab in the rides, the groups in their order, at most two a kind, store links real", () => {
    const groups = phoneGroups(input());
    expect(groups[0].key).toBe("ride");
    expect(groups[0].apps.map((a) => a.key)).toContain("grab");
    for (const g of groups) expect(g.apps.length).toBeLessThanOrEqual(2);
    const grab = groups[0].apps.find((a) => a.key === "grab")!;
    expect(grab.ios).toMatch(/^https:\/\/apps\.apple\.com\//);
    expect(grab.android).toMatch(/^https:\/\/play\.google\.com\//);
    expect(groups.at(-1)!.key).toBe("esim");
  });

  it("the eSIM providers say to pick the plan in the app, for the trip's days: no GB rows", () => {
    const esim = phoneGroups(input()).find((g) => g.key === "esim")!;
    expect(esim.apps.length).toBeGreaterThan(0);
    expect(esim.apps[0].why).toContain("12 günlük paketi uygulamada seç");
    expect(esim.apps.map((a) => a.why).join(" ")).not.toMatch(/\bGB\b/);
  });

  it("two countries: an app listed for one of them says where; each app once", () => {
    const groups = phoneGroups(input({ countries: ["TH", "JP"] }));
    const all = keys(groups);
    expect(new Set(all).size).toBe(all.length);
    const grab = groups.flatMap((g) => g.apps).find((a) => a.key === "grab");
    expect(grab?.where).toEqual(["Tayland"]);
  });

  it("a country the table doesn't have: nothing from it, no crash", () => {
    expect(phoneGroups(input({ countries: ["ZZ"] }))).toEqual([]);
  });

  it("an app said not for me stays out", () => {
    expect(keys(phoneGroups(input({ hidden: ["grab"] })))).not.toContain("grab");
  });
});

describe("the plan's ride apps and the trip's kinds", () => {
  it("an airport taxi's Uber leads the rides where the table lists it, once", () => {
    const rides = phoneGroups(input({ countries: ["PT"], rides: ["Uber"] })).find((g) => g.key === "ride")!;
    expect(rides.apps[0].name).toBe("Uber");
    expect(rides.apps.filter((a) => a.name === "Uber")).toHaveLength(1);
  });

  it("where the table knows the country and not the app (Uber in Thailand), the plan's Uber is left out", () => {
    expect(phoneGroups(input({ countries: ["TH"], rides: ["Uber"] })).flatMap((g) => g.apps).some((a) => a.name === "Uber")).toBe(false);
  });

  it("no country known: the plan's Uber comes with its reason", () => {
    const rides = phoneGroups(input({ countries: [], rides: ["Uber"] })).find((g) => g.key === "ride")!;
    expect(rides.apps[0].why).toContain("Havalimanı yolu için");
  });

  it("a hiking trip in Japan: the kind's group, Japan's own hiking app first", () => {
    const g = phoneGroups(input({ countries: ["JP"], kinds: ["hiking"] })).find((x) => x.key === "intent:hiking")!;
    expect(g.title).toContain("Doğa yürüyüşü");
    expect(g.apps[0].key).toBe("yamap");
  });

  it("the kinds are read from the playbook, the plan's names, the wants and a rental", () => {
    const trip = { title: "Bali", intent: { playbook: "festival" }, wants: { stays: ["camp"] } } as unknown as Trip;
    const items = [{ name: "Batur yanardağı gün doğumu yürüyüşü", category: "activity" }, { name: "Nusa Penida şnorkel turu", category: "activity" }] as unknown as Item[];
    const kinds = tripKinds(trip, items);
    expect(kinds).toEqual(expect.arrayContaining(["festival", "hiking", "diving", "camping", "offline-maps"]));
  });
});

describe("the AI's lines", () => {
  it("kept in the board's language, labelled, with a search, none the table has", () => {
    const ai = { lang: "tr", at: 1, list: [{ name: "Grab", cat: "ride", why: "x" }, { name: "Windy", cat: "intent", why: "Dalış günleri için rüzgâr ve dalga" }] };
    const g = phoneGroups(input({ ai })).find((x) => x.key === "ai")!;
    expect(g.apps.map((a) => a.name)).toEqual(["Windy"]);
    expect(g.apps[0].ai).toBe(true);
    expect(g.apps[0].search).toContain("google.com/search");
    expect(g.apps[0].ios).toBeNull();
    expect(phoneGroups(input({ ai, lang: "en" })).some((x) => x.key === "ai")).toBe(false);
  });

  it("the answer is trimmed: at most five, none empty, none twice", () => {
    const out = acceptPhoneAi({ apps: [...Array(7)].map((_, i) => ({ name: i === 1 ? "A0" : `A${i}`, cat: "other", why: "w" })).concat([{ name: " ", cat: "x", why: "w" }]) });
    expect(out?.map((a) => a.name)).toEqual(["A0", "A2", "A3", "A4", "A5"]);
    expect(acceptPhoneAi({ nope: 1 })).toBeNull();
  });
});

describe("the closed line", () => {
  it("says where, how many apps and the internet, and counts what's installed", () => {
    const groups = phoneGroups(input());
    expect(phoneSub(["Tayland"], groups)).toMatch(/^Tayland · \d+ uygulama \+ internet$/);
    const c = phoneCount(groups, ["grab"]);
    expect(c.done).toBe(1);
    expect(c.total).toBe(keys(groups).length);
  });
});
