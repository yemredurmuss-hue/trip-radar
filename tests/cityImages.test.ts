import { afterEach, describe, expect, it, vi } from "vitest";
import { imageProxy, isPhoto, isWikiImage, NetworkError, nextCityImage, nextHeroImage, pickCityImage, sized, wantsCityImage } from "../src/lib/cityImages";

describe("city images", () => {
  it("rejects flags, coats of arms, maps and svg", () => {
    expect(isPhoto("https://upload.wikimedia.org/x/Flag_of_Madeira.svg.png")).toBe(false);
    expect(isPhoto("https://upload.wikimedia.org/x/Coat_of_arms_of_Porto.png")).toBe(false);
    expect(isPhoto("https://upload.wikimedia.org/x/Madeira_locator_map.png")).toBe(false);
    expect(isPhoto("https://upload.wikimedia.org/x/Funchal_(_Portugal_)13.jpg")).toBe(true);
  });
  it("does not throw on a malformed percent escape", () => {
    expect(isPhoto("https://upload.wikimedia.org/x/100%_Funchal.jpg")).toBe(true);
    expect(isPhoto("https://upload.wikimedia.org/x/100%_flag.jpg")).toBe(false);
  });
  it("uses the proxy first, then Wikipedia's summary, then its media list", async () => {
    const calls: string[] = [];
    const inits: (RequestInit | undefined)[] = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push(url);
      inits.push(init);
      if (url.includes("proxy")) return null;
      if (url.includes("/summary/")) return { originalimage: { source: "https://u/Flag_of_Madeira.svg.png" } };
      if (url.includes("/media-list/")) return { items: [{ type: "image", title: "File:Map.png", srcset: [{ src: "//u/Map.png" }] }, { type: "image", title: "File:Levada.jpg", srcset: [{ src: "//u/Levada.jpg" }] }] };
      return null;
    };
    expect(await pickCityImage("Madeira", { fetchJson: fetcher, proxy: { url: "https://proxy/x", headers: { apikey: "k" } } })).toBe("https://u/Levada.jpg");
    expect(calls[0]).toContain("proxy");
    expect(inits[0]).toEqual({ headers: { apikey: "k" } });
    // The key goes to the sharing server only, never to Wikipedia.
    expect(calls.length).toBeGreaterThan(1);
    for (let i = 1; i < calls.length; i++) expect(inits[i]).toBeUndefined();
  });
});

describe("image proxy", () => {
  afterEach(() => vi.unstubAllGlobals());
  const withConfig = (store: Record<string, string>) => vi.stubGlobal("chrome", { storage: { local: { get: async (k: string) => ({ [k]: store[k] }) } } });
  it("is null with a server of one's own but no key; with none at all, Trip Radar's own server (0.36.3)", async () => {
    withConfig({ shareUrl: "https://abc.supabase.co" });
    expect(await imageProxy()).toBeNull();
    withConfig({ shareKey: "sb_publishable_x" });
    expect(await imageProxy()).toEqual({ url: "https://zjkesdsbructiyflzqvq.supabase.co/functions/v1/city-image", headers: { apikey: "sb_publishable_HotkmMyo4PGggsarTsiVZQ_eOSUlhS0" } });
  });
  it("sends apikey; legacy JWT keys also as Bearer", async () => {
    withConfig({ shareUrl: "https://abc.supabase.co", shareKey: "sb_publishable_x" });
    expect(await imageProxy()).toEqual({ url: "https://abc.supabase.co/functions/v1/city-image", headers: { apikey: "sb_publishable_x" } });
    withConfig({ shareUrl: "https://abc.supabase.co", shareKey: "eyJabc" });
    expect((await imageProxy())?.headers).toEqual({ apikey: "eyJabc", Authorization: "Bearer eyJabc" });
  });
});

describe("city image size", () => {
  const thumb = (w: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Porto.jpg/${w}px-Porto.jpg`;
  it("asks Wikimedia thumbnails for 1280 px", () => {
    expect(sized(thumb(330))).toBe(thumb(1280));
    expect(sized(thumb(3840))).toBe(thumb(1280));
    expect(sized("https://upload.wikimedia.org/wikipedia/commons/2/27/Porto.jpg")).toBe("https://upload.wikimedia.org/wikipedia/commons/2/27/Porto.jpg");
    expect(sized("https://images.pexels.com/photos/1/p.jpeg?w=940")).toBe("https://images.pexels.com/photos/1/p.jpeg?w=940");
  });
  it("prefers the summary's thumbnail at 1280 over a full-size original", async () => {
    const fetcher = async (url: string) =>
      url.includes("/summary/") ? { originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/2/27/Porto.jpg" }, thumbnail: { source: thumb(330) } } : null;
    expect(await pickCityImage("Porto", { fetchJson: fetcher })).toBe(thumb(1280));
  });
  it("resizes an original that is itself a thumbnail URL, and media-list picks", async () => {
    const summary = async (url: string) => (url.includes("/summary/") ? { originalimage: { source: thumb(3840) }, thumbnail: { source: thumb(330) } } : null);
    expect(await pickCityImage("Porto", { fetchJson: summary })).toBe(thumb(1280));
    const media = async (url: string) =>
      url.includes("/media-list/") ? { items: [{ type: "image", title: "File:Porto.jpg", srcset: [{ src: "//upload.wikimedia.org/wikipedia/commons/thumb/2/27/Porto.jpg/500px-Porto.jpg" }] }] } : null;
    expect(await pickCityImage("Porto", { fetchJson: media })).toBe(thumb(1280));
  });
});

describe("city image outages", () => {
  it("throws NetworkError when a request got no answer and no photo was found", async () => {
    const fetcher = async () => {
      throw new NetworkError();
    };
    await expect(pickCityImage("Porto", { fetchJson: fetcher })).rejects.toBeInstanceOf(NetworkError);
  });
  it("still returns a photo found despite one failed request", async () => {
    const fetcher = async (url: string) => {
      if (url.includes("proxy")) throw new NetworkError();
      return url.includes("/summary/") ? { originalimage: { source: "https://u/Porto.jpg" } } : null;
    };
    expect(await pickCityImage("Porto", { fetchJson: fetcher, proxy: { url: "https://proxy/x", headers: {} } })).toBe("https://u/Porto.jpg");
  });
  it("returns null (a real miss) when every request answered without a photo", async () => {
    expect(await pickCityImage("Nowhere", { fetchJson: async () => null })).toBeNull();
  });
  it("the default fetch: a non-OK answer is a miss, a thrown fetch is an outage", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    expect(await pickCityImage("Nowhere")).toBeNull();
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(pickCityImage("Nowhere")).rejects.toBeInstanceOf(NetworkError);
    vi.unstubAllGlobals();
  });
});

describe("city photos asked again once the proxy works", () => {
  const wiki = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Porto.jpg/1280px-Porto.jpg";
  const pexels = "https://images.pexels.com/photos/1/porto.jpeg";
  it("knows a Wikipedia picture by its host", () => {
    expect(isWikiImage(wiki)).toBe(true);
    expect(isWikiImage("https://tr.wikipedia.org/x.jpg")).toBe(true);
    expect(isWikiImage(pexels)).toBe(false);
    expect(isWikiImage("not a url")).toBe(false);
    expect(isWikiImage(null)).toBe(false);
  });
  it("never asked: always; a miss or a Wikipedia picture: only with the proxy; a proxy photo: never", () => {
    expect(wantsCityImage(undefined, false)).toBe(true);
    expect(wantsCityImage(null, false)).toBe(false);
    expect(wantsCityImage(wiki, false)).toBe(false);
    expect(wantsCityImage(null, true)).toBe(true);
    expect(wantsCityImage(wiki, true)).toBe(true);
    expect(wantsCityImage(pexels, true)).toBe(false);
  });
  it("a miss keeps the old picture; a first miss is stored as none", () => {
    expect(nextCityImage(wiki, pexels)).toBe(pexels);
    expect(nextCityImage(wiki, null)).toBe(wiki);
    expect(nextCityImage(undefined, null)).toBeNull();
    expect(nextCityImage(null, null)).toBeNull();
  });
  it("the trip card's picture follows the first city's new photo, never a page photo or a better one", () => {
    expect(nextHeroImage(wiki, pexels)).toBe(pexels);
    expect(nextHeroImage(null, pexels)).toBe(pexels);
    expect(nextHeroImage(null, wiki)).toBe(wiki);
    expect(nextHeroImage(wiki, null)).toBe(wiki);
    expect(nextHeroImage(pexels, "https://images.pexels.com/photos/2/other.jpeg")).toBe(pexels);
    expect(nextHeroImage("https://hotel.example/room.jpg", pexels)).toBe("https://hotel.example/room.jpg");
    expect(nextHeroImage(wiki, "https://upload.wikimedia.org/other.jpg")).toBe(wiki);
  });
});
