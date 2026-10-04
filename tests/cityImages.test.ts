import { describe, expect, it } from "vitest";
import { isPhoto, pickCityImage } from "../src/lib/cityImages";

describe("city images", () => {
  it("rejects flags, coats of arms, maps and svg", () => {
    expect(isPhoto("https://upload.wikimedia.org/x/Flag_of_Madeira.svg.png")).toBe(false);
    expect(isPhoto("https://upload.wikimedia.org/x/Coat_of_arms_of_Porto.png")).toBe(false);
    expect(isPhoto("https://upload.wikimedia.org/x/Madeira_locator_map.png")).toBe(false);
    expect(isPhoto("https://upload.wikimedia.org/x/Funchal_(_Portugal_)13.jpg")).toBe(true);
  });
  it("uses the proxy first, then Wikipedia's summary, then its media list", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes("proxy")) return null;
      if (url.includes("/summary/")) return { originalimage: { source: "https://u/Flag_of_Madeira.svg.png" } };
      if (url.includes("/media-list/")) return { items: [{ type: "image", title: "File:Map.png", srcset: [{ src: "//u/Map.png" }] }, { type: "image", title: "File:Levada.jpg", srcset: [{ src: "//u/Levada.jpg" }] }] };
      return null;
    };
    expect(await pickCityImage("Madeira", { fetchJson: fetcher, proxy: "https://proxy/x" })).toBe("https://u/Levada.jpg");
    expect(calls[0]).toContain("proxy");
  });
});
