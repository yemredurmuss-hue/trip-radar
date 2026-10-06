// The trip at a glance, left column (hero v9, docs/superpowers/specs/2026-10-05-hero-v9-design.md): a photo
// per city (switcher top left, countdown and ••• top right), the title, the dates, one muted sentence, the plan
// in four cells (a tap opens that section of the Plan) and "Planlananların %67'si rezerve · 3 ihtiyaç karar
// bekliyor" (lifecycle.ts: the percentage over what's in the plan only), a bar in two greens and the one dark
// button. Every block has an empty state; what arrives later fades in.
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { countdown, countdownText } from "../lib/countdown";
import type { HeroTally } from "../lib/heroInfo";
import { formatDateRange, nightsBetween } from "../lib/items";
import { L } from "../lib/i18n";
import { nDays } from "../lib/i18nText";
import { heroNumbers, openNeedsText, plannedBookedText } from "../lib/lifecycle";
import type { PlanList } from "../lib/planList";
import { creditLine, type CreditPart } from "../lib/cityImages";
import type { PhotoCredit, Trip } from "../lib/types";
import { HeroIcon, type HeroIconName } from "./Icons";
import { useAppear } from "./useAppear";

export interface HeroCity {
  name: string;
  image: string | null;
  /** Who took the photo (cityImages.ts creditOf): shown small at its bottom right. */
  credit?: PhotoCredit | null;
}

/** "Fotoğraf: <Ad> / Unsplash", each part a link when its page is known (new tab). */
function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  const line = creditLine(credit);
  const part = (p: CreditPart) =>
    p.href ? (
      <a href={p.href} target="_blank" rel="noopener noreferrer">
        {p.text}
      </a>
    ) : (
      <span>{p.text}</span>
    );
  return (
    <div className="hx-credit">
      {line.label} {line.by && <>{part(line.by)} / </>}
      {part(line.source)}
    </div>
  );
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
  /** A quieter one beside it (the PDF while the plan isn't all booked; sharing once it is). */
  secondary?: HeroAction | null;
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
  // Everything the list holds, a missing file too: any of it opens the list.
  const listed = todo.open.length + todo.book.length + todo.docs.length + todo.ways.length + deadlines;
  const toggle = (list: "all" | "deadline") => props.onList(props.list === list ? null : list);
  // Aşamalar (lifecycle.ts): the percentage is over what's in the plan only, booked (or ready) of planned + booked;
  // what waits for a decision is a count beside it, never in it. Nothing in the plan: no percentage.
  const { done: booked, planned, inPlan, open, pct } = heroNumbers(todo.counts);
  const bookedW = inPlan ? (booked / inPlan) * 100 : 0;
  const reach = inPlan ? 100 : 0;
  const headline =
    done.total === 0
      ? L("Planlama", "Planning")
      : done.complete
        ? L("Her şey hazır", "All set")
        : pct != null
          ? plannedBookedText(pct)
          : open
            ? openNeedsText(open)
            : L("Planlama", "Planning");
  // Under it: what waits for a decision (when the headline is the percentage), what's left to book (the light
  // tone's key) and, with no decision left, the transfers not said yet. A zero says nothing.
  const words: [string, ReactNode][] = [];
  if (pct != null && open) words.push(["open", openNeedsText(open)]);
  if (planned) words.push(["planned", <><i className="hx-key planned" aria-hidden />{L(`${planned} rezerve edilecek`, `${planned} to book`)}</>]);
  // Everything booked, files still to add: say so, so "Belge eksik" alone still opens the list.
  if (!open && !planned && todo.needs.docs) words.push(["docs", L(`${todo.needs.docs} belge eksik`, `${todo.needs.docs} file${todo.needs.docs === 1 ? "" : "s"} missing`)]);
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
  const barLabel = L(`${headline}: ${booked} rezerve, ${planned} planlandı, ${open} ihtiyaç karar bekliyor`, `${headline}: ${booked} booked, ${planned} planned, ${open} to decide`);
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
        {cities[at]?.image && cities[at].credit && <PhotoCreditLine key={cities[at].image} credit={cities[at].credit} />}
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
              <b>{headline}</b>
              {/* Two fills from the left: planned (light) under booked (dark), so booked + planned is the light one's end. */}
              <div className="hx-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label={barLabel}>
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
          {(props.action || props.secondary) && (
            <div className="hx-acts">
              {props.action && (
                <button className="hx-go" title={props.action.title} aria-label={props.action.title ? `${props.action.label}: ${props.action.title}` : undefined} onClick={props.action.run}>
                  {props.action.label}
                  <HeroIcon name="arrow" size={20} />
                </button>
              )}
              {props.secondary && (
                <button type="button" className="hx-alt" title={props.secondary.title} onClick={props.secondary.run}>
                  {props.secondary.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
