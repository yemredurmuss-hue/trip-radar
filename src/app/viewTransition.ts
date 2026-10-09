// A screen change carried by the browser's View Transitions (2026-10-09): the home's box flows into the chat's first
// message, the plan slides in beside it, the board settles in after "Oluştur". The named parts are in app.css
// (view-transition-name). Without the API, with reduced motion, or in a hidden tab the change is made at once.
import { flushSync } from "react-dom";

type WithTransitions = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

export function withTransition(update: () => void): void {
  const doc = document as WithTransitions;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || still || doc.visibilityState !== "visible") return update();
  try {
    doc.startViewTransition(() => flushSync(update)).finished.catch(() => undefined);
  } catch {
    update();
  }
}
