// The summary card under the photo (v82, v83 B9, F4, F5, C22, C30, Etsy T5; A · Kapak 2026-10-19: one white row, each
// part a small label over its value big and a line under it): when (a "~" when guessed and the days; each city's days on
// hover; only "~ · 10 gece" while they are a guess from a month or a season, D15; the days to go are big on the photo),
// who (the faces, the count big and the names, "Kimler gidiyor" in full on a tap), the budget (its window: booked,
// planned, free, each person's share, by kind, what's still to come; what's left of a budget set, else "tahmini · Limit
// koy"; "Bütçe belirle" without a price yet, D16), ready (the planned share big, the bar green for booked and amber for
// planned, what's booked and still to book; a tap on it goes to the first decision) and "Sıradaki", the one next step,
// its words whole on up to two lines. A part with nothing to say isn't drawn (C19).
import { useState, type ReactNode } from "react";
import { BUDGET_SLICES, type BudgetBar, type BudgetSlice } from "../../lib/progress";
import { formatPrice, nightsBetween } from "../../lib/items";
import type { Countdown } from "../../lib/countdown";
import { initials, nPeople } from "../../lib/heroInfo";
import { budgetAmount, budgetWords, freshWords, heroDatesWords, nextParts, readyWords, shareSentence, whoWords, type BudgetView, type HeroCounts } from "../../lib/heroStrip";
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
  /** Still the guess made from a month or a season (startTrip.approxDates): only the nights are said (D15). */
  rough?: boolean;
  /** Where today is against them: the days to go big on the photo, "3. gün / 7" or "Bitti" small (null while the dates are only a guess, D15). */
  count: Countdown | null;
  /** Each city's days, and "Tahmini · kayıtlardan". */
  tip: string | null;
}

/** B15: the bookings in their last two weeks with no file yet, and the way to the first. */
export interface HeroDocs {
  count: number;
  go: () => void;
}

/** D16: a trip with no budget sets one in the budget window, in this money. */
export interface HeroBudgetSet {
  currency: string;
  save: (amount: number) => void;
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
  // A guessed start has no days to count to: the nights alone (D15). The days to go are on the photo.
  const small = dates.rough ? "" : nDays(days);
  return (
    <TipOn tip={dates.tip} below>
      {(bind) => (
        <div {...bind} className="x-seg x-s1" tabIndex={dates.tip ? 0 : undefined}>
          <span className="x-k">{L("Ne zaman", "When")}</span>
          <span className="x-sv">
            <b>{heroDatesWords(dates)}</b>
            {small && <small>{small}</small>}
          </span>
        </div>
      )}
    </TipOn>
  );
}

function People({ trip, who, items, onShare }: { trip: Trip; who: Who; items: Item[]; onShare?: () => void }) {
  const pop = usePop();
  const share = useShare();
  const latest = useLatest(items);
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const { names, count } = who;
  const photoOf = (n: number, name: string | undefined) => (name && share?.photos[name]) || (n === 0 ? myPhoto : peoplePhoto(name)) || null;
  const words = whoWords(who);
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
      <span className="x-k">{L("Kim", "Who")}</span>
      <span className="x-who">
        <span className="x-avs">
          {Array.from({ length: faces }, (_, n) => face(n))}
          {count > 4 && <span className="x-face more">+{count - 4}</span>}
        </span>
        <button ref={pop.trigger} type="button" className={`x-sv x-whob${words.count ? "" : " ask"}`} aria-expanded={pop.open} aria-haspopup="dialog" aria-label={words.count ? `${label} · ${words.line}` : undefined} onClick={pop.toggle}>
          <b>{words.count ?? words.line}</b>
        </button>
      </span>
      {words.count && <small className="x-sl">{words.line}</small>}
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

/**
 * Ready: the planned share big, the bar (booked green, planned amber), what's booked and still to book; the bar's tip
 * says it in a whole sentence, a tap on the line goes to the first decision (F5). A new backbone says how many needs
 * instead of "%0" (C19).
 */
function Ready({ counts, onFirstDecision }: { counts: HeroCounts; onFirstDecision: (() => void) | null }) {
  const words = readyWords(counts);
  const sentence = shareSentence(counts);
  const booked = counts.booked.pct ?? 0;
  const planned = Math.max(0, (counts.plan.pct ?? 0) - booked);
  return (
    <div className="x-seg x-s4">
      <span className="x-k">{L("Hazır", "Ready")}</span>
      {!counts.fresh && (
        <b className="x-pct" data-count>
          {words.pct}
        </b>
      )}
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
              {words.line}
            </button>
          )}
        </TipOn>
      ) : (
        <span className="x-ps">{words.line}</span>
      )}
    </div>
  );
}

/** D16: the budget window's own line to set one ("Toplam bütçe" in the trip's money, Enter or Kaydet). */
function SetBudget({ set, onDone }: { set: HeroBudgetSet; onDone: () => void }) {
  const [text, setText] = useState("");
  const amount = budgetAmount(text);
  const save = () => {
    if (amount == null) return;
    set.save(amount);
    onDone();
  };
  return (
    <form
      className="x-bset"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        <span>{L("Toplam bütçe", "Total budget")}</span>
        <span className="x-bin">
          <input type="text" inputMode="decimal" value={text} autoFocus placeholder={formatPrice(1500, set.currency)} onChange={(e) => setText(e.target.value)} aria-label={L(`Toplam bütçe (${set.currency})`, `Total budget (${set.currency})`)} />
        </span>
      </label>
      <button type="submit" className="x-bsave" disabled={amount == null}>
        {L("Kaydet", "Save")}
      </button>
      <small className="x-pn">{L("Sohbette söylemen de yeter.", "Saying it in the chat works too.")}</small>
    </form>
  );
}

const sliceLabel = (s: BudgetSlice) =>
  ({ flight: L("Uçuş", "Flights"), stay: L("Konaklama", "Stays"), transport: L("Ulaşım", "Transport"), activity: L("Etkinlik", "Experiences"), other: L("Diğer", "Other") })[s];

/** D16: no budget and no price yet: the segment is the way to set one. */
function NoBudget({ set }: { set: HeroBudgetSet }) {
  const pop = usePop();
  return (
    <div className="x-seg x-s3" ref={pop.box}>
      <span className="x-k">{L("Bütçe", "Budget")}</span>
      <button ref={pop.trigger} type="button" className="x-sv x-budb set" aria-expanded={pop.open} aria-haspopup="dialog" onClick={pop.toggle}>
        <b>{L("Bütçe belirle", "Set a budget")}</b>
      </button>
      {pop.shown && (
        <div className={`x-pop x-bud-pop${pop.leaving ? " x-out" : ""}`} role="dialog" aria-label={L("Bütçe belirle", "Set a budget")}>
          <b className="x-pt">{L("Bütçe belirle", "Set a budget")}</b>
          <SetBudget set={set} onDone={() => pop.close(true)} />
        </div>
      )}
    </div>
  );
}

function Budget({ view, bar, set }: { view: BudgetView; bar: BudgetBar; set: HeroBudgetSet | null }) {
  const pop = usePop();
  const money = (n: number) => formatPrice(n, view.currency);
  const slices = BUDGET_SLICES.filter((s) => bar.byCategory[s] > 0);
  const said = [
    `${L("Bütçe", "Budget")}: ${view.sign}${money(view.likely)}`,
    view.total != null ? L(`${money(view.total)} bütçe`, `${money(view.total)} budget`) : set ? L("tahmini toplam, bütçe belirle", "likely total, set a budget") : L("tahmini toplam", "likely total"),
    view.over ? L(`bütçeyi ${money(view.over)} aşar`, `${money(view.over)} over`) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="x-seg x-s3" ref={pop.box}>
      <span className="x-k">{L("Bütçe", "Budget")}</span>
      <button ref={pop.trigger} type="button" className={`x-sv x-budb${view.over ? " over" : ""}`} aria-expanded={pop.open} aria-haspopup="dialog" aria-label={said} onClick={pop.toggle}>
        <b data-count>
          <Counted value={view.likely} format={(n) => `${view.sign}${money(n)}`} />
        </b>
      </button>
      <small className={`x-sl${view.over ? " over" : ""}`}>
        {budgetWords(view)}
        {view.total == null && set && (
          <>
            {" · "}
            <button type="button" className="x-bsetl" aria-expanded={pop.open} aria-haspopup="dialog" onClick={pop.toggle}>
              {L("Limit koy", "Set a limit")}
            </button>
          </>
        )}
      </small>
      {pop.shown && (
        <div className={`x-pop x-bud-pop${pop.leaving ? " x-out" : ""}`} role="dialog" aria-label={L("Bütçe", "Budget")}>
          <b className="x-pt">{view.total != null ? `${L("Bütçe", "Budget")} · ${money(view.total)}` : `${L("Tahmini toplam", "Likely total")} · ${view.sign}${money(view.likely)}`}</b>
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
                {view.sign}
                {money(view.perPerson.amount)} · {nPeople(view.perPerson.people)}
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
          {view.total == null && set && (
            <>
              <div className="x-sep" />
              <SetBudget set={set} onDone={() => pop.close(true)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Next({ next }: { next: HeroNext }) {
  if (!next.run)
    return (
      <span className="x-next ok" role="status">
        <XIcon name="check" size={18} stroke={2.4} />
        <span className="x-nw">
          <b className="x-nl">{next.label}</b>
        </span>
      </span>
    );
  const parts = nextParts(next.label);
  return (
    <TipOn tip={next.title ?? null} below align="right">
      {(bind) => (
        <button {...bind} type="button" className="h-next x-next" aria-label={next.title ? `${next.label}: ${next.title}` : next.label} onClick={next.run!}>
          <span className="x-nw">
            <small>{parts.head}</small>
            <b className="x-nl">{parts.text}</b>
          </span>
          <XIcon name="arrow" size={20} stroke={2.2} />
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
  /** D16: with no budget, the way to set one (null: not known yet in which money). */
  budgetSet: HeroBudgetSet | null;
  next: HeroNext;
}) {
  const segs: ReactNode[] = [
    props.dates && <Dates key="dates" dates={props.dates} />,
    <People key="people" trip={props.trip} who={props.who} items={props.items} onShare={props.onShare} />,
    props.budget ? <Budget key="budget" view={props.budget.view} bar={props.budget.bar} set={props.budgetSet} /> : props.budgetSet && <NoBudget key="budget" set={props.budgetSet} />,
    props.counts.total > 0 && <Ready key="ready" counts={props.counts} onFirstDecision={props.onFirstDecision} />,
  ].filter(Boolean);
  return (
    <div className={`x-strip n${segs.length}`} data-pit-children>
      {segs}
      <Next next={props.next} />
    </div>
  );
}
