// The traveller's own currency (2026-10-09, the home's ₺ € $ £ picker, kept like the language): prices are compared and
// summed in it when the trip has no budget currency of its own, and the hero's exchange line is said in it. None
// chosen: as before (the trip's, else the records' most common, else EUR; the passport's for the exchange line).
export const CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;
export type DisplayCurrency = (typeof CURRENCIES)[number];
export const CURRENCY_SIGN: Record<DisplayCurrency, string> = { TRY: "₺", EUR: "€", USD: "$", GBP: "£" };

let chosen: DisplayCurrency | null = null;

export const displayCurrency = (): DisplayCurrency | null => chosen;
const isCurrency = (v: unknown): v is DisplayCurrency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** For the tests: as if chosen (null: none). */
export function setDisplayCurrency(next: DisplayCurrency | null): void {
  chosen = next;
}

/** Reads the chosen currency (none without extension storage: the tests, a plain page). */
export async function loadCurrency(): Promise<DisplayCurrency | null> {
  try {
    const stored = (await chrome.storage.local.get("currency")).currency;
    chosen = isCurrency(stored) ? stored : null;
  } catch {
    chosen = null;
  }
  return chosen;
}

export async function saveCurrency(next: DisplayCurrency): Promise<void> {
  chosen = next;
  await chrome.storage.local.set({ currency: next });
}
