// The trip at a glance, left column (hero v9, docs/superpowers/specs/2026-10-05-hero-v9-design.md): a photo
// per city (switcher top left, countdown and ••• top right), the title, the dates, one muted sentence, the plan
// in four cells (a tap opens that section of the Plan) and "Rezervasyonların": the sections' "3/4"s added up,
// a bar and the one dark button. Every block has an empty state; what arrives later fades in.
import { useEffect, useState, type ReactNode } from "react";
import { countdown, countdownText } from "../lib/countdown";
import type { HeroTally } from "../lib/heroInfo";
import { formatDateRange, nightsBetween } from "../lib/items";
import { L } from "../lib/i18n";
import { nDays } from "../lib/i18nText";
import type { DecisionProgress } from "../lib/progress";
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
  /** The Plan's sections' settled / total, added up (categories.planProgress). */
  done: { settled: number; total: number; pct: number; complete: boolean };
  progress: DecisionProgress;
  /** Which list is open under the hero: every to-do, or the cancellations running out. */
  list: "all" | "deadline" | null;
  onList: (list: "all" | "deadline" | null) => void;
  action: HeroAction | null;
  working: number;
  menu: ReactNode;
}) {
  const { trip, cities, range, tally, done, progress } = props;
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
  const deadlines = progress.count.deadline;
  const toggle = (list: "all" | "deadline") => props.onList(props.list === list ? null : list);
  const pct = L(`%${done.pct}`, `${done.pct}%`);
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
          {shown.map(([k, word, icon]) => (
            <button key={k} className={`c-${k}${tally[k] ? "" : " zero"}`} title={L("Plan'da göster", "Show on the Plan")} onClick={() => props.onTally(k)}>
              <HeroIcon name={icon} size={22} />
              <span>
                {tally[k]} {word}
              </span>
            </button>
          ))}
        </div>
        <div className={`hx-progress${done.total ? "" : " empty"}`}>
          <div className="hx-progress-main">
            <div className="hx-progress-head">
              <b>{done.complete ? L("Her şey hazır", "All set") : L("Rezervasyonların", "Your bookings")}</b>
              {done.total > 0 ? (
                <span key="count" className={`hx-progress-meta${barAppear}`}>
                  {progress.todos.length > 0 ? (
                    <button className="hx-progress-count" aria-expanded={props.list === "all"} title={L("Yapılacakları göster", "Show what's left")} onClick={() => toggle("all")}>
                      {L(`${done.settled}/${done.total} onaylandı`, `${done.settled}/${done.total} confirmed`)}
{" "}
                      <span className="dot" aria-hidden>
                        ·
                      </span>{" "}
                      <b>{pct}</b>
                    </button>
                  ) : (
                    <span className="hx-progress-count">
                      {L(`${done.settled}/${done.total} onaylandı`, `${done.settled}/${done.total} confirmed`)}
{" "}
                      <span className="dot" aria-hidden>
                        ·
                      </span>{" "}
                      <b>{pct}</b>
                    </span>
                  )}
                  {deadlines > 0 && (
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
                </span>
              ) : (
                <span key="none" className="hx-progress-meta">
                  {L("Henüz kayıt yok", "Nothing saved yet")}
                </span>
              )}
            </div>
            <div className="hx-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={done.pct} aria-label={L("Onaylanan", "Confirmed")}>
              {done.pct > 0 && <i style={{ width: `${done.pct}%` }} />}
            </div>
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
