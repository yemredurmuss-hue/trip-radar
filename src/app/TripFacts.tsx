// The facts column beside the hero, one fact a line: how long, which country, the places, who goes, the
// weather there, the budget (booked, planned, free), and the small things in one quiet row (money, plug,
// time, language); then the next step and a quiet line of the rest. Unknown rows are left out.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { weatherTitle, type CityWeather } from "../lib/climate";
import { currencyName, initials, offsetText, plugFit, plugFitText } from "../lib/heroInfo";
import { formatPrice, nightsBetween } from "../lib/items";
import { L, locale } from "../lib/i18n";
import { nDays } from "../lib/i18nText";
import { BUDGET_SLICES, nextStepText, type BudgetBar, type BudgetSlice, type DecisionProgress, type Todo, type TodoKind } from "../lib/progress";
import type { TripFacts as Facts } from "../lib/tripFacts";
import { HeroIcon, type HeroIconName } from "./Icons";
import { kinds } from "./Progress";
import { ShareLine, useShare } from "./Share";
import { useWeather } from "./useWeather";

export function TripFacts(props: {
  range: { start: string; end: string } | null;
  estimated: boolean;
  facts: Facts;
  /** The traveller's own country (the passport in Settings): whether their plugs fit. */
  home: string;
  countries: string[];
  cities: string[];
  /** Each city's days, for its weather. */
  places: { city: string; start: string; end: string }[];
  mapUrl: string | null;
  today: string;
  bar: BudgetBar | null;
  progress: DecisionProgress;
  onGo: (t: Todo["target"]) => void;
  /** Opens the share dialog when every to-do is done; absent where the trip can't be shared (the sample). */
  onShare?: () => void;
  /** Which kind's list is open under the hero. */
  todoOpen: TodoKind | null;
  onTodo: (kind: TodoKind | null) => void;
}) {
  const { range, facts, bar, progress } = props;
  const share = useShare();
  const days = range ? nightsBetween(range.start, range.end) + 1 : 0;
  const next = progress.todos[0];
  const weather = useWeather(props.places, props.countries.length === 1 ? props.countries[0] : null, props.today);
  const month = range ? new Date(`${range.start}T12:00:00Z`).toLocaleDateString(locale(), { month: "long", timeZone: "UTC" }) : "";
  // Who goes: the people on a shared trip by name, else as many plain circles as the saves say.
  const names = share ? [...new Set([share.me, ...(share.state?.members ?? [])].map((n) => n.trim()).filter(Boolean))] : [];
  const people = names.length ? names.length : (facts.adults ?? 0);
  return (
    <aside className="hx-side">
      <div className="hx-rows">
        {range && (
          <Fact icon="hourglass" label={L("Süre", "Length")} title={props.estimated ? L("Tahmini · kayıtlardan", "Estimated · from saves") : undefined}>
            {props.estimated ? "~" : ""}
            {nDays(days)}
          </Fact>
        )}
        {props.countries.length > 0 && (
          <Fact icon="globe" label={props.countries.length > 1 ? L("Ülkeler", "Countries") : L("Ülke", "Country")}>
            {props.countries.join(", ")}
          </Fact>
        )}
        {props.cities.length > 0 && (
          <Fact icon="pin" label={L("Lokasyonlar", "Places")}>
            {props.mapUrl ? (
              <a href={props.mapUrl} target="_blank" rel="noreferrer" title={L("Rotayı Google Haritalar'da gör", "See the route on Google Maps")}>
                {props.cities.join(", ")}
              </a>
            ) : (
              props.cities.join(", ")
            )}
          </Fact>
        )}
        {people > 0 && (
          <Fact icon="users" label={L("Yolcular", "Travellers")} title={names.length ? names.join(", ") : L(`${people} yetişkin`, `${people} adult${people === 1 ? "" : "s"}`)}>
            <span className="hx-people">
              {Array.from({ length: Math.min(people, 4) }, (_, n) => (
                <i key={n} className={`p${n % 4}`}>
                  {names[n] ? initials(names[n]) : <HeroIcon name="user" size={14} />}
                </i>
              ))}
              {people > 4 && <i className="more">+{people - 4}</i>}
            </span>
          </Fact>
        )}
        {share && (
          <div className="hx-share">
            <ShareLine />
          </div>
        )}
        {weather.length > 0 && (
          <Fact icon="partly" label={L("Hava", "Weather")}>
            <span className="hx-weather">
              {weather.map((w) => (
                <span key={w.city} title={weatherTitle(w, month)}>
                  <HeroIcon name={skyIcon(w)} size={17} className={`sky-${w.sky}`} />
                  <span>{w.high}°</span>
                  {weather.length > 1 && <small>{w.city}</small>}
                </span>
              ))}
            </span>
          </Fact>
        )}
        {bar && <BudgetRow bar={bar} />}
        <Minis facts={facts} home={props.home} />
      </div>
      {next ? (
        <button className="hx-next" onClick={() => props.onGo(next.target)}>
          <small>{L("Sıradaki adım", "Next step")}</small>
          <span title={nextStepText(next)}>
            <em>{nextStepText(next)}</em>
            <HeroIcon name="arrow" size={18} />
          </span>
        </button>
      ) : props.onShare ? (
        <button className="hx-next" onClick={props.onShare}>
          <small>{L("Her şey hazır", "All set")}</small>
          <span>
            {L("Bu geziyi paylaş", "Share this trip")} <HeroIcon name="arrow" size={18} />
          </span>
        </button>
      ) : (
        <div className="hx-next">
          <small>{L("Her şey hazır", "All set")}</small>
          <span>{L("Her şey karara bağlandı", "Everything's decided")}</span>
        </div>
      )}
      {progress.todos.length > 0 && (
        <div className="hx-todo" aria-label={L("Yapılacaklar", "To do")}>
          {kinds()
            .filter((k) => progress.count[k.kind] > 0)
            .map((k) => (
              <button
                key={k.kind}
                className={props.todoOpen === k.kind ? "on" : ""}
                aria-expanded={props.todoOpen === k.kind}
                title={k.kind === "deadline" ? L(`Ücretsiz iptal süresi yaklaşan ${progress.count.deadline} rezervasyon`, `${progress.count.deadline} free cancellation(s) running out`) : undefined}
                onClick={() => props.onTodo(props.todoOpen === k.kind ? null : k.kind)}
              >
                {k.kind === "deadline" ? "⏳" : k.label} <b>{progress.count[k.kind]}</b>
              </button>
            ))}
        </div>
      )}
    </aside>
  );
}

/**
 * The budget big (else what's known so far), a bar of what's booked (green), planned but not booked
 * (amber) and still free (grey), and the three sums small under it. A tap opens the split by kind,
 * what's left, and what the open decisions will likely add.
 */
function BudgetRow({ bar }: { bar: BudgetBar }) {
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
  const known = bar.booked + bar.chosen;
  if (known <= 0 && bar.total == null) return null;
  const scale = Math.max(bar.total ?? 0, known) || 1;
  const money = (n: number) => formatPrice(n, bar.currency);
  const over = bar.total != null && known > bar.total ? known - bar.total : 0;
  const free = bar.total != null && !over ? bar.total - known : 0;
  const slices = BUDGET_SLICES.filter((s) => bar.byCategory[s] > 0);
  return (
    <div className="hx-budget click" ref={box} title={L("Ayrıntı için tıkla", "Click for details")} onClick={() => setOpen(!open)}>
      <div className="top">
        <HeroIcon name="wallet" size={18} />
        <small>{bar.total != null ? L("Bütçe", "Budget") : L("Bilinen toplam", "Known total")}</small>
        <strong>{money(bar.total ?? known)}</strong>
      </div>
      <div className="hx-meter" aria-label={L("Alınan, planlanan ve boşta kalan", "Booked, planned and free")}>
        {bar.booked > 0 && <i className="booked" style={{ width: `${(bar.booked / scale) * 100}%` }} />}
        {bar.chosen > 0 && <i className="planned" style={{ width: `${(bar.chosen / scale) * 100}%` }} />}
      </div>
      <div className="legend">
        {bar.booked > 0 && (
          <span>
            <i className="booked" />
            {L(`${money(bar.booked)} alındı`, `${money(bar.booked)} booked`)}
          </span>
        )}
        {bar.chosen > 0 && (
          <span>
            <i className="planned" />
            {L(`${money(bar.chosen)} planda`, `${money(bar.chosen)} planned`)}
          </span>
        )}
        {free > 0 && (
          <span>
            <i />
            {L(`${money(free)} boşta`, `${money(free)} free`)}
          </span>
        )}
        {over > 0 && <span className="hx-over">{L(`${money(over)} aşıyor`, `${money(over)} over`)}</span>}
      </div>
      {open && (
        <div className="hx-pop" onClick={(e) => e.stopPropagation()}>
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

/** One fact, one line: icon, label, the value on the right. */
function Fact({ icon, label, title, children }: { icon: HeroIconName; label: string; title?: string; children: ReactNode }) {
  return (
    <div className="hx-fact" title={title}>
      <HeroIcon name={icon} size={18} />
      <small>{label}</small>
      <strong>{children}</strong>
    </div>
  );
}

/** The small things in one row: the money (its rate on hover), the plug, the time difference, the language. */
function Minis({ facts, home }: { facts: Facts; home: string }) {
  const local = facts.local;
  if (!local) return null;
  const fit = plugFit(home, facts.country);
  const offset = offsetText(local.hours);
  return (
    <div className="hx-minis">
      <span title={local.rateText ?? undefined}>
        <HeroIcon name="coin" size={16} />
        {currencyName(local.currency)}
      </span>
      {local.info.plugs.length > 0 && (
        <span title={fit ? plugFitText(fit) : undefined}>
          <HeroIcon name="plug" size={16} />
          {local.info.plugs.join("/")}
        </span>
      )}
      {offset && (
        <span title={L("Senin saatine göre", "Against your own time")}>
          <HeroIcon name="clock" size={16} />
          {offset}
        </span>
      )}
      <span>
        <HeroIcon name="lang" size={16} />
        {L(local.info.language.tr, local.info.language.en)}
      </span>
    </div>
  );
}

const skyIcon = (w: CityWeather): HeroIconName => w.sky;

const sliceLabel = (s: BudgetSlice) =>
  ({ flight: L("Uçuş", "Flights"), stay: L("Konaklama", "Stays"), transport: L("Ulaşım", "Transport"), activity: L("Deneyim", "Experiences"), other: L("Diğer", "Other") })[s];
