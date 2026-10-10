// The one-time start card above a new trip's plan (spec item 7): Uçuşları bul · Konaklamaları seç · Önerilere
// bak, each ticked by itself from the board's own state; gone when all are done or with ×. The lasting
// guidance stays the hero's "Planı tamamla".
import { L } from "../../lib/i18n";
import { approxDates, dayText, guideSteps, guideVisible, type GuideInput, type GuideStep } from "../../lib/startTrip";
import type { Trip } from "../../lib/types";
import { updateTrip } from "../actions";
import { UiIcon } from "../cards/Silhouettes";

interface Props extends GuideInput {
  trip: Trip;
  onGo: (step: GuideStep["id"]) => void;
}

export function StartGuideCard({ trip, onGo, ...board }: Props) {
  const steps = guideSteps(trip, board);
  if (!guideVisible(trip, steps)) return null;
  const next = steps.find((s) => !s.done);
  const change = (patch: Partial<NonNullable<Trip["startGuide"]>>) =>
    void updateTrip(trip.id, (t) => ({ ...t, startGuide: { createdAt: t.startGuide?.createdAt ?? Date.now(), ...t.startGuide, ...patch } }), { touch: false });
  return (
    <section className="st-guide" aria-label={L("Başlangıç", "Getting started")}>
      <div className="st-guide-head">
        <div>
          <div className="st-guide-title">{L(`${trip.title} hazır`, `${trip.title} is ready`)}</div>
          <div className="st-guide-sub">{L("Üç adımda yola hazır. Her adım bitince kendiliğinden işaretlenir.", "Three steps to be ready. Each ticks itself off when it's done.")}</div>
        </div>
        <button type="button" className="st-guide-x" aria-label={L("Başlangıç kartını kapat", "Close the start card")} onClick={() => change({ closed: true })}>
          ×
        </button>
      </div>
      {approxDates(trip) && trip.startGuide?.approxStart && (
        <p className="st-guide-approx">
          {L(`Başlangıç yaklaşık: ${dayText(trip.startGuide.approxStart)}.`, `The start is a rough guess: ${dayText(trip.startGuide.approxStart)}.`)}{" "}
          <button type="button" className="btn-link" onClick={() => change({ approxStart: null })}>
            {L("Bu tarih doğru", "That's the date")}
          </button>{" "}
          <span className="muted">{L("ya da sohbette yeni tarihi söyle.", "or tell the chat the new one.")}</span>
        </p>
      )}
      <ol className="st-guide-steps">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`st-guide-step${s.done ? " done" : ""}${s === next ? " next" : ""}`}
              onClick={() => {
                if (s.id === "suggestions") change({ looked: true });
                onGo(s.id);
              }}
            >
              <span className="st-guide-n" aria-hidden>
                {s.done ? <UiIcon name="check" size={13} /> : i + 1}
              </span>
              <span>{s.label}</span>
              {!s.done && <span aria-hidden>↗</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
