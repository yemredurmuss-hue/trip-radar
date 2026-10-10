// The icons that show on a card's top edge while it is pointed at (docs/mockups/ux-katmanli-arayuz, "••• yerine eylem
// ikonları"): the most used entries of the card's menu, each running the same action as its menu line. It only adds:
// the card's ••• and ×, and every menu line, stay where they are (a keyboard and a touch screen use those), so the
// strip is hidden from a screen reader and from Tab, and not drawn on a touch screen at all. An entry with no icon here
// is only in the menu.
import type { ReactNode } from "react";
import type { MenuEntry } from "./CardShell";

const svg = (d: ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

/** By the menu entry's id (stageMenu.tsx): Düzenle, Değiştir, Belge ekle, İptal ettim. Sil and Çıkar stay in the menu only. */
const ICONS: Record<string, ReactNode> = {
  edit: svg(<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />),
  change: svg(<path d="M7 7h11l-3-3M17 17H6l3 3" />),
  addDoc: svg(<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14.5 7" />),
  cancel: svg(<><circle cx="12" cy="12" r="8" /><path d="m6.5 6.5 11 11" /></>),
};

export function ActionStrip({ entries }: { entries: MenuEntry[] }) {
  const shown = entries.filter((e) => e.id && ICONS[e.id]);
  if (!shown.length) return null;
  return (
    <span className="pk-strip" aria-hidden>
      {shown.map((e) => (
        <button key={e.id} type="button" tabIndex={-1} title={e.label} onClick={(ev) => (ev.stopPropagation(), e.run())}>
          {ICONS[e.id!]}
        </button>
      ))}
    </span>
  );
}
