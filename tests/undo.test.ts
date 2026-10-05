// tests/undo.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNDO_MS, undoSlot } from "../src/lib/undo";

afterEach(() => vi.useRealTimers());

describe("the one 'Geri al' on screen", () => {
  it("lasts 8 seconds", () => {
    vi.useFakeTimers();
    const slot = undoSlot<string>();
    const seen: (string | null)[] = [];
    slot.subscribe((v) => seen.push(v));
    slot.show("a");
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(slot.current()).toBe("a");
    vi.advanceTimersByTime(1);
    expect(slot.current()).toBeNull();
    expect(seen).toEqual(["a", null]);
  });
  it("taking it clears it; a newer deletion takes its place and starts again", () => {
    vi.useFakeTimers();
    const slot = undoSlot<string>();
    slot.show("a");
    vi.advanceTimersByTime(5000);
    slot.show("b");
    vi.advanceTimersByTime(5000);
    expect(slot.current()).toBe("b");
    expect(slot.take()).toBe("b");
    expect(slot.take()).toBeNull();
  });
});
