// What is being looked for right now, in the background (0.38.8, Emre: "AI arkada arıyorsa bunu minik bir şeyle
// göstermemiz lazım"): a need's offers from the connected source, a trip's packing list from the AI. A key is busy from
// the moment its request leaves until it answers or fails; the place its answer lands shows a small "aranıyor" line
// meanwhile (app/plan/v82/Searching.tsx). Nothing is stored: a page opened again starts with nothing in flight.

export interface LookStore {
  /** The key is being looked for now. */
  has(key: string | null | undefined): boolean;
  /** Marks `key` busy until `work` settles (two at once for one key: busy until both have). Returns `work` itself. */
  track<T>(key: string, work: Promise<T>): Promise<T>;
  /** Called on every change; returns the way to stop. */
  subscribe(listener: () => void): () => void;
}

export function lookStore(): LookStore {
  const busy = new Map<string, number>();
  const listeners = new Set<() => void>();
  const tell = () => listeners.forEach((l) => l());
  const done = (key: string) => {
    const n = (busy.get(key) ?? 1) - 1;
    if (n > 0) busy.set(key, n);
    else busy.delete(key);
    tell();
  };
  return {
    has: (key) => key != null && busy.has(key),
    track(key, work) {
      busy.set(key, (busy.get(key) ?? 0) + 1);
      tell();
      work.then(
        () => done(key),
        () => done(key),
      );
      return work;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** A need's offers or a stay's candidates asked from the connected source, by need key (cards/OfferRow). */
export const offersLooking = lookStore();

/** A trip's Bavul list asked from the AI, by trip id (plan/prep/usePackAi). */
export const packLooking = lookStore();
