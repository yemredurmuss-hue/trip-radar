import { describe, expect, it, vi } from "vitest";
import { copyOrSelect, splitAround } from "../src/lib/copyText";

describe("copyOrSelect", () => {
  it("writes the text and says it was copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn();
    expect(await copyOrSelect("ABC123", select, { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("ABC123");
    expect(select).not.toHaveBeenCalled();
  });
  it("selects the text on screen when the write is refused", async () => {
    const select = vi.fn();
    expect(await copyOrSelect("ABC123", select, { writeText: vi.fn().mockRejectedValue(new Error("denied")) })).toBe("selected");
    expect(select).toHaveBeenCalledOnce();
  });
  it("selects the text when there is no clipboard at all, and survives a selection that fails too", async () => {
    const select = vi.fn(() => {
      throw new Error("no selection");
    });
    expect(await copyOrSelect("x", select, undefined)).toBe("selected");
    expect(select).toHaveBeenCalledOnce();
  });
  it("starts the write before anything is awaited (the click's permission)", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    void copyOrSelect("x", () => undefined, { writeText });
    expect(writeText).toHaveBeenCalledOnce();
  });
});

describe("splitAround", () => {
  it("splits a line around a whole-word code", () => {
    expect(splitAround("Lizbon LIS · 14 Eki 19:40", "LIS")).toEqual(["Lizbon ", "LIS", " · 14 Eki 19:40"]);
    expect(splitAround("LIS", "LIS")).toEqual(["", "LIS", ""]);
  });
  it("does not split inside a longer word", () => {
    expect(splitAround("ALISON", "LIS")).toBeNull();
    expect(splitAround("Porto", "LIS")).toBeNull();
  });
});
