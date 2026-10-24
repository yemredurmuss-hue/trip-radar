// A page's own address for "already in your deck" (lib/companionWorker.ts pageKey): what names the thing is kept.
import { describe, expect, it } from "vitest";
import { pageKey } from "../src/lib/companionWorker";

describe("pageKey", () => {
  it("each YouTube video is a page of its own (2026-10-24: one saved video made every video 'zaten destende')", () => {
    expect(pageKey("https://www.youtube.com/watch?v=3pfnSu6HLB8")).not.toBe(pageKey("https://www.youtube.com/watch?v=abc123"));
    expect(pageKey("https://www.youtube.com/watch?v=3pfnSu6HLB8&t=42s&list=x")).toBe(pageKey("https://youtube.com/watch?v=3pfnSu6HLB8"));
  });
  it("a hotel's page is the same whatever the dates and tracking", () => {
    expect(pageKey("https://www.booking.com/hotel/pt/casa.html?checkin=2026-10-08&sid=x&utm_source=y")).toBe(pageKey("https://booking.com/hotel/pt/casa.html/"));
  });
  it("no address, no key", () => {
    expect(pageKey("not a url")).toBeNull();
  });
});
