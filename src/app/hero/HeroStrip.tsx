// The hero's strip in four parts (v82, v83 B9, F4, F5, C22, C30, Etsy T5): the dates (a "~" when guessed, the days and
// how many are left; each city's days on hover), who goes (the faces, "Kimler gidiyor" in full on a tap) with the
// backbone's two shares and the bar in two greens (a tap on the numbers goes to the first decision), the budget (its
// window: booked, planned, free, each person's share, by kind, what's still to come) and "Sıradaki", the one next step.
// A part with nothing to say isn't drawn (C19).
import type { ReactNode } from "react";
import { BUDGET_SLICES, type BudgetBar, type BudgetSlice } from "../../lib/progress";
import { formatDateRange, formatPrice, nightsBetween } from "../../lib/items";
import { initials, nPeople } from "../../lib/heroInfo";
import { freshWords, shareSentence, shareWords, type BudgetView, type HeroCounts } from "../../lib/heroStrip";
import { L } from "../../lib/i18n";
import { nDays } from "../../lib/i18nText";
import type { Who } from "../../lib/tripSettings";
import type { Item, Trip } from "../../lib/types";
import { Counted } from "../Counted";
import { TipOn } from "../HoverTip";
import { HeroIcon } from "../Icons";
import { useMyPhoto, usePeoplePhotos } from "../Profile";
import { ShareLine, useShare } from "../Share";
import { FaceTip, useLatest, WhoPopover } from "../Travellers";
import { XIcon } from "./icons";
import { usePop } from "./usePop";

export interface HeroDates {
  range: { start: string; end: string };
  estimated: boolean;
  /** "3 gün kaldı", "3. gün / 7", "Bitti". */
  countdown: string | null;
  /** Each city's days, and "Tahmini · kayıtlardan". */
  tip: string | null;
}

export interface HeroNext {
  label: string;
  /** What it does in words, for a screen reader and the tip. */
  title?: string;
  /** Null: nothing left to do ("Her şey hazır"). */
  run: (() => void) | null;
}

function Dates({ dates }: { dates: HeroDates }) {
  const { range } = dates;
  const days = nightsBetween(range.start, range.end) + 1;
  const small = [nDays(days), dates.countdown].filter(Boolean).join(" · ");
  return (
    <TipOn tip={dates.tip} below>
      {(bind) => (
        <div {...bind} className="x-seg x-s1" tabIndex={dates.tip ? 0 : undefined}>
          <span className="x-ico">
            <XIcon name="cal" size={20} stroke={1.8} />
          </span>
          <span className="x-sv">
            <b>
              {dates.estimated ? "~" : ""}
              {formatDateRange(range.start, range.end)}
            </b>
            <small>{small}</small>
          </span>
        </div>
      )}
    </TipOn>
  );
}

function People({ trip, who, items, onShare, counts, onFirstDecision }: { trip: Trip; who: Who; items: Item[]; onShare?: () => void; counts: HeroCounts; onFirstDecision: (() => void) | null }) {
  const pop = usePop();
  const share = useShare();
  const latest = useLatest(items);
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const { names, count } = who;
  const photoOf = (n: number, name: string | undefined) => (name && share?.photos[name]) || (n === 0 ? myPhoto : peoplePhoto(name)) || null;
  const words = shareWords(counts);
  const sentence = shareSentence(counts);
  const booked = counts.booked.pct ?? 0;
  const planned = Math.max(0, (counts.plan.pct ?? 0) - booked);
  const label = count > 0 ? nPeople(count) : L("Kimler gidiyor?", "Who's going?");
  const faces = count > 0 ? Math.min(count, 4) : 1;
  const face = (n: number) => {
    const name = names[n];
    const photo = count > 0 ? photoOf(n, name) : null;
    return (
      <FaceTip key={n} name={name} action={latest(name)} me={n === 0}>
        {(bind) => (
          <button
            {...bind}
            type="button"
            className={`x-face${n === 0 && count > 0 ? " me" : ""}${count > 0 ? "" : " none"}${photo ? " photo" : ""}`}
            aria-label={`${name ?? label} · ${L("Kimler gidiyor", "Who's going")}`}
            aria-expanded={pop.open}
            onClick={pop.toggle}
          >
            {photo ? <img src={photo} alt="" /> : name ? initials(name) : <HeroIcon name="user" size={16} />}
          </button>
        )}
      </FaceTip>
    );
  };
  return (
    <div className="x-seg x-s2" ref={pop.box}>
      <span className="x-ico">
        <XIcon name="users" size={20} stroke={1.8} />
      </span>
      <span className="x-avs">
        {Array.from({ length: faces }, (_, n) => face(n))}
        {count > 4 && <span className="x-face more">+{count - 4}</span>}
      </span>
      <span className="x-s2b">
        <button ref={pop.trigger} type="button" className="x-sv x-whob" aria-expanded={pop.open} aria-haspopup="dialog" onClick={pop.toggle}>
          <b>{label}</b>
        </button>
        {counts.total > 0 && (
          <>
            <TipOn tip={sentence} below>
              {(bind) => (
                <span {...bind} className="x-prog" tabIndex={0}>
                  <span className="x-bar" data-pit="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={counts.plan.pct ?? 0} aria-label={sentence}>
                    {booked > 0 && <i className="bk" style={{ width: `${booked}%` }} />}
                    {planned > 0 && <i className="ch" style={{ width: `${planned}%` }} />}
                  </span>
                </span>
              )}
            </TipOn>
            {counts.fresh ? (
              <small className="x-ps">{freshWords(counts)}</small>
            ) : onFirstDecision ? (
              <TipOn tip={<>{sentence} <span className="tipx-note">{L("Basınca ilk karara gider.", "A click goes to the first decision.")}</span></>} below>
                {(bind) => (
                  <button {...bind} type="button" className="x-ps" onClick={onFirstDecision}>
                    <b data-count>{words.plan}</b> · {words.booked}
                  </button>
                )}
              </TipOn>
            ) : (
              <span className="x-ps">
                <b data-count>{words.plan}</b> · {words.booked}
              </span>
            )}
          </>
        )}
      </span>
      {pop.shown && (
        <div className={`x-pop x-who-pop${pop.leaving ? " x-out" : ""}`}>
          <WhoPopover
            trip={trip}
            who={who}
            latest={latest}
            isShared={Boolean(share)}
            shared={share ? (share.state?.members ?? []) : []}
            ownPhotos={share?.photos ?? {}}
            onInvite={
              onShare
                ? () => {
                    pop.close();
                    onShare();
                  }
                : undefined
            }
          />
          {share && (
            <p className="x-shline">
              <ShareLine />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const sliceLabel = (s: BudgetSlice) =>
  ({ flight: L("Uçuş", "Flights"), stay: L("Konaklama", "Stays"), transport: L("Ulaşım", "Transport"), activity: L("Etkinlik", "Experiences"), other: L("Diğer", "Other") })[s];

function Budget({ view, bar }: { view: BudgetView; bar: BudgetBar }) {
  const pop = usePop();
  const money = (n: number) => formatPrice(n, view.currency);
  const slices = BUDGET_SLICES.filter((s) => bar.byCategory[s] > 0);
  const said = [
    `${L("Bütçe", "Budget")}: ~${money(view.likely)}`,
    view.total != null ? L(`${money(view.total)} bütçe`, `${money(view.total)} budget`) : L("tahmini toplam", "likely total"),
    view.over ? L(`bütçeyi ${money(view.over)} aşar`, `${money(view.over)} over`) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="x-seg x-s3" ref={pop.box}>
      <span className="x-ico">
        <XIcon name="wallet" size={20} stroke={1.8} />
      </span>
      <button ref={pop.trigger} type="button" className={`x-sv x-budb${view.over ? " over" : ""}`} aria-expanded={pop.open} aria-haspopup="dialog" aria-label={said} onClick={pop.toggle}>
        <b data-count>
          <Counted value={view.likely} format={(n) => `~${money(n)}`} />
        </b>
        <small>{view.total != null ? L(`/ ${money(view.total)} bütçe`, `/ ${money(view.total)} budget`) : L("tahmini toplam", "likely total")}</small>
      </button>
      {pop.shown && (
        <div className={`x-pop x-bud-pop${pop.leaving ? " x-out" : ""}`} role="dialog" aria-label={L("Bütçe", "Budget")}>
          <b className="x-pt">{view.total != null ? `${L("Bütçe", "Budget")} · ${money(view.total)}` : `${L("Tahmini toplam", "Likely total")} · ~${money(view.likely)}`}</b>
          {view.lines.map((l) => (
            <div key={l.key} className={`x-bl ${l.key}`}>
              <span>
                <i aria-hidden />
                {l.label}
              </span>
              <b>{money(l.amount)}</b>
            </div>
          ))}
          {view.perPerson && (
            <div className="x-bl pp">
              <span>{L("Kişi başı", "Per person")}</span>
              <b>
                ~{money(view.perPerson.amount)} · {nPeople(view.perPerson.people)}
              </b>
            </div>
          )}
          {slices.length > 0 && (
            <>
              <div className="x-sep" />
              {slices.map((s) => (
                <div key={s} className="x-bl">
                  <span>{sliceLabel(s)}</span>
                  <b>{money(bar.byCategory[s])}</b>
                </div>
              ))}
            </>
          )}
          {view.note.length > 0 && <p className="x-pn">{view.note.join(" ")}</p>}
        </div>
      )}
    </div>
  );
}

function Next({ next }: { next: HeroNext }) {
  if (!next.run)
    return (
      <span className="x-next ok" role="status">
        <XIcon name="check" size={16} stroke={2.4} />
        {next.label}
      </span>
    );
  return (
    <TipOn tip={next.title ?? null} below align="right">
      {(bind) => (
        <button {...bind} type="button" className="h-next x-next" aria-label={next.title ? `${next.label}: ${next.title}` : undefined} onClick={next.run!}>
          <span className="x-nl">{next.label}</span>
          <XIcon name="arrow" size={16} stroke={2.2} />
        </button>
      )}
    </TipOn>
  );
}

export function HeroStrip(props: {
  dates: HeroDates | null;
  trip: Trip;
  who: Who;
  items: Item[];
  onShare?: () => void;
  counts: HeroCounts;
  onFirstDecision: (() => void) | null;
  budget: { view: BudgetView; bar: BudgetBar } | null;
  next: HeroNext;
}) {
  const segs: ReactNode[] = [
    props.dates && <Dates key="dates" dates={props.dates} />,
    <People key="people" trip={props.trip} who={props.who} items={props.items} onShare={props.onShare} counts={props.counts} onFirstDecision={props.onFirstDecision} />,
    props.budget && <Budget key="budget" view={props.budget.view} bar={props.budget.bar} />,
  ].filter(Boolean);
  return (
    <div className="x-strip" data-pit-children>
      {segs.flatMap((s, n) => (n ? [<i key={`dv${n}`} className="x-dv" aria-hidden />, s] : [s]))}
      <Next next={props.next} />
    </div>
  );
}
