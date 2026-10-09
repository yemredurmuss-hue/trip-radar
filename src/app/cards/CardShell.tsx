// The frame every plan card shares (etkinlik-v4): the ground says where it stands (sand: not bought yet,
// green: done), a 24 px top line (ring · kind · date | files · •••), the body, the 48 px bottom strip, and
// the details that open inside the card on a tap.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { CardFacts } from "../../lib/cardFacts";
import { cardKindColor, cardKindLabel, type CardKind } from "../../lib/cardKinds";
import { groundOf, type FootView, type Ring as RingState } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { nOptions } from "../../lib/i18nText";
import { Editable, useInlineEdit } from "./InlineEdit";
import { KindIcon, UiIcon } from "./Silhouettes";

export function Ring({ state }: { state: RingState }) {
  const label = { open: L("Karar bekliyor", "To decide"), half: L("Planlandı, rezerve edilmedi", "Planned, not booked"), done: L("Rezerve edildi ya da rezervasyon gerekmiyor", "Booked, or no booking needed") }[state];
  return (
    <span className={`pk-ring ${state}`} role="img" aria-label={label} title={label}>
      {state === "done" && <UiIcon name="check" size={13} />}
    </span>
  );
}

export interface MenuEntry {
  label: string;
  run: () => void;
  danger?: boolean;
  /** A group's title ("Kimin için?"): not a button. */
  heading?: boolean;
  /** Ticked (a multi-choice group): ✓ on the right, and the menu stays open on a tap. */
  checked?: boolean;
  /** Before it, a line (the end of a group). */
  sep?: boolean;
  /** Beside the label: a face (whose it is). */
  lead?: ReactNode;
}

/** Only one ••• menu is open at a time: opening one closes whichever was open (its setter is kept here). */
let closeOpenMenu: (() => void) | null = null;

export function CardMenu({ entries }: { entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    if (closeOpenMenu && closeOpenMenu !== close) closeOpenMenu();
    closeOpenMenu = close;
    // Capture phase: a press anywhere outside closes it, even where a handler stops propagation.
    const onDown = (e: PointerEvent) => {
      if (wrap.current && e.target instanceof Node && wrap.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      if (closeOpenMenu === close) closeOpenMenu = null;
    };
  }, [open]);
  if (!entries.length) return null;
  return (
    <span className="pk-menu-wrap" ref={wrap}>
      <button ref={button} type="button" className="pk-ib" aria-label={L("Kart menüsü", "Card menu")} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <UiIcon name="dots" size={16} />
      </button>
      {open && (
        <div className="pk-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          {entries.map((m) =>
            m.heading ? (
              <div key={m.label} className="pk-menu-h">{m.label}</div>
            ) : (
              <button key={m.label} type="button" role={m.checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={m.checked}
                className={[m.danger ? "danger" : "", m.sep ? "sep" : "", m.checked ? "on" : ""].filter(Boolean).join(" ") || undefined}
                onClick={() => { if (m.checked === undefined) setOpen(false); m.run(); }}>
                {m.lead}
                <span className="pk-menu-l">{m.label}</span>
                {m.checked && <span className="pk-menu-tick" aria-hidden>✓</span>}
              </button>
            ),
          )}
        </div>
      )}
    </span>
  );
}

/**
 * The hover ×: deletes at once with the 8-second "Geri al" (a chore, an idea), or `hide`s: empty nights, and a plan
 * card's record (v11: "Gerek yok", under Gizlenenler). `label` names it otherwise ("Kaldır" on a booking, which asks).
 */
export function DeleteX({ name, onDelete, hide = false, label, className }: { name: string; onDelete: () => void; hide?: boolean; label?: string; className?: string }) {
  const word = label ?? (hide ? L("Gerek yok", "Not needed") : L("Sil", "Delete"));
  return (
    <button type="button" className={`pk-x${className ? ` ${className}` : ""}`}
      aria-label={`${name}: ${word.toLocaleLowerCase(L("tr", "en"))}`}
      title={word}
      onClick={(e) => { e.stopPropagation(); onDelete(); }}>
      <UiIcon name="x" size={12} />
    </button>
  );
}

export interface Nav {
  index: number;
  total: number;
  go: (step: -1 | 1) => void;
}

/** The bottom strip: where it stands (or ‹ 1/2 ›) on the left, the price and the one action on the right. */
export function CardFoot({ view, nav, best = false, price, onAction, live, go, alt, quietWait = false, docs = null, more }: {
  view: FootView;
  /** v11: a plan chosen and not bought: its stage is the card's colour and its top line, not words here (a date running out stays). */
  quietWait?: boolean;
  /** v11: a booking's file (its name) or "Belge eksik", after its proof. */
  docs?: ReactNode;
  /** v11: "Ayrıntı ›", a booking's window. */
  more?: () => void;
  /** v11: a chosen plan's other options, "Pano'da 2 alternatif" by its price (they open on the Pano). */
  alt?: { count: number; onClick: () => void } | null;
  /** v11: a plan's page to book on ("Rezerve et ↗"), where its "Aldım" moved to the top line. */
  go?: { href: string; label: string } | null;
  nav?: Nav;
  best?: boolean;
  price: CardFacts["price"] | null;
  onAction?: () => void;
  /** A flight's real data (0.36.18): a note (the ticket against the schedule, a delay) and its source. */
  live?: { note: string | null; tone: "warn" | "bad"; source: string | null } | null;
}) {
  const left = view.left;
  // On an editable card a missing price is a faint "Fiyat ekle".
  const pricing = Boolean(useInlineEdit()?.fields.includes("price"));
  return (
    <div className="pk-foot">
      {left.kind === "nav" && nav ? (
        <>
          <span className="pk-state wait pk-opt">{nOptions(nav.total)}</span>
          <span className="pk-nav">
            <button type="button" aria-label={L("Önceki seçenek", "Previous option")} disabled={nav.index === 0} onClick={() => nav.go(-1)}>
              <UiIcon name="left" size={13} />
            </button>
            {nav.index + 1}/{nav.total}
            <button type="button" aria-label={L("Sonraki seçenek", "Next option")} disabled={nav.index === nav.total - 1} onClick={() => nav.go(1)}>
              <UiIcon name="right" size={13} />
            </button>
          </span>
          {best && <span className="pk-best">{L("Önerim", "My pick")}</span>}
        </>
      ) : left.kind === "state" && quietWait && left.tone === "wait" ? (
        left.when ? <span className={`pk-state wait${left.alert ? ` alert-${left.alert}` : ""}`}><span className="pk-when">⏳ {left.when}</span></span> : null
      ) : left.kind === "state" ? (
        <span className={`pk-state ${left.tone}${left.alert ? ` alert-${left.alert}` : ""}`}>
          {left.tone === "done" && <UiIcon name="check" size={13} />}
          {left.text}
          {left.sub && <span className="pk-sub">· {left.sub}</span>}
          {left.when && <span className="pk-when">· ⏳ {left.when}</span>}
        </span>
      ) : null}
      {live?.note && <span className={`pk-live-note ${live.tone}`}>{live.note}</span>}
      {live?.source && <span className="pk-src">{live.source}</span>}
      {(price || pricing) && (
        <span className="pk-price">
          <Editable field="price">
            {price && (
              <>
                <b>{price.text}</b>
                {price.label ? ` ${price.label}` : ""}
              </>
            )}
          </Editable>
        </span>
      )}
      {alt && alt.count > 0 && (
        <button type="button" className="pk-alt" onClick={(e) => { e.stopPropagation(); alt.onClick(); }}>
          {L(`Pano'da ${alt.count} alternatif`, `${alt.count} alternative${alt.count === 1 ? "" : "s"} on the Board`)}
        </button>
      )}
      {view.action && onAction && (
        <button type="button" className="pk-cta" onClick={onAction}>
          {view.action.label}
        </button>
      )}
      {!view.action && go && (
        <a className="pk-cta pk-go" href={go.href} target="_blank" rel="noreferrer">
          {go.label}
        </a>
      )}
      {docs}
      {more && (
        <button type="button" className="pk-more" onClick={(e) => { e.stopPropagation(); more(); }}>
          {L("Ayrıntı", "Details")} ›
        </button>
      )}
    </div>
  );
}

export function CardShell(props: {
  kind: CardKind;
  /** The top line's name when it isn't the kind's ("Metro", "Şehir değişimi"). */
  label?: string;
  ring: RingState;
  /** The top line's day (a string, or its editable pieces on a record's card). */
  date: ReactNode;
  /** Whose it is, after the date ("Sabine'in bileti"; nothing for everyone's). */
  badge?: ReactNode;
  ariaLabel: string;
  itemId?: string;
  domId?: string;
  extraClass?: string;
  art?: ReactNode;
  docs?: ReactNode;
  /** A record's card: the hover × left of •••. A transfer has none (nothing to delete). */
  onDelete?: () => void;
  /** What the × says (v11: "Gerek yok", "Kaldır" on a booking). */
  deleteLabel?: string;
  /** v11: the planned card's "✓ Aldım", on the top line. */
  topAction?: ReactNode;
  menu: MenuEntry[];
  open: boolean;
  onToggle: () => void;
  body: ReactNode;
  foot: ReactNode;
  detail: ReactNode;
}) {
  const style = { "--mc": cardKindColor(props.kind) } as CSSProperties;
  // A tap anywhere on the card opens it, except on its controls and inside what's opened.
  const tap = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, label, .pk-detail, .pk-menu, .pk-doclist")) return;
    props.onToggle();
  };
  return (
    <article
      className={`pk-card pk-${groundOf(props.ring)} pk-r-${props.ring}${props.open ? " pk-open" : ""}${props.extraClass ? ` ${props.extraClass}` : ""}`}
      style={style}
      aria-label={props.ariaLabel}
      data-item-id={props.itemId}
      id={props.domId}
      onClick={tap}
    >
      {props.art}
      <div className="pk-top">
        <Ring state={props.ring} />
        <span className="pk-kind">
          <KindIcon kind={props.kind} size={15} />
          {props.label ?? cardKindLabel(props.kind)}
        </span>
        {props.date && <span className="pk-date">· {props.date}</span>}
        {props.badge}
        <span className="pk-end">
          {props.topAction}
          {props.docs}
          {props.onDelete && <DeleteX name={props.ariaLabel} onDelete={props.onDelete} label={props.deleteLabel} />}
          <CardMenu entries={props.menu} />
        </span>
      </div>
      <div className="pk-body" role="button" tabIndex={0} aria-expanded={props.open}
        aria-label={props.open ? L(`${props.ariaLabel}: ayrıntıyı kapat`, `${props.ariaLabel}: close details`) : L(`${props.ariaLabel}: ayrıntı`, `${props.ariaLabel}: details`)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), props.onToggle())}>
        {props.body}
      </div>
      {props.foot}
      {props.open && props.detail}
    </article>
  );
}
