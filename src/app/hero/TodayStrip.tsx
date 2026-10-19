// "Bugün" (v83 "gezi sırasında", D8, F2; hero83.py today_html): on the trip's days the hero's place holds the day as it is
// lived: its date, city and number, the weather, hour by hour what happens (gone by faded, the one on now marked, each
// with its one thing to do then), tomorrow's first thing and the way to "Yolculuk sırasıyla". On a flight's day that
// flight as its live data says it: the gate, the delay, the new time and "Planı yeni saate göre kaydırdım". What the strip
// says is lib/tripToday.ts's; the weather is the hero's own (useWeather, the same cache).
import { useEffect, useState } from "react";
import { sameCity } from "../../lib/plan";
import { L } from "../../lib/i18n";
import type { TodayAction, TodayRow, TodayVM } from "../../lib/tripToday";
import { HeroIcon } from "../Icons";
import { useWeather } from "../useWeather";
import { XIcon } from "./icons";

const MINUTE = 60_000;

/**
 * The clock the strip and "Sıradaki" go by: a new moment each minute while `on` (the trip's days, the last two before a
 * flight), else the one it was opened at.
 */
export function useMinuteClock(on: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    if (!on) return;
    // On the minute, then every minute.
    let tick: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      setNow(new Date());
      tick = setInterval(() => setNow(new Date()), MINUTE);
    }, MINUTE - (Date.now() % MINUTE) + 50);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [on]);
  return now;
}

/** Gone by, on now, next: the row's look. */
const PHASE: Record<TodayRow["phase"], string> = { past: "done", now: "now", next: "next", later: "" };

function RowAction({ action, onDoc }: { action: TodayAction; onDoc: (itemId: string) => void }) {
  if (action.kind === "doc") {
    return action.itemId ? (
      <button type="button" className="q-open sm" onClick={() => onDoc(action.itemId!)}>
        {action.label}
      </button>
    ) : null;
  }
  return action.url ? (
    <a className="q-alk" href={action.url} target="_blank" rel="noreferrer">
      {action.label} <span aria-hidden>↗</span>
    </a>
  ) : null;
}

export function TodayStrip({ vm, places, country, now, onJourney, onDoc }: {
  vm: TodayVM;
  /** Each city's days, as the hero asks its weather for them (the same cache). */
  places: { city: string; start: string; end: string }[];
  country: string | null;
  /** The hero's today (its weather's key). */
  now: string;
  /** "Yolculuk sırasıyla →": the Plan in trip order, at today's chapter. */
  onJourney: () => void;
  onDoc: (itemId: string) => void;
}) {
  const here = places.filter((p) => vm.city && sameCity(p.city, vm.city));
  const weather = useWeather(here, country, now)[0] ?? null;
  const f = vm.flight;
  const live = f && f.tiles.length > 0;
  const tomorrow = vm.tomorrow;
  return (
    <section className="x-today" aria-label={L("Bugün", "Today")}>
      <div className="xt-h">
        <div className="xt-d">
          <b>{L("Bugün", "Today")}</b>
          <small>{vm.title}</small>
        </div>
        {weather && (
          <span className="xt-w">
            <HeroIcon name={weather.sky} size={15} />
            {weather.high}°
            <span className="xt-wl">
              {" · "}
              {L(`gece ${weather.low}°`, `night ${weather.low}°`)}
            </span>
          </span>
        )}
        <button type="button" className="xt-go" onClick={onJourney}>
          {L("Yolculuk sırasıyla", "In trip order")}
          <XIcon name="arrow" size={14} stroke={2.2} />
        </button>
      </div>
      {vm.rows.length > 0 && (
        <ol className="xt-l" aria-label={L("Bugünün akışı", "Today's flow")}>
          {vm.rows.map((r) => (
            <li key={r.key} className={`xt-r ${PHASE[r.phase]}${r.alert ? " alert" : ""}`} data-row={r.kind} data-key={r.key} aria-current={r.phase === "now" ? "time" : undefined}>
              <time>{r.time ? `${r.estimated ? "~" : ""}${r.time}` : ""}</time>
              <span className="xt-k">{r.kindWord}</span>
              <span className="xt-m">
                <b>{r.title}</b>
                {r.sub && <small>{r.sub}</small>}
              </span>
              {r.action ? <RowAction action={r.action} onDoc={onDoc} /> : <span />}
            </li>
          ))}
        </ol>
      )}
      {live && (
        <div className={`xt-live${f.alert ? " alert" : ""}`} role="status">
          <span className="xt-lvt">
            <i className="xt-dot" aria-hidden />
            <b>{L("Canlı", "Live")}</b> · {f.title}
          </span>
          <span className="xt-tiles">
            {f.tiles.map((t) => (
              <span key={`${t.label}:${t.value}`} className={`xt-tile${t.tone ? ` ${t.tone}` : ""}`}>
                <small>{t.label}</small>
                <b>
                  {t.value}
                  {t.note && <i> {t.note}</i>}
                </b>
              </span>
            ))}
          </span>
          {f.shift && <p className="xt-shift">{f.shift}</p>}
          {f.source && <small className="xt-src">{L(`Veri: ${f.source}`, `Data: ${f.source}`)}</small>}
        </div>
      )}
      {tomorrow && (
        <div className="xt-next">
          <XIcon name="clock" size={15} stroke={2} />
          <b>{tomorrow.time ? L(`Yarın ${tomorrow.time}`, `Tomorrow ${tomorrow.time}`) : L("Yarın", "Tomorrow")}</b>
          <span>{[tomorrow.title, tomorrow.sub].filter(Boolean).join(" · ")}</span>
        </div>
      )}
    </section>
  );
}

/** A row of today on the strip (the hero's "Sıradaki" goes there). */
export function todayRowEl(key: string): Element | null {
  return document.querySelector(`.x-today .xt-r[data-key="${CSS.escape(key)}"]`);
}
