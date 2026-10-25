// The cover's photo, chosen (lib/coverPhoto.ts): Commons' wide photos beside the stock one, the model's look; whenever it
// can't choose, the old way (the stock photo, else Wikipedia's) as it was.
import { describe, expect, it } from "vitest";
import { findCityPhoto, lookAgainAtCover, wantsCityImage, nextHeroImage } from "../src/lib/cityImages";
import { chooseCover, commonsCandidates, coverQuestion, stockThumb, type CoverCandidate } from "../src/lib/coverPhoto";

const page = (title: string, w: number, h: number, mime = "image/jpeg", index = 1) => ({
  title, index,
  imageinfo: [{ width: w, height: h, mime, thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${encodeURIComponent(title)}/1920px-x.jpg?utm=1`, descriptionurl: `https://commons.wikimedia.org/wiki/${title}`, extmetadata: { Artist: { value: '<a href="x">Jane Doe</a>' } } }],
});
const commonsAnswer = { query: { pages: {
  a: page("File:Ozora stage.jpg", 4256, 2140, "image/jpeg", 1),
  b: page("File:Ozora logo.jpg", 3000, 1500, "image/jpeg", 2),
  c: page("File:Ozora small.jpg", 1200, 800, "image/jpeg", 3),
  d: page("File:Ozora tall.jpg", 2400, 3600, "image/jpeg", 4),
  e: page("File:Ozora drawing.png", 4000, 2000, "image/png", 5),
  f: page("File:Ozora dragon.jpg", 3968, 2976, "image/jpeg", 6),
} } };

describe("commonsCandidates", () => {
  it("wide JPEG landscapes only, in Commons' order, never a logo; credited to the author, linked to the file", async () => {
    const list = await commonsCandidates("Ozora festival", async () => commonsAnswer);
    expect(list.map((c) => c.credit?.photoPage)).toEqual(["https://commons.wikimedia.org/wiki/File:Ozora stage.jpg", "https://commons.wikimedia.org/wiki/File:Ozora dragon.jpg"]);
    expect(list[0].credit).toMatchObject({ by: "Jane Doe", source: "commons" });
    expect(list[0].url).not.toContain("?");
    expect(list[0].thumb).toContain("/500px-");
  });
});

describe("chooseCover", () => {
  const cands: CoverCandidate[] = [
    { url: "https://images.unsplash.com/a", thumb: "https://t/a", credit: null },
    { url: "https://upload.wikimedia.org/b", thumb: "https://t/b", credit: null },
  ];
  const jpeg = (async () => new Response(new Uint8Array([255, 216, 255]), { headers: { "content-type": "image/jpeg" } })) as unknown as typeof fetch;
  it("the model's pick", async () => {
    expect((await chooseCover("Ozora", cands, async () => 2, jpeg))?.url).toBe("https://upload.wikimedia.org/b");
  });
  it("no judge, none fit, an error, a number out of range: null (the old way)", async () => {
    expect(await chooseCover("Ozora", cands, null, jpeg)).toBeNull();
    expect(await chooseCover("Ozora", cands, async () => null, jpeg)).toBeNull();
    expect(await chooseCover("Ozora", cands, async () => { throw new Error("no key"); }, jpeg)).toBeNull();
    expect(await chooseCover("Ozora", cands, async () => 7, jpeg)).toBeNull();
  });
  it("a photo that won't load as a JPEG/PNG isn't looked at", async () => {
    const webp = (async () => new Response(new Uint8Array([1]), { headers: { "content-type": "image/webp" } })) as unknown as typeof fetch;
    expect(await chooseCover("Ozora", cands, async () => 1, webp)).toBeNull();
  });
});

describe("findCityPhoto with the cover's look", () => {
  const proxy = { url: "https://srv/functions/v1/city-image", headers: {} };
  const fetchJson = async (url: string) => (url.includes("city-image") ? { url: "https://images.unsplash.com/photo-1?w=2400", source: "unsplash" } : url.includes("commons.wikimedia.org") ? commonsAnswer : null);
  const jpeg = (async () => new Response(new Uint8Array([255, 216, 255]), { headers: { "content-type": "image/jpeg" } })) as unknown as typeof fetch;
  it("the model picks Commons' stage over the stock photo", async () => {
    const found = await findCityPhoto("Ozora", { proxy, fetchJson, judge: async () => 2, fetchImage: jpeg });
    expect(found?.url).toContain("upload.wikimedia.org");
    expect(found?.credit?.source).toBe("commons");
  });
  it("it can't choose: the stock photo, as before", async () => {
    const found = await findCityPhoto("Ozora", { proxy, fetchJson, judge: async () => { throw new Error("no key"); }, fetchImage: jpeg });
    expect(found?.url).toContain("images.unsplash.com");
  });
  it("no judge: Commons isn't asked at all", async () => {
    const asked: string[] = [];
    await findCityPhoto("Ozora", { proxy, fetchJson: async (u: string) => (asked.push(u), fetchJson(u)) });
    expect(asked.some((u) => u.includes("commons"))).toBe(false);
  });
});

describe("a chosen Commons cover stays", () => {
  it("isn't asked again as an old Wikipedia picture, and takes the hero's place", () => {
    const url = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/x.jpg/1920px-x.jpg";
    expect(wantsCityImage(url, true, { by: null, source: "commons", authorUrl: null, photoPage: null })).toBe(false);
    expect(wantsCityImage(url, true, { by: null, source: "wikipedia", authorUrl: null, photoPage: null })).toBe(true);
    expect(nextHeroImage("https://upload.wikimedia.org/old.jpg", url, true)).toBe(url);
  });
});

describe("stockThumb", () => {
  it("Unsplash's small copy as a JPEG", () => {
    const u = new URL(stockThumb("https://images.unsplash.com/photo-1?w=2400&auto=format&q=80"));
    expect([u.searchParams.get("fm"), u.searchParams.get("w"), u.searchParams.get("auto")]).toEqual(["jpg", "500", null]);
  });
});

describe("lookAgainAtCover: the plan's one look at a cover", () => {
  const proxy = { url: "https://srv/functions/v1/city-image", headers: {} };
  const fetchJson = async (url: string) => (url.includes("city-image") ? { url: "https://images.unsplash.com/photo-1?w=2400", source: "unsplash" } : url.includes("commons.wikimedia.org") ? commonsAnswer : null);
  const jpeg = (async () => new Response(new Uint8Array([255, 216, 255]), { headers: { "content-type": "image/jpeg" } })) as unknown as typeof fetch;
  it("the photo there now among the others; the model's pick comes back, answered", async () => {
    const r = await lookAgainAtCover("Ozora", "https://images.unsplash.com/photo-1?w=2400", { proxy, judge: async () => 2, fetchJson, fetchImage: jpeg });
    expect(r.answered).toBe(true);
    expect(r.pick?.credit?.source).toBe("commons");
  });
  it("tells the model photo 1 is the cover now, and that an event is seen happening", async () => {
    let seen: unknown = null;
    await lookAgainAtCover("Boom Festival", "https://images.unsplash.com/photo-9?w=2400", { proxy, judge: async (_s, _p, how) => ((seen = how), 1), fetchJson, fetchImage: jpeg, event: true });
    expect(seen).toEqual({ event: true, current: true });
  });
  it("the question keeps the cover there now unless another is clearly better; a place gets no event line", () => {
    const q = coverQuestion("Boom Festival", 4, { event: true, current: true });
    expect(q).toMatch(/Photo 1 is the cover now: answer 1 unless/);
    expect(q).toMatch(/is an event: choose it happening/);
    expect(coverQuestion("Lisbon", 3, { current: true })).not.toMatch(/event/);
    expect(coverQuestion("Lisbon", 3)).toBe('Photos 1 to 3, found for "Lisbon". Which one is its cover?');
  });
  it("no key or an error: not answered, nothing picked (the photo there stays, asked again another time)", async () => {
    const r = await lookAgainAtCover("Ozora", "https://images.unsplash.com/photo-1?w=2400", { proxy, judge: async () => { throw new Error("429"); }, fetchJson, fetchImage: jpeg });
    expect(r).toEqual({ answered: false, pick: null });
  });
});
