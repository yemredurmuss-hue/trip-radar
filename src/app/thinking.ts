// The chat's "thinking" line and the mascot's face while the assistant works (hareket dili, docs/mockups/hareket):
// what it is waiting on when that is known (a web search, prices), else "Düşünüyor…"; past LONG_WAIT it says so, so a
// slow answer never looks stuck. The mascot works while the line shows, smiles for a moment when the answer lands, and
// looks sorry while an error is on screen.
import type { ChatStatus } from "../lib/chatStatus";
import { L } from "../lib/i18n";
import type { MascotState } from "./Mascot";

/** After this long without an answer the line says it is taking a while. */
export const LONG_WAIT = 12_000;
/** How long the mascot smiles once the answer is in. */
export const DONE_FOR = 1_400;

export function thinkingLine(status: ChatStatus, waitedMs: number): string {
  if (status === "web") return L("Web'de arıyorum…", "Searching the web…");
  if (status === "offers") return L("Fiyatlara bakıyorum…", "Checking prices…");
  if (waitedMs >= LONG_WAIT) return L("Uzun sürüyor; bu arada yazmaya devam edebilirsin.", "This is taking a while; you can keep typing meanwhile.");
  return L("Düşünüyor…", "Thinking…");
}

export function mascotFace({ working, justDone, error }: { working: boolean; justDone: boolean; error: boolean }): MascotState {
  if (working) return "work";
  if (error) return "oops";
  return justDone ? "done" : "idle";
}
