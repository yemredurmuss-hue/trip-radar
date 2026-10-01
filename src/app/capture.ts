// Adding things from the board itself: pasted links and dropped/pasted screenshots.
import { downscale, fileToDataUrl, requestProcessing } from "../lib/browser";
import { saveImage, savePastedLink } from "../lib/process";
import { looksLikeUrl } from "../lib/url";

export async function addImages(files: Iterable<File>): Promise<number> {
  let count = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    await saveImage(await downscale(await fileToDataUrl(file)));
    count++;
  }
  if (count) requestProcessing();
  return count;
}

/** Saves the text as links when it is only links; returns false for ordinary text. */
export async function addLinks(text: string): Promise<boolean> {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || !tokens.every(looksLikeUrl)) return false;
  for (const url of tokens) await savePastedLink(url);
  requestProcessing();
  return true;
}
