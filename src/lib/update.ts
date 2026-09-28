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
