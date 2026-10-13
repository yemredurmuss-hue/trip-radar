// The start card's photos: the mosaic unless the strip was picked and kept (Preview.tsx).
import { describe, expect, it } from "vitest";
import { LAYOUT_KEY, layoutKept } from "../src/app/start/Preview";

describe("the photo layout kept in the browser", () => {
  it("is the mosaic until the strip is picked", () => {
    expect(layoutKept({ getItem: () => null })).toBe("mosaic");
    expect(layoutKept({ getItem: (k) => (k === LAYOUT_KEY ? "strip" : null) })).toBe("strip");
    expect(layoutKept({ getItem: () => "mosaic" })).toBe("mosaic");
    expect(layoutKept({ getItem: () => "anything else" })).toBe("mosaic");
  });
  it("is the mosaic without storage, or with storage that throws", () => {
    expect(layoutKept(null)).toBe("mosaic");
    expect(layoutKept({ getItem: () => { throw new Error("blocked"); } })).toBe("mosaic");
  });
});
