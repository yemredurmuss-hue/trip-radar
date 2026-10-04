// The trip at a glance, left column: a photo per city (switcher + slow auto-advance), the countdown
// and route label, the title, one paragraph (mood + status), what's confirmed, and "what I understood".
import { useEffect, useState, type ReactNode } from "react";
import { countdown, countdownText } from "../lib/countdown";
import { L } from "../lib/i18n";
import type { Trip } from "../lib/types";
import { HeroIcon, type HeroIconName } from "./Icons";
import { IntentRow } from "./IntentCard";
import type { Decisions } from "./useDecisions";

export interface HeroCity {
  name: string;
  image: string | null;
}

/** Chosen or booked, still in the plan. `carsOnly`: every counted transport is a rented car ("araç"). */
export interface HeroCounts {
  flight: number;
  stay: number;
  transport: number;
  activity: number;
  carsOnly: boolean;
}

export function TripHero(props: {
  trip: Trip;
  decisions: Decisions | null;
  cities: HeroCity[];
  range: { start: string; end: string } | null;
  today: string;
  routeText: string | null;
  mapUrl: string | null;
  lead: string;
  counts: HeroCounts;
  working: number;
  menu: ReactNode;
}) {
  const { trip, cities, range, today, counts } = props;
  const [i, setI] = useState(0);
  // Every 6 s to the next city; a tap on one restarts the wait.
  useEffect(() => {
    if (cities.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % cities.length), 6000);
    return () => clearInterval(t);
  }, [cities.length, i]);
  const at = cities.length ? i % cities.length : 0;
  const label = countdownText(countdown(range, today));
  const shown: [keyof Omit<HeroCounts, "carsOnly">, string, HeroIconName, string][] = [
    ["flight", L("uçuş", "flights"), "plane", L("Alınan ya da seçilen uçuş", "Flights booked or chosen")],
    ["stay", L("konaklama", "stays"), "bed", L("Seçilen ya da rezerve konaklama", "Stays chosen or booked")],
    [
      "transport",
      counts.carsOnly ? L("araç", "cars") : L("ulaşım", "transport"),
      "car",
      counts.carsOnly ? L("Kiralanan araç", "Cars rented") : L("Seçilen ya da alınan ulaşım", "Transport chosen or booked"),
    ],
    ["activity", L("etkinlik", "activities"), "ticket", L("Plana alınan etkinlik", "Activities in the plan")],
  ];
  const stats = shown.filter(([k]) => counts[k] > 0);
  const busy = L(`${props.working} kayıt işleniyor`, `Processing ${props.working}`);
  return (
    <div className="hx-left">
      <div className="hx-photo">
        {cities.map((c, n) =>
          c.image ? <img key={c.name || n} src={c.image} alt={c.name} className={n === at ? "on" : ""} onError={(e) => (e.currentTarget.style.display = "none")} /> : null,
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
      {(label || props.routeText) && (
        <div className="hx-tab">
          {label && (
            <>
              <HeroIcon name="clock" size={18} />
              <b>{label}</b>
            </>
          )}
          {label && props.routeText && <span className="sep">·</span>}
          {props.routeText &&
            (props.mapUrl ? (
              <a href={props.mapUrl} target="_blank" rel="noreferrer" title={L("Rotayı Google Haritalar'da gör", "See the route on Google Maps")}>
                {props.routeText} ↗
              </a>
            ) : (
              <span>{props.routeText}</span>
            ))}
        </div>
      )}
      <div className="hx-story">
        <h1>{trip.title}</h1>
        {props.lead && <p className="hx-lead">{props.lead}</p>}
        {stats.length > 0 && (
          <div className="hx-stats" aria-label={L("Onaylananlar", "Confirmed")}>
            {stats.map(([k, word, icon, title]) => (
              <div key={k} className={`c-${k}`} title={title}>
                <HeroIcon name={icon} size={20} />
                <b>{counts[k]}</b>
                <span>{word}</span>
              </div>
            ))}
          </div>
        )}
        <IntentRow trip={trip} decisions={props.decisions} />
      </div>
    </div>
  );
}
