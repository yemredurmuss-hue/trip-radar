// The end of an open section (kategoriler-v4 .hidden-link): what belongs here but is out of the way — a
// record ruled out ("Ele"), an option a booking closed, a transfer or nights said not needed ("Gerek yok") —
// behind one quiet "Gizlenenler · N göster". Opened, a compact row each, with the way back it always had:
// "Geri al" puts a ruled-out record back among the options, "Geri getir" brings a transfer or nights back;
// a closed option says which booking closed it (undo the booking and it comes back) and opens on a tap.
import { useState } from "react";
import type { HiddenThing } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { formatDateRange, formatPrice } from "../../lib/items";
import type { Item } from "../../lib/types";
import { setHidden, setItemStatus } from "../actions";
import { useCardEnv } from "../cards/PlanCard";
import { kindLabel } from "../LegRow";

export function HiddenList({ things }: { things: HiddenThing[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cat-hidden">
      <p className="cat-hidden-link">
        {L("Gizlenenler", "Hidden")} ·{" "}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? L("kapat", "close") : L(`${things.length} göster`, `show ${things.length}`)}
        </button>
      </p>
      {open && (
        <ul className="cat-hidden-rows">
          {things.map((t) => (
            <HiddenRow key={t.key} thing={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

const priceOf = (item: Item) => (item.price.amount != null ? formatPrice(item.price.amount, item.price.currency) : null);

function HiddenRow({ thing }: { thing: HiddenThing }) {
  const env = useCardEnv();
  switch (thing.kind) {
    case "dismissed":
    case "closed": {
      const { item } = thing;
      const meta = [thing.kind === "closed" ? thing.reason : L("Elendi", "Ruled out"), item.city, priceOf(item)].filter(Boolean).join(" · ");
      return (
        <li className={`cat-hidden-row ${thing.kind}`} data-item-id={item.id}>
          <button type="button" className="cat-hidden-name" onClick={() => env.onOpenItem(item)}>
            {item.name}
          </button>
          <span className="cat-hidden-meta">{meta}</span>
          {thing.kind === "dismissed" && (
            <button type="button" className="link-btn" onClick={() => void setItemStatus(item, "saved")} title={L("Seçeneklere geri al", "Back to options")}>
              {L("Geri al", "Undo")}
            </button>
          )}
        </li>
      );
    }
    case "leg": {
      const { leg } = thing;
      const name = kindLabel()[leg.kind];
      return (
        <li className="cat-hidden-row leg">
          <b className="cat-hidden-name">{name}</b>
          <span className="cat-hidden-meta">
            {formatDateRange(leg.date, null)} · {leg.from.label} → {leg.to.label}
          </span>
          <button type="button" className="link-btn" onClick={() => void setHidden(env.tripId, thing.key, false, name)}>
            {L("Geri getir", "Bring back")}
          </button>
        </li>
      );
    }
    case "nights": {
      const label = `${thing.city ?? L("Konaklama", "Stay")} ${formatDateRange(thing.range.start, thing.range.end)}`;
      return (
        <li className="cat-hidden-row nights">
          <b className="cat-hidden-name">{L("Geceler", "Nights")}</b>
          <span className="cat-hidden-meta">{label}</span>
          <button type="button" className="link-btn" onClick={() => void setHidden(env.tripId, thing.key, false, label)}>
            {L("Geri getir", "Bring back")}
          </button>
        </li>
      );
    }
  }
}
