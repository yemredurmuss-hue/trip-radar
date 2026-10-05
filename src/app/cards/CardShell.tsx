// The frame every plan card shares (etkinlik-v4): the ground says where it stands (sand: not bought yet,
// green: done), a 24 px top line (ring · kind · date | files · •••), the body, the 48 px bottom strip, and
// the details that open inside the card on a tap.
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { CardFacts } from "../../lib/cardFacts";
import { cardKindColor, cardKindLabel, type CardKind } from "../../lib/cardKinds";
import { groundOf, type FootView, type Ring as RingState } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { nOptions } from "../../lib/i18nText";
import { KindIcon, UiIcon } from "./Silhouettes";

export function Ring({ state }: { state: RingState }) {
  const label = { open: L("Karar bekliyor", "To decide"), half: L("Seçildi, alınmadı", "Chosen, not booked"), done: L("Alındı ya da planlandı", "Booked or planned") }[state];
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
}

export function CardMenu({ entries }: { entries: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  if (!entries.length) return null;
  return (
    <span className="pk-menu-wrap">
      <button type="button" className="pk-ib" aria-label={L("Kart menüsü", "Card menu")} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <UiIcon name="dots" size={16} />
      </button>
      {open && (
        <div className="pk-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          {entries.map((m) => (
            <button key={m.label} type="button" role="menuitem" className={m.danger ? "danger" : undefined} onClick={() => { setOpen(false); m.run(); }}>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** The hover ×: deletes the card and its files at once, with the 8-second "Geri al" (no confirm). */
export function DeleteX({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <button type="button" className="pk-x" aria-label={L(`${name}: sil`, `${name}: delete`)} title={L("Sil", "Delete")}
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
export function CardFoot({ view, nav, best = false, price, onAction }: { view: FootView; nav?: Nav; best?: boolean; price: CardFacts["price"] | null; onAction?: () => void }) {
  const left = view.left;
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
      ) : left.kind === "state" ? (
        <span className={`pk-state ${left.tone}${left.alert ? ` alert-${left.alert}` : ""}`}>
          {left.tone === "done" && <UiIcon name="check" size={13} />}
          {left.text}
          {left.sub && <span className="pk-sub">· {left.sub}</span>}
          {left.when && <span className="pk-when">· ⏳ {left.when}</span>}
        </span>
      ) : null}
      {price && (
        <span className="pk-price">
          <b>{price.text}</b>
          {price.label ? ` ${price.label}` : ""}
        </span>
      )}
      {view.action && onAction && (
        <button type="button" className="pk-cta" onClick={onAction}>
          {view.action.label}
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
  date: string | null;
  ariaLabel: string;
  itemId?: string;
  domId?: string;
  extraClass?: string;
  art?: ReactNode;
  docs?: ReactNode;
  /** A record's card: the hover × left of •••. A transfer has none (nothing to delete). */
  onDelete?: () => void;
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
      className={`pk-card pk-${groundOf(props.ring)}${props.open ? " pk-open" : ""}${props.extraClass ? ` ${props.extraClass}` : ""}`}
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
        <span className="pk-end">
          {props.docs}
          {props.onDelete && <DeleteX name={props.ariaLabel} onDelete={props.onDelete} />}
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
