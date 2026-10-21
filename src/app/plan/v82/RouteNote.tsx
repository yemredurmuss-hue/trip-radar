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
import type { RailDate } from "../../../lib/railDates";
import { Ic } from "./icons";
import { RailCol, useRowOpen } from "./IntentRow";

/** The ways that are a note (K85): a taxi, the metro, a walk, one's own car. Anything else needs a ticket or a booking. */
const NOTE_MODES: readonly LegMode[] = ["taxi", "metro", "walk", "car"];
/** A change of city, not a way across one: its ways include a ticket's (memory: transport booking logic). */
const CITY_CHANGE: readonly LegMode[] = ["train", "flight", "ferry"];
const cityChange = (modes: readonly LegMode[]) => modes.some((m) => CITY_CHANGE.includes(m));
/** Needs a ticket or a booking: a bus between cities does, the airport bus doesn't ("bilet otobüste", K85). */
const books = (m: LegMode, modes: readonly LegMode[]) => !(NOTE_MODES.includes(m) || (m === "bus" && !cityChange(modes)));

/**
 * A way said on the leg with nothing to book (legSaid, a rented car's): drawn as a note, not a card. "Ben hallettim" with no
 * way named is a note on a transfer, but stays the card it was ("Ayarlandı") on a change of city (review).
 */
export function isRouteNote(vm: Pick<IntentVM, "legKey" | "itemIds" | "status" | "modes" | "ticket">): boolean {
  if (vm.legKey == null || vm.itemIds.length > 0 || vm.status !== "arranged") return false;
  const mode = vm.ticket?.wayMode ?? null;
  return mode == null ? vm.modes.length > 0 && !cityChange(vm.modes) : !books(mode, vm.modes);
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
                <small>{books(w.mode, vm.modes) ? L("rezervasyon ister", "needs a booking") : L("rezervasyon gerekmez", "no booking needed")}</small>
              </span>
              {w.mode === current ? <Ic name="check" size={15} stroke={3} /> : books(w.mode, vm.modes) ? <em>{L("kart olur", "becomes a card")}</em> : <i />}
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

/**
 * Yerinde (plan v14, onay paketi 2026-10-21: Ulaşım): the same way with nothing to book on a dated category's rail. A quiet
 * thin row: its kind's word and "yerinde" over its route, its day and note, the grey-blue "Yerinde" hap in its slot; no
 * price is written (none is known, C19). Pressed, the ways open under it, the one said ticked ("Nasıl gidilir"), each
 * saying whether it needs a booking (one that does makes the leg a card again), "Ben hallettim", and the map's directions.
 */
export function YerindeRow({ vm, date, menu, onPick, onOwn, map }: { vm: IntentVM; date: RailDate | null; menu: ReactNode; onPick: (mode: LegMode) => void; onOwn: () => void; map: string | null }) {
  const [open, setOpen] = useRowOpen(vm.key);
  const panelId = useId();
  const current = vm.ticket?.wayMode ?? null;
  const ways = wayChoices(vm.modes);
  const now = ways.find((w) => w.mode === current) ?? null;
  const toEnd = vm.ticket?.to ?? null;
  const toName = toEnd?.place && !/^[A-Z]{3}$/.test(toEnd.place) && !/·/.test(toEnd.place) ? toEnd.place : null;
  // (a stay's end by its name, never the site it was saved from: the same on both ends)
  const fromEnd = vm.ticket?.from ?? null;
  const fromName = fromEnd?.place && !/^[A-Z]{3}$/.test(fromEnd.place) && !/·/.test(fromEnd.place) ? fromEnd.place : null;
  const from = fromName ?? vm.head.route?.from ?? null;
  const to = toName ?? vm.head.route?.to ?? null;
  const meta = [...vm.head.parts.filter((p) => !/→/.test(p) && !/\d+ [A-ZÇĞİÖŞÜa-zçğıöşü]{3}/.test(p)), vm.note].filter(Boolean).join(" · ");
  const art = now ? `illus/${now.art}.png` : "illus/taksi-transfer.png";
  return (
    <div className={`q-row${open ? " open" : ""}`} data-face="yer">
      <RailCol date={date} editable={false} />
      <div className="q-rcard yer">
        <div
          className="q-rrow"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            setOpen(!open);
          }}
        >
          <span className="q-rmark yer" aria-hidden>
            <img src={art} alt="" />
          </span>
          <span className="q-rhd">
            <span className="q-rlead">{[now?.label ?? L("Yol", "Way"), L("yerinde", "on the spot")].join(" · ")}</span>
            <h4 className="q-nm" title={from && to ? `${from} → ${to}` : headName(vm)}>
              {from && to ? (
                <>
                  {from} <i>→</i> {to}
                </>
              ) : (
                headName(vm)
              )}
            </h4>
            {meta && <span className="q-rln"><span>{meta}</span></span>}
          </span>
          <span className="q-rfig" />
          <span className="q-rslot">
            <span className="q-st q-rhap yer">{L("Yerinde", "On the spot")}</span>
          </span>
          <span className="q-rmenu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {menu}
          </span>
        </div>
        <div className="q-rp" id={panelId} hidden={!open}>
          {open && (
            <div className="q-yp" role="radiogroup" aria-label={L("Nasıl gidilir", "How to get there")}>
              <p className="q-ypt">{L("Nasıl gidilir · rezervasyon gerekmez, yerinde ödenir", "How to get there · nothing to book, paid on the spot")}</p>
              {ways.map((w) => {
                const on = w.mode === current;
                const booking = books(w.mode, vm.modes);
                return (
                  <button key={w.mode} type="button" role="radio" aria-checked={on} className={`q-yo${on ? " on" : ""}`} onClick={() => onPick(w.mode)}>
                    <span className="q-yr" aria-hidden>{on && <Ic name="check" size={12} stroke={3} />}</span>
                    <img src={`illus/${w.art}.png`} alt="" />
                    <span className="q-rhd">
                      <b>{w.label}</b>
                      <small>{booking ? L("rezervasyon ister · kart olur", "needs a booking · becomes a card") : L("rezervasyon gerekmez", "no booking needed")}</small>
                    </span>
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={false} className="q-yo" onClick={onOwn}>
                <span className="q-yr" aria-hidden />
                <span className="q-yown" aria-hidden>
                  <Ic name="check" size={14} stroke={2.6} />
                </span>
                <span className="q-rhd">
                  <b>{L("Ben hallettim", "I've got it")}</b>
                  <small>{L("biri alacak, kendim ayarladım", "someone picks me up, I sorted it")}</small>
                </span>
              </button>
              {map && (
                <div className="q-racts">
                  <span className="q-rsp" />
                  <a className="q-got" href={map} target="_blank" rel="noreferrer">
                    <Ic name="pin" size={14} /> {L("Haritada aç ↗", "Open the map ↗")}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
