import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FallbackImg } from "./FallbackImg";
import { requestProcessing } from "../lib/browser";
import type { GroupDecision } from "../lib/decision";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatDateRange,
  formatPrice,
  groupItems,
  listingKeyOf,
  nightsBetween,
  rankItems,
  routeUrl,
  rowLabel,
  tripDateRange,
  type NeedGroup,
} from "../lib/items";
import { buildLegs, type Leg } from "../lib/legs";
import { buildTimeline } from "../lib/timeline";
import { needsReading } from "../lib/listing";
import { cardFacts } from "../lib/cardFacts";
import { budgetBar, decisionProgress, entryDomId, type Todo } from "../lib/progress";
import { cityKeyOf, type OptionGroup, type Plan } from "../lib/plan";
import { retryCapture } from "../lib/process";
import { isRental } from "../lib/travelKinds";

import type { Capture, Category, Item, Trip } from "../lib/types";
import { chooseItem, setHidden } from "./actions";
import { CategoryIcon, Chevron, SummaryIcon } from "./Icons";
import { IntentCard } from "./IntentCard";
import { BudgetBarView, findTarget, show, TodoStrip } from "./Progress";
import { KIND_LABEL, LegRow } from "./LegRow";
import { Carousel } from "./Carousel";
import { SettledCard, SwipeCard } from "./SwipeCard";
import { TimelineView, type CardFor, type RenderGroup, type SettledFor, type TimelineMode } from "./Timeline";
import { choiceOf, type Choice } from "../lib/choice";
import { pivotalFindings } from "../lib/pivots";
import type { ValueCard } from "../lib/value";
import { decisionLabel, type Decisions } from "./useDecisions";

interface Props {
  trip: Trip;
  items: Item[];
  plan: Plan;
  openCaptures: Capture[];
  decisions: Decisions | null;
  onOpenItem: (item: Item) => void;
  onCompare: (groupKey: string) => void;
  menu: React.ReactNode;
}

/** Categories shown as one summary row until expanded (like "Tiyatro, tekne turu ve 4 yer"). */
const SUMMARIZED: Category[] = ["activity", "food", "other"];

export function TripPanel({ trip, items, plan, openCaptures, decisions, onOpenItem, onCompare, menu }: Props) {
  // The plan's dates: the ones set, widened by any stay booked or chosen outside them.
  const range = plan.range ?? trip.confirmedDates ?? tripDateRange(items);
  // The cities in the order they're visited (the nights' blocks), else as the saved stays name them.
  const route = routeOf(plan, items);
  const days = range ? nightsBetween(range.start, range.end) + 1 : 0;
  const subtitle = [range ? formatDateRange(range.start, range.end) : null, days ? `${days} gün` : null, route].filter(Boolean).join(" · ");
  const today = decisions?.ctx.today ?? new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<TimelineMode>("plan");
  /** Opens a block of the plan (from the itinerary). */
  const showOnPlan = (key: string) => {
    setView("plan");
    setTimeout(() => show(document.getElementById(entryDomId(key))), 60);
  };
  /** A to-do's place: on this view if it's there, else on the other (an empty transfer is only in the itinerary). */
  const reveal = (target: Todo["target"]) => {
    const here = findTarget(target);
    if (here) return show(here);
    setView((v) => (v === "plan" ? "days" : "plan"));
    setTimeout(() => show(findTarget(target)), 60);
  };
  // On the way: which day of the trip it is.
  const onDay = plan.range && today >= plan.range.start && today <= plan.range.end ? nightsBetween(plan.range.start, today) + 1 : null;
  // Ideas for a day (saved, not chosen) aren't blocks of the plan's front: they wait with the undated ones.
  const places = () =>
    groupItems([
      ...timeline.undated,
      ...timeline.entries.flatMap((e) => (e.kind === "day" ? e.items.filter((i) => i.status === "saved" && SUMMARIZED.includes(i.category)) : [])),
    ]).filter((s) => SUMMARIZED.includes(s.category));
  const dismissed = items.filter((i) => i.status === "dismissed");
  const mapUrl = routeUrl(items);
  const working = openCaptures.filter((c) => c.status === "pending" || c.status === "processing");
  const failed = openCaptures.filter((c) => c.status === "error");
  const listings = decisions?.ctx.listings;
  const legs = useMemo(() => buildLegs(plan, trip, listings), [plan, trip, listings]);
  const reading = listings
    ? new Set(items.filter((i) => needsReading(i, listings.get(listingKeyOf(i))) && !listings.get(listingKeyOf(i))?.error).map(listingKeyOf)).size
    : 0;
  const hidden = useMemo(() => new Set(trip.hidden ?? []), [trip.hidden]);
  const timeline = useMemo(() => buildTimeline(plan, legs, items, hidden), [plan, legs, items, hidden]);
  const hiddenLegs = legs.filter((l) => l.kind !== "move" && hidden.has(`leg:${l.key}`));
  const decisionOf = (item: Item) => [...(decisions?.byGroup.values() ?? [])].find((d) => d.options.some((o) => o.item.id === item.id));
  /** One undecided option as a decision card: swipe through them, open one for the reasons. */
  const card: CardFor = (item, group, decision, ranked, onCompareGroup) => (
    <SwipeCard
      key={item.id}
      item={item}
      group={group}
      decision={decision ?? decisionOf(item)}
      decisions={decisions}
      ranked={ranked}
      onOpen={() => onOpenItem(item)}
      onCompare={onCompareGroup}
    />
  );
  /** A decided need in one line ("Seçildi · bilet alınmadı"). */
  const settled: SettledFor = (item, decision, onChange, changing) => (
    <SettledCard
      key={item.id}
      item={item}
      decision={decision ?? decisionOf(item)}
      decisions={decisions}
      onOpen={() => onOpenItem(item)}
      onChange={onChange}
      changing={changing}
    />
  );
  const leg = (l: Leg, opts: { embedded?: boolean; timed?: boolean } = {}) => (
    <LegRow key={l.key} leg={l} tripId={trip.id} onOpenItem={onOpenItem} embedded={opts.embedded} timed={opts.timed} />
  );

  const renderGroup: RenderGroup = (group, heading, groupSubtitle, nested = false) => (
    <OptionGroupView
      key={group.key}
      group={group}
      heading={heading}
      subtitle={groupSubtitle}
      nested={nested}
      decision={decisions?.byGroup.get(group.key)}
      card={decisions?.cards.get(group.key)}
      ctx={decisions?.ctx}
      renderCard={card}
      renderSettled={settled}
      onCompare={() => onCompare(group.key)}
    />
  );

  return (
    <>
      <div className="panel-top">{menu}</div>
      <header className="trip-hero">
        <FallbackImg className="hero-img" src={trip.heroImage} fallback={<div className="hero-img" />} />
        <div className="hero-main">
          <h1 className="trip-title">{trip.title}</h1>
          {onDay && <div className="trip-now">Seyahat başladı · {onDay}. gün</div>}
          <div className="trip-sub">
            {subtitle || "Tarih ve şehir, kaydettikçe netleşir"}
            {range && !trip.confirmedDates && <span className="estimated">~tahmini</span>}
          </div>
          <div className="hero-row">
            <TripSummary items={items} plan={plan} />
            {mapUrl && (
              <a className="hero-link" href={mapUrl} target="_blank" rel="noreferrer">
                Rotayı gör ↗
              </a>
            )}
            <span className="status-line">
              {working.length > 0 && `${working.length} kayıt işleniyor… `}
              {reading > 0 && `${reading} sayfa okunuyor… `}
              {failed.length > 0 && <span className="err">{failed.length} kayıt işlenemedi</span>}
            </span>
          </div>
        </div>
      </header>
      {decisions && <BudgetBarView bar={budgetBar(plan, items, decisions.ctx, decisions.byGroup)} />}
      <TodoStrip progress={decisionProgress(timeline, items, plan, decisions?.byGroup, today)} onGo={reveal} />

      {failed.length > 0 && (
        <div className="errors">
          {failed.map((c) => (
            <div key={c.id}>
              <span className="error-text" title={c.error ?? ""}>
                <span className="err">⚠ {c.title || c.url || "Ekran görüntüsü"}</span>
                <span className="muted"> — {c.error}</span>
              </span>
              <button
                className="small-btn"
                onClick={async () => {
                  await retryCapture(c.id);
                  requestProcessing();
                }}
              >
                Tekrar dene
              </button>
            </div>
          ))}
        </div>
      )}

      <IntentCard trip={trip} decisions={decisions} />

      {timeline.entries.length > 0 && (
        <div className="view-tabs" role="tablist" aria-label="Görünüm">
          <button role="tab" aria-selected={view === "plan"} className={view === "plan" ? "on" : ""} onClick={() => setView("plan")}>
            Plan
          </button>
          <button role="tab" aria-selected={view === "days"} className={view === "days" ? "on" : ""} onClick={() => setView("days")}>
            Günlük akış
          </button>
        </div>
      )}
      {timeline.entries.length > 0 && (
        <TimelineView
          mode={view}
          onShow={showOnPlan}
          plan={plan}
          timeline={timeline}
          tripId={trip.id}
          leg={leg}
          renderGroup={renderGroup}
          card={card}
          settled={settled}
          listings={listings}
          today={today}
        />
      )}

      {view === "plan" && CATEGORY_ORDER.map((category) => {
        if (category === "stay") return <LooseStays key="stay" plan={plan} renderGroup={renderGroup} />;
        if (SUMMARIZED.includes(category)) {
          const section = places().find((s) => s.category === category);
          return section ? (
            <SummarySection key={category} category={category} groups={section.groups} card={card} onOpenItem={onOpenItem} />
          ) : null;
        }
        // Flights and transport the timeline placed on their day are there; the rest (and eSIMs) here.
        const groups = category === "flight" || category === "transport" ? timeline.unplaced : plan.groups;
        return groups
          .filter((g) => g.category === category)
          .map((g, index) => renderGroup(g, index === 0 ? CATEGORY_LABELS[category] : null, g.title));
      })}

      {view === "plan" && plan.closed.length > 0 && <ClosedSection closed={plan.closed} onOpenItem={onOpenItem} />}

      {view === "plan" && hiddenLegs.length > 0 && <HiddenSection legs={hiddenLegs} tripId={trip.id} />}

      {view === "plan" && dismissed.length > 0 && (
        <SummarySection
          category="other"
          label={`Elenenler (${dismissed.length})`}
          groups={[{ key: "dismissed", category: "other", title: null, items: dismissed }]}
          onOpenItem={onOpenItem}
        />
      )}
    </>
  );
}

/**
 * The trip at a glance, beside its picture: how many days and cities, and what's in the plan so far
 * (experiences saved, stays and trips chosen or booked).
 */
function TripSummary({ items, plan }: { items: Item[]; plan: Plan }) {
  const live = items.filter((i) => i.status !== "dismissed" && !plan.closed.some((c) => c.item.id === i.id));
  const settled = (i: Item) => i.status === "chosen" || i.status === "booked";
  const cities = new Set(
    [...plan.stayBlocks.map((b) => b.city), ...live.filter((i) => i.category === "stay").map((i) => i.city)].map((c) => cityKeyOf(c)).filter(Boolean),
  ).size;
  const experiences = live.filter((i) => (i.category === "activity" || i.category === "food") && settled(i)).length;
  // Stays: how many of the plan's stretches of nights have a place, of how many there are.
  const blocks = plan.stayBlocks.length;
  const placed = plan.stayBlocks.filter((b) => b.kind !== "open").length;
  const trips = live.filter((i) => (i.category === "flight" || i.category === "transport") && settled(i)).length;
  const stats: [ReactNode, string, string][] = [
    [<SummaryIcon name="pin" />, `${cities} şehir`, "Gezideki şehirler"],
    [<CategoryIcon category="stay" size={20} />, blocks ? `${placed}/${blocks} konaklama` : `${live.filter((i) => i.category === "stay" && settled(i)).length} konaklama`, "Yeri seçilen / gereken konaklama"],
    [<CategoryIcon category="transport" size={20} />, `${trips} ulaşım`, "Seçilen ya da alınan ulaşım"],
    [<SummaryIcon name="star" />, `${experiences} etkinlik`, "Plana alınan etkinlik"],
  ];
  const shown = stats.filter(([, text]) => !/^0 /.test(text));
  if (!shown.length) return null;
  return (
    <ul className="hero-stats" aria-label="Gezi özeti">
      {shown.map(([icon, text, title]) => (
        <li key={text} title={title}>
          {icon}
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Porto → Funchal": the cities in the order the nights go, each once in a row; else the saved stays' cities. */
function routeOf(plan: Plan, items: Item[]): string | null {
  const inOrder: string[] = [];
  for (const b of plan.stayBlocks) {
    if (b.city && (!inOrder.length || cityKeyOf(inOrder.at(-1)!) !== cityKeyOf(b.city))) inOrder.push(b.city);
  }
  if (inOrder.length) return inOrder.join(" → ");
  const saved = [...new Set(items.filter((i) => i.status !== "dismissed" && i.category === "stay" && i.city).map((i) => i.city!))];
  return saved.length ? joinTr(saved) : null;
}

/** Stays that don't fit the trip's nights (no dates, or outside them); every stay when there are no dates yet. */
function LooseStays({ plan, renderGroup }: { plan: Plan; renderGroup: RenderGroup }) {
  if (!plan.looseStays.length) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span>{plan.stayBlocks.length ? "Diğer konaklamalar" : CATEGORY_LABELS.stay}</span>
      </div>
      {plan.looseStays.map((g) =>
        renderGroup(
          g,
          null,
          plan.range
            ? `${g.title ?? ""}${g.range ? " · gezi tarihleri dışında" : " · tarih seçilmemiş"}`
            : `${g.title ?? ""}${g.range ? "" : " · tarih seçilmemiş"}`,
          true,
        ),
      )}
    </div>
  );
}

function OptionGroupView({
  group,
  heading,
  subtitle,
  nested,
  decision,
  card,
  ctx,
  renderCard,
  renderSettled,
  onCompare,
}: {
  group: OptionGroup;
  heading: string | null;
  subtitle: string | null;
  nested: boolean;
  decision: GroupDecision | undefined;
  card: ValueCard | undefined;
  ctx: Decisions["ctx"] | undefined;
  renderCard: CardFor;
  renderSettled: SettledFor;
  onCompare: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rank = (item: Item) => {
    const index = decision?.options.findIndex((o) => o.item.id === item.id) ?? -1;
    return index >= 0 ? index : null;
  };
  const ranked = rankItems(group.items, rank);
  const decided = ranked.find((i) => i.status === "booked") ?? ranked.find((i) => i.status === "chosen");
  const live = !group.booked && decision;
  const comparable = live && decision.options.filter((o) => !o.excluded).length > 1;
  const single = live && decision.status === "single";
  // The strongest option for each thing that matters (the balanced one first), and the rest.
  const choice = live && ctx && comparable ? choiceOf(decision, ctx) : null;
  // Where an option's place hangs on one thing read on its page: said on its card, with the question.
  const pivots = useMemo(() => (live && ctx && comparable && !group.items.some((i) => i.status === "chosen") ? pivotalFindings(decision, ctx) : []), [live, ctx, comparable, decision, group.items]);
  const head =
    heading || subtitle ? (
      <span className="group-title">
        {heading && <span>{heading}</span>}
        {subtitle && <span className="muted">{subtitle}</span>}
      </span>
    ) : null;
  // Decided: one line (the cards come back with "Değiştir"). A booking settles it for good.
  const change = decided && decided.status === "chosen" && ranked.length > 1 ? () => setChanging(!changing) : undefined;
  // A new pick (or a booking) closes the cards again.
  const decidedId = decided?.id;
  useEffect(() => setChanging(false), [decidedId]);
  if (decided && !(changing && change)) {
    return (
      <div className={nested ? "group nested" : "section"}>
        {head && <div className={nested ? "group-head" : "section-head"}>{head}</div>}
        {renderSettled(decided, decision, change, false)}
      </div>
    );
  }
  // Best first, numbered: the first few at once, the rest one tap away (the engine's order: fit, then
  // to check, then partial, then out).
  const byRank = [...group.items].sort((a, b) => (rank(a) ?? Infinity) - (rank(b) ?? Infinity) || (a.price.amount ?? Infinity) - (b.price.amount ?? Infinity));
  const lead = byRank.slice(0, VISIBLE);
  const others = byRank.slice(VISIBLE);
  const shown = showAll ? byRank : lead;
  const rankedOf = (item: Item) => {
    const r = choice?.ranked.find((x) => x.option.item.id === item.id);
    return r && { ...r, pivot: pivots.find((p) => p.itemId === item.id) ?? null };
  };
  return (
    <div className={nested ? "group nested" : "section"}>
      {decided && renderSettled(decided, decision, change, true)}
      {head && <div className={nested ? "group-head" : "section-head"}>{head}</div>}
      {!decided && choice?.headline && ctx && <Headline choice={choice} alternatives={group.items} onCompare={onCompare} />}
      <div className="option-grid">
        {shown.map((item) => renderCard(item, group.items, decision, rankedOf(item), comparable || single ? onCompare : undefined))}
      </div>
      {others.length > 0 && (
        <button className="link-btn more-options" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Daha az göster" : `+${others.length} seçenek daha`}
        </button>
      )}
      {!decided && !choice?.headline && (comparable || single) && (
        <button className="verdict-line" onClick={onCompare}>
          <span className={single ? "muted" : ""}>{decision!.summary}</span>
          <span className="verdict-cta">{single ? "Kriterleri gör →" : "Karşılaştır →"}</span>
        </button>
      )}
    </div>
  );
}

/** Options shown at once, best first; the rest behind "+N seçenek daha". */
const VISIBLE = 5;
const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase("tr") + s.slice(1);

/**
 * The decision in a sentence above the cards: the pick and why, then the alternatives for each priority
 * with their place ("Tasarruf ve sessizlik için 2. Bonfim Loft (€60 daha ucuz)"), what to check before
 * choosing, and the button to take the pick.
 */
function Headline({ choice, alternatives, onCompare }: { choice: Choice; alternatives: Item[]; onCompare: () => void }) {
  const first = choice.ranked.find((r) => r.rank === 1)?.option.item;
  const pages = new Map(alternatives.map((i) => [i.id, i.url]));
  return (
    <div className="reco-line headline">
      <div className="reco-text">
        <p>{choice.headline}</p>
        {choice.verify.length > 0 && (
          <ul className="reco-verify" aria-label="Seçmeden kontrol et">
            {choice.verify.map((v) => (
              <li key={`${v.itemId}:${v.what}`}>
                <b>{v.name}:</b> {v.what}
                {pages.get(v.itemId) && (
                  <a href={pages.get(v.itemId)!} target="_blank" rel="noreferrer">
                    {" "}
                    Sayfada bak ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="reco-actions">
        {first && (
          <button className="pill-btn primary" onClick={() => void chooseItem(first, alternatives)}>
            {`${first.name} seç`}
          </button>
        )}
        <button className="link-btn" onClick={onCompare}>
          Karşılaştır →
        </button>
      </span>
    </div>
  );
}

/** Transfers the traveller said aren't needed: out of the way, one tap from coming back. */
function HiddenSection({ legs, tripId }: { legs: Leg[]; tripId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="section">
      <button className="row" onClick={() => setOpen(!open)} style={{ gridTemplateColumns: "72px 1fr 20px" }}>
        <span className="thumb icon">
          <CategoryIcon category="transport" />
        </span>
        <span>
          <div className="row-name">Gizlenenler ({legs.length})</div>
          <div className="row-label tone-muted">"Gerek yok" dediğin transferler; geri getirebilirsin</div>
        </span>
        <span className="chev" style={{ transform: open ? "rotate(90deg)" : undefined }}>
          <Chevron />
        </span>
      </button>
      {open &&
        legs.map((l) => (
          <div key={l.key} className="hidden-row">
            <span>
              <b>{KIND_LABEL[l.kind]}</b>
              <span className="muted">
                {" "}
                · {formatDateRange(l.date, null)} · {l.from.label} → {l.to.label}
              </span>
            </span>
            <button className="link-btn" onClick={() => void setHidden(tripId, `leg:${l.key}`, false, KIND_LABEL[l.kind])}>
              Geri getir
            </button>
          </div>
        ))}
    </div>
  );
}

/** Options a booking made irrelevant: out of the way, never deleted. */
function ClosedSection({ closed, onOpenItem }: { closed: Plan["closed"]; onOpenItem: (i: Item) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="section">
      <button className="row" onClick={() => setOpen(!open)} style={{ gridTemplateColumns: "72px 1fr 20px" }}>
        <span className="thumb icon">
          <CategoryIcon category={closed[0].item.category} />
        </span>
        <span>
          <div className="row-name">Kapanan seçenekler ({closed.length})</div>
          <div className="row-label tone-muted">Rezervasyonla kapandı; rezervasyonu geri alırsan geri gelirler</div>
        </span>
        <span className="chev" style={{ transform: open ? "rotate(90deg)" : undefined }}>
          <Chevron />
        </span>
      </button>
      {open &&
        closed.map(({ item, reason }) => (
          <Row key={item.id} item={item} group={[item]} closedReason={reason} onOpen={() => onOpenItem(item)} />
        ))}
    </div>
  );
}

function SummarySection({
  category,
  groups,
  card,
  onOpenItem,
  label,
}: {
  category: Category;
  groups: NeedGroup[];
  /** Cards that open in place; without it, plain rows (e.g. the dismissed list). */
  card?: CardFor;
  onOpenItem: (i: Item) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = groups.flatMap((g) => g.items);
  const names = items.map((i) => i.name);
  const summary = names.length <= 2 ? joinTr(names) : `${names.slice(0, 2).join(", ")} ve ${names.length - 2} yer daha`;
  return (
    <div className="section">
      <button className="row" onClick={() => setOpen(!open)} style={{ gridTemplateColumns: "72px 1fr 20px" }}>
        <span className="thumb icon">
          <CategoryIcon category={category} />
        </span>
        <span>
          <div className="row-name">{label ?? CATEGORY_LABELS[category]}</div>
          <div className="row-label tone-muted">{summary}</div>
        </span>
        <span className="chev" style={{ transform: open ? "rotate(90deg)" : undefined }}>
          <Chevron />
        </span>
      </button>
      {open &&
        (card ? (
          <Carousel label={label ?? CATEGORY_LABELS[category]}>{items.map((item) => card(item, items))}</Carousel>
        ) : (
          items.map((item) => <Row key={item.id} item={item} group={items} onOpen={() => onOpenItem(item)} />)
        ))}
    </div>
  );
}

function Row({
  item,
  group,
  decision,
  currency,
  closedReason,
  onOpen,
}: {
  item: Item;
  group: Item[];
  decision?: GroupDecision;
  currency?: string;
  closedReason?: string;
  onOpen: () => void;
}) {
  const base = closedReason ? { text: closedReason, tone: "muted" as const } : rowLabel(item, group);
  const decided = item.status === "saved" && !closedReason ? decisionLabel(item, decision, currency ?? "EUR") : null;
  // A stale or unverified price stays visible next to the decision label.
  const warning = decided && base.tone === "warning" && decided.tone !== "warning" ? base.text : null;
  const label = decided ?? base;
  const image = item.imageUrl;
  const highlight = !closedReason && (decided?.best || item.status === "chosen" || item.status === "booked");
  return (
    <button className={`row${highlight ? " highlight" : ""}${closedReason ? " closed" : ""}`} onClick={onOpen}>
      <FallbackImg
        className="thumb"
        src={item.category === "flight" ? null : image}
        fallback={
          <span className="thumb icon">
            <CategoryIcon category={isRental(item) ? "car" : item.category} />
          </span>
        }
      />
      <span style={{ minWidth: 0 }}>
        <div className="row-name">{item.name}</div>
        <div className="row-label">
          {decided?.score != null && <span className={`score-pill${decided.best ? " best" : ""}`}>{decided.score}</span>}
          <span className={`tone-${label.tone}`}>{label.text}</span>
          {warning && <span className="tone-warning"> · {warning}</span>}
        </div>
      </span>
      <span className="row-price">
        {item.price.amount != null ? formatPrice(item.price.amount, item.price.currency) : ""}
        {item.price.scope === "per_night" && <span className="muted" style={{ fontSize: 13 }}>/gece</span>}
      </span>
      <span className="chev">
        <Chevron />
      </span>
    </button>
  );
}

export function joinTr(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ve ${names.at(-1)}`;
}
