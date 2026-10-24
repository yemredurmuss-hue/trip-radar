// Tamamlandı (0.47.0): the small chime is on unless "Küçük sesler" is off, and never with "Hareketi duraklat" or reduced
// motion. Vitest runs in node: the page's storage, matchMedia and AudioContext are small fakes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { chime, setSounds, soundsOn } from "../src/app/chime";

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
let made = 0;
class FakeAudio {
  state = "running";
  currentTime = 0;
  destination = {};
  constructor() {
    made++;
  }
  createOscillator() {
    return { type: "", frequency: { value: 0 }, connect: (x: unknown) => x, start: () => undefined, stop: () => undefined };
  }
  createGain() {
    const g = { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: (x: unknown) => x };
    return g;
  }
  resume() {
    return Promise.resolve();
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("chime", () => {
  it("on by default; Settings' switch turns it off and on", () => {
    vi.stubGlobal("localStorage", store());
    expect(soundsOn()).toBe(true);
    setSounds(false);
    expect(soundsOn()).toBe(false);
    setSounds(true);
    expect(soundsOn()).toBe(true);
  });
  it("plays only when sounds are on and nothing asks for stillness", () => {
    vi.stubGlobal("localStorage", store());
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("AudioContext", FakeAudio);
    made = 0;
    chime();
    expect(made).toBe(1);
    setSounds(false);
    chime();
    expect(made).toBe(1);
  });
  it("silent with reduced motion; a blocked storage keeps it on and never throws", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    expect(soundsOn()).toBe(true);
    expect(() => setSounds(false)).not.toThrow();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(() => chime()).not.toThrow();
  });
});
