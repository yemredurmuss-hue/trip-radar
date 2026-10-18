// The trip's ⋯ menu on the cover's top left (v83 C1): Belgeler, Paylaş, Planı PDF indir, Rotayı haritada gör, Geçmiş ve
// çöp kutusu, Yeni sohbet, Link ekle, Ayarlar, and apart in red "Geziyi sil". Each runs what the board already does there;
// one that can't be done here (no route to draw, a trip that can't be shared) isn't in the list. Arrow keys move in it.
import { useEffect, useRef } from "react";
import { L } from "../../lib/i18n";
import { XIcon, type XIconName } from "./icons";
import { usePop } from "./usePop";

export interface TripMenuActions {
  /** Belgeler: today the board's Belgeler view (the Pano phase turns it into the Pano's own). */
  onDocs: () => void;
  onShare?: () => void;
  onPdf: () => void;
  /** Rotayı haritada gör: the route on Google Maps, when the saves place it. */
  mapUrl: string | null;
  onHistory?: () => void;
  onNewChat: () => void;
  onLink: () => void;
  onSettings?: () => void;
  onDelete?: () => void;
}

type Row = { key: string; icon: XIconName; label: string; run?: () => void; href?: string };

export function TripMenu({ actions }: { actions: TripMenuActions }) {
  const pop = usePop();
  const list = useRef<HTMLDivElement>(null);
  // Opened (a click or the keyboard): the first item takes the focus, so the arrows work at once.
  useEffect(() => {
    if (pop.open) list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [pop.open]);
  const rows: Row[] = [
    { key: "docs", icon: "doc", label: L("Belgeler", "Documents"), run: actions.onDocs },
    ...(actions.onShare ? [{ key: "share", icon: "share" as const, label: L("Paylaş", "Share"), run: actions.onShare }] : []),
    { key: "pdf", icon: "pdf", label: L("Planı PDF indir", "Download the plan as PDF"), run: actions.onPdf },
    ...(actions.mapUrl ? [{ key: "map", icon: "map" as const, label: L("Rotayı haritada gör", "See the route on a map"), href: actions.mapUrl }] : []),
    ...(actions.onHistory ? [{ key: "hist", icon: "hist" as const, label: L("Geçmiş ve çöp kutusu", "History and trash"), run: actions.onHistory }] : []),
    { key: "chat", icon: "newchat", label: L("Yeni sohbet", "New chat"), run: actions.onNewChat },
    { key: "link", icon: "link", label: L("Link ekle", "Add a link"), run: actions.onLink },
    ...(actions.onSettings ? [{ key: "set", icon: "gear" as const, label: L("Ayarlar", "Settings"), run: actions.onSettings }] : []),
  ];
  const pick = (run?: () => void) => {
    pop.close();
    run?.();
  };
  // Up and down walk the items (round), Home and End go to the ends.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to = e.key === "ArrowDown" ? (at + 1) % items.length : e.key === "ArrowUp" ? (at - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    items[to]?.focus();
  };
  return (
    <div
      className="x-tmenu"
      ref={pop.box}
      // Tabbed away from the menu: it closes (a click outside does too).
      onBlur={(e) => {
        if (pop.open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) pop.close();
      }}
    >
      <button
        ref={pop.trigger}
        type="button"
        className="x-tmb"
        aria-label={L("Gezi menüsü", "Trip menu")}
        aria-haspopup="menu"
        aria-expanded={pop.open}
        onClick={pop.toggle}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" || pop.open) return;
          e.preventDefault();
          pop.toggle();
        }}
      >
        <XIcon name="dots" size={20} stroke={2.6} />
      </button>
      {pop.shown && (
        <div
          className={`x-pop x-tm-pop${pop.leaving ? " x-out" : ""}`}
          role="menu"
          aria-label={L("Gezi menüsü", "Trip menu")}
          onKeyDown={onKey}
          ref={list}
        >
          {rows.map((r) =>
            r.href ? (
              <a key={r.key} className="x-tmi" role="menuitem" data-tm={r.key} href={r.href} target="_blank" rel="noreferrer" onClick={() => pop.close()}>
                <XIcon name={r.icon} stroke={1.9} />
                {r.label}
              </a>
            ) : (
              <button key={r.key} type="button" className="x-tmi" role="menuitem" data-tm={r.key} onClick={() => pick(r.run)}>
                <XIcon name={r.icon} stroke={1.9} />
                {r.label}
              </button>
            ),
          )}
          {actions.onDelete && (
            <>
              <div className="x-sep" role="separator" />
              <button type="button" className="x-tmi bad" role="menuitem" data-tm="del" onClick={() => pick(actions.onDelete)}>
                <XIcon name="trash" stroke={1.9} />
                {L("Geziyi sil", "Delete the trip")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
