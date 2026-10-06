// The hero photo's picking (supabase/functions/city-image/pick.ts) and its credit (cityImages.ts), 2026-10-07.
import { describe, expect, it } from "vitest";
import { cacheKey, keyOf, pexelsSearchUrl, pickPexels, pickUnsplash, publicAnswer, unsplashSearchUrl } from "../supabase/functions/city-image/pick";
import { creditLine, creditOf, keptCredits, proxyCredit, proxyQuery } from "../src/lib/cityImages";
import { eventPhotoQuery } from "../src/lib/startTrip";

const unsplash = (id: string, likes: number) => ({
  likes,
  urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=abc&ixlib=rb-4.0.3` },
  user: { name: `U${id}`, links: { html: `https://unsplash.com/@u${id}` } },
  links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download?ixid=abc` },
});
const pexels = (id: number, width: number, height: number) => ({
  id,
  width,
  height,
  url: `https://www.pexels.com/photo/x-${id}/`,
  photographer: `P${id}`,
  photographer_url: `https://www.pexels.com/@p${id}`,
  src: { original: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg` },
});

describe("city-image picking", () => {
  it("asks 10 landscape answers of each, and keys the cache by version and every search", () => {
    expect(unsplashSearchUrl("Ozora Festival")).toBe("https://api.unsplash.com/search/photos?query=Ozora%20Festival&orientation=landscape&per_page=10&content_filter=high");
    expect(pexelsSearchUrl("Ella Sri Lanka")).toBe("https://api.pexels.com/v1/search?query=Ella%20Sri%20Lanka&orientation=landscape&per_page=10");
    expect(cacheKey([" Madeira  Island "])).toBe("v2:madeira island");
    expect(cacheKey(["Ozora", "Ozora festival"])).toBe("v2:ozora|ozora festival");
  });

  it("takes Unsplash's most liked, at 2400 px with ixid kept, credited with the UTM", () => {
    const p = pickUnsplash([unsplash("a", 3), unsplash("b", 90), unsplash("c", 90)])!;
    expect(p.url).toBe("https://images.unsplash.com/photo-b?ixid=abc&ixlib=rb-4.0.3&w=2400&q=80&auto=format");
    expect(p).toMatchObject({ by: "Ub", source: "unsplash", author_url: "https://unsplash.com/@ub?utm_source=trip_radar&utm_medium=referral" });
    expect(p.photo_page).toBe("https://unsplash.com/photos/b?utm_source=trip_radar&utm_medium=referral");
    expect(p.download_location).toBe("https://api.unsplash.com/photos/b/download?ixid=abc");
    // The download address stays on the server.
    expect(publicAnswer(p)).not.toHaveProperty("download_location");
    expect(pickUnsplash([])).toBeNull();
    expect(pickUnsplash(undefined)).toBeNull();
  });

  it("takes the widest landscape of Pexels' first five, its original at 2400 px", () => {
    const p = pickPexels([pexels(1, 4000, 2600), pexels(2, 3000, 6000), pexels(3, 6000, 4000), pexels(4, 5000, 3000), pexels(5, 4500, 3000), pexels(6, 9000, 5000)])!;
    expect(p.url).toBe("https://images.pexels.com/photos/3/pexels-photo-3.jpeg?auto=compress&cs=tinysrgb&w=2400");
    expect(p).toMatchObject({ by: "P3", source: "pexels", author_url: "https://www.pexels.com/@p3", photo_page: "https://www.pexels.com/photo/x-3/" });
    expect(pickPexels([])).toBeNull();
  });

  it("reads a key pasted with its name", () => {
    const key = "Ab3_d-".repeat(8);
    expect(keyOf(`UNSPLASH_ACCESS_KEY="${key}"\n`)).toBe(key);
    expect(keyOf("")).toBe("");
  });
});

describe("the event's photo searches", () => {
  it("searches the event, then '<name> festival', then the feeling of it", () => {
    expect(eventPhotoQuery("Fusion", true)).toEqual({ query: "Fusion", titles: ["Fusion"], alt: ["Fusion festival", "music festival crowd stage"] });
    expect(eventPhotoQuery("Ozora", true).query).toBe("Ozora Festival");
    expect(eventPhotoQuery("Sardine Night", false).alt).toEqual(["Sardine Night festival", "festival crowd celebration"]);
    // Already a festival: not said twice; the table's English name.
    expect(eventPhotoQuery("Glastonbury Festivali", true).query).toBe("Glastonbury Festival");
    expect(eventPhotoQuery("Glastonbury Festivali", true).alt).toEqual(["music festival crowd stage"]);
  });
  it("sends the searches after the first to the proxy", () => {
    expect(proxyQuery("https://s/functions/v1/city-image", "Ozora", ["Ozora festival"])).toBe("https://s/functions/v1/city-image?q=Ozora&alt=Ozora%20festival");
    expect(proxyQuery("https://s/f", "Ella Sri Lanka")).toBe("https://s/f?q=Ella%20Sri%20Lanka");
  });
});

describe("the hero's photo credit", () => {
  it("reads the proxy's answer; an older one with only a name is Pexels'", () => {
    expect(proxyCredit({ url: "u", by: "Ann", source: "unsplash", author_url: "https://unsplash.com/@ann", photo_page: null })).toEqual({
      by: "Ann",
      source: "unsplash",
      authorUrl: "https://unsplash.com/@ann",
      photoPage: null,
    });
    expect(proxyCredit({ url: "u", by: "Bo" })?.source).toBe("pexels");
    expect(proxyCredit({ url: "u" })).toBeNull();
  });

  it("says 'Fotoğraf: <Ad> / Unsplash', both linked, Unsplash's with the UTM", () => {
    const line = creditLine({ by: "Ann", source: "unsplash", authorUrl: "https://unsplash.com/@ann", photoPage: "https://unsplash.com/photos/x" });
    expect(line.label).toBe("Fotoğraf:");
    expect(line.by).toEqual({ text: "Ann", href: "https://unsplash.com/@ann?utm_source=trip_radar&utm_medium=referral" });
    expect(line.source).toEqual({ text: "Unsplash", href: "https://unsplash.com/?utm_source=trip_radar&utm_medium=referral" });
    const px = creditLine({ by: "Bo", source: "pexels", authorUrl: "https://www.pexels.com/@bo", photoPage: "https://www.pexels.com/photo/1/" });
    expect(px.source).toEqual({ text: "Pexels", href: "https://www.pexels.com/photo/1/" });
    expect(px.by?.href).toBe("https://www.pexels.com/@bo");
  });

  it("credits a photo stored without one from its address", () => {
    expect(creditOf("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Funchal.jpg/1280px-Funchal.jpg")).toMatchObject({ source: "wikipedia", by: null });
    expect(creditLine(creditOf("https://upload.wikimedia.org/x/Funchal.jpg")!).source.text).toBe("Wikipedia");
    expect(creditOf("https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?auto=compress")).toMatchObject({
      source: "pexels",
      photoPage: "https://www.pexels.com/photo/2014422/",
    });
    expect(creditOf("https://cf.bstatic.com/hotel.jpg")).toBeNull();
    const stored = { by: "Ann", source: "unsplash" as const, authorUrl: null, photoPage: null };
    expect(creditOf("https://images.unsplash.com/photo-1", { "https://images.unsplash.com/photo-1": stored })).toBe(stored);
  });

  it("keeps only the credits of the photos the trip still shows", () => {
    const c = { by: "A", source: "pexels" as const, authorUrl: null, photoPage: null };
    const t = { heroImage: "h", cityImages: { x: "n", y: null }, photoCredits: { h: c, old: c } };
    expect(keptCredits(t, [{ url: "n", credit: c }, null])).toEqual({ h: c, n: c });
    expect(keptCredits({ heroImage: null }, [])).toBeUndefined();
  });
});
