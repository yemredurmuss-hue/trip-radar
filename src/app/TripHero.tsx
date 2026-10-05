// The trip at a glance, left column: a photo per city (switcher + slow auto-advance), the dates and the
// countdown on it, the title, one paragraph (mood + status), the plan in one line (icon, number, name:
// flights, stays, transport, experiences), and "what I understood".
import { useEffect, useState, type ReactNode } from "react";
import { countdown, countdownText } from "../lib/countdown";
import type { HeroTally } from "../lib/heroInfo";
import { formatDateRange } from "../lib/items";
import { L } from "../lib/i18n";
import type { Trip } from "../lib/types";
import { HeroIcon, type HeroIconName } from "./Icons";
import { IntentRow } from "./IntentCard";
import type { Decisions } from "./useDecisions";

export interface HeroCity {
  name: string;
  image: string | null;
}

export function TripHero(props: {
  trip: Trip;
  decisions: Decisions | null;
  cities: HeroCity[];
  range: { start: string; end: string } | null;
  today: string;
  lead: string;
  tally: HeroTally;
  working: number;
  menu: ReactNode;
}) {
  const { trip, cities, range, today, tally } = props;
  const [i, setI] = useState(0);
  // Every 6 s to the next city; a tap on one restarts the wait.
  useEffect(() => {
    if (cities.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % cities.length), 6000);
    return () => clearInterval(t);
  }, [cities.length, i]);
  const at = cities.length ? i % cities.length : 0;
  const label = countdownText(countdown(range, today));
  const shown: [keyof HeroTally, number, string, HeroIconName][] = [
    ["flight", tally.flight, L("uçuş", tally.flight === 1 ? "flight" : "flights"), "plane"],
    ["stay", tally.stay, L("konaklama", tally.stay === 1 ? "stay" : "stays"), "bed"],
    ["transport", tally.transport, L("ulaşım", "transport"), "car"],
    ["experience", tally.experience, L("deneyim", tally.experience === 1 ? "experience" : "experiences"), "star"],
  ];
  const stats = shown.filter(([, n]) => n > 0);
  const busy = L(`${props.working} kayıt işleniyor`, `Processing ${props.working}`);
  return (
    <div className="hx-left">
      <div className="hx-photo">
        {/* Keyed by the photo too: a failed one is hidden in place, so a new address must mount a fresh <img>. */}
        {cities.map((c, n) =>
          c.image ? <img key={`${c.name || n}|${c.image}`} src={c.image} alt={c.name} className={n === at ? "on" : ""} onError={(e) => (e.currentTarget.style.display = "none")} /> : null,
        )}
        {cities.length > 1 && (
          <div className="hx-cities">
            {cities.map((c, n) => (
              <button key={c.name} className={n === at ? "on" : ""} onClick={() => setI(n)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
        {props.working > 0 && (
          <span className="hx-busy" title={busy}>
            <i />
            <span>{busy}</span>
          </span>
        )}
      </div>
      {/* Outside the photo (which clips): the menu opens over the page. */}
      <div className="hx-menu">{props.menu}</div>
      {(range || label) && (
        <div className="hx-tab">
          <HeroIcon name="cal" size={18} />
          {range && <b>{formatDateRange(range.start, range.end)}</b>}
          {range && label && <span className="sep">·</span>}
          {label && <span>{label}</span>}
        </div>
      )}
      <div className="hx-story">
        <h1>{trip.title}</h1>
        {props.lead && <p className="hx-lead">{props.lead}</p>}
        {stats.length > 0 && (
          <div className="hx-stats" aria-label={L("Planda", "In the plan")}>
            {stats.map(([k, n, word, icon]) => (
              <span key={k} className={`c-${k}`}>
                <HeroIcon name={icon} size={20} />
                <b>{n}</b> {word}
              </span>
            ))}
          </div>
        )}
        <IntentRow trip={trip} decisions={props.decisions} />
      </div>
    </div>
  );
}
