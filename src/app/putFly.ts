// (hareket dili, docs/mockups/hareket "Plana koy: kart uçar") A press on "Plana koy" (Pano, a Pano group's options, the swipe card):
// a small copy of the card's name flies in an arc (420 ms) to where it went and that gives a little hop: where it went is seen, not only told.
// Where it went is the Plan's section the card sits in, when that section's header is on screen: its number jumps (1.35x, 380 ms). On the
// Pano no section is drawn, so the Plan tab stays the target (it hops 1.18x). Found by the button's words (each of those buttons says only
// that), so the cards' own files are not touched. Nothing when neither is on screen, nothing for "azaltılmış hareket".
import { reducedMotion } from "./motion";

/** The words of a "Plana koy" / "Plana ekle" button (the cards of v30 say "Plana ekle"), in either language, with or without its "+". Pure. */
export const isPutButton = (text: string) => /^\+?\s*(plana koy|plana ekle|add to plan|add to the plan)$/i.test(text.trim());
/** The name a card shows first, cut to fit the flying chip. Pure. */
export const chipName = (text: string, max = 28) => {
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 1) ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
};

export const FLY_MS = 420;
/** The number's jump (m-planakoy): 1.35x over 380 ms, springing back. */
export const BUMP_MS = 380;
export const BUMP_SCALE = 1.35;

/** The mark a section's header counts by (its number, else its icon). */
export const SECTION_MARKS = [".cat-head .cat-n", ".cat-head .cat-ic"] as const;

/** True for a box with a size that lies inside the window (a header scrolled out of sight is no target). Pure on the rect. */
export const onScreen = (r: { top: number; bottom: number; width: number; height: number }, viewHeight: number) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= viewHeight;

export function installPutFly(doc: Document = document): () => void {
  const onClick = (e: MouseEvent) => {
    if (reducedMotion()) return;
    const button = (e.target as Element | null)?.closest?.("button");
    if (!button || !isPutButton(button.textContent ?? "")) return;
    // Where it lands: the number of the Plan's section the card is in (on screen), else the Plan tab.
    const section = button.closest("[data-section]");
    const mark = SECTION_MARKS.map((sel) => section?.querySelector<HTMLElement>(sel) ?? null).find(Boolean) ?? null;
    const markBox = mark?.getBoundingClientRect();
    const view = doc.defaultView?.innerHeight ?? 0;
    // The tab, as before; scrolled out of sight, the sticky bar's own Plan button stands in for it.
    const tab0 = doc.querySelector<HTMLElement>(".view-tabs [role=tab]");
    const tab = tab0 && onScreen(tab0.getBoundingClientRect(), view) ? tab0 : (doc.querySelector<HTMLElement>(".sbar-tabs button") ?? tab0);
    const target = mark && markBox && onScreen(markBox, view) ? mark : tab;
    const to = target?.getBoundingClientRect();
    if (!target || !to || to.width === 0) return;
    // the card around the button: the nearest box wider than the button itself
    let card: HTMLElement | null = button.parentElement;
    while (card && card.getBoundingClientRect().width < 160) card = card.parentElement;
    const from = (card ?? button).getBoundingClientRect();
    const chip = doc.createElement("span");
    chip.className = "mv-fly";
    chip.setAttribute("aria-hidden", "true");
    // v46 cards (.ev-card) carry their name as their label; the older ones read it from their first line.
    chip.textContent = chipName(card?.closest<HTMLElement>(".ev-card")?.getAttribute("aria-label") ?? card?.innerText ?? "") || "+1";
    doc.body.appendChild(chip);
    const x0 = from.left + 12, y0 = from.top + 10;
    const x1 = to.left + to.width / 2 - 20, y1 = to.top + to.height / 2 - 14;
    const arc = Math.min(y0, y1) - 40;
    chip
      .animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
          { transform: `translate(${(x0 + x1) / 2}px, ${arc}px) scale(.9)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${x1}px, ${y1}px) scale(.6)`, opacity: 0.2 },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" },
      )
      .finished.then(() => target.animate([{ scale: "1" }, { scale: target === tab ? "1.18" : String(BUMP_SCALE), offset: 0.4 }, { scale: "1" }], { duration: BUMP_MS, easing: "cubic-bezier(.2, .9, .3, 1.3)" }))
      .catch(() => undefined)
      .finally(() => chip.remove());
  };
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}
