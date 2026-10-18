// tests/codeVersion.test.ts — a page loaded right after the updater swapped the files runs newer code
// than the extension Chrome has loaded: it asks for the reload instead of opening the database.
import { describe, expect, it } from "vitest";
import { builtVersion, shouldAskForReload, staleExtension } from "../src/lib/update";

describe("newer files than the loaded extension", () => {
  it("differs only when both versions are known and not the same", () => {
    expect(staleExtension("0.31.0", "0.30.0")).toBe(true);
    expect(staleExtension("0.31.0", "0.31.0")).toBe(false);
    expect(staleExtension("", "0.30.0")).toBe(false);
    expect(staleExtension("0.31.0", "")).toBe(false);
  });
  it("outside a build (tests, a dev server) there's no built version", () => {
    expect(builtVersion()).toBe("");
  });
  it("asks for a reload once per version a minute, so a broken build can't reload forever", () => {
    expect(shouldAskForReload("0.31.0", null, 1_000)).toBe(true);
    expect(shouldAskForReload("0.31.0", { version: "0.31.0", at: 1_000 }, 30_000)).toBe(false);
    expect(shouldAskForReload("0.31.0", { version: "0.31.0", at: 1_000 }, 62_000)).toBe(true);
    expect(shouldAskForReload("0.32.0", { version: "0.31.0", at: 1_000 }, 2_000)).toBe(true);
  });
});
