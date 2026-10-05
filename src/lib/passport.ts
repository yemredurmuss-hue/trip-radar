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
 * abroad (insurance, an eSIM: suggestions.ts) waits for it rather than guess.
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
