// "Yolculuk günü" (plan v46, r-yolgunu; drawn in docs/mockups/artifact-arsivi/sade-yolculuk-gunu-D3sMFH, A "Tek bilet"): the day a
// traveller changes city is one card, not six lines. The trip itself is in the middle as the Plan's own ticket (a flight,
// a train, the card they know), what comes before it above (check-out, the transfer there) and what comes after below
// (the transfer, check-in), each a line as Gün gün draws it (its time, its stage, its way to go opened under it).
import { Fragment } from "react";
import { isPlanRow, type DayCard } from "../../lib/dayCards";
import { journeyRows, type JourneyDay as Journey } from "../../lib/dayView";
import { placeRoute } from "../../lib/dayRowTitle";
import { L } from "../../lib/i18n";
import type { DayRow } from "../../lib/journey";
import { PlanEntry } from "../plan/PlanEntry";
import { ArrivalAsk, DayLine, RowWarn, usePlace, type DayPlanCards } from "./DayCards";

export function JourneyDay({ journey, card, cards, onShow, tripId }: { journey: Journey; card: DayCard; cards: DayPlanCards; onShow: (key: string) => void; tripId: string }) {
  const place = usePlace();
  const route = card.route ? placeRoute(card.route, place) : null;
  const left = journeyRows(journey).filter((r) => isPlanRow(r) && r.state !== "done").length;
  const lines = (rows: DayRow[]) => (
    <ol className="dg-tl">
      {rows.map((r) => (
        <DayLine key={r.key} row={r} onTap={() => onShow(r.entry?.key ?? r.stayKey ?? r.key)} tripId={tripId} />
      ))}
    </ol>
  );
  return (
    <article className="jd" aria-label={route ? L(`Yolculuk günü: ${route}`, `Travel day: ${route}`) : L("Yolculuk günü", "Travel day")}>
      <header className="jd-head">
        <b>{L("Yolculuk günü", "Travel day")}</b>
        {route && <span>{route}</span>}
        {left > 0 && <span className="jd-left">{L(`${left} satır bekliyor`, `${left} waiting`)}</span>}
      </header>
      {journey.before.length > 0 && (
        <div className="jd-edge">
          <span className="jd-lbl">{L("Çıkış", "Leaving")}</span>
          {lines(journey.before)}
        </div>
      )}
      <div className="jd-body">
        {journey.body.map((r) =>
          r.kind === "travel" && r.entry ? (
            <Fragment key={r.key}>
              <div className="jd-ticket" id={`jd-${r.key}`}>
                <PlanEntry entry={r.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} />
              </div>
              <ArrivalAsk row={r} />
              <RowWarn row={r} tripId={tripId} />
            </Fragment>
          ) : (
            <Fragment key={r.key}>{lines([r])}</Fragment>
          ),
        )}
      </div>
      {journey.after.length > 0 && (
        <div className="jd-edge">
          <span className="jd-lbl">{L("Varış", "Arriving")}</span>
          {lines(journey.after)}
        </div>
      )}
    </article>
  );
}
