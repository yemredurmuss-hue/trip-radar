// "Kopyala" (docs/mockups/ux-katmanli-arayuz, "Tek tıkla kopyala"): the clipboard write, and what is done when the browser refuses it.
export type CopyResult = "copied" | "selected";

/**
 * Writes `text` to the clipboard. It must be called straight from the click handler (the write needs the click's
 * permission): the first statement starts it. When the browser refuses (or has no clipboard), `select` selects the text
 * on screen instead so ⌘C finishes the job, and the result says so.
 */
export async function copyOrSelect(
  text: string,
  select: () => void,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
): Promise<CopyResult> {
  try {
    if (!clipboard) throw new Error("no clipboard");
    await clipboard.writeText(text);
    return "copied";
  } catch {
    try {
      select();
    } catch {
      /* nothing left to try */
    }
    return "selected";
  }
}

/** The text split around the first whole-word `token` ("Lizbon LIS · 14 Eki" around "LIS"); null when it isn't there. */
export function splitAround(text: string, token: string): [string, string, string] | null {
  const m = new RegExp(`(^|[^\\p{L}\\p{N}])(${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}\\p{N}])`, "u").exec(text);
  if (!m) return null;
  const at = m.index + m[1].length;
  return [text.slice(0, at), token, text.slice(at + token.length)];
}
