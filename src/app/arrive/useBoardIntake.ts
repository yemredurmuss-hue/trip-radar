// The board takes things directly: files or links dropped on it (with the calm overlay while they're over
// it), and a paste while nothing on the page is being typed in. Each goes the usual way (capture.ts) and is
// marked as handed to the board, so the page follows its waiting card.
import { useEffect } from "react";
import { addEvent, notifyChanged } from "../../lib/db";
import { addLinks, addTripFiles, isTripFile } from "../capture";
import { droppedLinks, useDropZone } from "./useDropZone";

function addFilesToBoard(tripId: string, files: File[]) {
  void addTripFiles(tripId, files, "board").then((problems) => {
    const fresh = problems.filter((p) => !p.logged).map((p) => p.text);
    return fresh.length ? addEvent(tripId, `⚠ ${fresh.join(" ")}`).then(notifyChanged) : undefined;
  });
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

export function useBoardIntake(tripId: string | null) {
  const zone = useDropZone<HTMLElement>((dt) => {
    if (!tripId) return;
    // A PDF or a picture dropped on the board goes to this trip's Belgeler and is read (0.34.6).
    if (dt.files.length) return addFilesToBoard(tripId, Array.from(dt.files));
    const links = droppedLinks(dt);
    if (links) void addLinks(links, { tripId, source: "board" });
  });
  useEffect(() => {
    if (!tripId) return;
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e.target) || typing(document.activeElement) || !e.clipboardData) return;
      // Only on the board's side (the chat has its own box).
      if (!(e.target instanceof Element) || e.target.closest(".chat")) return;
      const files = Array.from(e.clipboardData.files);
      if (files.some(isTripFile)) {
        e.preventDefault();
        return addFilesToBoard(tripId, files);
      }
      const text = e.clipboardData.getData("text/plain");
      // Only links are taken (addLinks says no to ordinary text); nothing else happens to a paste here anyway.
      if (text) void addLinks(text, { tripId, source: "board" });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [tripId]);
  return zone;
}
