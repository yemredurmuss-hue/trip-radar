// A screen change carried by the browser's View Transitions (2026-10-09): the home's box flows into the chat's first
// message, the plan slides in beside it, the board settles in after "Oluştur". The named parts are in app.css
// (view-transition-name). Without the API, with reduced motion, or in a hidden tab the change is made at once.
import { flushSync } from "react-dom";

type Transition = { ready: Promise<void>; updateCallbackDone: Promise<void>; finished: Promise<void> };
type WithTransitions = Document & { startViewTransition?: (update: () => void) => Transition };

// A transition the browser gives up on (a busy machine: "Transition was aborted because of timeout in DOM update")
// rejects `ready` while the change itself is still made: every promise is handled, or the rejection reaches the
// board's error banner (ErrorBoundary.tsx) and covers the screen.
function quietly(t: Transition): Promise<void> {
  t.ready.catch(() => undefined);
  t.updateCallbackDone.catch(() => undefined);
  return t.finished.catch(() => undefined);
}

function canTransition(doc: WithTransitions): boolean {
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return !!doc.startViewTransition && !still && doc.visibilityState === "visible";
}

export function withTransition(update: () => void): void {
  const doc = document as WithTransitions;
  if (!canTransition(doc)) return update();
  try {
    quietly(doc.startViewTransition(() => flushSync(update)));
  } catch {
    update();
  }
}

// Opening a trip from its card and going back (hareket dili, docs/mockups/hareket): the card's photo grows into the
// trip's hero photo, and shrinks back into its card. Only the two photos of the change carry the shared name, and only
// while it runs (a name must be unique on the page). The rest of the screen crossfades as in withTransition.
const PHOTO = "trip-photo";
const way = (doc: Document, to?: "open" | "back") => {
  const root = doc.documentElement;
  if (!root) return;
  if (to) root.dataset.photo = to;
  else delete root.dataset.photo;
};
let carrying = false;
/** True while a trip's photo is being carried to its hero: the opening (opening.ts) then leaves the hero photo as it lands. */
export const photoCarried = () => carrying;

const cardPhoto = (tripId: string) => document.querySelector<HTMLElement>(`[data-trip-card="${CSS.escape(tripId)}"] .pic`);
const heroPhoto = () => document.querySelector<HTMLElement>(".x-hero .x-big");

/** `open`: from the trip's card on the home to its board; else from the board back to the home, landing on the card. */
export function withTripPhoto(update: () => void, tripId: string, open: boolean): void {
  const doc = document as WithTransitions;
  if (!canTransition(doc)) return update();
  const from = open ? cardPhoto(tripId) : heroPhoto();
  const name = (el: HTMLElement | null, on: boolean) => el?.style.setProperty("view-transition-name", on ? PHOTO : "");
  let to: HTMLElement | null = null;
  name(from, true);
  // (m-cekmece) the photo takes 600 ms to grow into the hero and 420 ms to shrink back: app.css reads the way from the root.
  way(doc, open ? "open" : "back");
  try {
    carrying = open;
    quietly(
      doc.startViewTransition(() => {
        name(from, false);
        flushSync(update);
        to = open ? heroPhoto() : cardPhoto(tripId);
        name(to, true);
      }),
    ).finally(() => {
      carrying = false;
      name(to, false);
      way(doc);
    });
  } catch {
    carrying = false;
    name(from, false);
    way(doc);
    update();
  }
}
