import { useMemo, useState } from "react";
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
  rankItems,
  routeUrl,
  rowLabel,
  tripDateRange,
  type NeedGroup,
} from "../lib/items";
import { buildLegs, type Leg } from "../lib/legs";
import { buildTimeline } from "../lib/timeline";
import { needsReading } from "../lib/listing";
import type { OptionGroup, Plan } from "../lib/plan";
import { retryCapture } from "../lib/process";

import type { Capture, Category, Item, Trip } from "../lib/types";
import { DecisionCard } from "./DecisionCard";
import { CategoryIcon, Chevron } from "./Icons";
import { IntentCard } from "./IntentCard";
import { LegRow } from "./LegRow";
import { Carousel } from "./Carousel";
import { SettledCard, SwipeCard } from "./SwipeCard";
import { TimelineView, type CardFor, type RenderGroup, type SettledFor } from "./Timeline";
import { rolesOf, type ValueCard } from "../lib/value";
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
  const range = trip.confirmedDates ?? tripDateRange(items);
  const cities = [...new Set(items.filter((i) => i.status !== "dismissed" && i.category === "stay" && i.city).map((i) => i.city!))];
  const subtitle = [range ? formatDateRange(range.start, range.end) : null, cities.length ? joinTr(cities) : null]
    .filter(Boolean)
    .join(" · ");
  const places = () => groupItems(timeline.undated).filter((s) => SUMMARIZED.includes(s.category));
  const dismissed = items.filter((i) => i.status === "dismissed");
  const route = routeUrl(items);
  const working = openCaptures.filter((c) => c.status === "pending" || c.status === "processing");
  const failed = openCaptures.filter((c) => c.status === "error");
  const listings = decisions?.ctx.listings;
  const legs = useMemo(() => buildLegs(plan, trip, listings), [plan, trip, listings]);
  const reading = listings
    ? new Set(items.filter((i) => needsReading(i, listings.get(listingKeyOf(i))) && !listings.get(listingKeyOf(i))?.error).map(listingKeyOf)).size
    : 0;
  const timeline = useMemo(() => buildTimeline(plan, legs, items), [plan, legs, items]);
  const decisionOf = (item: Item) => [...(decisions?.byGroup.values() ?? [])].find((d) => d.options.some((o) => o.item.id === item.id));
  /** One undecided option as a decision card: swipe through them, open one for the reasons. */
  const card: CardFor = (item, group, decision, roles, onCompareGroup) => (
    <SwipeCard
      key={item.id}
      item={item}
      group={group}
      decision={decision ?? decisionOf(item)}
      decisions={decisions}
      roles={roles}
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
  const leg = (l: Leg) => <LegRow key={l.key} leg={l} tripId={trip.id} onOpenItem={onOpenItem} />;

  const renderGroup: RenderGroup = (group, heading, groupSubtitle, nested = false) => (
    <OptionGroupView
      key={group.key}
      group={group}
      heading={heading}
      subtitle={groupSubtitle}
      nested={nested}
      decision={decisions?.byGroup.get(group.key)}
      card={decisions?.cards.get(group.key)}
      renderCard={card}
      renderSettled={settled}
      onCompare={() => onCompare(group.key)}
    />
  );

  return (
    <>
      <div className="panel-top">{menu}</div>
      <h1 className="trip-title">{trip.title}</h1>
      <div className="trip-sub">
        {subtitle || "Tarih ve şehir, kaydettikçe netleşir"}
        {range && !trip.confirmedDates && <span className="estimated">~tahmini</span>}
        {trip.budget && <span className="estimated">· bütçe {formatPrice(trip.budget.amount, trip.budget.currency)}</span>}
      </div>
      <FallbackImg className="hero" src={trip.heroImage} fallback={<div className="hero" />} />

      <div className="hero-row">
        <span className="status-line">
          {working.length > 0 && `${working.length} kayıt işleniyor… `}
          {reading > 0 && `${reading} sayfa okunuyor… `}
          {failed.length > 0 && <span className="err">{failed.length} kayıt işlenemedi</span>}
        </span>
        {route && (
          <a href={route} target="_blank" rel="noreferrer">
            Rotayı gör ↗
          </a>
        )}
      </div>

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
        <TimelineView plan={plan} timeline={timeline} tripId={trip.id} leg={leg} renderGroup={renderGroup} card={card} settled={settled} />
      )}

      {CATEGORY_ORDER.map((category) => {
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

      {plan.closed.length > 0 && <ClosedSection closed={plan.closed} onOpenItem={onOpenItem} />}

      {dismissed.length > 0 && (
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
  renderCard: CardFor;
  renderSettled: SettledFor;
  onCompare: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const rank = (item: Item) => {
    const index = decision?.options.findIndex((o) => o.item.id === item.id) ?? -1;
    return index >= 0 ? index : null;
  };
  const ranked = rankItems(group.items, rank);
  const decided = ranked.find((i) => i.status === "booked") ?? ranked.find((i) => i.status === "chosen");
  const live = !group.booked && decision;
  const comparable = live && decision.options.filter((o) => !o.excluded).length > 1;
  const single = live && decision.status === "single";
  const roles = live ? rolesOf(decision) : new Map<string, string[]>();
  const head =
    heading || subtitle ? (
      <span className="group-title">
        {heading && <span>{heading}</span>}
        {subtitle && <span className="muted">{subtitle}</span>}
      </span>
    ) : null;
  // Decided: one line (the cards come back with "Değiştir"). A booking settles it for good.
  const change = decided && decided.status === "chosen" && ranked.length > 1 ? () => setChanging(!changing) : undefined;
  if (decided && !changing) {
    return (
      <div className={nested ? "group nested" : "section"}>
        {head && <div className={nested ? "group-head" : "section-head"}>{head}</div>}
        {renderSettled(decided, decision, change, false)}
      </div>
    );
  }
  // Eliminated and rule-breaking options go last (the engine ranks them there already).
  return (
    <div className={nested ? "group nested" : "section"}>
      {decided && renderSettled(decided, decision, change, true)}
      <Carousel head={head} label={heading ?? subtitle ?? "Seçenekler"}>
        {ranked.map((item) => renderCard(item, group.items, decision, roles.get(item.id), comparable || single ? onCompare : undefined))}
      </Carousel>
      {!decided &&
        (live && card ? (
          <DecisionCard card={card} decision={decision} onCompare={onCompare} />
        ) : (
          (comparable || single) && (
            <button className="verdict-line" onClick={onCompare}>
              <span className={single ? "muted" : ""}>{decision!.summary}</span>
              <span className="verdict-cta">{single ? "Kriterleri gör →" : "Karşılaştır →"}</span>
            </button>
          )
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
            <CategoryIcon category={item.category} />
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
