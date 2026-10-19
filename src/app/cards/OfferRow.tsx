// "✨ Senin için N öneri ▾" under an empty card (spec 2026-10-06-bos-kartlar-design.md, revision 2; card layout
// docs/mockups/2026-10-06-ai-oneriler-turler-v3.html): drawn only while an AI data source is connected and has
// offers for the need. Closed at first; opened or closed it's remembered per section; a new count changes the
// number, never opens it. Each offer is a price card: on the left only what the kind needs to decide (a flight or
// transfer: who runs it, the hours and codes, how long, direct; a stay, an activity, an eSIM: the photo, the name,
// the rating and area, one line) and one purple "✨ why" line; on the right the deal: the source, the big price (a
// stay's by the night), its unit, a full-width "Ekle →" and × in the corner ("Bunun gibileri gösterme").
// A stay, when the source has candidates, shows its three picks instead (stayPicks.ts: "Sana en uygun", "Daha
// ekonomik", "Daha konforlu") as the plan's option cards with "Seç"; the same row's open/closed state.
import { useEffect, useMemo, useState } from "react";
import { durationText } from "../../lib/cardFacts";
import { L } from "../../lib/i18n";
import { nStops } from "../../lib/i18nText";
import type { StayCandidate } from "../../lib/offerSources";
import { candidateOffer, pickCard, pickList, pickOnPlan, picksContext, pickThree, type PickKind, type StayPick } from "../../lib/stayPicks";
import type { Item } from "../../lib/types";
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
import { addOffer, fillOffer, setItemStatus } from "../actions";
import { BrandChip, Rating } from "../plan/v82/OptionCompact";
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
  // A flight's estimate, only from at least three real fares (never made up): the cheapest to the dearest, whole trip.
  const fares = offers.filter((o) => o.kind === "flight" && o.price != null).map((o) => o.price as number);
  const money = offers.find((o) => o.kind === "flight" && o.price != null)?.currency ?? null;
  const estimate = fares.length >= 3 ? `${formatPrice(Math.round(Math.min(...fares)), money)}–${formatPrice(Math.round(Math.max(...fares)), money)}` : null;
  return (
    <div className={`ek-offers${open ? " open" : ""}`}>
      <button type="button" className="ek-offers-head" aria-expanded={open} onClick={onToggle}>
        <span aria-hidden>✨</span>
        <span className="ek-offers-count">{offerCount(offers.length)}</span>
        {estimate && <span className="ek-offers-est">{L(`Tahmini ${estimate}${adults ? ` · ${adults} kişi` : ""}`, `Estimated ${estimate}${adults ? ` · ${adults} ${adults === 1 ? "person" : "people"}` : ""}`)}</span>}
        <span className="ek-offers-chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="ek-offer-list">
          {offers.map((o) => {
            const deal = dealPrice(o, adults);
            // A flight for several: one person's fare big, the whole of it small (plan v30).
            const eachFlight = o.kind === "flight" && deal != null && (adults ?? 0) > 1;
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
                        {formatPrice(Math.round(eachFlight ? deal.amount / adults! : deal.amount), o.currency ?? null)}
                        {deal.perNight && <small> {L("/ gece", "/ night")}</small>}
                      </b>
                      <span className="ek-per">{eachFlight ? L(`kişi başı · ${total} toplam`, `per person · ${total} total`) : deal.unit(total)}</span>
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

/**
 * A stay's three picks (stayPicks.ts, owner-approved MVP), as the plan's option cards (v82 OptionCompact, Emre 0.38.4:
 * the frame's own card, not another one): the photo near its own shape with "Sana en uygun", "Daha ekonomik" or "Daha
 * konforlu" on it, the site's label and the rating, the name (its page), the price by the night and "Seç", which puts
 * it on the plan as an option of the need and chooses it. The one "why" is the card's tooltip.
 */
export function StayPicksView({ picks, open, chosen, onToggle, onPick }: {
  picks: { kind: PickKind; pick: StayPick }[];
  open: boolean;
  /** The candidates chosen from here ("Seçili"). */
  chosen: string[];
  onToggle: () => void;
  onPick: (kind: PickKind, pick: StayPick) => void;
}) {
  if (!picks.length) return null;
  return (
    <div className={`ek-offers ek-picks${open ? " open" : ""}`}>
      <button type="button" className="ek-offers-head" aria-expanded={open} onClick={onToggle}>
        <span aria-hidden>✨</span>
        <span className="ek-offers-count">{offerCount(picks.length)}</span>
        <span className="ek-offers-chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="z-ocs ek-pcs">
          {picks.map(({ kind, pick }) => {
            const card = pickCard(kind, pick);
            const done = chosen.includes(card.id);
            return (
              <article key={card.id} className={`q-card q-opt z-oc${done ? " is-cur" : ""}`} data-pick={kind} data-offer={card.id} aria-label={card.title} title={card.why || undefined}>
                <div className={`z-op${card.image ? "" : " art"}`}>
                  <img className={card.image ? "ph" : undefined} src={card.image ?? "illus/otel.png"} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <span className={`q-src${kind === "best" ? " best" : ""}`}>{kind === "best" ? `✨ ${card.label}` : card.label}</span>
                </div>
                <div className="z-ob">
                  <span className="z-l1">
                    <BrandChip brand={card.brand} />
                    <Rating rating={card.rating} />
                  </span>
                  <h3 className="z-t" title={card.title}>
                    <a className="z-tb" href={card.url} target="_blank" rel="noopener noreferrer">
                      {card.title}
                    </a>
                  </h3>
                  <div className="z-of">
                    {card.price && (
                      <span className="q-pr" title={card.price.title ?? undefined}>
                        <b>{card.price.amount}</b>
                        <small>{card.price.unit}</small>
                      </span>
                    )}
                    <button type="button" className="q-pick" aria-pressed={done || undefined} disabled={done}
                      aria-label={done ? L(`${card.title}: seçili`, `${card.title}: chosen`) : L(`${card.title}: seç`, `${card.title}: choose`)}
                      onClick={() => onPick(kind, pick)}>
                      {done ? L("Seçili", "Chosen") : L("Seç", "Choose")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A stay's row: the source's candidates narrowed to three for this trip (its plans there, its priorities). */
function StayPicksRow({ need, onChoose, placeholder }: { need: Need; onChoose: ((item: Item) => void) | null; placeholder: Item | null }) {
  const { offers: source, tripId, trip, items } = useEmptyEnv();
  const available = source.available();
  const storeKey = offersOpenKey(tripId, need.section);
  // Open unless the traveller closed it: the picks are the box's options, under it at once (0.38.5).
  const [open, setOpen] = useState(() => readOffersOpen(storeKey, undefined, true));
  const [cands, setCands] = useState<StayCandidate[] | null>(null);
  const [tapped, setTapped] = useState<string[]>([]);
  useEffect(() => {
    if (!available || !source.candidates) return;
    let live = true;
    // Asked by itself once the nights and the place are known; the source keeps the answer for hours (offerSources).
    source.candidates(need).then(
      (list) => live && setCands(Array.isArray(list) ? list : []),
      () => live && setCands([]),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only for another need
  }, [available, source, need.key]);
  const picks = useMemo(() => pickList(pickThree(cands ?? [], picksContext(need, trip, items ?? []))), [cands, need, trip, items]);
  const recordOf = (c: StayCandidate): Item | undefined => pickOnPlan(c, items ?? []);
  const onPlan = (cands ?? []).filter((c) => ["chosen", "booked"].includes(recordOf(c)?.status ?? "")).map((c) => c.id);
  // The one tapped answers at once (the box then shows it chosen and this row goes); else what the records say.
  const chosen = tapped.length ? tapped : onPlan;
  if (!available) return null;
  if (cands && !picks.length) return <NoOffers />;
  const toggle = () => {
    writeOffersOpen(storeKey, !open);
    setOpen(!open);
  };
  return (
    <StayPicksView
      picks={picks}
      open={open}
      chosen={chosen}
      onToggle={toggle}
      onPick={(kind, { cand, why }) => {
        setTapped([cand.id]);
        const own = recordOf(cand);
        const offer = candidateOffer(cand, kind, why);
        // The start's place for these nights becomes the pick (no second card beside it).
        const item = own ? Promise.resolve(own) : placeholder ? fillOffer(placeholder, offer, need) : addOffer(tripId, offer, need);
        void item.then((i) => (onChoose ? onChoose(i) : setItemStatus(i, "chosen"))).catch((e: Error) => console.warn("Seçilemedi", e.message));
      }}
    />
  );
}

/** The row for one need: a stay's three picks when the source has candidates, else its offers as they come. */
export function OfferRow({ need, onChoose = null, placeholder = null }: {
  need: Need;
  /** "Seç" on a stay's pick: the record it became (or was), chosen the way the box chooses (other picks set back). */
  onChoose?: ((item: Item) => void) | null;
  /** The start's place to fill in the box (intentFrame.placeholderOf): a pick takes its record in place. */
  placeholder?: Item | null;
}) {
  const { offers: source } = useEmptyEnv();
  return need.kind === "stay" && source.candidates ? <StayPicksRow need={need} onChoose={onChoose} placeholder={placeholder} /> : <PlainOfferRow need={need} />;
}

/** The source asked and nothing came back: said plainly, nothing made up (0.38.5). */
export function NoOffers() {
  return <p className="ek-none">{L("Kaynaklarda bu tarihler için seçenek çıkmadı. Kendin ara ile bakabilirsin.", "The sources had nothing for these dates. Try Search yourself.")}</p>;
}

/** The plain row: asks the source once per need, nothing at all while no source is connected. */
function PlainOfferRow({ need }: { need: Need }) {
  const { offers: source, tripId } = useEmptyEnv();
  const available = source.available();
  const storeKey = offersOpenKey(tripId, need.section);
  const [state, setState] = useState<OfferRowState>(() => ({ open: readOffersOpen(storeKey, undefined, true), offers: [], gone: [] }));
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!available) return;
    let live = true;
    // Asked by itself once the need is known (a flight's ends and day); the source keeps the answer for hours.
    source.offers(need).then(
      (list) => live && (setState((s) => withOffers(s, validOffers(list, need))), setDone(true)),
      () => live && (setState((s) => withOffers(s, [])), setDone(true)),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only for another need
  }, [available, source, need.key]);
  if (!available) return null;
  // (an eSIM's source may be away: nothing said there, as before)
  if (done && !state.offers.length) return need.kind === "flight" ? <NoOffers /> : null;
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
