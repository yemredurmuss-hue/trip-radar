// "Yolculuk sırasıyla" (plan v46, F5b): the trip as ONE column, card after card in the order it is lived. A dark "Yola çıkış"
// capsule, then (a dotted link between every two) the flight, the way on, a thin heading for the city, its stay, each of its
// events as its own card, the to-dos and restaurants in one box, the next way ... and the green "Eve dönüş". Flights and rides are
// the Plan's own cards (PlanEntry), here at a compact width; the stay, the events and the to-dos are small cards that take
// the reader to the real card (JourneyCards). The data is the timeline's board (lib/journey.ts journeyFlow): nothing here
// is a second source, it only lays the same blocks out in order.
import { Fragment, type ReactNode } from "react";
import { journeyFlow, type FlowNode } from "../../lib/journey";
import { L } from "../../lib/i18n";
import { nNights } from "../../lib/i18nText";
import { reasonItemOf } from "../../lib/reason";
import { rangeText, spanText } from "../../lib/storyDates";
import type { Timeline } from "../../lib/timeline";
import type { Item } from "../../lib/types";
import { useCardEnv } from "../cards/PlanCard";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import type { LegCardFor, RenderGroup, SettledFor } from "../Timeline";
import { JourneyEvent, JourneyStay, JourneyTodo, type GoTarget } from "./JourneyCards";
import { PlanEntry } from "./PlanEntry";

type Cards = { legCard: LegCardFor; renderGroup: RenderGroup; settled: SettledFor };

export function StoryView({ timeline, tripStart, cards, items, onGo }: { timeline: Timeline; tripStart: string | null; items: Item[]; cards: Cards; onGo: (target: GoTarget) => void }) {
  const env = useCardEnv();
  const nodes = journeyFlow(timeline, items);
  if (!nodes.length) return null;
  // The activity the trip is for (a festival's ticket) says so on its card.
  const reasonId = reasonItemOf(env.trip, nodes.flatMap((n) => (n.kind === "event" ? [n.item] : [])))?.id ?? null;
  const draw = (n: FlowNode): ReactNode => {
    switch (n.kind) {
      case "start":
        return (
          <div className="jf-end start">
            <KindIcon kind="flight" size={16} />
            {n.city ? L(`Yola çıkış · ${n.city}`, `Setting off · ${n.city}`) : L("Yola çıkış", "Setting off")}
          </div>
        );
      case "entry":
        return (
          <div className="jf-w jf-plan">
            <PlanEntry entry={n.entry} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} plain />
          </div>
        );
      case "city": {
        const dates = rangeText(n.range?.start, n.range?.end);
        return (
          <div className="jf-city" title={spanText(n.range?.start, n.range?.end, tripStart) || undefined}>
            <i />
            <span className="jf-cb">
              <UiIcon name="pin" size={15} />
              <b>{n.city ?? L("Konaklama", "Stay")}</b>
              {(dates || n.nights > 0) && <span className="num">{[dates, n.nights > 0 ? nNights(n.nights) : null].filter(Boolean).join(" · ")}</span>}
            </span>
            <i />
          </div>
        );
      }
      case "stay":
        return (
          <div className="jf-w">
            <JourneyStay stay={n.stay} onGo={onGo} />
          </div>
        );
      case "event":
        return (
          <div className="jf-w">
            <JourneyEvent item={n.item} date={n.date} reason={n.item.id === reasonId} onGo={onGo} />
          </div>
        );
      case "todo":
        return (
          <div className="jf-w">
            <JourneyTodo items={n.items} onGo={onGo} />
          </div>
        );
      case "end":
        return (
          <div className="jf-end">
            <UiIcon name="check" size={16} />
            {n.city ? L(`Eve dönüş · ${n.city}`, `Back home · ${n.city}`) : L("Eve dönüş", "Back home")}
          </div>
        );
    }
  };
  return (
    <div className="jf section trip-plan" data-pit-children="">
      {nodes.map((n, i) => (
        <Fragment key={n.key}>
          {i > 0 && <div className="jf-link" aria-hidden />}
          {draw(n)}
        </Fragment>
      ))}
    </div>
  );
}
