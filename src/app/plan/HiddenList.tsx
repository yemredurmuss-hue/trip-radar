// The end of an open section (kategoriler-v4 .hidden-link): what belongs here but is out of the way — a
// record ruled out ("Ele"), an option a booking closed, a transfer or nights said not needed ("Gerek yok") —
// behind one quiet "Gizlenenler · N göster". Opened, a compact row each, with the way back it always had:
// "Geri al" puts a ruled-out record back among the options, "Geri getir" brings a transfer or nights back;
// a closed option says which booking closed it (undo the booking and it comes back) and opens on a tap.
// The v82 categories (plan v83 F3, Hidden): what was said not needed comes as its intent's head folded down, "Gerek yok
// dedin · Geri al" putting it back where it stood; the rest keeps its row.
import { useState } from "react";
import type { HiddenThing } from "../../lib/categories";
import { hiddenEntries, type HiddenEntry } from "../../lib/hiddenIntents";
import { L } from "../../lib/i18n";
import { formatDateRange, formatPrice } from "../../lib/items";
import { stageLabel, stageOf } from "../../lib/lifecycle";
import type { Item, Suggestion } from "../../lib/types";
import { restoreSuggestion, setHidden, setItemStatus } from "../actions";
import { useCardEnv } from "../cards/PlanCard";
import { kindLabel } from "../LegRow";
import { Ic, partIcon } from "./v82/icons";

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
      // A booking cancelled ("İptal ettim") says so, with what was said about the refund (lifecycle.ts).
      const why = thing.kind === "closed" ? thing.reason : stageOf(item) === "cancelled" ? stageLabel("cancelled") : L("Elendi", "Ruled out");
      const meta = [why, item.refundNote, item.city, priceOf(item)].filter(Boolean).join(" · ");
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

/** "Gizlenenler · n" at a v82 category's end, on its rail (F3): the heads said not needed first, then the rows. */
export function Hidden({ section, live, suggestions, art }: {
  section: { id: HiddenThing["section"]; hidden: readonly HiddenThing[] };
  /** The category's records still on the plan. */
  live: readonly Item[];
  suggestions: readonly Suggestion[];
  /** A kind's drawing for a head (IntentBox.artOf). */
  art: (kind: Extract<HiddenEntry, { name: string }>["kind"]) => string;
}) {
  const entries = hiddenEntries(section, live, suggestions);
  if (!entries.length) return null;
  const heads = entries.filter((e): e is Extract<HiddenEntry, { name: string }> => e.type !== "row");
  const rows = entries.filter((e): e is Extract<HiddenEntry, { type: "row" }> => e.type === "row");
  return (
    <details className="q-hid">
      <summary>
        {L(`Gizlenenler · ${entries.length}`, `Hidden · ${entries.length}`)}
      </summary>
      <div className="q-hidb">
        {heads.map((e) => (
          <SkippedHead key={e.key} entry={e} art={art(e.kind)} />
        ))}
        {rows.length > 0 && (
          <ul className="cat-hidden-rows">
            {rows.map((r) => (
              <HiddenRow key={r.key} thing={r.thing} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** A need said not needed, as its box's head with the body folded away: "Gerek yok dedin · Geri al". */
function SkippedHead({ entry, art }: { entry: Extract<HiddenEntry, { name: string }>; art: string }) {
  const env = useCardEnv();
  const back = async () => {
    switch (entry.type) {
      case "nights":
        await setHidden(env.tripId, entry.hiddenKey, false, entry.name);
        for (const item of entry.items) await setItemStatus(item, "saved");
        return;
      case "leg":
        return setHidden(env.tripId, entry.hiddenKey, false, entry.name);
      case "need":
        for (const item of entry.items) await setItemStatus(item, "saved");
        return;
      case "suggestion":
        return restoreSuggestion(env.tripId, entry.suggestion.key, entry.name);
    }
  };
  return (
    <section className="q-int z-int skip" data-st="skip" data-hidden={entry.key} aria-label={entry.name}>
      <div className="q-head z-h">
        <div className="q-art">
          <img className="art" src={art} alt="" />
        </div>
        <div className="q-hd">
          <h4 className="q-nm" title={entry.name}>{entry.name}</h4>
          <div className="q-ln">
            {entry.parts.map((p) => (
              <span key={p}>
                <Ic name={partIcon(p)} size={14} />
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="q-hr">
          <span className="q-st none">{L("Gerek yok", "Not needed")}</span>
        </div>
      </div>
      <p className="q-skipl">
        <span>{L("Gerek yok dedin.", "You said it's not needed.")}</span>
        <button type="button" className="q-undo" onClick={() => void back()} aria-label={L(`${entry.name}: geri al`, `${entry.name}: undo`)}>
          {L("Geri al", "Undo")}
        </button>
      </p>
    </section>
  );
}
