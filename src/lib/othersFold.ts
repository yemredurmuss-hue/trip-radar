// 0.38.9 (Emre: "Seç diyorum, seçenekler hâlâ orada açık kalıyor"): once a need has its pick (chosen or booked), the
// options under its box and its "Senin için n öneri" row fold to one line, "Diğer seçenekler (n)", that opens and closes
// on a tap. Still to decide, they stay open as before. What was opened is remembered per box for this page only: a new
// page starts a chosen box folded.
import { L } from "./i18n";

/** The folded line's words: how many wait under it (nothing hidden without its number). */
export const othersLabel = (n: number): string => L(`Diğer seçenekler (${n})`, `Other options (${n})`);

/** The boxes (trip and need) whose options were opened on this page. */
const opened = new Set<string>();

/** Whether a box's options are open now: always while nothing is chosen, else only if opened on this page. */
export function othersOpen(key: string, chosen: boolean): boolean {
  return !chosen || opened.has(key);
}

/** Opened or folded by a tap (or folded by a pick): remembered for this page. */
export function rememberOthers(key: string, open: boolean): void {
  if (open) opened.add(key);
  else opened.delete(key);
}
