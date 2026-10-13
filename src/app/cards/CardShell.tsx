// The frame every plan card shares (etkinlik-v4): the ground says where it stands (white: searching, our pick,
// chosen; green: bought or booked, with its one BookedBadge), a 24 px top line (ring · kind · date | badge · files ·
// •••), the body, the bottom strip, and the details that open inside the card on a tap.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { CardFacts } from "../../lib/cardFacts";
import { cardKindColor, cardKindLabel, type CardKind } from "../../lib/cardKinds";
import type { FootView, Ring as RingState } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { nOptions } from "../../lib/i18nText";
import { ActionStrip } from "./ActionStrip";
import { Editable, useInlineEdit } from "./InlineEdit";
import { InfoButton } from "./InfoButton";
import { KindIcon, UiIcon } from "./Silhouettes";

/** Where a plan not bought stands: searching (dashed) or chosen (a green line). A bought one draws nothing: it wears the BookedBadge. */
export function Ring({ state }: { state: RingState }) {
  if (state === "done") return null;
  const label = state === "open" ? L("Karar bekliyor", "To decide") : L("Seçildi, rezerve edilmedi", "Chosen, not booked");
  return <span className={`pk-ring ${state}`} role="img" aria-label={label} title={label} />;
}

export interface MenuEntry {
  /** Which action it is ("edit", "change", "addDoc", "cancel"...), for the icon strip over the card (ActionStrip); absent: only in the menu. */
  id?: string;
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

const capitalFirst = (text: string) => (text ? text.charAt(0).toLocaleUpperCase(L("tr", "en")) + text.slice(1) : text);

export interface Nav {
  index: number;
  total: number;
  go: (step: -1 | 1) => void;
}

/** The bottom strip: where it stands (or ‹ 1/2 ›) on the left, the price and the one action on the right. */
export function CardFoot({ view, nav, best = false, price, each = null, onAction, live, go, alt, quietWait = false, says = false, timed = null, docs = null, more, noTicket = false }: {
  /** v30: a way of travel that needs no ticket says so by its price ("Bilet gerekmez") instead of a page to buy on. */
  noTicket?: boolean;
  view: FootView;
  /** v11: a plan chosen and not bought: its stage is the card's colour and its top line, not words here (a date running out stays). */
  quietWait?: boolean;
  /** v30: a chosen flight keeps saying its words even then: "Bilet alınmadı · uçuşa 12 gün" (orange within 14 days). */
  says?: boolean;
  /** v30: a booked stay's check-in time, from two days before ("Giriş saati 15:00"). */
  timed?: string | null;
  /** v11: a booking's file (its name) or "Belge eksik", after its proof. */
  docs?: ReactNode;
  /** v11: "Ayrıntı ›", a booking's window. */
  more?: () => void;
  /** F3: a chosen plan's other options, "Değiştir 2", a pill at the foot's left (it turns the card to its options, or opens them on the Board). */
  alt?: { count: number; onClick: () => void; /** v30: it turns the card to its options in place (a chevron); else it goes to the Board. */ flips?: boolean } | null;
  /** v11: a plan's page to book on ("Rezerve et ↗"), where its "Aldım" moved to the top line. */
  go?: { href: string; label: string } | null;
  nav?: Nav;
  best?: boolean;
  price: CardFacts["price"] | null;
  /** F5a: a ticket's price per person, big, and the party's line under it ("2 kişi · €30"); in place of the price's own text. */
  each?: { each: string; line: string | null } | null;
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
      ) : left.kind === "state" && quietWait && says && left.tone === "wait" ? (
        <span className={`pk-state wait pk-says${left.alert ? ` alert-${left.alert}` : ""}`}>
          <span className="pk-when">⏳ {capitalFirst(left.sub ?? left.text)}{left.when ? ` · ${left.when}` : ""}</span>
        </span>
      ) : left.kind === "state" && quietWait && left.tone === "wait" ? (
        left.when ? <span className={`pk-state wait${left.alert ? ` alert-${left.alert}` : ""}`}><span className="pk-when">⏳ {left.when}</span></span> : null
      ) : left.kind === "state" && (left.text || left.sub || left.when) ? (
        <span className={`pk-state ${left.tone}${left.alert ? ` alert-${left.alert}` : ""}`}>
          {left.tone === "done" && left.text && <UiIcon name="check" size={13} />}
          {left.text}
          {left.sub && <span className="pk-sub">· {left.sub}</span>}
          {left.when && <span className="pk-when">{left.text ? "· " : ""}⏳ {left.when}</span>}
        </span>
      ) : null}
      {alt && alt.count > 0 && (
        <button type="button" className="pk-alt" aria-haspopup={alt.flips ? "dialog" : undefined} title={alt.flips ? L("Diğer seçenekler", "Other options") : L("Pano'da diğer seçenekler", "Other options on the Board")} onClick={(e) => { e.stopPropagation(); alt.onClick(); }}>
          {L("Değiştir", "Change")}
          <span className="pk-alt-n">{alt.count}</span>
        </button>
      )}
      {timed && <span className="pk-timed">{timed}</span>}
      {live?.note && <span className={`pk-live-note ${live.tone}`}>{live.note}</span>}
      {live?.source && <span className="pk-src">{live.source}</span>}
      {(price || pricing) && (
        <span className="pk-price">
          <Editable field="price">
            {price && price.perNight ? (
              // F3: a stay's price the way the sites write it, the night alone ("€210 / gece"); the whole sum is in the ⓘ.
              <span className="pk-price2">
                <b>{price.perNight.split(" / ")[0]}</b>
                <small> / {price.perNight.split(" / ")[1]}</small>
              </span>
            ) : (
              price && (each ? (
                <span className="pk-price3">
                  <span><b>{each.each}</b> {L("kişi başı", "per person")}</span>
                  {each.line && <small>{each.line}</small>}
                </span>
              ) : (
                <>
                  <b>{price.text}</b>
                  {price.label ? ` ${price.label}` : ""}
                </>
              ))
            )}
          </Editable>
        </span>
      )}
      {view.action && onAction && (
        <button type="button" className="pk-cta" onClick={onAction}>
          {view.action.label}
        </button>
      )}
      {!view.action && noTicket && <span className="pk-noticket">{L("Bilet gerekmez", "No ticket needed")}</span>}
      {!view.action && !noTicket && go && (
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

/** How long a folded card waits for an answer before it counts as "Gerek yok". */
const FOLD_GRACE_MS = 15_000;

/**
 * The × folded in place (v30): "X kaldırıldı · Neden? [Gerek yok] [Ben hallettim] · Geri al". Nothing picked after a
 * while counts as "Gerek yok". Plan cards and every empty card fold the same way.
 */
export function FoldLine({ name, itemId, onGone, onArranged, onUndo }: { name: string; itemId?: string; onGone: () => void; onArranged: () => void; onUndo: () => void }) {
  // Nothing picked after a while counts as "Gerek yok" (spec: the × is for dropping what the plan made, no question left open).
  useEffect(() => {
    const t = setTimeout(onGone, FOLD_GRACE_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pk-fold" role="group" aria-label={L(`${name}: kaldırıldı`, `${name}: removed`)} data-item-id={itemId}>
      <span className="pk-fold-t">
        <UiIcon name="x" size={13} />
        <b title={name}>{name}</b> {L("kaldırıldı", "removed")}
      </span>
      <span className="pk-fold-q">{L("Neden?", "Why?")}</span>
      <button type="button" className="pk-fold-b" onClick={onGone}>{L("Gerek yok", "Not needed")}</button>
      <button type="button" className="pk-fold-b" onClick={onArranged}>
        <UiIcon name="check" size={13} />
        {L("Ben hallettim", "I sorted it")}
      </button>
      <span className="pk-fold-sp" />
      <button type="button" className="pk-fold-u" onClick={onUndo}>{L("Geri al", "Undo")}</button>
    </div>
  );
}

export function CardShell(props: {
  kind: CardKind;
  /** The top line's name when it isn't the kind's ("Metro", "Şehir değişimi"). */
  label?: string;
  /** F2: a flight ticket's own head (logo, airline, day) in place of the ring, kind and date. */
  head?: ReactNode;
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
  /** v30: with it, the × doesn't take the card away at once: it folds in place into a line asking why ("Gerek yok" · "Ben hallettim") and "Geri al". Not on a booking (its × asks first). */
  onArranged?: () => void;
  /** v11: the planned card's "✓ Aldım", on the top line. */
  topAction?: ReactNode;
  menu: MenuEntry[];
  /** Who saved it: a small face on the card's top left corner (WhoseBadge.tsx SavedFace); null: none. */
  corner?: ReactNode;
  /** What the ⓘ balloon says (InfoButton.tsx): rows of facts beyond the face; null: no ⓘ. The card's face is as it was. */
  info?: ReactNode | null;
  open: boolean;
  onToggle: () => void;
  body: ReactNode;
  foot: ReactNode;
  detail: ReactNode;
}) {
  const style = { "--mc": cardKindColor(props.kind) } as CSSProperties;
  const [folded, setFolded] = useState(false);
  const foldable = Boolean(props.onDelete && props.onArranged);
  // A tap anywhere on the card opens it, except on its controls and inside what's opened.
  const tap = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, label, .pk-detail, .pk-menu, .pk-doclist")) return;
    props.onToggle();
  };
  if (folded && foldable) {
    return <FoldLine name={props.ariaLabel} itemId={props.itemId} onGone={() => { setFolded(false); props.onDelete!(); }} onArranged={() => { setFolded(false); props.onArranged!(); }} onUndo={() => setFolded(false)} />;
  }
  return (
    <article
      className={`pk-card pk-r-${props.ring}${props.open ? " pk-open" : ""}${props.extraClass ? ` ${props.extraClass}` : ""}`}
      style={style}
      aria-label={props.ariaLabel}
      data-item-id={props.itemId}
      id={props.domId}
      onClick={tap}
        >
      {props.corner && <span className="who-dot">{props.corner}</span>}
      {props.art}
      <div className="pk-top">
        {props.head ?? (
          <>
            <Ring state={props.ring} />
            <span className="pk-kind">
              <KindIcon kind={props.kind} size={15} />
              {props.label ?? cardKindLabel(props.kind)}
            </span>
            {props.date && <span className="pk-date">· {props.date}</span>}
          </>
        )}
        {props.badge}
        <span className="pk-end">
          {props.info && <InfoButton>{props.info}</InfoButton>}
          {props.topAction}
          {props.docs}
          {props.onDelete && <DeleteX name={props.ariaLabel} onDelete={foldable ? () => setFolded(true) : props.onDelete} label={props.deleteLabel} />}
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
      <ActionStrip entries={props.menu} />
    </article>
  );
}
