import { useState } from "react";
import { FallbackImg } from "./FallbackImg";
import { requestProcessing } from "../lib/browser";
import {
  CATEGORY_LABELS,
  formatDateRange,
  formatPrice,
  groupItems,
  routeUrl,
  rowLabel,
  tripDateRange,
  type NeedGroup,
} from "../lib/items";
import { retryCapture } from "../lib/process";
import type { Capture, Category, Item, Trip } from "../lib/types";
import { CategoryIcon, Chevron } from "./Icons";

interface Props {
  trip: Trip;
  items: Item[];
  openCaptures: Capture[];
  onOpenItem: (item: Item) => void;
  menu: React.ReactNode;
}

const ROWS_PER_GROUP = 3;
/** Categories shown as one summary row until expanded (like "Tiyatro, tekne turu ve 4 yer"). */
const SUMMARIZED: Category[] = ["activity", "food", "other"];

export function TripPanel({ trip, items, openCaptures, onOpenItem, menu }: Props) {
  const range = trip.confirmedDates ?? tripDateRange(items);
  const cities = [...new Set(items.filter((i) => i.status !== "dismissed" && i.category === "stay" && i.city).map((i) => i.city!))];
  const subtitle = [range ? formatDateRange(range.start, range.end) : null, cities.length ? joinTr(cities) : null]
    .filter(Boolean)
    .join(" · ");
  const sections = groupItems(items);
  const dismissed = items.filter((i) => i.status === "dismissed");
  const route = routeUrl(items);
  const working = openCaptures.filter((c) => c.status === "pending" || c.status === "processing");
  const failed = openCaptures.filter((c) => c.status === "error");

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

      {sections.map(({ category, groups }) =>
        SUMMARIZED.includes(category) ? (
          <SummarySection key={category} category={category} groups={groups} onOpenItem={onOpenItem} />
        ) : (
          groups.map((group, index) => (
            <Group
              key={group.key}
              title={index === 0 || group.title ? CATEGORY_LABELS[category] : null}
              group={group}
              onOpenItem={onOpenItem}
            />
          ))
        ),
      )}

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

function Group({ title, group, onOpenItem }: { title: string | null; group: NeedGroup; onOpenItem: (i: Item) => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.items : group.items.slice(0, ROWS_PER_GROUP);
  const hidden = group.items.length - shown.length;
  return (
    <div className="section">
      {(title || group.title) && (
        <div className="section-head">
          <span>{title}</span>
          {group.title && <span className="muted">{group.title}</span>}
        </div>
      )}
      {shown.map((item) => (
        <Row key={item.id} item={item} group={group.items} onOpen={() => onOpenItem(item)} />
      ))}
      {hidden > 0 && (
        <button className="more" onClick={() => setExpanded(true)}>
          + {hidden} seçenek daha
        </button>
      )}
    </div>
  );
}

function SummarySection({
  category,
  groups,
  onOpenItem,
  label,
}: {
  category: Category;
  groups: NeedGroup[];
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
      {open && items.map((item) => <Row key={item.id} item={item} group={items} onOpen={() => onOpenItem(item)} />)}
    </div>
  );
}

function Row({ item, group, onOpen }: { item: Item; group: Item[]; onOpen: () => void }) {
  const label = rowLabel(item, group);
  const image = item.imageUrl;
  const highlight = item.recommendation || item.status === "chosen" || item.status === "booked";
  return (
    <button className={`row${highlight ? " highlight" : ""}`} onClick={onOpen}>
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
        <div className={`row-label tone-${label.tone}`}>{label.text}</div>
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
