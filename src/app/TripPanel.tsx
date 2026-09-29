import { Fragment, useState } from "react";
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
import { needsReading } from "../lib/listing";
import type { OptionGroup, Plan, StayBlock } from "../lib/plan";
import { retryCapture } from "../lib/process";

import type { Capture, Category, Item, Trip } from "../lib/types";
import { DecisionCard } from "./DecisionCard";
import { CategoryIcon, Chevron } from "./Icons";
import { IntentCard } from "./IntentCard";
import { OptionCard } from "./OptionCard";
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

const ROWS_PER_GROUP = 3;
/** Categories shown as one summary row until expanded (like "Tiyatro, tekne turu ve 4 yer"). */
const SUMMARIZED: Category[] = ["activity", "food", "other"];

type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => React.ReactNode;
type CardFor = (item: Item, group: Item[], decision?: GroupDecision, roles?: string[], onCompare?: () => void) => React.ReactNode;

const WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function TripPanel({ trip, items, plan, openCaptures, decisions, onOpenItem, onCompare, menu }: Props) {
  const range = trip.confirmedDates ?? tripDateRange(items);
  const cities = [...new Set(items.filter((i) => i.status !== "dismissed" && i.category === "stay" && i.city).map((i) => i.city!))];
  const subtitle = [range ? formatDateRange(range.start, range.end) : null, cities.length ? joinTr(cities) : null]
    .filter(Boolean)
    .join(" · ");
  const currency = decisions?.ctx.currency ?? "EUR";
  const places = groupItems(items).filter((s) => SUMMARIZED.includes(s.category));
  const dismissed = items.filter((i) => i.status === "dismissed");
  const route = routeUrl(items);
  const working = openCaptures.filter((c) => c.status === "pending" || c.status === "processing");
  const failed = openCaptures.filter((c) => c.status === "error");
  const listings = decisions?.ctx.listings;
  const reading = listings
    ? new Set(items.filter((i) => needsReading(i, listings.get(listingKeyOf(i))) && !listings.get(listingKeyOf(i))?.error).map(listingKeyOf)).size
    : 0;
  /** One saved option as a card that opens in place (pros and cons, evidence, actions). */
  const card: CardFor = (item, group, decision, roles, onCompareGroup) => (
    <OptionCard
      key={item.id}
      item={item}
      group={group}
      decision={decision}
      decisions={decisions}
      roles={roles}
      onOpen={() => onOpenItem(item)}
      onCompare={onCompareGroup}
    />
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
      renderCard={card}
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

      {CATEGORY_ORDER.map((category) => {
        if (category === "stay") return <StaySection key="stay" plan={plan} renderGroup={renderGroup} card={card} />;
        if (SUMMARIZED.includes(category)) {
          const section = places.find((s) => s.category === category);
          return section ? (
            <SummarySection key={category} category={category} groups={section.groups} card={card} onOpenItem={onOpenItem} />
          ) : null;
        }
        return plan.groups
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

/** The trip's nights in order: booked, chosen and open stretches, with what's missing between them. */
function StaySection({ plan, renderGroup, card }: { plan: Plan; renderGroup: RenderGroup; card: CardFor }) {
  if (!plan.stayBlocks.length && !plan.looseStays.length) return null;
  const n = plan.nights;
  const parts = [n.booked && `${n.booked} rezerve`, n.chosen && `${n.chosen} seçildi`, n.open && `${n.open} açık`].filter(Boolean);
  return (
    <div className="section">
      <div className="section-head">
        <span>{CATEGORY_LABELS.stay}</span>
        {n.total > 0 && <span className="muted">{[`${n.total} gece`, ...parts].join(" · ")}</span>}
      </div>
      <DayStrip blocks={plan.stayBlocks} />
      {plan.notices
        .filter((x) => x.kind === "conflict")
        .map((x) => (
          <div key={x.text} className="notice">
            ⚠ {x.text}
          </div>
        ))}
      {plan.stayBlocks.map((block) => (
        <Fragment key={block.range.start}>
          {plan.notices
            .filter((x) => x.kind === "transfer" && x.date === block.range.start)
            .map((x) => (
              <div key={x.text} className="notice">
                ⚠ {x.text}
              </div>
            ))}
          <Block block={block} renderGroup={renderGroup} card={card} />
        </Fragment>
      ))}
      {plan.looseStays.map((g) =>
        renderGroup(
          g,
          null,
          plan.range
            ? `${g.title ?? ""}${g.range ? " · gezi tarihleri dışında" : " · tarih seçilmemiş"}`
            : `${g.title ?? ""}${g.range ? "" : " · tarih seçilmemiş"}`,
          Boolean(plan.stayBlocks.length),
        ),
      )}
    </div>
  );
}

const BLOCK_LABEL = { booked: "✓ Rezerve", chosen: "Seçildi", open: "Açık", empty: "Boş" } as const;

const blockState = (block: StayBlock) => (block.kind === "open" && !block.groups.length ? "empty" : block.kind);

/** The trip's nights at a glance, one cell per night, coloured by whether it's booked, chosen or open. */
function DayStrip({ blocks }: { blocks: StayBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="day-strip" role="list" aria-label="Geceler">
      {blocks.map((block) => {
        const state = blockState(block);
        const nights = Array.from({ length: block.nights }, (_, i) => addDay(block.range.start, i));
        return (
          <button
            key={block.range.start}
            role="listitem"
            className={`strip-block ${state}`}
            style={{ flexGrow: block.nights }}
            title={`${formatDateRange(block.range.start, block.range.end)} · ${block.nights} gece · ${BLOCK_LABEL[state]}`}
            onClick={() => document.getElementById(`block-${block.range.start}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span className="strip-days">
              {nights.map((d) => (
                <span key={d} className="strip-day">
                  <b>{dayOfMonth(d)}</b>
                  <small>{weekday(d)}</small>
                </span>
              ))}
            </span>
            <span className="strip-label">
              {block.city ? `${block.city} · ` : ""}
              {BLOCK_LABEL[state]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Block({ block, renderGroup, card }: { block: StayBlock; renderGroup: RenderGroup; card: CardFor }) {
  const state = blockState(block);
  return (
    <div className={`stay-block ${state}`} id={`block-${block.range.start}`}>
      <div className="block-head">
        <span className="block-date">
          <span className="block-range">{formatDateRange(block.range.start, block.range.end)}</span>
          <span className="block-days">
            {weekday(block.range.start)} – {weekday(block.range.end)} · {block.nights} gece
            {block.city && ` · ${block.city}`}
          </span>
        </span>
        <span className={`block-chip ${state}`}>{BLOCK_LABEL[state]}</span>
      </div>
      {block.kind === "booked" && card(block.item, [block.item])}
      {block.kind !== "booked" &&
        block.groups.map((g) =>
          renderGroup(g, null, g.range && g.range.start === block.range.start && g.range.end === block.range.end ? null : g.title, true),
        )}
      {block.kind === "open" && !block.groups.length && (
        <div className="empty-slot">
          Bu geceler için kayıtlı seçenek yok.{" "}
          <a href={block.searchUrl} target="_blank" rel="noreferrer">
            Booking'de bu tarihlerle ara ↗
          </a>
        </div>
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
  onCompare,
}: {
  group: OptionGroup;
  heading: string | null;
  subtitle: string | null;
  nested: boolean;
  decision: GroupDecision | undefined;
  card: ValueCard | undefined;
  renderCard: CardFor;
  onCompare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rank = (item: Item) => {
    const index = decision?.options.findIndex((o) => o.item.id === item.id) ?? -1;
    return index >= 0 ? index : null;
  };
  const ranked = rankItems(group.items, rank);
  // Once something is chosen, its alternatives fold away (still one click from view).
  const limit = ranked.some((i) => i.status === "chosen" || i.status === "booked") ? 1 : ROWS_PER_GROUP;
  const shown = expanded ? ranked : ranked.slice(0, limit);
  const hidden = ranked.slice(shown.length);
  const droppable = hidden.filter((i) => decision?.options.find((o) => o.item.id === i.id)?.dominatedBy).length;
  const live = !group.booked && decision;
  const comparable = live && decision.options.filter((o) => !o.excluded).length > 1;
  const single = live && decision.status === "single";
  const roles = live ? rolesOf(decision) : new Map<string, string[]>();
  return (
    <div className={nested ? "group nested" : "section"}>
      {(heading || subtitle) && (
        <div className={nested ? "group-head" : "section-head"}>
          <span>{heading}</span>
          {subtitle && <span className="muted">{subtitle}</span>}
        </div>
      )}
      {shown.map((item) => renderCard(item, group.items, decision, roles.get(item.id), comparable || single ? onCompare : undefined))}
      {hidden.length > 0 && (
        <button className="more" onClick={() => setExpanded(true)}>
          + {hidden.length} seçenek daha{droppable ? ` (${droppable} elenebilir)` : ""}
        </button>
      )}
      {live && card ? (
        <DecisionCard card={card} decision={decision} onCompare={onCompare} />
      ) : (comparable || single) && (
        <button className="verdict-line" onClick={onCompare}>
          <span className={single ? "muted" : ""}>{decision!.summary}</span>
          <span className="verdict-cta">{single ? "Kriterleri gör →" : "Karşılaştır →"}</span>
        </button>
      )}
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
        items.map((item) => (card ? card(item, items) : <Row key={item.id} item={item} group={items} onOpen={() => onOpenItem(item)} />))}
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
