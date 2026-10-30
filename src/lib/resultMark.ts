// ✓ hatırlanır (tek Kaydet v3, Emre onayladı 2026-10-30): a result saved with its "+" is known again when the page comes
// back (reloaded, or back from the Pano), and pressing it again makes no second record. Known by what doesn't change
// about it: its times and its words, never its price; and on its own page address only, so a daily flight on another
// day is another result.

/** What stays the same about one result card: its heading, its clock times in order, its words (no digits, no prices). */
export interface ResultPrint {
  /** The card's own heading (a hotel's, a tour's name), folded; "" when the card has none. */
  n: string;
  /** Its clock times in order ("07:40 09:05"): a flight's departure and arrival. */
  t: string;
  /** Its words of three letters or more, folded, each once, at most 60. */
  w: string[];
}

const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFC");

/** The print of a card from its text and its heading. */
export function resultPrint(text: string, heading = ""): ResultPrint {
  const times = text.match(/(?<!\d)(?:[01]?\d|2[0-3]):[0-5]\d(?!\d)/g) ?? [];
  const words = [...new Set(fold(text).match(/\p{L}{3,}/gu) ?? [])].slice(0, 60);
  return { n: fold(heading).replace(/\s+/g, " ").trim().slice(0, 120), t: times.join(" "), w: words };
}

/**
 * The same result? The same times, the same name (the heading, or without one its first two words: a flight's airline,
 * a hotel's name), and most words alike ("Son 2 koltuk" coming and going is not another result). When unsure it says
 * no: a "+" left as "+" costs a second look, a wrong ✓ would keep a result from being saved.
 */
export function sameResult(a: ResultPrint, b: ResultPrint): boolean {
  if (a.t !== b.t) return false;
  if (a.n || b.n ? a.n !== b.n : a.w.slice(0, 2).join(" ") !== b.w.slice(0, 2).join(" ")) return false;
  const bw = new Set(b.w);
  const shared = a.w.filter((x) => bw.has(x)).length;
  const union = new Set([...a.w, ...b.w]).size;
  if (!union) return Boolean(a.t || a.n);
  return shared / union >= 0.6;
}

/** The page a print belongs to: its address without the hash and the ad trackers (a reload, a way back, keeps it). */
export function resultPage(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gclid$|fbclid$|msclkid$|_ga$)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.toString().slice(0, 600);
  } catch {
    return null;
  }
}

/** A print sent from the page: kept only when it has its fields' shapes (the page is not trusted for more). */
export function printOf(x: unknown): ResultPrint | null {
  if (!x || typeof x !== "object") return null;
  const p = x as Record<string, unknown>;
  if (typeof p.n !== "string" || typeof p.t !== "string" || !Array.isArray(p.w)) return null;
  const w = p.w.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 40)).slice(0, 60);
  return { n: p.n.slice(0, 120), t: p.t.slice(0, 120), w };
}
