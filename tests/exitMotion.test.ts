import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_MS, installExitMotion, LEAVING, leavesWithCopy } from "../src/app/exitMotion";

// A window or drawer that is taken out leaves a still copy that fades (hareket dili). Vitest runs in node: the element, the page and the
// observer are small fakes that carry only what exitMotion.ts reads.
type FakeEl = {
  matches: (sel: string) => boolean;
  classList: { contains: (c: string) => boolean; add: (c: string) => void };
  attrs: Record<string, string>;
  inert: boolean;
  removed: boolean;
  withId: FakeEl[];
  removeAttribute: (a: string) => void;
  setAttribute: (a: string, v: string) => void;
  querySelectorAll: () => FakeEl[];
  cloneNode: () => FakeEl;
  remove: () => void;
};

const el = (classes: string[], id: string | null = "x"): FakeEl => {
  const set = new Set(classes);
  const e: FakeEl = {
    matches: (sel) => sel.split(",").some((s) => set.has(s.trim().replace(/^\./, ""))),
    classList: { contains: (c) => set.has(c), add: (c) => void set.add(c) },
    attrs: id ? { id } : {},
    inert: false,
    removed: false,
    withId: [],
    removeAttribute(a) {
      delete this.attrs[a];
    },
    setAttribute(a, v) {
      this.attrs[a] = v;
    },
    querySelectorAll: () => e.withId,
    cloneNode: () => {
      const c = el([...set], id);
      c.withId = [el([], "inner")];
      return c;
    },
    remove() {
      this.removed = true;
    },
  };
  return e;
};

describe("exitMotion: what leaves with a copy", () => {
  it("names the windows and drawers of the entrance block", () => {
    for (const c of [".modal", ".overlay", ".drawer", ".compare-modal", ".pk-sheet-back"]) expect(LEAVING).toContain(c);
    expect(EXIT_MS).toBeGreaterThanOrEqual(260);
    expect(EXIT_MS).toBeLessThanOrEqual(400);
  });
  it("a window leaves with a copy; a card, or a copy itself, does not", () => {
    expect(leavesWithCopy(el(["modal"]) as unknown as Element)).toBe(true);
    expect(leavesWithCopy(el(["drawer"]) as unknown as Element)).toBe(true);
    expect(leavesWithCopy(el(["pk-card"]) as unknown as Element)).toBe(false);
    expect(leavesWithCopy(el(["modal", "mv-leaving"]) as unknown as Element)).toBe(false); // c305557: a copy is not an open window
  });
});

describe("installExitMotion", () => {
  const realHTMLElement = (globalThis as { HTMLElement?: unknown }).HTMLElement;
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    (globalThis as { HTMLElement?: unknown }).HTMLElement = realHTMLElement;
  });

  function setup(reduced: boolean) {
    vi.useFakeTimers();
    class FakeHTMLElement {}
    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    let callback: (records: unknown[]) => void = () => {};
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(cb: (records: unknown[]) => void) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const appended: FakeEl[] = [];
    const doc = { body: { appendChild: (e: FakeEl) => void appended.push(e) } } as unknown as Document;
    installExitMotion(doc);
    const take = (e: FakeEl) => {
      Object.setPrototypeOf(e, FakeHTMLElement.prototype);
      callback([{ removedNodes: [e] }]);
    };
    return { appended, take };
  }

  it("puts a still, hidden, id-less copy back and drops it after EXIT_MS", () => {
    const { appended, take } = setup(false);
    take(el(["modal"], "dlg"));
    expect(appended).toHaveLength(1);
    const copy = appended[0];
    expect(copy.classList.contains("mv-leaving")).toBe(true);
    expect(copy.attrs["aria-hidden"]).toBe("true");
    expect(copy.inert).toBe(true);
    expect(copy.attrs.id).toBeUndefined();
    expect(copy.withId.every((e) => e.attrs.id === undefined)).toBe(true);
    vi.advanceTimersByTime(EXIT_MS - 1);
    expect(copy.removed).toBe(false);
    vi.advanceTimersByTime(2);
    expect(copy.removed).toBe(true);
  });
  it("makes no copy with reduced motion", () => {
    const { appended, take } = setup(true);
    take(el(["modal"]));
    expect(appended).toHaveLength(0);
  });
  it("makes no copy of something that is not a window, or of a copy being dropped", () => {
    const { appended, take } = setup(false);
    take(el(["pk-card"]));
    take(el(["modal", "mv-leaving"]));
    expect(appended).toHaveLength(0);
  });
});
