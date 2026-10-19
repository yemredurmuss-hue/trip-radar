// The record a reply put on the board or suggested, under that reply (C34, v83 "sohbet uyumu"; z83_build.py chat_html):
// the Plan's compact card (the site and its score, the name, one line, the price and its unit), "Planda göster" and
// "Bunu seç" / "Plana koy", or the chip of what it already is ("Seçildi", "Planda", "Alındı"). What it says is
// lib/chatCards.ts's.
import type { CSSProperties } from "react";
import type { SectionId } from "../../lib/categories";
import type { ChatCardVM, PlanTarget } from "../../lib/chatCards";
import { L } from "../../lib/i18n";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { FallbackImg } from "../FallbackImg";

/** A category's drawing, for a card with no picture. */
const ART: Record<SectionId, Parameters<typeof KindIcon>[0]["kind"]> = {
  flight: "flight", stay: "stay", transport: "train", activity: "activity", todo: "todo", food: "food", other: "esim", prep: "prep", inspo: "inspo",
};

export function ChatCard({ card, onShow, onPick }: { card: ChatCardVM; onShow: (t: PlanTarget) => void; onPick: (itemId: string, t: PlanTarget) => void }) {
  const art = <KindIcon kind={ART[card.target.section] ?? "stay"} size={24} />;
  const brand = card.brand;
  return (
    <div className="c-card" data-card={card.itemId} data-state={card.state}>
      <span className="c-img" aria-hidden>
        {card.image ? <FallbackImg src={card.image} className="c-photo" fallback={art} /> : art}
      </span>
      <span className="c-main">
        {(brand || card.rating) && (
          <span className="c-l1">
            {brand && (
              <span className={`q-brand${brand.color ? "" : " plain"}`} style={brand.color ? ({ "--bl": brand.color } as CSSProperties) : undefined}>
                {brand.label}
              </span>
            )}
            {card.rating && <b className={`q-rb${card.rating.startsWith("★") ? " star" : ""}`}>{card.rating}</b>}
          </span>
        )}
        <b title={card.title}>{card.title}</b>
        {card.sub && <small>{card.sub}</small>}
      </span>
      {card.price && (
        <span className="c-pr">
          <b>{card.price.amount}</b>
          {card.price.unit && <small>{card.price.unit}</small>}
        </span>
      )}
      <span className="c-acts">
        <button type="button" className="c-go" onClick={() => onShow(card.target)} aria-label={L(`${card.title}: planda göster`, `${card.title}: show on the plan`)}>
          {L("Planda göster", "Show on the plan")}
        </button>
        {card.done ? (
          <span className="c-done">
            <UiIcon name="check" size={13} />
            {card.done}
          </span>
        ) : card.pick ? (
          <button type="button" className="c-pick" onClick={() => onPick(card.pick!.itemId, card.target)} aria-label={`${card.title}: ${card.pick.label}`}>
            {card.pick.label}
          </button>
        ) : null}
      </span>
    </div>
  );
}
