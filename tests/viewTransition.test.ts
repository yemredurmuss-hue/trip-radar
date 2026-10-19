// A view transition the browser gives up on ("Transition was aborted because of timeout in DOM update", a busy
// machine) rejects its `ready` promise: unhandled, that reached the board's error banner and covered the screen.
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTransition, withTripPhoto } from "../src/app/viewTransition";

const aborted = () => Object.assign(new Error("Transition was aborted because of timeout in DOM update"), { name: "TimeoutError" });

function fakeDocument() {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  vi.stubGlobal("document", {
    visibilityState: "visible",
    querySelector: () => null,
    startViewTransition: (update: () => void) => {
      update();
      return { ready: Promise.reject(aborted()), updateCallbackDone: Promise.resolve(), finished: Promise.resolve() };
    },
  });
  vi.stubGlobal("CSS", { escape: (s: string) => s });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  return { unhandled, done: () => process.off("unhandledRejection", onUnhandled) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.unstubAllGlobals());

describe("view transitions given up by the browser", () => {
  it("withTransition makes the change and leaves no unhandled rejection", async () => {
    const page = fakeDocument();
    const update = vi.fn();
    withTransition(update);
    await settle();
    page.done();
    expect(update).toHaveBeenCalledOnce();
    expect(page.unhandled).toEqual([]);
  });

  it("withTripPhoto makes the change and leaves no unhandled rejection", async () => {
    const page = fakeDocument();
    const update = vi.fn();
    withTripPhoto(update, "trip-1", true);
    await settle();
    page.done();
    expect(update).toHaveBeenCalledOnce();
    expect(page.unhandled).toEqual([]);
  });
});

describe("E17: the app's own \"Hareketi duraklat\" stops them too", () => {
  const started = () => {
    let runs = 0;
    vi.stubGlobal("document", {
      visibilityState: "visible",
      querySelector: () => null,
      startViewTransition: (update: () => void) => {
        runs++;
        update();
        return { ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: Promise.resolve() };
      },
    });
    vi.stubGlobal("CSS", { escape: (s: string) => s });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    return () => runs;
  };
  const still = (on: boolean) => vi.stubGlobal("localStorage", { getItem: () => (on ? "1" : null), setItem: () => undefined, removeItem: () => undefined });

  it("with the switch on the change is made at once, the card's photo and the screen alike", () => {
    const runs = started();
    still(true);
    const update = vi.fn();
    withTransition(update);
    withTripPhoto(update, "trip-1", true);
    expect(update).toHaveBeenCalledTimes(2);
    expect(runs()).toBe(0);
  });

  it("with it off the browser carries the change", () => {
    const runs = started();
    still(false);
    withTransition(vi.fn());
    withTripPhoto(vi.fn(), "trip-1", false);
    expect(runs()).toBe(2);
  });
});
