// A stay's page photos kept beside its own (onay paketi 2026-10-22, galeri): their addresses only, in view first, each once,
// never its own photo, a logo or a map; only for a stay.
import { describe, expect, it } from "vitest";
import { GALLERY_MAX, galleryOf } from "../src/lib/items";

const img = (src: string, inView = true) => ({ src, alt: "", inView });

describe("galleryOf", () => {
  it("a stay's photos past its own, each once, the web's only, no logo or map", () => {
    const capture = { url: "https://www.booking.com/hotel/th/rimping.html", images: [img("https://cf.bstatic.com/a.jpg"), img("https://cf.bstatic.com/b.jpg"), img("https://cf.bstatic.com/a.jpg"), img("data:image/png;base64,xx"), img("https://cf.bstatic.com/logo.png"), img("https://maps.googleapis.com/staticmap?x"), img("https://cf.bstatic.com/c.jpg", false)] };
    expect(galleryOf("stay", capture, "https://cf.bstatic.com/a.jpg")).toEqual({ gallery: ["https://cf.bstatic.com/b.jpg", "https://cf.bstatic.com/c.jpg"] });
  });
  it("at most a handful; none for a flight, a screenshot or a page with no photos", () => {
    const many = { url: "https://x.test/h", images: Array.from({ length: 20 }, (_, i) => img(`https://x.test/p${i}.jpg`)) };
    expect(galleryOf("stay", many, null).gallery).toHaveLength(GALLERY_MAX);
    expect(galleryOf("flight", many, null)).toEqual({});
    expect(galleryOf("stay", { url: null, images: many.images }, null)).toEqual({});
    expect(galleryOf("stay", { url: "https://x.test/h" }, null)).toEqual({});
  });
});
