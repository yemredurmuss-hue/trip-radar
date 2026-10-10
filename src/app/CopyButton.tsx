// "Kopyala" (docs/mockups/ux-katmanli-arayuz, "Tek tıkla kopyala"): a booking code, an address or an airport code gets a
// small button that shows on hover or focus (always on a touch screen). It sits over the page beside the text and takes
// no room of its own, so nothing moves. A click copies and the label says "Kopyalandı ✓" for a moment; when the browser
// refuses the clipboard the text is selected instead ("Seçildi, ⌘C").
import { useEffect, useRef, useState, type ReactNode } from "react";
import { copyOrSelect } from "../lib/copyText";
import { L } from "../lib/i18n";

const SHOWN_MS = 1600;

export function CopyText({ value, children, side = "right", label }: {
  value: string;
  children: ReactNode;
  /** Which side of the text the button sits on: the left one for text at the right edge of a card. */
  side?: "left" | "right";
  /** What is copied, for a screen reader ("Rezervasyon kodu"). */
  label?: string;
}) {
  const text = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  useEffect(() => () => clearTimeout(timer.current), []);
  const select = () => {
    const el = text.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };
  const copy = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    // (the card around it opens on a click; its body toggles on Enter / Space)
    e.stopPropagation();
    e.preventDefault();
    void copyOrSelect(value, select).then((result) => {
      setState(result);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), SHOWN_MS);
    });
  };
  const word = state === "copied" ? L("Kopyalandı ✓", "Copied ✓") : state === "selected" ? L("Seçildi, ⌘C", "Selected, ⌘C") : L("Kopyala", "Copy");
  return (
    <span className={`cpy ${side}`}>
      <span className="cpy-t" ref={text}>{children}</span>
      <button
        type="button"
        className={`cpy-b${state === "idle" ? "" : " done"}`}
        aria-label={`${label ? `${label}: ` : ""}${value} ${L("kopyala", "copy")}`}
        onClick={copy}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.stopPropagation()}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 9h10v11H9zM5 15V4h10" />
        </svg>
        <span aria-live="polite">{word}</span>
      </button>
    </span>
  );
}
