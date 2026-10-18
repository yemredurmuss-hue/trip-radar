// Self-update for the unpacked install: the Mac updater (scripts/mac/update.sh) rewrites the files
// on disk; unpacked extensions serve files straight from disk, so reading our own manifest.json
// tells us whether a newer version is waiting. A reload then picks it up.

export async function diskVersion(): Promise<string | null> {
  try {
    const res = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    const manifest = (await res.json()) as { version?: string };
    return manifest.version ?? null;
  } catch {
    return null; // mid-write or unreadable: try again next time
  }
}

export const runningVersion = () => chrome.runtime.getManifest().version;

export async function updateWaiting(): Promise<string | null> {
  const disk = await diskVersion();
  return disk && disk !== runningVersion() ? disk : null;
}

// --- a page newer than the loaded extension -------------------------------------------------------
// Right after the updater swaps the folder, a popup or a new board tab loads the NEW files while Chrome
// still runs the OLD extension (its worker and tabs hold the database open at the old version, and
// before 0.31 they don't let go). Opening the database then would wait forever: ask for the reload.

/** The version these files were built as (scripts/build.mjs); "" outside a build (tests). */
export const builtVersion = (): string => (typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "");

/** True when this page's files are another version than the extension Chrome has loaded. */
export const staleExtension = (built: string, running: string): boolean => Boolean(built && running && built !== running);

const ASK_AGAIN_MS = 60_000;
interface Asked {
  version: string;
  at: number;
}
/** Once per version a minute: if the reload didn't fix it (a broken build), the page opens as before. */
export const shouldAskForReload = (built: string, last: Asked | null, now: number): boolean =>
  !last || last.version !== built || now - last.at > ASK_AGAIN_MS;

/**
 * Called first by the board and the popup. True when the extension is being reloaded to the files on
 * disk (the page shows "Güncelleniyor…" and must not open the database); `reopen` is where the board
 * comes back (null for the popup).
 */
export async function reloadIfStale(reopen: string | null, now = Date.now()): Promise<boolean> {
  const built = builtVersion();
  if (!staleExtension(built, runningVersion())) return false;
  try {
    const { updateAsked } = await chrome.storage.local.get("updateAsked");
    if (!shouldAskForReload(built, (updateAsked as Asked | undefined) ?? null, now)) return false;
    await chrome.storage.local.set({ updateAsked: { version: built, at: now } });
    // The old worker (0.30 too) answers this by reloading the extension.
    await chrome.runtime.sendMessage({ type: "apply-update", reopen });
    return true;
  } catch {
    return false;
  }
}
