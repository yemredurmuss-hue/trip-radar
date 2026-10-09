// The booking's window (v11 phase 3, docs/mockups/2026-10-08-japonya-web-v11.html): a booked card opens this instead
// of its decision details. Its brand, name and times with "Rezerve · belgeli"; "Rezervasyon ayrıntısı" (the
// reference, the way there or the nights, the address, how many, free cancellation: lib/bookingRows.ts); its files
// (open, or "Belge eksik · ekle"; they stay on this computer); and what's done with a booking: Değiştir (asks first
// whether the old one was cancelled), İptal ettim (its need to find again, "Geri al"), Tüm detaylar, Kapat.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { bookingRows } from "../../lib/bookingRows";
import type { CardFacts } from "../../lib/cardFacts";
import { cardKindColor, cardKindLabel, type CardKind } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import type { DocMeta, Item } from "../../lib/types";
import { DocList, DocPickButton } from "./DocAccess";
import { KindIcon, UiIcon } from "./Silhouettes";

export function BookingSheet({ item, kind, facts, docs, date, onChange, onCancel, onUnbook, onDetails, onClose }: {
  item: Item;
  kind: CardKind;
  facts: CardFacts;
  docs: DocMeta[];
  /** The card's top-line day ("8 Ekim", "1–6 Nis"). */
  date: string | null;
  onChange: () => void;
  onCancel: () => void;
  /** "Aldım" by mistake: not booked after all (Seçildi again). */
  onUnbook: () => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const rows = bookingRows(item, kind);
  const sub = [date, item.provider].filter(Boolean).join(" · ");
  return createPortal(
    <div className="modal" onClick={(e) => (e.stopPropagation(), onClose())}>
      <div className="bk-sheet" role="dialog" aria-modal="true" aria-labelledby="bk-title" style={{ "--c": cardKindColor(kind) } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <header className="bk-head">
          <span className="bk-ic" aria-hidden>
            <KindIcon kind={kind} size={20} />
          </span>
          <div className="bk-tt">
            <h3 id="bk-title">{item.name}</h3>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="bk-x" aria-label={L("Kapat", "Close")} onClick={onClose} autoFocus>
            <UiIcon name="x" size={14} />
          </button>
        </header>
        <div className="bk-hero">
          <span className="bk-kind">{cardKindLabel(kind)}</span>
          <b>{facts.price ? `${facts.price.text}${facts.price.label ? ` ${facts.price.label}` : ""}` : item.name}</b>
          <span className="bk-lab">
            <UiIcon name="check" size={13} />
            {docs.length ? L("Rezerve · belgeli", "Booked · with its file") : L("Rezerve", "Booked")}
          </span>
        </div>
        <section className="bk-sec">
          <h4>{L("Rezervasyon ayrıntısı", "Booking details")}</h4>
          {rows.length ? (
            <dl className="bk-rows">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="bk-none">{L("Ayrıntı yok; belgeyi eklersen PNR, saat ve tutarı ben okurum.", "No details yet; add its document and I'll read the reference, times and amount.")}</p>
          )}
        </section>
        <section className="bk-sec">
          <h4>{L("Belgeler", "Documents")}</h4>
          {docs.length ? (
            <DocList docs={docs} />
          ) : (
            <DocPickButton item={item} className="bk-miss">
              {L("Belge eksik · ekle", "No document · add one")}
            </DocPickButton>
          )}
          <p className="bk-note">{L("Belgeler yalnız bu bilgisayarda durur; Belgeler sekmesinde de görünür.", "Documents stay on this computer; they're in the Documents tab too.")}</p>
        </section>
        <footer className="bk-foot">
          <button type="button" className="bk-btn" onClick={() => (onClose(), onChange())}>
            {L("Değiştir", "Change")}
          </button>
          <button type="button" className="bk-btn" onClick={() => (onClose(), onCancel())}>
            {L("İptal ettim", "I cancelled it")}
          </button>
          <span className="bk-sp" />
          <button type="button" className="bk-link quiet" onClick={() => (onClose(), onUnbook())}>
            {L("Rezervasyonu geri al", "Mark as not booked")}
          </button>
          <button type="button" className="bk-link" onClick={() => (onClose(), onDetails())}>
            {L("Tüm detaylar", "All details")}
          </button>
          <button type="button" className="bk-btn dark" onClick={onClose}>
            {L("Kapat", "Close")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
