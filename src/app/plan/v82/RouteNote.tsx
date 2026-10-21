// A way said on a leg with nothing to book (plan v13, spec 2026-10-21 K85): a taxi, the metro, a walk, the airport bus,
// one's own car. Not a card: one line under the category's cards ("Yol notları"), its route, its day and "rezervasyon
// gerekmez", and the way's name on a button that opens "Nasıl gideceksin?" (the leg's ways, ticketFrame.wayChoices). A way
// that needs a booking (a private transfer) makes the leg a card again. Arrows, Home and End move in the menu; Escape and
// a click outside close it, the button keeps the focus.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { L } from "../../../lib/i18n";
import { headName } from "../../../lib/intentFrame";
import type { IntentVM } from "../../../lib/intents";
import { wayChoices } from "../../../lib/ticketFrame";
import type { LegMode } from "../../../lib/types";
import { Ic } from "./icons";

/** Ways that need a booking: picking one turns the note into a card ("kart olur"). */
const BOOKS: readonly LegMode[] = ["transfer", "flight", "ferry"];

/** A way said on the leg with nothing to book (legSaid, a rented car's): drawn as a note, not a card. */
export function isRouteNote(vm: Pick<IntentVM, "legKey" | "itemIds" | "status" | "modes" | "ticket">): boolean {
  if (vm.legKey == null || vm.itemIds.length > 0 || vm.status !== "arranged") return false;
  const mode = vm.ticket?.wayMode ?? null;
  return mode == null ? vm.modes.length > 0 : !BOOKS.includes(mode);
}

export function RouteNote({ vm, menu, onPick, onOwn, domId }: { vm: IntentVM; menu: ReactNode; onPick: (mode: LegMode) => void; onOwn: () => void; domId?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const current = vm.ticket?.wayMode ?? null;
  const ways = wayChoices(vm.modes);
  const now = ways.find((w) => w.mode === current) ?? null;
  // The stay it ends at by its name ("Jardim Stay"), not the site it was saved from: the ticket's big word there is the site.
  const toEnd = vm.ticket?.to ?? null;
  const toName = toEnd?.place && !/^[A-Z]{3}$/.test(toEnd.place) && !/·/.test(toEnd.place) ? toEnd.place : null;
  const route = vm.head.route ? `${vm.head.route.from} → ${toName ?? vm.head.route.to}` : headName(vm);
  const meta = [...vm.head.parts.filter((p) => !/→/.test(p)), vm.note].filter(Boolean).join(" · ");
  useEffect(() => {
    if (!open) return;
    const first = box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? box.current?.querySelector<HTMLButtonElement>("[role=menuitemradio]");
    first?.focus();
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && e.target !== btn.current) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };
  return (
    <div className={`z-note13${open ? " open" : ""}`} id={domId} data-intent={vm.key} data-mode={current ?? undefined}>
      <span className="z-nic" aria-hidden>
        {now ? <img src={`illus/${now.art}.png`} alt="" /> : <Ic name="pin" size={18} />}
      </span>
      <span className="z-nt">
        <b title={route}>{route}</b>
        {meta && <span>{meta}</span>}
      </span>
      <button ref={btn} type="button" className="z-nsw" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={L(`Nasıl gideceksin: ${now?.label ?? "seç"}`, `How you'll go: ${now?.label ?? "pick"}`)} onClick={() => setOpen(!open)}>
        {now?.label ?? L("Nasıl gideceksin?", "How will you go?")}
        <Ic name="chev" size={13} />
      </button>
      {menu}
      {open && (
        <div ref={box} id={menuId} className="z-nmenu" role="menu" aria-label={L("Nasıl gideceksin?", "How will you go?")} onKeyDown={onKey}>
          <p>{L("Nasıl gideceksin?", "How will you go?")}</p>
          {ways.map((w) => (
            <button key={w.mode} type="button" role="menuitemradio" aria-checked={w.mode === current} tabIndex={w.mode === current ? 0 : -1} onClick={() => (setOpen(false), onPick(w.mode))}>
              <img src={`illus/${w.art}.png`} alt="" />
              <span className="z-no">
                <b>{w.label}</b>
                <small>{BOOKS.includes(w.mode) ? L("rezervasyon ister", "needs a booking") : L("rezervasyon gerekmez", "no booking needed")}</small>
              </span>
              {w.mode === current ? <Ic name="check" size={15} stroke={3} /> : BOOKS.includes(w.mode) ? <em>{L("kart olur", "becomes a card")}</em> : <i />}
            </button>
          ))}
          <button type="button" role="menuitemradio" aria-checked={false} tabIndex={-1} onClick={() => (setOpen(false), onOwn())}>
            <span className="z-nown" aria-hidden>
              <Ic name="check" size={16} stroke={2.6} />
            </span>
            <span className="z-no">
              <b>{L("Ben hallettim", "I've got it")}</b>
              <small>{L("biri alacak, kendim ayarladım", "someone picks me up, I sorted it")}</small>
            </span>
            <i />
          </button>
        </div>
      )}
    </div>
  );
}
