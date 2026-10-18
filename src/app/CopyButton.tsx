// "Kopyala" (docs/mockups/ux-katmanli-arayuz, "Tek tıkla kopyala"): a booking code, an address or an airport code gets a
// small button that shows on hover or focus (always on a touch screen). It sits over the page beside the text and takes
// no room of its own, so nothing moves. A click copies and the label says "Kopyalandı ✓" for a moment; when the browser
// refuses the clipboard the text is selected instead ("Seçildi, ⌘C"). The button is empty and zero wide: its pill and
// words are drawn by CSS (data-label), so the text around the code reads and copies exactly as before ("LIS · 19:40").
import { useEffect, useRef, useState, type ReactNode } from "react";
import { copyOrSelect } from "../lib/copyText";
import { L } from "../lib/i18n";

const SHOWN_MS = 1600;

export function CopyText({ value, children, side = "right", label }: {
  value: string;
  children: ReactNode;
  /** Where its pill shows: beside the text, or under it where the text is at a card's edge. */
  side?: "right" | "below";
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
  const button = (
    <button
      type="button"
      className={`cpy-b${state === "idle" ? "" : " done"}`}
      data-label={word}
      aria-label={state === "idle" ? `${label ? `${label}: ` : ""}${value} ${L("kopyala", "copy")}` : word}
      onClick={copy}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.stopPropagation()}
    />
  );
  return (
    <span className={`cpy ${side}`}>
      <span className="cpy-t" ref={text}>{children}</span>
      {button}
    </span>
  );
}
