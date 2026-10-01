// Currency conversion with ECB reference rates (Frankfurter, free, no key), refreshed once a day.

export type Rates = { base: "EUR"; date: string; rates: Record<string, number> };

const ENDPOINTS = ["https://api.frankfurter.dev/v1/latest?base=EUR", "https://api.frankfurter.app/latest?from=EUR"];
const RETRY_MS = 10 * 60e3;
let lastFailure = 0;

export async function getRates(): Promise<Rates | null> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = (await chrome.storage.local.get("rates")).rates as (Rates & { fetched: string }) | undefined;
    if (stored?.fetched === today) return stored;
    // Offline or blocked: the board recomputes often, so don't retry on every change.
    if (Date.now() - lastFailure < RETRY_MS) return stored ?? null;
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const body = (await res.json()) as { date: string; rates: Record<string, number> };
        const rates: Rates & { fetched: string } = { base: "EUR", date: body.date, rates: { ...body.rates, EUR: 1 }, fetched: today };
        await chrome.storage.local.set({ rates });
        return rates;
      } catch {
        // try the next endpoint
      }
    }
    lastFailure = Date.now();
    return stored ?? null; // yesterday's rates beat none
  } catch {
    return null;
  }
}

/** Converts via EUR; null when either currency is unknown to the rate table. */
export function convert(amount: number, from: string, to: string, rates: Rates | null): number | null {
  if (from === to) return amount;
  const a = rates?.rates[from];
  const b = rates?.rates[to];
  return a && b ? (amount / a) * b : null;
}
