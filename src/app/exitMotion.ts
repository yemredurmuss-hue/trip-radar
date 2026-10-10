// (hareket dili, docs/mockups/hareket) A window or drawer leaves the way it came in, only quicker. The app takes them out at once
// (`{open && <Modal />}`), so the moment one is taken out a still copy of it is put back over the page, fades (the card shrinks a little,
// the drawer slides back out) and is dropped. The copy can't be pointed at, focused or read by a screen reader, and keeps no ids.
// Card options (.ch-sheet) are left out, as on the way in: the cards have their own design line. Nothing for "azaltılmış hareket".
import { reducedMotion } from "./motion";

/** What leaves this way: the entrances of app.css's "Hareket dili" block. */
export const LEAVING = ".modal, .overlay, .drawer, .compare-modal, .pk-sheet-back";
/** The copy is dropped after this long (ms): --t-quick, and the drawer's --t-base, with a little room. */
export const EXIT_MS = 320;

/** True for an element that should leave with a copy: one of the windows, not a card's options, not a copy itself. Pure on the element. */
export function leavesWithCopy(el: Element): boolean {
  return el.matches(LEAVING) && !el.classList.contains("mv-leaving") && !el.querySelector(".ch-sheet") && !el.matches(".ch-sheet");
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
