// "✨ Senin için N öneri ▾" under an empty card (spec 2026-10-06-bos-kartlar-design.md, revision 2; card layout
// docs/mockups/2026-10-06-ai-oneriler-turler-v3.html): drawn only while an AI data source is connected and has
// offers for the need. Closed at first; opened or closed it's remembered per section; a new count changes the
// number, never opens it. Each offer is a price card: on the left only what the kind needs to decide (a flight or
// transfer: who runs it, the hours and codes, how long, direct; a stay, an activity, an eSIM: the photo, the name,
// the rating and area, one line) and one purple "✨ why" line; on the right the deal: the source, the big price (a
// stay's by the night), its unit, a full-width "Ekle →" and × in the corner ("Bunun gibileri gösterme").
import { useEffect, useState } from "react";
import { durationText } from "../../lib/cardFacts";
import { L } from "../../lib/i18n";
import { nStops } from "../../lib/i18nText";
import { formatPrice } from "../../lib/items";
import {
  dealPrice,
  offerCount,
  offersOpenKey,
  ratingText,
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
import { BRANDS } from "../../lib/searchLinks";
import { addOffer } from "../actions";
import { useEmptyEnv } from "./emptyEnv";
import { KindIcon, UiIcon } from "./Silhouettes";

const ICON: Record<OfferKind, "flight" | "stay" | "taxi" | "activity" | "esim"> = { flight: "flight", stay: "stay", transfer: "taxi", activity: "activity", esim: "esim" };

/** The source's mark: a brand we draw (one letter on its colour), else its first letter on grey. */
function SourceMark({ source }: { source: string }) {
  const brand = Object.values(BRANDS).find((b) => b.name.toLocaleLowerCase("tr") === source.toLocaleLowerCase("tr"));
  return (
    <span className="ek-lg" style={{ background: brand?.color ?? "#8e8e93" }} aria-hidden>
      {brand?.letter ?? initial(source)}
    </span>
  );
}

/** A name's first letter, upper-cased the plain way (Iberia → I, never İ). */
const initial = (name: string): string => [...name.trim()][0]?.toUpperCase() ?? "";

/** "2 sa önce": how fresh the source's price is (in the source name's tooltip only). */
function freshness(fetchedAt: number, now: number): string {
  const hours = Math.max(0, Math.round((now - fetchedAt) / 3_600_000));
  if (!fetchedAt) return "";
  if (hours < 1) return L("az önce", "just now");
  return hours < 48 ? L(`${hours} sa önce`, `${hours} h ago`) : L(`${Math.round(hours / 24)} gün önce`, `${Math.round(hours / 24)} days ago`);
}

/** A flight's or transfer's body: carrier and its tile, the hour and code at each end, how long and direct between. */
function RouteBody({ o }: { o: Offer }) {
  const direct = o.kind === "flight" && o.stops != null ? (o.stops === 0 ? L("Direkt", "Direct") : nStops(o.stops)) : null;
  return (
    <div className="ek-of-route">
      {o.carrier && (
        <span className="ek-of-carrier">
          {o.carrier}
          {/* The carrier's own code when the source gives it (TK), else its initial: never a code made from the name. */}
          <span className="ek-of-air" aria-hidden>
            {o.carrierCode ?? initial(o.carrier)}
          </span>
        </span>
      )}
      <span className="ek-of-tm">
        {o.depart ?? "–"}
        {o.fromCode && <small>{o.fromCode}</small>}
      </span>
      <span className="ek-of-mid">
        {o.durationMinutes ? <span>{durationText(o.durationMinutes)}</span> : <span />}
        <span className="ek-of-ln" aria-hidden>
          <KindIcon kind={ICON[o.kind]} size={13} />
        </span>
        {o.via ? <span className="ek-of-ok">{o.via}</span> : direct ? <span className={o.stops === 0 ? "ek-of-ok" : undefined}>{direct}</span> : null}
      </span>
      <span className="ek-of-tm">
        {o.arrive ?? "–"}
        {o.toCode && <small>{o.toCode}</small>}
      </span>
    </div>
  );
}

/** A stay's, an activity's, an eSIM's body: the photo, the name, the rating chip and area, one more line. */
function MediaBody({ o }: { o: Offer }) {
  return (
    <div className="ek-of-media">
      <span className="ek-of-ph">
        {o.photo ? <img src={o.photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <KindIcon kind={ICON[o.kind]} size={30} />}
      </span>
      <span className="ek-of-txt">
        <a className="ek-of-t" href={o.url} target="_blank" rel="noopener noreferrer">
          {o.title}
        </a>
        {(o.rating != null || o.area) && (
          <span className="ek-of-s">
            {o.rating != null && <span className="ek-of-rate">{ratingText(o.rating)}</span>}
            {o.area}
          </span>
        )}
        {o.meta && <span className="ek-of-s">{o.meta}</span>}
      </span>
    </div>
  );
}

/** The row as drawn, from its state (no fetching, no storage): what the tests render. */
export function OfferRowView({ offers, open, adults = null, now = Date.now(), onToggle, onAdd, onLess }: {
  offers: Offer[];
  open: boolean;
  /** Who goes: a flight's "2 kişi toplam", a transfer's or an activity's "2 kişi". */
  adults?: number | null;
  now?: number;
  onToggle: () => void;
  onAdd: (offer: Offer) => void;
  onLess: (offer: Offer) => void;
}) {
  if (!offers.length) return null;
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
          {offers.map((o) => {
            const deal = dealPrice(o, adults);
            const total = o.price != null ? formatPrice(o.price, o.currency ?? null) : "";
            const fresh = freshness(o.fetchedAt, now);
            return (
              <div key={o.id} className={`ek-offer kind-${o.kind}`} data-offer={o.id}>
                <div className="ek-of-body">
                  {o.kind === "flight" || o.kind === "transfer" ? <RouteBody o={o} /> : <MediaBody o={o} />}
                  {o.why && <p className="ek-why">✨ {o.why}</p>}
                </div>
                <div className="ek-deal">
                  <a className="ek-from" href={o.url} target="_blank" rel="noopener noreferrer" title={fresh ? `${o.source} · ${fresh}` : o.source}>
                    <SourceMark source={o.source} />
                    {o.source}
                  </a>
                  {deal && (
                    <>
                      <b className="ek-amt">
                        {formatPrice(Math.round(deal.amount), o.currency ?? null)}
                        {deal.perNight && <small> {L("/ gece", "/ night")}</small>}
                      </b>
                      <span className="ek-per">{deal.unit(total)}</span>
                    </>
                  )}
                  <button type="button" className="ek-go" onClick={() => onAdd(o)} aria-label={L(`${o.title}: seçeneklere ekle`, `${o.title}: add to options`)}>
                    {L("Ekle", "Add")} →
                  </button>
                  <button type="button" className="ek-offer-x" onClick={() => onLess(o)} aria-label={L("Bunun gibileri gösterme", "Show fewer like this")} title={L("Bunun gibileri gösterme", "Show fewer like this")}>
                    <UiIcon name="x" size={12} />
                  </button>
                </div>
              </div>
            );
          })}
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
      adults={need.adults ?? null}
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
