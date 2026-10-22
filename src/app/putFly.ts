// (hareket dili, docs/mockups/hareket "Plana koy: kart uçar") A press on "Plana koy" (Pano, a Pano group's options, the swipe card):
// a small copy of the card's name flies in an arc (420 ms) to where it went and that gives a little hop: where it went is seen, not only told.
// Where it went is the Plan's section the card sits in, when that section's header is on screen: its number jumps (1.35x, 380 ms). On the
// Pano no section is drawn, so the Plan tab stays the target (it hops 1.18x). Found by the button's words (each of those buttons says only
// that), so the cards' own files are not touched. Nothing when neither is on screen, nothing for "azaltılmış hareket".
// Plan v82 (E6, E §2.6): in a row of cards (Etkinlik, Yapılacaklar) the card itself flies from Öneriler to its slot in Planında
// (420 ms, e-move), the cards left behind slide into the gap (260 ms, e-out) and Planında's count jumps (1.35x, 380 ms); a full
// Planında's "+n Pano'da" jumps instead. With "azaltılmış hareket" or "Hareketi duraklat" the card is simply there, with a 2 px
// edge for 1.6 s. Its slot is known once the plan has it: the flight leaves when the new card is drawn.
import { reducedMotion } from "./motion";

/** The words of a "Plana koy" / "Plana ekle" button (the cards of v30 say "Plana ekle"), in either language, with or without its "+". Pure. */
export const isPutButton = (text: string) => /^\+?\s*(plana koy|plana ekle|add to plan|add to the plan)$/i.test(text.trim());
/** The name a card shows first, cut to fit the flying chip. Pure. */
export const chipName = (text: string, max = 28) => {
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 1) ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
};

/** The flying chip's words: the card's own name (the label of a v46 .ev-card or a Pano .pn-card), else its first line. Never the price. */
export const chipLabel = (card: { closest?: (sel: string) => { getAttribute: (n: string) => string | null } | null; innerText?: string } | null) =>
  chipName(card?.closest?.(".ev-card, .pn-card")?.getAttribute("aria-label") ?? card?.innerText ?? "") || "+1";

export const FLY_MS = 420;
/** The number's jump (m-planakoy): 1.35x over 380 ms, springing back. */
export const BUMP_MS = 380;
export const BUMP_SCALE = 1.35;

/** The mark a section's header counts by (its number, else its icon); plan v82's row: its state line, else its icon. */
export const SECTION_MARKS = [".cat-head .cat-n", ".cat-head .cat-ic", ".q-row1 .q-pl1", ".q-row1 .q-meters", ".q-row1 .q-ic"] as const;

/** True for a box with a size that lies inside the window (a header scrolled out of sight is no target). Pure on the rect. */
export const onScreen = (r: { top: number; bottom: number; width: number; height: number }, viewHeight: number) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= viewHeight;

type Rect = { left: number; top: number; width: number; height: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The move that lays a card at `from` over `to` (its corner on the slot's, its size the slot's). Pure. */
export const slotTransform = (from: Rect, to: Rect): string =>
  `translate(${Math.round(to.left - from.left)}px, ${Math.round(to.top - from.top)}px) scale(${round2(to.width / (from.width || 1))}, ${round2(to.height / (from.height || 1))})`;

/** The card that came into a row: the first key there now that wasn't before. Pure. */
export const arrivedKey = (before: readonly string[], after: readonly string[]): string | null => after.find((k) => !before.includes(k)) ?? null;

/** How long the flight to Planında waits for its slot before it lets go (a write that never lands). */
export const SLOT_WAIT_MS = 1500;
/** The cards left in Öneriler slide into the gap (E §2.6). */
export const SLIDE_MS = 260;
/** Reduced motion: the new card's 2 px edge. */
export const LANDED_MS = 1600;

const cardsOf = (row: Element): HTMLElement[] => [...row.querySelectorAll<HTMLElement>(":scope > .z-k[data-k]")];
const keysOf = (row: Element): string[] => cardsOf(row).map((e) => e.dataset.k ?? "");

function jump(el: Element | null) {
  if (!el) return;
  el.classList.remove("bump");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("bump");
  setTimeout(() => el.classList.remove("bump"), BUMP_MS + 40);
}

/**
 * "+ Plana koy" on a card of a row's Öneriler: true when it's handled here (the card flies to its slot), false for any other
 * "Plana koy" (the Pano's, a category's), which keeps the chip's flight.
 */
function flyToSlot(button: HTMLElement, doc: Document): boolean {
  const card = button.closest<HTMLElement>(".z-k[data-k]");
  const ideas = card?.closest<HTMLElement>('[data-row="ideas"]');
  const box = ideas?.closest<HTMLElement>(".q-int");
  const plan = box?.querySelector<HTMLElement>('[data-row="plan"]');
  if (!card || !ideas || !box || !plan) return false;
  const still = reducedMotion();
  const from = card.getBoundingClientRect();
  const before = keysOf(plan);
  const moreBefore = plan.querySelector(".z-more")?.textContent ?? null;
  const left = new Map(cardsOf(ideas).filter((e) => e !== card).map((e) => [e.dataset.k ?? "", e.getBoundingClientRect()] as const));
  let clone: HTMLElement | null = null;
  if (!still) {
    clone = card.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-k");
    clone.removeAttribute("data-item-id");
    clone.setAttribute("aria-hidden", "true");
    clone.classList.remove("ar-new");
    clone.classList.add("z-fly");
    Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    doc.body.appendChild(clone);
    card.style.visibility = "hidden";
  }
  let over = false;
  const finish = (target: HTMLElement | null, isMore: boolean) => {
    if (over) return;
    over = true;
    observer.disconnect();
    clearTimeout(timer);
    if (!target) {
      clone?.remove();
      card.style.visibility = "";
      return;
    }
    if (still) {
      target.classList.add("landed");
      setTimeout(() => target.classList.remove("landed"), LANDED_MS);
      return;
    }
    // What stayed in Öneriler slides into the gap the card left.
    for (const el of cardsOf(ideas)) {
      const was = left.get(el.dataset.k ?? "");
      if (!was) continue;
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: SLIDE_MS, easing: "cubic-bezier(.16, 1, .3, 1)" });
    }
    const to = target.getBoundingClientRect();
    if (!isMore) target.style.visibility = "hidden";
    requestAnimationFrame(() => {
      if (!clone) return;
      clone.style.transform = slotTransform(from, to);
      clone.style.opacity = ".15";
    });
    setTimeout(() => {
      clone?.remove();
      target.style.visibility = "";
      jump(isMore ? target : box.querySelector(".q-planw .q-ppn"));
    }, FLY_MS);
  };
  const look = () => {
    const key = arrivedKey(before, keysOf(plan));
    const target = key ? cardsOf(plan).find((e) => e.dataset.k === key) ?? null : null;
    if (target) return finish(target, false);
    // A full Planında: the card goes to "+n Pano'da", which changes.
    const more = plan.querySelector<HTMLElement>(".z-more");
    if (more && more.textContent !== moreBefore) finish(more, true);
  };
  const observer = new MutationObserver(look);
  observer.observe(box, { childList: true, subtree: true, characterData: true });
  const timer = setTimeout(() => finish(null, false), SLOT_WAIT_MS);
  return true;
}

export function installPutFly(doc: Document = document): () => void {
  const onClick = (e: MouseEvent) => {
    const button = (e.target as Element | null)?.closest?.("button");
    if (!button || !isPutButton(button.textContent ?? "")) return;
    if (flyToSlot(button, doc)) return;
    if (reducedMotion()) return;
    // Where it lands: the number of the Plan's section the card is in (on screen), else the Plan tab.
    const section = button.closest("[data-section]");
    const mark = SECTION_MARKS.map((sel) => section?.querySelector<HTMLElement>(sel) ?? null).find(Boolean) ?? null;
    const markBox = mark?.getBoundingClientRect();
    const view = doc.defaultView?.innerHeight ?? 0;
    // The tab, as before; scrolled out of sight, the thin bar's own Plan button stands in for it (hero/HeroMini).
    const tab0 = doc.querySelector<HTMLElement>(".view-tabs [role=tab]");
    const tab = tab0 && onScreen(tab0.getBoundingClientRect(), view) ? tab0 : (doc.querySelector<HTMLElement>(".h-mini.on .h-tabs button") ?? tab0);
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
    // The Pano's cards (.pn-card) carry their name as their label too; their own first line is the price.
    chip.textContent = chipLabel(card);
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
