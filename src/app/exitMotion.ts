// (hareket dili, docs/mockups/hareket) A window, a drawer or the undo toast leaves the way it came in, only quicker. The app takes them out at once
// (`{open && <Modal />}`), so the moment one is taken out a still copy of it is put back over the page, fades (the card shrinks a little,
// the drawer slides back out) and is dropped. The copy can't be pointed at, focused or read by a screen reader, and keeps no ids.
// A card's options are its own back (.ch-back, plan-v30) with their own flip, not a window: not touched here. Nothing for
// "azaltılmış hareket".
import { reducedMotion } from "./motion";

/** What leaves this way: the entrances of app.css's "Hareket dili" block, and the undo toast (it only fades). */
export const LEAVING = ".modal, .overlay, .drawer, .compare-modal, .pk-sheet-back, .pk-undo";
/** The copy is dropped after this long (ms): --t-quick, and the drawer's --t-base, with a little room. */
export const EXIT_MS = 320;

/** True for an element that should leave with a copy: one of the windows, not a copy itself. Pure on the element. */
export function leavesWithCopy(el: Element): boolean {
  return el.matches(LEAVING) && !el.classList.contains("mv-leaving");
}

export function installExitMotion(doc: Document = document): () => void {
  if (typeof MutationObserver !== "function") return () => {};
  const observer = new MutationObserver((records) => {
    if (reducedMotion()) return;
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (!(node instanceof HTMLElement) || !leavesWithCopy(node)) continue;
        const copy = node.cloneNode(true) as HTMLElement;
        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
        copy.classList.add("mv-leaving");
        copy.setAttribute("aria-hidden", "true");
        copy.inert = true;
        doc.body.appendChild(copy);
        setTimeout(() => copy.remove(), EXIT_MS);
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
