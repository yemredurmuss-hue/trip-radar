// The trip at a glance, left column (hero v9, docs/superpowers/specs/2026-10-05-hero-v9-design.md): a photo
// per city (switcher top left, countdown and ••• top right), the title, the dates, one muted sentence, the plan
// in four cells (a tap opens that section of the Plan) and "Planlama %75": what needs a booking in three stages
// (booked, planned, waiting for a decision), a bar in two greens and the one dark button. Every block has an
// empty state; what arrives later fades in.
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { countdown, countdownText } from "../lib/countdown";
import type { HeroTally } from "../lib/heroInfo";
import { formatDateRange, nightsBetween } from "../lib/items";
import { L } from "../lib/i18n";
import { nDays } from "../lib/i18nText";
import type { PlanList } from "../lib/planList";
import type { Trip } from "../lib/types";
import { HeroIcon, type HeroIconName } from "./Icons";
import { useAppear } from "./useAppear";

export interface HeroCity {
  name: string;
  image: string | null;
}

/** The progress box's button: where the next step is (or the first save, or sharing). */
export interface HeroAction {
  label: string;
  /** What it does in words, for the tooltip and screen readers ("Karar ver: Madeira konaklama"). */
  title?: string;
  run: () => void;
}

export function TripHero(props: {
  trip: Trip;
  cities: HeroCity[];
  range: { start: string; end: string } | null;
  /** The dates come from the saves, not set: "~" and a tooltip. */
  estimated: boolean;
  today: string;
  lead: string;
  tally: HeroTally;
  /** A cell of the plan line: its section on the Plan. */
  onTally: (kind: keyof HeroTally) => void;
  /** The Plan's sections' settled / total, added up (categories.planProgress): nothing saved, or all done. */
  done: { settled: number; total: number; pct: number; complete: boolean };
  /** What needs a booking, in three stages (planList.ts): the bar's two fills, its words and the list they open. */
  todo: PlanList;
  /** Which list is open under the hero: every to-do, or the cancellations running out. */
  list: "all" | "deadline" | null;
  onList: (list: "all" | "deadline" | null) => void;
  action: HeroAction | null;
  working: number;
  menu: ReactNode;
}) {
  const { trip, cities, range, tally, done, todo } = props;
  const [i, setI] = useState(0);
  // Every 6 s to the next city; a tap on one restarts the wait.
  useEffect(() => {
    if (cities.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % cities.length), 6000);
    return () => clearInterval(t);
  }, [cities.length, i]);
  const at = cities.length ? i % cities.length : 0;
  const label = countdownText(countdown(range, props.today));
  const hasImage = cities.some((c) => c.image);
  const known = cities.some((c) => c.name);
  const days = range ? nightsBetween(range.start, range.end) + 1 : 0;
  const shown: [keyof HeroTally, string, HeroIconName][] = [
    ["flight", L("uçuş", tally.flight === 1 ? "flight" : "flights"), "plane"],
    ["stay", L("konaklama", tally.stay === 1 ? "stay" : "stays"), "bed"],
    ["transport", L("ulaşım", "transport"), "car"],
    ["experience", L("deneyim", tally.experience === 1 ? "experience" : "experiences"), "star"],
  ];
  const busy = L(`${props.working} kayıt işleniyor`, `Processing ${props.working}`);
  const dateAppear = useAppear(!!range);
  const barAppear = useAppear(done.total > 0);
  const deadlines = todo.deadlines.length;
  const listed = todo.open.length + todo.book.length + todo.ways.length + deadlines;
  const toggle = (list: "all" | "deadline") => props.onList(props.list === list ? null : list);
  const { booked, planned, open, total } = todo.stages;
  // Planned or booked of all that needs a booking; never 100 while something waits for a decision. Nothing that
  // needs a booking: an empty bar (no stage to fill), never a full one.
  const pct = total ? Math.min(Math.round(((booked + planned) / total) * 100), open ? 99 : 100) : 0;
  const reach = total ? ((booked + planned) / total) * 100 : 0;
  const bookedW = total ? (booked / total) * 100 : 0;
  // "3 rezerve · 3 planlandı · 2 karar bekliyor": a zero says nothing, so it's left out. Once nothing waits for a
  // decision, what's planned is what's left to book.
  const words: [string, ReactNode][] = [];
  if (booked) words.push(["booked", <><i className="hx-key booked" aria-hidden />{L(`${booked} rezerve`, `${booked} booked`)}</>]);
  if (planned) words.push(["planned", <><i className="hx-key planned" aria-hidden />{open ? L(`${planned} planlandı`, `${planned} planned`) : L(`${planned} rezervasyon kaldı`, `${planned} ${planned === 1 ? "booking" : "bookings"} left`)}</>]);
  if (open) words.push(["open", L(`${open} karar bekliyor`, `${open} to decide`)]);
  // The transfers not said yet aren't a stage (no fill in the bar); with no decision left they still get a word, so
  // "Planlama tamam" never hides them and the list stays one tap away.
  const ways = todo.ways.length;
  if (ways && !open) words.push(["ways", L(`${ways} ulaşım sorusu`, `${ways} transfer question${ways === 1 ? "" : "s"}`)]);
  // The line wraps between the parts, never inside one, and a dot goes with the part after it (none left dangling).
  const parts = words.map(([k, w], n) => (
    <Fragment key={k}>
      {n > 0 && " "}
      <span className="hx-part">
        {n > 0 && (
          <>
            <span className="dot" aria-hidden>
              ·
            </span>{" "}
          </>
        )}
        {w}
      </span>
    </Fragment>
  ));
  const barLabel = L(`Planlama: ${booked} rezerve, ${planned} planlandı, ${open} karar bekliyor`, `Planning: ${booked} booked, ${planned} planned, ${open} to decide`);
  return (
    <div className="hx-left">
      <div className={`hx-photo${hasImage ? "" : " empty"}`}>
        {/* Under the photos: seen while there's none, or when one fails to load. */}
        <div className="hx-ph" aria-hidden={hasImage || undefined}>
          <HeroIcon name="landscape" size={36} />
          {!hasImage && !known && <span>{L("Şehir belli olunca fotoğrafı gelir", "The photo comes once the city is known")}</span>}
        </div>
        {/* Keyed by the photo too: a failed one is hidden in place, so a new address must mount a fresh <img>. */}
        {cities.map((c, n) =>
          c.image ? <img key={`${c.name || n}|${c.image}`} src={c.image} alt={c.name} className={n === at ? "on" : ""} onError={(e) => (e.currentTarget.style.display = "none")} /> : null,
        )}
        {cities.length > 1 && (
          <div className="hx-cities">
            {cities.map((c, n) => (
              <button key={c.name} className={n === at ? "on" : ""} aria-pressed={n === at} onClick={() => setI(n)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="hx-badges">
          {props.working > 0 && (
            <span className="hx-busy" title={busy}>
              <i />
              <span>{busy}</span>
            </span>
          )}
          {label && <span className="hx-count">{label}</span>}
        </div>
      </div>
      {/* Outside the photo (which clips): the menu opens over the page. */}
      <div className="hx-menu">{props.menu}</div>
      <div className="hx-story">
        <h1>{trip.title}</h1>
        {range ? (
          <div key="dates" className={`hx-when${dateAppear}`} title={props.estimated ? L("Tahmini · kayıtlardan", "Estimated · from saves") : undefined}>
            <HeroIcon name="cal" size={20} />
            <span>
              {props.estimated ? "~" : ""}
              {formatDateRange(range.start, range.end)}
            </span>
            <span className="dot" aria-hidden>
              ·
            </span>
            <span>{nDays(days)}</span>
          </div>
        ) : (
          <div key="none" className="hx-when empty">
            <HeroIcon name="cal" size={20} />
            <span>{L("Tarihler kaydettikçe netleşir", "Dates fill in as you save")}</span>
          </div>
        )}
        {props.lead && <p className="hx-lead">{props.lead}</p>}
        <div className="hx-tally" role="group" aria-label={L("Planda", "In the plan")}>
          {/* One line each, sized to its words; the lines between are their own items so they sit mid-gap. */}
          {shown.map(([k, word, icon], n) => (
            <Fragment key={k}>
              {n > 0 && <i className="hx-sep" aria-hidden />}
              <button className={`c-${k}${tally[k] ? "" : " zero"}`} title={L("Plan'da göster", "Show on the Plan")} onClick={() => props.onTally(k)}>
                <HeroIcon name={icon} size={22} />
                <span>
                  {tally[k]} {word}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        <div className={`hx-progress${done.total ? "" : " empty"}`}>
          <div className="hx-progress-main">
            {/* The words, the bar (and "⏳ 2") on one line, the three stages under them: the box keeps the height it had. */}
            <div className="hx-progress-head">
              <b>{done.total === 0 ? L("Planlama", "Planning") : done.complete ? L("Her şey hazır", "All set") : total === 0 ? L("Planlama", "Planning") : open === 0 ? L("Planlama tamam", "Planning done") : L(`Planlama %${pct}`, `Planning ${pct}%`)}</b>
              {/* Two fills from the left: planned (light) under booked (dark), so booked + planned is the light one's end. */}
              <div className="hx-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={barLabel}>
                {reach > 0 && <i className="hx-bar-planned" style={{ width: `${reach}%` }} />}
                {bookedW > 0 && <i className="hx-bar-booked" style={{ width: `${bookedW}%` }} />}
              </div>
              {done.total > 0 && deadlines > 0 && (
                <button
                  className="hx-deadline"
                  aria-expanded={props.list === "deadline"}
                  aria-label={L(`Ücretsiz iptal süresi yaklaşan ${deadlines} rezervasyon`, `${deadlines} free cancellation(s) running out`)}
                  title={L(`Ücretsiz iptal süresi yaklaşan ${deadlines} rezervasyon`, `${deadlines} free cancellation(s) running out`)}
                  onClick={() => toggle("deadline")}
                >
                  ⏳ {deadlines}
                </button>
              )}
            </div>
            {done.total > 0 ? (
              <span key="count" className={`hx-progress-meta${barAppear}`}>
                {parts.length > 0 &&
                  (listed > 0 ? (
                    <button className="hx-progress-count" aria-expanded={props.list === "all"} title={L("Yapılacakları göster", "Show what's left")} onClick={() => toggle("all")}>
                      {parts}
                    </button>
                  ) : (
                    <span className="hx-progress-count">{parts}</span>
                  ))}
              </span>
            ) : (
              <span key="none" className="hx-progress-meta">
                {L("Henüz kayıt yok", "Nothing saved yet")}
              </span>
            )}
          </div>
          {props.action && (
            <button className="hx-go" title={props.action.title} aria-label={props.action.title ? `${props.action.label}: ${props.action.title}` : undefined} onClick={props.action.run}>
              {props.action.label}
              <HeroIcon name="arrow" size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
