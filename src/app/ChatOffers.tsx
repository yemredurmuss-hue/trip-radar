// The offers a chat reply found (find_offers), as compact cards under it: the name (its page, through the offer's
// own partner link), the price (a stay's total and by the night; a flight's for who goes), the rating ("★ 4,7" out
// of 5, "8,9" out of 10), the source, the one "why" line, and "Ekle", which saves it as one of the need's options
// (the same option as the empty card's row). At most three, as the sources gave them; a stay's three picks carry
// their label on top ("Sana en uygun", "Daha ekonomik", "Daha konforlu").
import { useState } from "react";
import { L } from "../lib/i18n";
import { formatPrice } from "../lib/items";
import { dealPrice, MAX_OFFERS, ratingText, type Need, type Offer } from "../lib/offerSource";
import { pickLabel } from "../lib/stayPicks";
import type { ChatMessage } from "../lib/types";
import { addChatOffer } from "./actions";

/** The cards as drawn, from what's given (no storage): what the tests render. */
export function ChatOffersView({ offers, need, added, onAdd }: { offers: Offer[]; need: Need; added: string[]; onAdd: (offer: Offer) => void }) {
  if (!offers.length) return null;
  return (
    <div className="chat-offers">
      {offers.slice(0, MAX_OFFERS).map((o) => {
        const deal = dealPrice(o, need.adults ?? null);
        const total = o.price != null ? formatPrice(o.price, o.currency ?? null) : null;
        const done = added.includes(o.id);
        return (
          <div key={o.id} className={`chat-offer${o.pick ? ` pick-${o.pick}` : ""}`} data-offer={o.id} data-pick={o.pick ?? undefined}>
            <div className="co-main">
              {/* A stay's three picks (stayPicks.ts): the same labels as the empty card's row. */}
              {o.pick && <span className="co-pick">{pickLabel(o.pick)}</span>}
              <a className="co-title" href={o.url} target="_blank" rel="noopener noreferrer">
                {o.title}
              </a>
              <span className="co-meta">
                {o.rating != null && <span className="ek-of-rate">{ratingText(o.rating)}</span>}
                <a className="co-src" href={o.url} target="_blank" rel="noopener noreferrer">
                  {o.source}
                </a>
              </span>
              {o.why && <p className="co-why">✨ {o.why}</p>}
            </div>
            <div className="co-deal">
              {deal && total && (
                <>
                  <b className="co-amt">{deal.perNight ? total : formatPrice(Math.round(deal.amount), o.currency ?? null)}</b>
                  <span className="co-per">
                    {deal.perNight ? `${formatPrice(Math.round(deal.amount), o.currency ?? null)} ${L("/ gece", "/ night")}` : deal.unit(total)}
                  </span>
                </>
              )}
              {/* No price for these dates: only its usual range, said as such. */}
              {!(deal && total) && o.meta && <span className="co-per">{o.meta}</span>}
              <button type="button" className={done ? "btn-link co-add" : "small-btn co-add"} disabled={done} onClick={() => onAdd(o)}
                aria-label={done ? L(`${o.title} eklendi`, `${o.title} added`) : L(`${o.title}: seçeneklere ekle`, `${o.title}: add to options`)}>
                {done ? L("Eklendi ✓", "Added ✓") : L("Ekle", "Add")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A reply's offers: "Ekle" saves the option once and says "Eklendi" (remembered on the reply). */
export function ChatOffers({ m }: { m: ChatMessage }) {
  const [added, setAdded] = useState<string[]>(m.offers?.added ?? []);
  if (!m.offers) return null;
  const { need, offers } = m.offers;
  const all = [...new Set([...added, ...(m.offers.added ?? [])])];
  return (
    <ChatOffersView
      offers={offers}
      need={need}
      added={all}
      onAdd={(o) => {
        setAdded((a) => (a.includes(o.id) ? a : [...a, o.id]));
        void addChatOffer(m.id, o, need).catch((e: Error) => console.warn("Öneri eklenemedi", e.message));
      }}
    />
  );
}
