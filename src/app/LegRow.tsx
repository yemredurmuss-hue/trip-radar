import { useState } from "react";
import { legItem, legTiming, MODE_LABELS, modesFor, withLegChoice, type Leg } from "../lib/legs";
import { formatDateRange } from "../lib/items";
import type { Item, LegMode } from "../lib/types";
import { updateTrip } from "./actions";

const ICONS: Record<LegMode, string> = {
  flight: "✈",
  train: "🚆",
  bus: "🚌",
  ferry: "⛴",
  metro: "🚇",
  taxi: "🚕",
  transfer: "🚐",
  car: "🚗",
  walk: "🚶",
};

const KIND_LABEL = { arrival: "Varış transferi", move: "Şehir değişimi", change: "Otel değişimi", departure: "Gidiş transferi" } as const;

/**
 * One transfer between the stays: where from and to, when, and where it stands (open, planned by
 * metro, a saved option, booked). Opening it shows what's easy to miss and lets the traveller say
 * how they'll go; saying it in the chat ("metroyla gideceğim") does the same.
 */
export function LegRow({ leg, tripId, onOpenItem }: { leg: Leg; tripId: string; onOpenItem: (item: Item) => void }) {
  const [open, setOpen] = useState(false);
  const timing = legTiming(leg);
  const choice = leg.choice;
  const save = (patch: Parameters<typeof withLegChoice>[2]) => void updateTrip(tripId, (t) => withLegChoice(t, leg.key, patch));
  const settledByItem = leg.options.some((i) => i.status === "booked");
  const settled = legItem(leg);

  return (
    <div className={`leg st-${leg.status}${open ? " open" : ""}`} id={`leg-${leg.key}`}>
      <button className="leg-head" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${KIND_LABEL[leg.kind]}: ${leg.from.label} → ${leg.to.label}`}>
        <span className="leg-icon" aria-hidden>
          {leg.mode ? ICONS[leg.mode] : "↓"}
        </span>
        <span className="leg-main">
          <span className="leg-title">
            {leg.from.label} → {leg.to.label}
          </span>
          <span className="leg-sub">
            {KIND_LABEL[leg.kind]} · {formatDateRange(leg.date, null)}
            {timing && ` · ${timing}`}
            {settled && ` · ${settled.name}`}
          </span>
        </span>
        <span className={`leg-chip st-${leg.status}`}>{leg.statusText}</span>
      </button>
      {!open && leg.notes.length > 0 && (
        <p className="leg-note">
          ⓘ {leg.notes[0]}
          {leg.notes.length > 1 && <span className="muted"> (+{leg.notes.length - 1})</span>}
        </p>
      )}
      {open && (
        <div className="leg-body">
          {leg.notes.map((n) => (
            <p key={n} className="leg-note">
              ⓘ {n}
            </p>
          ))}
          {leg.options.length > 0 && (
            <div className="leg-options">
              {leg.options.map((i) => (
                <button key={i.id} className="link-btn" onClick={() => onOpenItem(i)}>
                  {i.name}
                  {i.status === "booked" ? " ✓" : i.status === "chosen" ? " (seçildi)" : ""}
                </button>
              ))}
            </div>
          )}
          {!settledByItem && (
            <>
              <div className="leg-modes" role="group" aria-label="Nasıl gideceksin?">
                {modesFor(leg.kind).map((m) => (
                  <button
                    key={m}
                    className={`mode-chip${choice?.mode === m ? " on" : ""}`}
                    aria-pressed={choice?.mode === m}
                    onClick={() => save(choice?.mode === m ? { mode: null } : { mode: m })}
                  >
                    {ICONS[m]} {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
              <label className="leg-booked">
                <input type="checkbox" checked={Boolean(choice?.booked)} onChange={(e) => save({ booked: e.target.checked })} />
                Ayarlandı / rezerve edildi
              </label>
            </>
          )}
          {choice?.note && <p className="muted small-note">Not: {choice.note}</p>}
          <p className="muted small-note">
            Sohbette “metroyla gideceğim” ya da “transferi ayarladım” demen de yeter; seçenekleri birlikte konuşabiliriz.
          </p>
        </div>
      )}
    </div>
  );
}
