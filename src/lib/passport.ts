// Which passport the visa row answers for (Settings → Pasaport). Turkish by default.
export async function loadPassport(): Promise<string> {
  try {
    const v = (await chrome.storage.local.get("passport")).passport;
    return typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : "TR";
  } catch {
    return "TR";
  }
}
export const savePassport = (code: string) => chrome.storage.local.set({ passport: code.toUpperCase() });
