// "Yolculuk sırasıyla" (plan v30): the trip in the order it's lived, the dates down the left (month, day, weekday, "Gün N"),
// a dashed line with a node for each stop, the Plan's own cards on the right: each city with its stays and what's
// planned there ("Burada"), the way between them as the same cards. The data is the timeline's board (the plan's
// front), so nothing here is a second source: it only lays the same blocks out by date.
import type { ReactNode } from "react";
import { L } from "../../lib/i18n";
import { dateBox, spanText } from "../../lib/storyDates";
import type { Timeline, TimelineEntry, TimelineSection } from "../../lib/timeline";
import type { Item } from "../../lib/types";
import { bookedAs } from "../../lib/cardView";
import { BookedBadge } from "../cards/BookedBadge";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import type { LegCardFor, RenderGroup, SettledFor } from "../Timeline";
import { PlanEntry } from "./PlanEntry";

type Cards = { legCard: LegCardFor; renderGroup: RenderGroup; settled: SettledFor };

const dayOf = (s: TimelineSection): string | null => (s.kind === "travel" ? s.entry.date : s.kind === "journey" ? s.journey.date : (s.range?.start ?? null));

/** The things planned in a city that aren't a stay or a way there: plans and bookings on its days. */
function hereItems(entries: TimelineEntry[]): Item[] {
  const out: Item[] = [];
  for (const e of entries) {
    if (e.kind === "plan") out.push(...e.items);
    else if (e.kind === "event") out.push(e.item);
    else if (e.kind === "day") out.push(...e.items);
  }
  return out.filter((i) => i.status === "chosen" || i.status === "booked");
}

export function StoryView({ timeline, tripStart, cards }: { timeline: Timeline; tripStart: string | null; cards: Cards }) {
  const rows: ReactNode[] = [];
  let last = "";
  const dateCell = (iso: string | null) => {
    const b = dateBox(iso, tripStart);
    if (!b) return <span className="sy-nodate" />;
    if (b.iso === last) return <span className="sy-same" title={L("aynı gün", "same day")} />;
    last = b.iso;
    return (
      <span className="sy-date" data-pit-sy="">
        <span>{b.month}</span>
        <b>{b.day}</b>
        <small>{b.weekday}</small>
        {b.dayNo != null && <i>{L(`Gün ${b.dayNo}`, `Day ${b.dayNo}`)}</i>}
      </span>
    );
  };
  const row = (key: string, iso: string | null, icon: ReactNode, body: ReactNode, cls: string) => (
    <div key={key} className={`sy-row ${cls}`}>
      <div className="sy-d">{dateCell(iso)}</div>
      <div className="sy-r">
        <span className="sy-node" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="sy-c">{body}</div>
    </div>
  );
  const entry = (e: TimelineEntry) => <PlanEntry key={e.key} entry={e} legCard={cards.legCard} renderGroup={cards.renderGroup} settled={cards.settled} plain />;
  for (const s of timeline.board) {
    if (s.kind === "travel") {
      rows.push(row(s.key, s.entry.date, <KindIcon kind={s.entry.role === "move" ? "transport" : "flight"} size={18} />, entry(s.entry), "sy-leg"));
    } else if (s.kind === "journey") {
      rows.push(row(s.key, s.journey.date, <KindIcon kind={s.journey.role === "move" ? "transport" : "flight"} size={18} />, <>{s.entries.map(entry)}</>, "sy-leg"));
    } else {
      const here = hereItems(s.entries);
      const start = s.range?.start ?? null;
      rows.push(
        row(
          s.key || `city:${s.index}`,
          start,
          <KindIcon kind="stay" size={18} />,
          <div className="sy-city">
            <div className="sy-ch">
              <b>{s.city ?? L("Konaklama", "Stay")}</b>
              <span>
                {s.nights > 0 ? `${L(`${s.nights} gece`, `${s.nights} night${s.nights === 1 ? "" : "s"}`)} · ` : ""}
                {spanText(s.range?.start, s.range?.end, tripStart)}
              </span>
            </div>
            <div className="sy-cb">
              <div className="sy-stays">{s.stays.map(entry)}</div>
              <div className="sy-here">
                <span className="sy-lbl">{L("Burada", "Here")}</span>
                {here.length === 0 && <span className="sy-none">{L("Henüz bir şey yok", "Nothing yet")}</span>}
                {here.map((i) => (
                  <span key={i.id} className={`sy-ev${i.status === "booked" ? " rez" : ""}`} title={i.name}>
                    <KindIcon kind={i.category === "food" ? "food" : "activity"} size={15} />
                    <b>{i.name}</b>
                    {i.status === "booked" && <BookedBadge as={bookedAs(i)} small />}
                  </span>
                ))}
              </div>
            </div>
          </div>,
          "sy-stop",
        ),
      );
    }
  }
  // The way home ends the line (the drawing's "✓ Eve dönüş · İstanbul"): the day the last flight lands, where home is.
  const lastSec = timeline.board[timeline.board.length - 1];
  const home = lastSec?.kind === "journey" && lastSec.journey.role === "departure" ? lastSec.journey : lastSec?.kind === "travel" && lastSec.entry.role === "departure" ? lastSec.entry : null;
  if (home) {
    const homeCity = "to" in home ? home.to : null;
    const homeDay = "date" in home ? home.date : null;
    const label = homeCity ? L(`Eve dönüş · ${homeCity}`, `Back home · ${homeCity}`) : L("Eve dönüş", "Back home");
    rows.push(row("home-end", homeDay, <UiIcon name="check" size={18} />, <span className="sy-end">{label}</span>, "sy-endrow"));
  }
  if (!rows.length) return null;
  return (
    <div className="sy section trip-plan" data-pit-children="">
      {rows}
    </div>
  );
}
