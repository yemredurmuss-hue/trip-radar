// tests/objectUrls.test.ts — a file opened in a new tab stays readable until the board goes away.
import { resolveObjectURL } from "node:buffer";
import { describe, expect, it } from "vitest";
import { revokeTracked, trackObjectUrl } from "../src/lib/objectUrls";

describe("opened files' object URLs", () => {
  it("are kept until revokeTracked (the board's pagehide), then all let go", () => {
    const a = trackObjectUrl(URL.createObjectURL(new Blob(["a"])));
    const b = trackObjectUrl(URL.createObjectURL(new Blob(["b"])));
    expect(resolveObjectURL(a)).toBeTruthy();
    expect(revokeTracked()).toBe(2);
    expect([resolveObjectURL(a), resolveObjectURL(b)]).toEqual([undefined, undefined]);
    expect(revokeTracked()).toBe(0);
  });
});
