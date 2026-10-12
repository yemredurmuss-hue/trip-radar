// (hareket dili, docs/mockups/hareket "Plana koy: kart uçar") A press on "Plana koy" (Pano, a Pano group's options, the swipe card):
// a small copy of the card's name flies in an arc to the Plan tab, and the tab gives a little hop: where it went is seen, not only told.
// Found by the button's words (each of those buttons says only that), so the cards' own files are not touched. Nothing when the Plan tab
// isn't on screen, nothing for "azaltılmış hareket".
import { reducedMotion } from "./motion";

/** The words of a "Plana koy" / "Plana ekle" button (the cards of v30 say "Plana ekle"), in either language, with or without its "+". Pure. */
export const isPutButton = (text: string) => /^\+?\s*(plana koy|plana ekle|add to plan|add to the plan)$/i.test(text.trim());
/** The name a card shows first, cut to fit the flying chip. Pure. */
export const chipName = (text: string, max = 28) => {
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 1) ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
};

export const FLY_MS = 420;

export function installPutFly(doc: Document = document): () => void {
  const onClick = (e: MouseEvent) => {
    if (reducedMotion()) return;
    const button = (e.target as Element | null)?.closest?.("button");
    if (!button || !isPutButton(button.textContent ?? "")) return;
    const tab = doc.querySelector<HTMLElement>(".view-tabs [role=tab]");
    const to = tab?.getBoundingClientRect();
    if (!tab || !to || to.width === 0) return;
    // the card around the button: the nearest box wider than the button itself
    let card: HTMLElement | null = button.parentElement;
    while (card && card.getBoundingClientRect().width < 160) card = card.parentElement;
    const from = (card ?? button).getBoundingClientRect();
    const chip = doc.createElement("span");
    chip.className = "mv-fly";
    chip.setAttribute("aria-hidden", "true");
    // v30 cards (.ax-c) carry their name as their label; the older ones read it from their first line.
    chip.textContent = chipName(card?.closest<HTMLElement>(".ax-c")?.getAttribute("aria-label") ?? card?.innerText ?? "") || "+1";
    doc.body.appendChild(chip);
    const x0 = from.left + 12, y0 = from.top + 10;
    const x1 = to.left + to.width / 2 - 20, y1 = to.top + to.height / 2 - 14;
    const arc = Math.min(y0, y1) - 60;
    chip
      .animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
          { transform: `translate(${(x0 + x1) / 2}px, ${arc}px) scale(.85)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${x1}px, ${y1}px) scale(.4)`, opacity: 0 },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" },
      )
      .finished.then(() => tab.animate([{ scale: "1" }, { scale: "1.18", offset: 0.4 }, { scale: "1" }], { duration: 380, easing: "cubic-bezier(.2, .9, .3, 1.3)" }))
      .catch(() => undefined)
      .finally(() => chip.remove());
  };
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}
