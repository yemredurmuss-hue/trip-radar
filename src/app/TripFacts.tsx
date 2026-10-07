// The hero's card on the right (hero v9, docs/superpowers/specs/2026-10-05-hero-v9-design.md), one block
// under the other with a hairline between: who goes and the trip's style, the budget (booked, planned, free),
// "Tercihler" (what was understood), the country and its weather, and the small things in one row (money,
// plug, time, language). Every block has an empty state; what arrives later fades in.
import { useEffect, useRef, useState } from "react";
import { weatherTitle, type CityWeather } from "../lib/climate";
import { countryNames, currencyName, flagEmoji, offsetText, plugFit, plugFitText } from "../lib/heroInfo";
import { formatPrice } from "../lib/items";
import { L, locale } from "../lib/i18n";
import { BUDGET_SLICES, type BudgetBar, type BudgetSlice } from "../lib/progress";
import type { TripFacts as Facts } from "../lib/tripFacts";
import type { Who } from "../lib/tripSettings";
import type { StyleChip } from "../lib/tripStyle";
import type { Trip } from "../lib/types";
import { HeroIcon, type HeroIconName } from "./Icons";
import { Preferences } from "./IntentCard";
import { Travellers } from "./Travellers";
import { useAppear } from "./useAppear";
import type { Decisions } from "./useDecisions";
import { useWeather } from "./useWeather";

export function TripFacts(props: {
  trip: Trip;
  decisions: Decisions | null;
  range: { start: string; end: string } | null;
  facts: Facts;
  /** The traveller's own country (the passport in Settings): whether their plugs fit. */
  home: string;
  /** The trip's country codes, in the order its places come. */
  countries: string[];
  /** Each city's days, for its weather. */
  places: { city: string; start: string; end: string }[];
  today: string;
  chips: StyleChip[];
  bar: BudgetBar | null;
  /** Who goes (Travellers.useWho): the names and how many. */
  who: Who;
  /** Opens the share dialog; absent where the trip can't be shared (the sample). */
  onShare?: () => void;
}) {
  const { range, facts } = props;
  const names = countryNames(props.countries);
  const weather = useWeather(props.places, names.length === 1 ? names[0] : null, props.today);
  const month = range ? new Date(`${range.start}T12:00:00Z`).toLocaleDateString(locale(), { month: "long", timeZone: "UTC" }) : "";
  // The budget's word needs the exchange rates (decisions): until they're read, no "empty" style yet.
  const ready = !!props.decisions;
  const chipsAppear = useAppear(props.chips.length > 0, ready);
  const placeAppear = useAppear(names.length > 0);
  const weatherAppear = useAppear(weather.length > 0);
  return (
    <aside className="hx-side">
      <div className="hx-block hx-who">
        <Travellers trip={props.trip} who={props.who} onShare={props.onShare} />
        {props.chips.length > 0 ? (
          <div key="chips" className={`hx-styles${chipsAppear}`} aria-label={L("Gezinin tarzı", "The trip's style")}>
            {props.chips.map((c) => (
              <span key={c.label} style={{ background: c.bg, color: c.fg }}>
                <HeroIcon name={c.icon} size={16} />
                {c.label}
              </span>
            ))}
          </div>
        ) : !ready ? (
          <div key="loading" className="hx-styles" aria-hidden>
            <span className="hx-wait">&nbsp;</span>
          </div>
        ) : (
          <div key="none" className="hx-styles">
            <span className="empty">{L("Tarzın konuştukça belirir", "Your style shows as we talk")}</span>
          </div>
        )}
      </div>
      <Budget bar={props.bar} ready={ready} />
      <Preferences trip={props.trip} decisions={props.decisions} />
      {names.length > 0 ? (
        <div key="place" className={`hx-block hx-place${placeAppear}`}>
          <div className="hx-countries">
            {props.countries.map((code, n) => (
              <span key={code}>
                {flagEmoji(code) && (
                  <i className="flag" aria-hidden>
                    {flagEmoji(code)}
                  </i>
                )}
                {names[n]}
              </span>
            ))}
          </div>
          {weather.length > 0 && (
            <div key="weather" className={`hx-weather${weatherAppear}`}>
              {weather.map((w) => (
                <span key={w.city} title={weatherTitle(w, month)}>
                  <span className="city">{w.city}</span>
                  <HeroIcon name={skyIcon(w)} size={22} className={`sky-${w.sky}`} />
                  <span className="deg">{w.high}°</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div key="none" className="hx-block hx-place">
          <p className="hx-empty">{L("Ülke ve hava, şehir belli olunca gelir", "The country and its weather come once the city is known")}</p>
        </div>
      )}
      <Minis facts={facts} home={props.home} />
    </aside>
  );
}

/**
 * The budget big (else what's known so far), then what's booked (green), planned but not booked (amber) and
 * still free (grey) or over (red), a line each. A tap opens the split by kind, what's left, and what the open
 * decisions will likely add.
 */
function Budget({ bar, ready }: { bar: BudgetBar | null; ready: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const known = bar ? bar.booked + bar.chosen : 0;
  const filled = !!bar && (known > 0 || bar.total != null);
  const appear = useAppear(filled, ready);
  // Still reading the prices (no decisions yet): the heading and the block's height, not "—".
  if (!ready) {
    return (
      <div key="loading" className="hx-block hx-budget" aria-busy="true">
        <div className="hx-budget-top">
          <h3 className="hx-h">{L("Bütçe", "Budget")}</h3>
        </div>
        <p className="hx-empty hx-wait" aria-hidden>
          &nbsp;
        </p>
      </div>
    );
  }
  if (!bar || !filled) {
    return (
      <div key="none" className="hx-block hx-budget">
        <div className="hx-budget-top">
          <h3 className="hx-h">{L("Bütçe", "Budget")}</h3>
          <strong>—</strong>
        </div>
        <p className="hx-empty">{L("Fiyatlı kayıtlar geldikçe toplanır", "Adds up as priced saves come in")}</p>
      </div>
    );
  }
  const money = (n: number) => formatPrice(n, bar.currency);
  const over = bar.total != null && known > bar.total ? known - bar.total : 0;
  const free = bar.total != null && !over ? bar.total - known : 0;
  const slices = BUDGET_SLICES.filter((s) => bar.byCategory[s] > 0);
  const lines: [string, string, number][] = [
    ["booked", L("Rezerve", "Booked"), bar.booked],
    ["planned", L("Planlanan", "Planned"), bar.chosen],
    ["free", L("Boşta", "Free"), free],
    ["over", L("Aşıyor", "Over"), over],
  ];
  // Its name for a screen reader, with spaces: the drawn spans read "Bütçe€1.500Rezerve€552" run together.
  const spoken = [`${L("Bütçe", "Budget")} ${money(bar.total ?? known)}`, ...lines.filter(([, , n]) => n > 0).map(([, label, n]) => `${label} ${money(n)}`)].join(", ");
  return (
    <div key="full" className={`hx-block hx-budget${appear}`} ref={box}>
      <button className="hx-budget-btn" aria-expanded={open} aria-label={spoken} title={L("Ayrıntı için tıkla", "Click for details")} onClick={() => setOpen(!open)}>
        <span className="hx-budget-top">
          <span className="hx-h">{L("Bütçe", "Budget")}</span>
          <strong title={bar.total == null ? L("Bütçe belirlenmedi; bilinen toplam", "No budget set; the known total") : undefined}>{money(bar.total ?? known)}</strong>
        </span>
        {lines
          .filter(([, , n]) => n > 0)
          .map(([k, label, n]) => (
            <span key={k} className={`hx-budget-line ${k}`}>
              <span>
                <i aria-hidden />
                {label}
              </span>
              <b>{money(n)}</b>
            </span>
          ))}
      </button>
      {open && (
        <div className="hx-pop">
          {slices.map((s) => (
            <div key={s} className="line">
              <span>
                <i className={`c-${s}`} />
                {sliceLabel(s)}
              </span>
              <b>{money(bar.byCategory[s])}</b>
            </div>
          ))}
          {bar.total != null && known <= bar.total && (
            <>
              {slices.length > 0 && <div className="sep" />}
              <div className="line">
                <span>{L("Kalan", "Left")}</span>
                <b>{money(bar.total - known)}</b>
              </div>
            </>
          )}
          {bar.open > 0 && (
            <div className="left">{L(`Karar bekleyenler seçilince yaklaşık ${money(bar.open)} daha eklenir.`, `About ${money(bar.open)} more once the open decisions are made.`)}</div>
          )}
          {bar.uncounted > 0 && <div className="left">{L(`${bar.uncounted} fiyat sayılamadı.`, bar.uncounted === 1 ? "1 price couldn't be counted." : `${bar.uncounted} prices couldn't be counted.`)}</div>}
        </div>
      )}
    </div>
  );
}

/** The small things in one row: the money (its rate on hover), the plug, the time difference, the language. */
function Minis({ facts, home }: { facts: Facts; home: string }) {
  const local = facts.local;
  if (!local) return null;
  const fit = plugFit(home, facts.country);
  const offset = offsetText(local.hours);
  const cells: [HeroIconName, string, string | undefined][] = [
    ["coin", currencyName(local.currency), local.rateText ?? undefined],
    ...(local.info.plugs.length ? [["plug", L(`${local.info.plugs.join("/")} priz`, `${local.info.plugs.join("/")} plug`), fit ? plugFitText(fit) : undefined] as [HeroIconName, string, string | undefined]] : []),
    ...(offset ? [["clock", offset, L("Senin saatine göre", "Against your own time")] as [HeroIconName, string, string | undefined]] : []),
    ["lang", L(local.info.language.tr, local.info.language.en), undefined],
  ];
  return (
    <div className="hx-block">
      <div className="hx-minis">
        {cells.map(([icon, text, title]) => (
          <span key={icon} title={title}>
            <HeroIcon name={icon} size={18} />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

const skyIcon = (w: CityWeather): HeroIconName => w.sky;

const sliceLabel = (s: BudgetSlice) =>
  ({ flight: L("Uçuş", "Flights"), stay: L("Konaklama", "Stays"), transport: L("Ulaşım", "Transport"), activity: L("Deneyim", "Experiences"), other: L("Diğer", "Other") })[s];
