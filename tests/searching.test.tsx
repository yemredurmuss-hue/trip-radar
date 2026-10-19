// 0.38.8 (Emre: "AI arkada arıyorsa bunu minik bir şeyle göstermemiz lazım"): what is being looked for in the background
// (lib/looking.ts), the small "aranıyor" line where its answer lands (plan/v82/Searching.tsx), the Bavul's while the AI
// makes the list, the AI review's running state, and the dots standing still with reduced motion.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CardEnvContext, type CardEnv } from "../src/app/cards/PlanCard";
import { Bavul } from "../src/app/plan/prep/Bavul";
import type { PrepModel } from "../src/app/plan/prep/usePrep";
import { Searching, SearchDots, useLooking } from "../src/app/plan/v82/Searching";
import { lookStore, type LookStore } from "../src/lib/looking";
import type { PackView } from "../src/lib/prepPack";
import { REVIEW_STALE_MS, reviewRunning } from "../src/lib/suggestReview";

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("lookStore", () => {
  it("is busy from the ask until the answer, and tells its listeners", async () => {
    const store = lookStore();
    const heard = vi.fn();
    store.subscribe(heard);
    const d = deferred<string[]>();
    const out = store.track("activity:Ushuaia", d.promise);
    expect(store.has("activity:Ushuaia")).toBe(true);
    expect(store.has("activity:El Calafate")).toBe(false);
    expect(store.has(null)).toBe(false);
    d.resolve(["Tierra del Fuego National Park"]);
    expect(await out).toEqual(["Tierra del Fuego National Park"]);
    await settle();
    expect(store.has("activity:Ushuaia")).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("a failed ask isn't busy any more either, and the failure still reaches the caller", async () => {
    const store = lookStore();
    const d = deferred<string[]>();
    const out = store.track("stay:ushuaia", d.promise);
    d.reject(new Error("offline"));
    await expect(out).rejects.toThrow("offline");
    await settle();
    expect(store.has("stay:ushuaia")).toBe(false);
  });

  it("two asks for one key: busy until both are back", async () => {
    const store = lookStore();
    const a = deferred<number>();
    const b = deferred<number>();
    store.track("k", a.promise);
    store.track("k", b.promise);
    a.resolve(1);
    await settle();
    expect(store.has("k")).toBe(true);
    b.resolve(2);
    await settle();
    expect(store.has("k")).toBe(false);
  });

  it("stops telling a listener that left", () => {
    const store = lookStore();
    const heard = vi.fn();
    store.subscribe(heard)();
    store.track("k", new Promise(() => undefined));
    expect(heard).not.toHaveBeenCalled();
  });
});

describe("Searching", () => {
  it("is the chat's three dots and a short line, said to screen readers", () => {
    const html = renderToStaticMarkup(<Searching text="Viator'da turlar aranıyor…" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('class="th-dots q-lookd" aria-hidden="true"');
    expect(html).toContain("Viator&#x27;da turlar aranıyor…");
    expect(renderToStaticMarkup(<SearchDots />)).not.toContain("role");
  });

  // Emre's Ushuaia: the tours asked when Etkinlik opens; the line stands until they come, then goes.
  function Tours({ store, city }: { store: LookStore; city: string }) {
    return useLooking(store, `activity:${city}`) ? <Searching text="Viator'da turlar aranıyor…" /> : <p>Tierra del Fuego Natio…</p>;
  }
  it("shows while its key is asked and goes with the answer", async () => {
    const store = lookStore();
    const d = deferred<null>();
    store.track("activity:Ushuaia", d.promise);
    expect(renderToStaticMarkup(<Tours store={store} city="Ushuaia" />)).toContain("turlar aranıyor");
    expect(renderToStaticMarkup(<Tours store={store} city="El Calafate" />)).not.toContain("turlar aranıyor");
    d.resolve(null);
    await settle();
    const after = renderToStaticMarkup(<Tours store={store} city="Ushuaia" />);
    expect(after).not.toContain("turlar aranıyor");
    expect(after).toContain("Tierra del Fuego");
  });
});

describe("Bavul while the AI makes the list", () => {
  const view: PackView = { groups: [{ title: "Belgeler", rows: [{ key: "pasaport", name: "Pasaport", why: null, ready: false, buy: false, item: null }] }], asks: [], total: 1, ready: 0, toBuy: 0 };
  const model = { trip: { id: "t1" }, mine: { always: [], never: [] }, saveMine: () => undefined, shopHome: null } as unknown as PrepModel;
  const bavul = (looking: boolean) =>
    renderToStaticMarkup(
      <CardEnvContext.Provider value={{} as CardEnv}>
        <Bavul view={view} sub="Emre için · Kasım, 9 gün" bag={null} model={model} looking={looking} />
      </CardEnvContext.Provider>,
    );
  it("says it's being made under its head, keeping what it says already", () => {
    const html = bavul(true);
    expect(html).toContain("Bavul listesi hazırlanıyor…");
    expect(html).toContain("Emre için · Kasım, 9 gün");
    expect(html).toContain("0/1 hazır");
  });
  it("says nothing once the list is in", () => {
    expect(bavul(false)).not.toContain("hazırlanıyor");
  });
});

describe("reviewRunning", () => {
  const now = Date.UTC(2026, 10, 1);
  it("is the review out now: claimed and not back, nor stuck", () => {
    expect(reviewRunning({ key: "ushuaia|2026-11-20_2026-11-30|x", at: now - 20_000, state: "running" }, now)).toBe(true);
    expect(reviewRunning({ key: "k", at: now - REVIEW_STALE_MS - 1, state: "running" }, now)).toBe(false);
    expect(reviewRunning({ key: "k", at: now - 1000, state: "done" }, now)).toBe(false);
    expect(reviewRunning({ key: "k", at: now - 1000, failed: true, state: "failed" }, now)).toBe(false);
    expect(reviewRunning(null, now)).toBe(false);
  });
});

describe("reduced motion", () => {
  const css = readFileSync("static/v82/motion.css", "utf8");
  it("the dots stand still with the system setting and with Hareketi duraklat; the words stay", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.q-lookd i \{ animation: none !important;/);
    expect(css).toMatch(/body\.still \.q-lookd i \{ animation: none !important;/);
    expect(css).not.toMatch(/\.q-lookt[^}]*display: none/);
  });
});
