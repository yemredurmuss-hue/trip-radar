// The plan as a PDF (PrintPlan.tsx): a photo at the size paper needs, from the sources that can scale it.
import { describe, expect, it } from "vitest";
import { paperSize } from "../src/app/PrintPlan";

describe("paperSize", () => {
  it("asks Unsplash and Pexels for about 1600 px; anything else as it is", () => {
    const u = new URL(paperSize("https://images.unsplash.com/photo-1?ixid=abc&w=6000"));
    expect([u.hostname, u.searchParams.get("w"), u.searchParams.get("q"), u.searchParams.get("ixid")]).toEqual(["images.unsplash.com", "1600", "80", "abc"]);
    expect(new URL(paperSize("https://images.pexels.com/photos/1/a.jpeg")).searchParams.get("w")).toBe("1600");
    expect(paperSize("https://upload.wikimedia.org/x.jpg")).toBe("https://upload.wikimedia.org/x.jpg");
    expect(paperSize("data:image/png;base64,xx")).toBe("data:image/png;base64,xx");
  });
});
