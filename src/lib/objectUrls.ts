// Object URLs of files opened in a new tab (lib/docs). The tab may still be reading one (a long PDF, a
// reload), so they're let go when the board goes away (pagehide), not on a timer.
const tracked = new Set<string>();

export function trackObjectUrl(url: string): string {
  tracked.add(url);
  return url;
}

/** Lets every tracked URL go; how many there were. */
export function revokeTracked(): number {
  const n = tracked.size;
  for (const url of tracked) URL.revokeObjectURL(url);
  tracked.clear();
  return n;
}
