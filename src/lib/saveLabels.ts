// Kaydet penceresi v5 (docs/mockups/eklenti-tek-kaydet-v5, Emre onayladı 2026-10-31): the words the popup shows. What is
// saved is called by its own title, cleaned of the tab's noise ("(2) … - YouTube", emoji, a run of capitals); a trip by
// its name with its date apart, small under it ("Patagonya Gezisi · Şubat 2027" → "Patagonya Gezisi" over "Şubat 2027").

const MONTHS = "ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|oca|şub|nis|haz|tem|ağu|eyl|eki|kas|ara";
// (a separator, then a month and a year, or a year alone, at the very end; or the same in brackets)
const TRAILING_DATE = new RegExp(`^(.*?\\S)\\s*(?:[·•|,–—-]\\s*|\\(\\s*)((?:(?:${MONTHS})\\.?\\s+)?(?:19|20)\\d{2})\\s*\\)?$`, "iu");

/** A trip's name with a date written into it: the name, and the date to show under it (null: none in the name). */
export function splitTripName(title: string): { name: string; date: string | null } {
  const t = title.replace(/\s+/g, " ").trim();
  const m = TRAILING_DATE.exec(t);
  // (a name that is only a date stays whole)
  if (!m || !m[1].replace(/[\s·•|,–—-]/g, "")) return { name: t, date: null };
  return { name: m[1].replace(/[\s·•|,–—-]+$/, ""), date: m[2] };
}

// (pictographs, flags, keycaps' parts, the joiners and variation selectors that glue them)
const EMOJI = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}‍︎️⃣])/gu;
const SEP = "\\s+[-|–—·•:]\\s+";

const squash = (s: string) => s.toLocaleLowerCase("en").replace(/^www\./, "").replace(/\.(com|net|org|co|io|tr|com\.tr)$/g, "").replace(/[^\p{L}\p{N}]/gu, "");

/** "TRAVEL PLAN WITH ME" → "Travel plan with me": a run of two or more words in capitals, lowered (one capital word stays: IST, NYC). */
function lowerShouting(s: string): string {
  // (\b is ASCII-only even with /u: İ, Ş would break a word; letters are looked at around it instead)
  return s.replace(/(?:(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{N}'’]+(?![\p{L}\p{N}])[\s,&!?.]*){2,}/gu, (run, at: number) => {
    const tr = /[ÇĞİÖŞÜ]/.test(run);
    const low = run.toLocaleLowerCase(tr ? "tr" : "en");
    // (at the title's start, its first letter stays a capital)
    const before = s.slice(0, at).replace(/[\s([{"'“‘]/g, "");
    return before ? low : low.charAt(0).toLocaleUpperCase(tr ? "tr" : "en") + low.slice(1);
  });
}

/**
 * The title shown for what is saved: the page's own title cleaned of what the tab adds. Gone: a leading "(2)" (unread
 * count), the site's own name at the end ("- YouTube", "| Booking.com"), emoji; a run of capitals lowered. Never cut here:
 * the popup shows at most two lines, then "…" (the whole title stays in its tooltip and in the Pano).
 */
export function cleanTitle(raw: string, site: string | null = null): string {
  let t = raw.replace(EMOJI, "").replace(/\s+/g, " ").trim();
  t = t.replace(/^\(\d{1,4}\+?\)\s*/, "");
  // (the last part after a separator, when it is the site's name: "… - YouTube", "… | Gezgin Defteri")
  const parts = t.split(new RegExp(SEP));
  if (parts.length > 1) {
    const tail = squash(parts[parts.length - 1]);
    const names = [site ?? ""].map(squash).filter(Boolean);
    if (tail && (names.some((n) => n === tail || n.startsWith(tail) || tail.startsWith(n)) || tail === "youtube")) {
      t = t.slice(0, t.lastIndexOf(parts[parts.length - 1])).replace(new RegExp(`${SEP}$`), "").trim();
    }
  }
  t = lowerShouting(t);
  // (what the emoji left behind: "ME  (" → "me (", a separator at an end)
  t = t.replace(/\s+([,.!?)])/g, "$1").replace(/\(\s+/g, "(").replace(/\s{2,}/g, " ").replace(/^[\s|–—·•:-]+|[\s|–—·•:-]+$/g, "").trim();
  return t || raw.trim();
}

/** A YouTube video's own picture (its address alone says it; the page's og:image lags behind on YouTube's own moves). */
export function videoThumb(url: string): string | null {
  const m = /^https:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : null;
}
