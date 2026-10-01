import { useState } from "react";
import { legItem, legShortTitle, legTiming, MODE_LABELS, modesFor, withLegChoice, type Leg } from "../lib/legs";
import type { Item, LegMode } from "../lib/types";
import { removeItem, setHidden, updateTrip } from "./actions";
import { L } from "../lib/i18n";

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

/** A transfer's kind in a word or two, in the current language. */
export const kindLabel = () => ({
  arrival: L("Varış transferi", "Arrival transfer"),
  move: L("Şehir değişimi", "City change"),
  change: L("Otel değişimi", "Hotel change"),
  departure: L("Gidiş transferi", "Departure transfer"),
});

/**
 * One transfer between the stays: where from and to, when, and where it stands (open, planned by
 * metro, a saved option, booked). Opening it shows what's easy to miss and lets the traveller say
 * how they'll go; saying it in the chat ("metroyla gideceğim") does the same.
 */
export function LegRow({
  leg,
  tripId,
  onOpenItem,
  embedded = false,
  timed = false,
}: {
  leg: Leg;
  tripId: string;
  onOpenItem: (item: Item) => void;
  /** Only the body, open: the line above it is its head. */
  embedded?: boolean;
  /** Its time is beside it already (a day's rows): the sub line keeps only the places. */
  timed?: boolean;
}) {
  const [toggled, setOpen] = useState(false);
  // Inside a day on the move the step is the head; only the body shows, open.
  const open = embedded || toggled;
  const timing = legTiming(leg);
  const choice = leg.choice;
  const save = (patch: Parameters<typeof withLegChoice>[2]) => void updateTrip(tripId, (t) => withLegChoice(t, leg.key, patch));
  const settledByItem = leg.options.some((i) => i.status === "booked");
  const settled = legItem(leg);

  return (
    <div className={`leg st-${leg.status}${open ? " open" : ""}${embedded ? " embedded" : ""}`} id={`leg-${leg.key}`}>
      {!embedded && (
        <button className="leg-head" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${kindLabel()[leg.kind]}: ${leg.from.label} → ${leg.to.label}`}>
          <span className="leg-icon" aria-hidden>
            {leg.mode ? ICONS[leg.mode] : "↓"}
          </span>
          <span className="leg-main">
            <span className="leg-title">{legShortTitle(leg)}</span>
            <span className="leg-sub">
              {[timed ? null : timing, `${leg.from.label} → ${leg.to.label}`, settled?.name].filter(Boolean).join(" · ")}
              {!open && leg.notes.length > 0 && (
                <span className="leg-hint" title={leg.notes.join("\n")} aria-label={L(`${leg.notes.length} not`, `${leg.notes.length} note${leg.notes.length === 1 ? "" : "s"}`)}>
                  {" "}
                  ⓘ
                </span>
              )}
            </span>
          </span>
          <span className={`leg-chip st-${leg.status}`}>{leg.statusText}</span>
        </button>
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
                <span key={i.id} className="leg-option">
                  <button className="link-btn" onClick={() => onOpenItem(i)}>
                    {i.name}
                    {i.status === "booked" ? " ✓" : i.status === "chosen" ? (i.origin === "chat" ? L(" (planlanıyor)", " (planning)") : L(" (seçildi)", " (chosen)")) : ""}
                  </button>
                  {/* A plan said in the chat ("12 Ekim'e taksi") comes off in one tap. */}
                  {i.origin === "chat" && i.status !== "booked" && (
                    <button className="link-btn quiet" onClick={() => void removeItem(i)} aria-label={L(`${i.name}: kaldır`, `${i.name}: remove`)}>
                      {L("Kaldır", "Remove")}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {!settledByItem && (
            <>
              <div className="leg-modes" role="group" aria-label={L("Nasıl gideceksin?", "How will you go?")}>
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
                {L("Ayarlandı / rezerve edildi", "Arranged / booked")}
              </label>
            </>
          )}
          {choice?.note && (
            <p className="muted small-note">
              {L("Not:", "Note:")} {choice.note}
            </p>
          )}
          <p className="muted small-note">
            {L(
              "Sohbette “metroyla gideceğim” ya da “transferi ayarladım” demen de yeter; seçenekleri birlikte konuşabiliriz.",
              "You can also say “I'll take the metro” or “I've booked the transfer” in the chat. We can talk the options through together.",
            )}
          </p>
          {leg.kind !== "move" && (
            <button className="link-btn quiet" onClick={() => void setHidden(tripId, `leg:${leg.key}`, true, kindLabel()[leg.kind])}>
              {L("Gerek yok · gizle", "Not needed · hide")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
