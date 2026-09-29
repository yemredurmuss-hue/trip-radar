import { useState } from "react";
import { cardFacts, durationText, whyLines, type CardFacts } from "../lib/cardFacts";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange, metricsOf } from "../lib/items";
import { rangeOfGroupKey, stayRange } from "../lib/plan";
import { withDates } from "../lib/url";
import type { Category, Item } from "../lib/types";
import { chooseItem, setItemStatus } from "./actions";
import { Evidence } from "./Evidence";
import { FallbackImg } from "./FallbackImg";
import { CategoryIcon } from "./Icons";
import type { Decisions } from "./useDecisions";

/** The site it's from, with the site's own icon (the traveller has been there), else its first letter. */
export function SourceBadge({ source }: { source: CardFacts["source"] }) {
  if (!source) return null;
  return (
    <span className="sc-source">
      <FallbackImg
        className="sc-favicon"
        src={source.host ? `https://${source.host}/favicon.ico` : null}
        fallback={<span className="sc-favicon letter">{source.label.charAt(0).toLocaleUpperCase("tr")}</span>}
      />
      {source.label}
    </span>
  );
}

const TICKETED: Category[] = ["flight", "transport", "activity"];
const bookedWord = (c: Category) => (TICKETED.includes(c) ? "Bilet alındı ✓" : "Rezerve ✓");
const notBookedWord = (c: Category) => (TICKETED.includes(c) ? "bilet alınmadı" : "rezerve edilmedi");

/** Saved without dates but compared for a group's nights: the page reopened with those dates. */
function datedLink(item: Item, decision: GroupDecision | undefined) {
  const nights = decision && item.category === "stay" && !stayRange(item) ? rangeOfGroupKey(decision.key) : null;
  return { nights, url: nights ? withDates(item.url, nights, item.guests.adults) : null };
}

function Links({ item, decision, onOpen, onCompare }: { item: Item; decision?: GroupDecision; onOpen: () => void; onCompare?: () => void }) {
  const { url } = datedLink(item, decision);
  return (
    <div className="sc-links">
      {onCompare && (
        <button className="link-btn" onClick={onCompare}>
          Karşılaştır →
        </button>
      )}
      <button className="link-btn" onClick={onOpen}>
        Tüm detaylar
      </button>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          Tarihlerle aç ↗
        </a>
      ) : (
        item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">
            Sayfayı aç ↗
          </a>
        )
      )}
    </div>
  );
}

function Price({ price, compact = false }: { price: CardFacts["price"]; compact?: boolean }) {
  if (!price) return <span className="muted">Fiyat yok · tarih seçip tekrar kaydet</span>;
  return (
    <span className={`price-block${compact ? " compact" : ""}`}>
      <span className="price-main">
        <b>{price.text}</b>
        {price.label && <span className="muted">{price.label}</span>}
        {price.provisional && <span className="tone-warning">· geçici</span>}
      </span>
      {price.perNight && <span className="price-night">{price.perNight}</span>}
    </span>
  );
}

interface CardProps {
  item: Item;
  /** The options it's compared with (a choice replaces another chosen one among them). */
  group: Item[];
  decision?: GroupDecision;
  decisions: Decisions | null;
  roles?: string[];
  onOpen: () => void;
  onCompare?: () => void;
}

/**
 * One undecided option as a decision card: where it's from, what it is, what it costs (in total and
 * per night), and the two things for and against it. "Detaylar" opens the reasons and every pro and
 * con with its evidence, inside the card; "Seç" puts it in the plan.
 */
export function SwipeCard({ item, group, decision, decisions, roles = [], onOpen, onCompare }: CardProps) {
  const [open, setOpen] = useState(false);
  const facts = cardFacts(item, decision, decisions?.ctx);
  const why = open ? whyLines(item, decision, decisions?.ctx.currency ?? "EUR") : [];
  const { nights } = datedLink(item, decision);
  // Only what changes the decision is flagged on the picture: ruled out, provisional, the best pick.
  const flag = facts.status && facts.status.tone === "warning" ? facts.status : null;
  const tag = !facts.out && !flag ? (roles[0] ?? (facts.best ? "En uygun" : null)) : null;

  return (
    <article className={`swipe-card${facts.best ? " best" : ""}${facts.out ? " out" : ""}${open ? " open" : ""}`} aria-label={item.name}>
      <div className="sc-media">
        <FallbackImg
          className="sc-img"
          src={facts.image}
          fallback={
            <div className={`sc-img placeholder cat-${item.category}`}>
              <CategoryIcon category={item.category} size={40} />
            </div>
          }
        />
        <SourceBadge source={facts.source} />
        {facts.score != null && (
          <span className={`sc-score${facts.best ? " best" : ""}`} title="Kriterlerine ve okunan yorumlara göre uyum (0–100)">
            <b>{facts.score}</b>
            <small>uyum</small>
          </span>
        )}
        {flag && <span className="sc-flag warning">{flag.text}</span>}
        {tag && <span className="sc-flag">{tag}</span>}
      </div>
      <div className="sc-body">
        <h3 className="sc-title">{facts.title}</h3>
        {facts.subtitle && <div className="sc-sub">{facts.subtitle}</div>}
        <div className="sc-price">
          <Price price={facts.price} />
        </div>
        {(facts.pros.length > 0 || facts.cons.length > 0) && (
          <div className="sc-pc">
            <div className="sc-col pros">
              {facts.pros.map((p) => (
                <div key={p} className="sc-line">
                  <span className="tick">+</span> {p}
                </div>
              ))}
            </div>
            <div className="sc-col cons">
              {facts.cons.map((c) => (
                <div key={c.text} className={`sc-line${c.strong ? " strong" : ""}`}>
                  <span className="tick">−</span> {c.text}
                </div>
              ))}
            </div>
          </div>
        )}
        {open && (
          <div className="sc-details">
            {facts.status && !flag && <p className={`small-note tone-${facts.status.tone}`}>{facts.status.text}</p>}
            {why.length > 0 && (
              <div className="sc-why">
                <div className="sc-col-head">Neden</div>
                {why.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            <Evidence item={item} decision={decision} decisions={decisions} heading={false} />
            {(item.cancellation.summary || item.price.taxesIncluded === "no") && (
              <p className="muted small-note">
                {[item.cancellation.summary, item.price.taxesIncluded === "no" ? "Vergiler fiyata dahil değil" : null].filter(Boolean).join(" · ")}
              </p>
            )}
            {nights && (
              <p className="muted small-note">
                Tarihsiz kaydedildi; {formatDateRange(nights.start, nights.end)} için geçici olarak karşılaştırılıyor. Tarihlerle açıp tekrar
                kaydedersen gerçek fiyat işlenir.
              </p>
            )}
            <Links item={item} decision={decision} onOpen={onOpen} onCompare={onCompare} />
          </div>
        )}
        <div className="sc-foot">
          <button className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Kapat ▴" : "Detaylar ▾"}
          </button>
          {item.status === "booked" ? (
            <span className="tone-success">{bookedWord(item.category)}</span>
          ) : item.status === "chosen" ? (
            <button className="pill-btn soft" onClick={() => void setItemStatus(item, "saved")} title="Seçimi geri al">
              Planda ✓
            </button>
          ) : (
            <button className="pill-btn dark" onClick={() => void chooseItem(item, group)}>
              Seç
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const RATING_WORDS: [number, string][] = [
  [9, "Harika"],
  [8, "Çok iyi"],
  [7, "İyi"],
  [0, "Fena değil"],
];

/** "9,4 · Harika · 1.002 yorum" from the page's rating, on a 10-point scale. */
function ratingOf(item: Item): { value: string; word: string; count: string | null } | null {
  const r = item.rating;
  if (r.value == null || !r.scale) return null;
  const ten = (r.value / r.scale) * 10;
  return {
    value: r.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 }),
    word: RATING_WORDS.find(([min]) => ten >= min)![1],
    count: r.count ? `${r.count.toLocaleString("tr-TR")} yorum` : null,
  };
}

const clock = (iso: string | null | undefined) => (iso && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null);
const shortDay = (iso: string | null | undefined) => (iso ? formatDateRange(iso.slice(0, 10), null) : null);

/** A flight (or train) as a route: from, the line with its duration and stops, to. */
function Route({ item, facts }: { item: Item; facts: CardFacts }) {
  const f = item.flight!;
  const m = metricsOf(item);
  const stops = item.category === "flight" && f.stops != null ? (f.stops === 0 ? "Direkt" : `${f.stops} aktarma`) : null;
  return (
    <div className="route">
      <div className="route-top">
        <SourceBadge source={facts.source} />
        {item.optionDetail && <span className="fare-badge">{item.optionDetail}</span>}
      </div>
      <div className="route-line">
        <div className="route-end">
          <b className={f.from!.length > 5 ? "long" : ""}>{f.from}</b>
          <span className="muted">{[clock(f.departure), shortDay(f.departure)].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="route-mid">
          <span>{m.durationMinutes ? durationText(m.durationMinutes) : ""}</span>
          <span className="route-bar">
            <CategoryIcon category={item.category === "flight" ? "flight" : "transport"} size={20} />
          </span>
          <span className="muted">{stops ?? ""}</span>
        </div>
        <div className="route-end right">
          <b className={f.to!.length > 5 ? "long" : ""}>{f.to}</b>
          <span className="muted">{[clock(f.arrival), shortDay(f.arrival)].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}

/** A stay, a tour, a restaurant: picture, name, what it is, the rating and the price. */
function Media({ item, facts }: { item: Item; facts: CardFacts }) {
  const rating = ratingOf(item);
  const lines = [facts.subtitle, item.category === "stay" ? item.optionDetail : null, item.cancellation.summary].filter(
    (l, i, all): l is string => Boolean(l) && all.indexOf(l) === i,
  );
  return (
    <div className="stc-media-row">
      <FallbackImg
        className="stc-img"
        src={item.imageUrl}
        fallback={
          <span className={`stc-img placeholder cat-${item.category}`}>
            <CategoryIcon category={item.category} size={30} />
          </span>
        }
      />
      <div className="stc-info">
        <SourceBadge source={facts.source} />
        <div className="stc-name">{item.name}</div>
        {lines.map((l) => (
          <div key={l} className="stc-line">
            {l}
          </div>
        ))}
        {rating && (
          <div className="rating-badge">
            <b>{rating.value}</b>
            <span>
              {rating.word}
              {rating.count && <small>{rating.count}</small>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A decided need as one calm card: the flight as a route, a stay or a tour with its picture, where it
 * stands ("Seçildi · rezerve edilmedi", "Bilet alındı ✓") and the price. A tap opens the details;
 * "Değiştir" brings the other options back as cards.
 */
export function SettledCard({
  item,
  decision,
  decisions,
  onOpen,
  onChange,
  changing = false,
}: {
  item: Item;
  decision?: GroupDecision;
  decisions: Decisions | null;
  onOpen: () => void;
  onChange?: () => void;
  changing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const facts = cardFacts(item, decision, decisions?.ctx);
  const booked = item.status === "booked";
  const route = (item.category === "flight" || item.category === "transport") && Boolean(item.flight?.from && item.flight?.to);
  const toggle = () => setOpen(!open);
  return (
    <div className={`settled-card${booked ? " booked" : ""}${open ? " open" : ""}`} aria-label={item.name}>
      <div
        className="stc-main"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
      >
        {route ? <Route item={item} facts={facts} /> : <Media item={item} facts={facts} />}
      </div>
      <div className="stc-foot">
        <span className="stc-state">
          {booked ? (
            <span className="state-chip booked">{bookedWord(item.category)}</span>
          ) : (
            <>
              <span className="state-chip chosen">Seçildi</span>
              <small className="muted">{notBookedWord(item.category)}</small>
            </>
          )}
        </span>
        <Price price={facts.price} compact />
        <span className="stc-actions">
          {!booked && (
            <button className="pill-btn outline" onClick={() => void setItemStatus(item, "booked")}>
              {TICKETED.includes(item.category) ? "Bileti aldım" : "Rezerve ettim"}
            </button>
          )}
          {onChange && !booked && (
            <button className="pill-btn outline" aria-expanded={changing} onClick={onChange}>
              {changing ? "Kapat" : "⇄ Değiştir"}
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="stc-details">
          <Evidence item={item} decision={decision} decisions={decisions} heading={false} />
          <div className="sc-links">
            <Links item={item} decision={decision} onOpen={onOpen} />
            {!booked && (
              <button className="link-btn" onClick={() => void setItemStatus(item, "saved")}>
                Seçimi geri al
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
