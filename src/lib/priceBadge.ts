// Fiyat izleme's badge (0.41.0): a drop also stays on the extension's icon ("−40") until its plan is opened, for a
// notification missed; the popup says it again. Light on purpose: the popup and the board import it.
/** What the icon's badge says, kept for the popup. */
export interface PriceBadge {
  tripId: string;
  title: string;
  said: string;
  save: number;
}
const BADGE = "priceBadge";

export async function showPriceBadge(badge: PriceBadge): Promise<void> {
  try {
    await chrome.storage.local.set({ [BADGE]: badge });
    await chrome.action.setBadgeBackgroundColor({ color: "#1f7a45" });
    await chrome.action.setBadgeText({ text: `−${Math.min(9999, Math.round(badge.save))}`.slice(0, 5) });
  } catch {
    // (no badge: the notification and the history said it)
  }
}

/** The drop the badge stands for, if any (the popup's line). */
export async function priceBadge(): Promise<PriceBadge | null> {
  try {
    const got = await chrome.storage.local.get(BADGE);
    const b = got[BADGE] as PriceBadge | undefined;
    return b && typeof b.tripId === "string" ? b : null;
  } catch {
    return null;
  }
}

/** The plan opened (or the drop seen in the popup): the badge goes. */
export async function clearPriceBadge(): Promise<void> {
  try {
    if (!(await priceBadge())) return;
    await chrome.storage.local.remove(BADGE);
    await chrome.action.setBadgeText({ text: "" });
  } catch {
    // (nothing to clear)
  }
}

