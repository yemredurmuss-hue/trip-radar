// The hero's photos asked for at the size they're drawn (2026-10-22: light and kept, lib/photoCache.ts).
import { describe, expect, it } from "vitest";
import { heldPhoto, holdPhoto, sizedPhoto } from "../src/lib/photoCache";

describe("sizedPhoto", () => {
  it("Unsplash: its width, quality and format by its own server", () => {
    const u = new URL(sizedPhoto("https://images.unsplash.com/photo-1?ixid=x&w=4000", 1280));
    expect(u.searchParams.get("w")).toBe("1280");
    expect(u.searchParams.get("q")).toBe("70");
    expect(u.searchParams.get("auto")).toBe("format");
    expect(u.searchParams.get("ixid")).toBe("x");
  });
  it("Pexels: compressed at its width", () => {
    const u = new URL(sizedPhoto("https://images.pexels.com/photos/1/a.jpeg?h=900", 480));
    expect([u.searchParams.get("auto"), u.searchParams.get("w"), u.searchParams.get("h")]).toEqual(["compress", "480", null]);
  });
  it("Wikimedia: the thumbnail at its width; anything else as it is", () => {
    expect(sizedPhoto("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/1280px-X.jpg", 480)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/480px-X.jpg");
    expect(sizedPhoto("https://example.com/x.jpg", 480)).toBe("https://example.com/x.jpg");
    expect(sizedPhoto("not a url", 480)).toBe("not a url");
  });
});

describe("holdPhoto", () => {
  it("holds nothing where there are no images (a worker, the tests): never drawn as ready", () => {
    holdPhoto("https://images.unsplash.com/photo-1?w=1280");
    expect(heldPhoto("https://images.unsplash.com/photo-1?w=1280")).toBe(false);
  });
});
