// "✨ Senin için N öneri ▾" under an empty card (spec 2026-10-06-bos-kartlar-design.md, revision 2): drawn only
// while an AI data source is connected and has offers for the need. Closed at first; opened or closed it's
// remembered per section; a new count changes the number, never opens it. Open, the offers in the option
// cards' layout (photo, name, rating, price, nights) on a purple ground: "Öneri", a purple why, "Seçeneklere
// ekle", and × ("bunun gibileri gösterme").
import { useEffect, useState } from "react";
import { num, nNights } from "../../lib/i18nText";
import { L } from "../../lib/i18n";
import { formatPrice } from "../../lib/items";
import {
  offerCount,
  offersOpenKey,
  readOffersOpen,
  shownOffers,
  validOffers,
  withOffers,
  without,
  writeOffersOpen,
  type Need,
  type Offer,
  type OfferKind,
  type OfferRowState,
} from "../../lib/offerSource";
import { addOffer } from "../actions";
import { useEmptyEnv } from "./emptyEnv";
import { KindIcon, UiIcon } from "./Silhouettes";

const ICON: Record<OfferKind, "flight" | "stay" | "taxi" | "activity" | "esim"> = { flight: "flight", stay: "stay", transfer: "taxi", activity: "activity", esim: "esim" };

/** The row as drawn, from its state (no fetching, no storage): what the tests render. */
export function OfferRowView({ offers, open, onToggle, onAdd, onLess }: {
  offers: Offer[];
  open: boolean;
  onToggle: () => void;
  onAdd: (offer: Offer) => void;
  onLess: (offer: Offer) => void;
}) {
  if (!offers.length) return null;
  const sources = [...new Set(offers.map((o) => o.source))].join(", ");
  return (
    <div className={`ek-offers${open ? " open" : ""}`}>
      <button type="button" className="ek-offers-head" aria-expanded={open} onClick={onToggle}>
        <span aria-hidden>✨</span>
        <span className="ek-offers-count">{offerCount(offers.length)}</span>
        <span className="ek-offers-chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="ek-offer-list">
          {offers.map((o) => (
            <div key={o.id} className="ek-offer" data-offer={o.id}>
              <span className="ek-offer-img">
                {o.photo ? <img src={o.photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <KindIcon kind={ICON[o.kind]} size={28} />}
              </span>
              <span className="ek-offer-txt">
                <span className="ek-offer-name">
                  <a href={o.url} target="_blank" rel="noopener noreferrer">
                    {o.title}
                  </a>
                  <span className="ek-badge">{L("Öneri", "Suggested")}</span>
                </span>
                <span className="ek-offer-meta">
                  {[o.rating != null ? `★ ${num(o.rating)}` : null, o.nights ? nNights(o.nights) : null, o.source].filter(Boolean).join(" · ")}
                </span>
                {o.why && <span className="ek-why">{o.why}</span>}
              </span>
              <span className="ek-offer-end">
                {o.price != null && <b className="ek-offer-price">{formatPrice(o.price, o.currency ?? null)}</b>}
                {o.price != null && o.nights ? <small>{nNights(o.nights)}</small> : null}
                <button type="button" className="ek-offer-add" onClick={() => onAdd(o)}>
                  {L("Seçeneklere ekle", "Add to options")}
                </button>
              </span>
              <button type="button" className="ek-offer-x" onClick={() => onLess(o)}
                aria-label={L(`${o.title}: bunun gibileri gösterme`, `${o.title}: show fewer like this`)} title={L("Bunun gibileri gösterme", "Show fewer like this")}>
                <UiIcon name="x" size={12} />
              </button>
            </div>
          ))}
          <p className="ek-offers-note">{L(`Fiyat ve puan: ${sources}`, `Prices and ratings: ${sources}`)}</p>
        </div>
      )}
    </div>
  );
}

/** The row for one need: asks the source once per need, nothing at all while no source is connected. */
export function OfferRow({ need }: { need: Need }) {
  const { offers: source, tripId } = useEmptyEnv();
  const available = source.available();
  const storeKey = offersOpenKey(tripId, need.section);
  const [state, setState] = useState<OfferRowState>(() => ({ open: readOffersOpen(storeKey), offers: [], gone: [] }));
  useEffect(() => {
    if (!available) return;
    let live = true;
    source.offers(need).then(
      (list) => live && setState((s) => withOffers(s, validOffers(list, need))),
      () => live && setState((s) => withOffers(s, [])),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only for another need
  }, [available, source, need.key]);
  if (!available) return null;
  const toggle = () => {
    const open = !state.open;
    writeOffersOpen(storeKey, open);
    setState((s) => ({ ...s, open }));
  };
  return (
    <OfferRowView
      offers={shownOffers(state)}
      open={state.open}
      onToggle={toggle}
      onAdd={(o) => {
        setState((s) => without(s, o.id));
        void addOffer(tripId, o, need);
      }}
      onLess={(o) => {
        setState((s) => without(s, o.id));
        source.less?.(o, need);
      }}
    />
  );
}
