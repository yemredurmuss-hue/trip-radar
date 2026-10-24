// Benle gezen eklenti, seviye 1 (lib/candidateTabs.ts): the deck's best candidates in one tab group named for the route,
// each tab's icon "2/3"; bought in one and closed, the plan asks "Aldın mı?". Only the tabs we opened; nothing read.
import { beforeEach, describe, expect, it } from "vitest";
import { ASK_BOUGHT, badgeOf, candidateClosed, candidateOf, markBuying, openCandidates } from "../src/lib/candidateTabs";

type Store = Record<string, unknown>;
let session: Store, local: Store, created: { url: string; active: boolean }[], grouped: { tabIds: number[] }[], titled: { id: number; title: string; color: string }[], badges: Record<number, string>;
const area = (box: () => Store) => ({
  get: async (k: string) => ({ [k]: box()[k] }),
  set: async (o: Store) => void Object.assign(box(), o),
  remove: async (k: string) => void delete box()[k],
});

beforeEach(() => {
  session = {};
  local = {};
  created = [];
  grouped = [];
  titled = [];
  badges = {};
  let id = 100;
  (globalThis as { chrome?: unknown }).chrome = {
    storage: { session: area(() => session), local: area(() => local) },
    tabs: {
      create: async (o: { url: string; active: boolean }) => (created.push(o), { id: ++id }),
      group: async (o: { tabIds: number[] }) => (grouped.push(o), 7),
    },
    tabGroups: { update: async (gid: number, o: { title: string; color: string }) => void titled.push({ id: gid, ...o }) },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async (o: { tabId: number; text: string }) => void (badges[o.tabId] = o.text), setTitle: async () => {} },
  };
});

const links = [
  { itemId: "tk", url: "https://www.turkishairlines.com/tk69", name: "Turkish Airlines", price: "€326" },
  { itemId: "qr", url: "https://www.kiwi.com/qr833", name: "Qatar Airways", price: "€354" },
  { itemId: "pc", url: "notaurl", name: "Pegasus", price: null },
  { itemId: "ek", url: "https://www.kiwi.com/ek373", name: "Emirates", price: "€288" },
  { itemId: "tg", url: "https://www.skyscanner.com/tg", name: "Thai", price: null },
];

describe("openCandidates", () => {
  it("the best three with a page, one group named for the route, the first in front, each tab its place", async () => {
    const n = await openCandidates({ tripId: "th", intentKey: "flight:bkk-ist", route: "Bangkok ✈ İstanbul" }, links);
    expect(n).toBe(3);
    expect(created.map((c) => c.url)).toEqual([links[0].url, links[1].url, links[3].url]);
    expect(created.map((c) => c.active)).toEqual([true, false, false]);
    expect(grouped[0].tabIds).toEqual([101, 102, 103]);
    expect(titled[0]).toEqual({ id: 7, title: "Bangkok ✈ İstanbul", color: "purple", collapsed: false });
    expect(badges).toEqual({ 101: "1/3", 102: "2/3", 103: "3/3" });
    expect(await candidateOf(102)).toMatchObject({ itemId: "qr", n: 2, of: 3, tripId: "th", route: "Bangkok ✈ İstanbul" });
    expect(badgeOf({ n: 2, of: 3 })).toBe("2/3");
  });
  it("closed: forgotten; bought there, the plan is asked", async () => {
    await openCandidates({ tripId: "th", intentKey: "k", route: "R" }, links);
    await candidateClosed(101);
    expect(await candidateOf(101)).toBeNull();
    expect(local[ASK_BOUGHT]).toBeUndefined();
    await markBuying(102);
    await candidateClosed(102);
    expect(local[ASK_BOUGHT]).toMatchObject({ itemId: "qr", tripId: "th" });
  });
  it("nothing to open, nothing opened", async () => {
    expect(await openCandidates({ tripId: "th", intentKey: "k", route: "R" }, [links[2]])).toBe(0);
    expect(created).toEqual([]);
  });
});
