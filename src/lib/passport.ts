// Which passport the visa row answers for (Settings → Pasaport). Turkish by default.
export async function loadPassport(): Promise<string> {
  try {
    const v = (await chrome.storage.local.get("passport")).passport;
    return typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : "TR";
  } catch {
    return "TR";
  }
}
/**
 * The passport only when the traveller set it in Settings; null while it's the default. What's said about going
 * abroad (insurance, an eSIM: suggestions.ts) then reads home from the first flight's airport, never the default.
 */
export async function loadHome(): Promise<string | null> {
  try {
    const v = (await chrome.storage.local.get("passport")).passport;
    return typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}
export const savePassport = (code: string) => chrome.storage.local.set({ passport: code.toUpperCase() });

/**
 * "Geçerli bir Schengen vizen var mı?" (P7, F57: a weekend in Lisbon three days away said "apply for the visa · gone by"):
 * answered once and kept for every trip; null while it hasn't been asked. "Yok" is kept too, so it isn't asked again.
 */
export interface SchengenAnswer {
  has: boolean;
  at: number;
}
export async function loadSchengenVisa(): Promise<SchengenAnswer | null> {
  try {
    const v = (await chrome.storage.local.get("schengenVisa")).schengenVisa as SchengenAnswer | undefined;
    return v && typeof v.has === "boolean" ? v : null;
  } catch {
    return null;
  }
}
export const saveSchengenVisa = (has: boolean) => chrome.storage.local.set({ schengenVisa: { has, at: Date.now() } satisfies SchengenAnswer });
