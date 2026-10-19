// 0.39.0: a price field with neither a price nor a usual range drew nothing at all (two empty parts read as something);
// it says "Fiyat ekle" again, so the field can still be opened.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Children } from "react";

describe("an editable field's emptiness", () => {
  it("empty parts count as empty", () => {
    const parts = [false, null, undefined, ""];
    expect(Children.toArray(parts).filter((c) => c !== "").length).toBe(0);
    expect(renderToStaticMarkup(<>{Children.toArray([false, <b key="a">€95</b>])}</>)).toBe("<b>€95</b>");
  });
});
