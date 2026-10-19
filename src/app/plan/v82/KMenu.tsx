// A card's ⋯ and its small windows in a row of cards (plan v82 aşama 4, C20, C26): the menu opens over the page (a portal,
// fixed by the button), so a 224 px card and the box's folding body never cut it. It opens and shuts at once (m-menu);
// Escape and a press outside close it and the focus goes back to its button; it follows its button when the page scrolls
// (a category still moving into place), and closes once the button is out of sight or the window changes size; one open
// at a time (an intent's ⋯ too, through the same pointerdown).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { MenuEntry } from "../../cards/CardShell";
import { Ic } from "./icons";

/** Only one card window open at a time. */
let closeOpen: (() => void) | null = null;

/** Where a window opens by its button: under it, its right edge on the button's (above when there's no room under). */
function placeBy(button: HTMLElement, pop: HTMLElement): { top: number; left: number } {
  const b = button.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const below = b.bottom + 6 + h <= window.innerHeight - 8;
  const top = below ? b.bottom + 6 : Math.max(8, b.top - 6 - h);
  const left = Math.min(Math.max(8, b.right - w), window.innerWidth - w - 8);
  return { top, left };
}

/**
 * A window by its button (the card's ⋯, "Gün ver ›"): placed when it opens, kept by it while the page scrolls, closed by
 * Escape (the focus back on the button), a press outside, its button scrolled out of sight or a new size.
 */
export function usePopover(open: boolean, close: () => void, button: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !button.current || !pop.current) return setAt(null);
    setAt(placeBy(button.current, pop.current));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (closeOpen && closeOpen !== close) closeOpen();
    closeOpen = close;
    const onDown = (e: PointerEvent) => {
      const t = e.target instanceof Node ? e.target : null;
      if (t && (pop.current?.contains(t) || button.current?.contains(t))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      button.current?.focus();
    };
    // A scroll of the page (not of the window itself) moves the button: the window goes with it while it's in sight.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && pop.current?.contains(e.target)) return;
      const b = button.current?.getBoundingClientRect();
      if (!b || !pop.current || b.bottom < 0 || b.top > window.innerHeight) return close();
      setAt(placeBy(button.current!, pop.current));
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      if (closeOpen === close) closeOpen = null;
    };
  }, [open]);
  // Hidden until placed (its size is measured first), then fixed where it belongs.
  return at ? { position: "fixed" as const, top: at.top, left: at.left } : { position: "fixed" as const, top: 0, left: 0, visibility: "hidden" as const };
}

/** A popover's shell over the page. */
export function Popover({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return createPortal(children, document.body);
}

export function KMenu({ entries, label, className = "z-kmb" }: { entries: MenuEntry[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useRef(() => setOpen(false)).current;
  const style = usePopover(open, close, button, pop);
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [open]);
  if (!entries.length) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(pop.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <>
      <button ref={button} type="button" className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}>
        <Ic name="dots" size={14} />
      </button>
      <Popover open={open}>
        <div className="z-mpop z-kpop" role="menu" ref={pop} style={style} onKeyDown={onKey} aria-label={label}>
          {entries.map((m) =>
            m.heading ? (
              <div key={m.label} className="z-mh">{m.label}</div>
            ) : (
              <button key={m.label} type="button" role="menuitem" className={["z-mi", m.danger ? "bad" : "", m.sep ? "sep" : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  setOpen(false);
                  button.current?.focus();
                  m.run();
                }}>
                {m.lead}
                {m.label}
              </button>
            ),
          )}
        </div>
      </Popover>
    </>
  );
}
