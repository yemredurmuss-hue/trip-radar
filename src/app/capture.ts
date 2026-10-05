// Adding things from the board itself: pasted links, dropped/pasted screenshots, and (0.34.6) documents —
// a PDF or a picture dropped, pasted or picked in a trip's chat or on its board is kept in its Belgeler and
// read by the traveller's own model; a picture that turns out to be a page's screenshot goes the old way.
import { downscale, fileToDataUrl, requestProcessing } from "../lib/browser";
import { addEvent, notifyChanged } from "../lib/db";
import { addTripDoc, checkDoc, deleteDoc, docType } from "../lib/docs";
import { plainAttachment, readDocument } from "../lib/docReader";
import { imagePart } from "../lib/extract";
import { L } from "../lib/i18n";
import { describeError } from "../lib/llm";
import type { Attachment } from "../lib/llm/types";
import { saveImage, savePastedLink } from "../lib/process";
import type { DocRecord } from "../lib/types";
import { looksLikeUrl } from "../lib/url";
import { sectionOfItem } from "../lib/categories";
import { addIntake, intakeNow, updateIntake, type FileIntake, type IntakeSource, type LinkIntake } from "./arrive/intake";

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

/**
 * Saves the text as links when it is only links; returns false for ordinary text. `from`: where it was handed
 * over (a trip's chat, its board), so the chat can show its chip and the board can follow it (arrive/intake).
 */
export async function addLinks(text: string, from?: { tripId: string | null; source: IntakeSource }): Promise<boolean> {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || !tokens.every(looksLikeUrl)) return false;
  for (const url of tokens) {
    // Handed to a trip's board: it goes into that trip, wherever its country or dates would send it.
    const capture = await savePastedLink(url, from?.source === "board" && from.tripId ? from.tripId : undefined);
    if (from) addIntake<LinkIntake>({ kind: "link", tripId: from.tripId, source: from.source, url, captureId: capture.id });
  }
  requestProcessing();
  return true;
}

/** A file this intake takes (a PDF or a picture; the rest is refused with a message). */
export const isTripFile = (file: File): boolean => file.type.startsWith("image/") || docType(file) != null;

/** A picture goes to the model made smaller (its JPEG), a PDF as it is. */
async function boardAttachment(doc: DocRecord): Promise<Attachment> {
  if (doc.type === "application/pdf") return plainAttachment(doc);
  const { mediaType, data } = imagePart(await downscale(await fileToDataUrl(doc.blob)));
  return { mimeType: mediaType, data };
}

/**
 * A trip's files, one after another: each kept in Belgeler (local only, the usual 15 MB and type limits),
 * then read and put on its card (readDocument writes the chat's lines). A picture the model says isn't a
 * document, or can't read, is saved as a screenshot like before. Returns what went wrong, in words
 * (`logged`: already a line in the chat).
 */
export async function addTripFiles(tripId: string, files: Iterable<File>, source: IntakeSource = "chat"): Promise<{ text: string; logged: boolean }[]> {
  const errors: { text: string; logged: boolean }[] = [];
  let screenshots = 0;
  // Each file's chip and waiting card (arrive/intake): reading, then where it went.
  const all = Array.from(files);
  const intakes = all.map((file) => addIntake<FileIntake>({ kind: "file", tripId, source, name: file.name, type: file.type, state: "reading" }));
  const screenshot = async (file: File, at: FileIntake) => {
    const shot = await downscale(await fileToDataUrl(file));
    const capture = await saveImage(shot, source === "board" ? tripId : undefined);
    updateIntake(at.id, { state: "screenshot", captureId: capture.id, thumb: shot });
    screenshots++;
  };
  const asScreenshot = async (file: File, docId: string, at: FileIntake) => {
    await deleteDoc(docId);
    await screenshot(file, at);
  };
  try {
    for (const [index, file] of all.entries()) {
      const at = intakes[index];
      // A picture Belgeler can't keep (WebP, GIF, HEIC...) is a screenshot, as it always was.
      if (file.type.startsWith("image/") && !docType(file)) {
        await screenshot(file, at);
        continue;
      }
      const problem = checkDoc(file);
      if (problem) {
        errors.push({ text: problem, logged: false });
        updateIntake(at.id, { state: "error", error: problem });
        continue;
      }
      const doc = await addTripDoc(tripId, file);
      const picture = doc.type !== "application/pdf";
      try {
        const out = await readDocument(tripId, doc.id, { attachment: boardAttachment });
        if (out.kind === "not_document" && picture) await asScreenshot(file, doc.id, at);
        else if (out.kind === "linked" || out.kind === "created") updateIntake(at.id, { state: "done", itemId: out.item.id, itemName: out.item.name, section: sectionOfItem(out.item) });
        else updateIntake(at.id, { state: "done" });
      } catch (error) {
        if (picture) {
          await asScreenshot(file, doc.id, at);
          continue;
        }
        const why = describeError(error);
        updateIntake(at.id, { state: "error", error: why, logged: true });
        errors.push({ text: why, logged: true });
        await addEvent(tripId, L(`📎 ${doc.name} Belgeler'e kaydedildi; okunamadı: ${why}`, `📎 ${doc.name} is saved in Documents; couldn't read it: ${why}`));
        notifyChanged();
      }
    }
  } finally {
    // Something threw on the way (storage full...): no chip keeps spinning.
    for (const at of intakes) if (intakeNow().find((e) => e.id === at.id && e.kind === "file" && e.state === "reading")) updateIntake(at.id, { state: "error" });
  }
  if (screenshots) requestProcessing();
  return errors;
}
