// An intent's ⋯ (plan v82 "ⓘ, × ve ⋯ tek ⋯ menüsünde"; B13, C21): Ayrıntı, Gerek yok, Ben hallettim, then what the old
// card's ••• did for it (Seçimi geri al, Rezervasyonu geri al, Çıkar, Düzenle, Belge ekle, eSIM kuruldu, Kimin için?, Sil).
// It opens and shuts at once (m-menu); Escape and a press outside close it, the focus goes back to ⋯; one open at a time.
import { useEffect, useRef, useState } from "react";
import { L } from "../../../lib/i18n";
import type { MenuEntry } from "../../cards/CardShell";
import { Ic } from "./icons";

/** Only one ⋯ open at a time: opening one closes the other. */
let closeOpen: (() => void) | null = null;

export function IntentMenu({ entries, name }: { entries: MenuEntry[]; name: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    if (closeOpen && closeOpen !== close) closeOpen();
    closeOpen = close;
    pop.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && wrap.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(pop.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      if (closeOpen === close) closeOpen = null;
    };
  }, [open]);
  if (!entries.length) return null;
  return (
    <div className="z-menu" ref={wrap}>
      <button ref={button} type="button" className="z-mb" aria-label={L(`${name}: diğer`, `${name}: more`)} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Ic name="dots" size={16} />
      </button>
      {open && (
        <div className="z-mpop" role="menu" ref={pop}>
          {entries.map((m) =>
            m.heading ? (
              <div key={m.label} className="z-mh">{m.label}</div>
            ) : (
              <button key={m.label} type="button" role={m.checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={m.checked}
                className={["z-mi", m.danger ? "bad" : "", m.sep ? "sep" : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  if (m.checked === undefined) {
                    setOpen(false);
                    button.current?.focus();
                  }
                  m.run();
                }}>
                {m.lead}
                {m.label}
                {m.checked && <span className="z-mt" aria-hidden>✓</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
