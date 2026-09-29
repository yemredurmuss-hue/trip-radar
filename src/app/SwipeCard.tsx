import { useState } from "react";
import { cardFacts, whyLines, type CardFacts } from "../lib/cardFacts";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange } from "../lib/items";
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
 * One option as a decision card: where it's from, what it is, what it costs for these dates, where
 * it stands, and the two things for and against it. "Detaylar" opens every pro and con with its
 * evidence and why it ranks where it does, inside the card; "Seç" puts it in the plan.
 */
export function SwipeCard({ item, group, decision, decisions, roles = [], onOpen, onCompare }: CardProps) {
  const [open, setOpen] = useState(false);
  const facts = cardFacts(item, decision, decisions?.ctx);
  const why = open ? whyLines(item, decision, decisions?.ctx.currency ?? "EUR") : [];
  // Saved without dates but compared for these nights: reopen the page with them to get the real price.
  const nights = decision && item.category === "stay" && !stayRange(item) ? rangeOfGroupKey(decision.key) : null;
  const dated = nights ? withDates(item.url, nights, item.guests.adults) : null;

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
      </div>
      <div className="sc-body">
        <h3 className="sc-title">{facts.title}</h3>
        {facts.subtitle && <div className="sc-sub">{facts.subtitle}</div>}
        {(facts.status || roles.length > 0) && (
          <div className="sc-tags">
            {facts.status && <span className={`tone-${facts.status.tone}`}>{facts.status.text}</span>}
            {!facts.out && roles.map((r) => <span key={r} className="role">{r}</span>)}
          </div>
        )}
        <div className="sc-price">
          {facts.price ? (
            <>
              <b>{facts.price.text}</b>
              {facts.price.label && <span>{facts.price.label}</span>}
              {facts.price.provisional && <span className="tone-warning">· geçici</span>}
            </>
          ) : (
            <span className="muted">Fiyat yok · tarih seçip tekrar kaydet</span>
          )}
        </div>
        {(facts.pros.length > 0 || facts.cons.length > 0) && (
          <div className="sc-pc">
            <div className="sc-col pros">
              <div className="sc-col-head">
                <span className="sign plus">+</span> Artılar
              </div>
              {facts.pros.map((p) => (
                <div key={p} className="sc-line">
                  <span className="tick">✓</span> {p}
                </div>
              ))}
              {!facts.pros.length && <div className="sc-line muted">—</div>}
            </div>
            <div className="sc-col cons">
              <div className="sc-col-head">
                <span className="sign minus">−</span> Eksiler
              </div>
              {facts.cons.map((c) => (
                <div key={c.text} className={`sc-line${c.strong ? " strong" : ""}`}>
                  <span className="tick">✕</span> {c.text}
                </div>
              ))}
              {!facts.cons.length && <div className="sc-line muted">—</div>}
            </div>
          </div>
        )}
        {open && (
          <div className="sc-details">
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
            <div className="sc-links">
              {onCompare && (
                <button className="link-btn" onClick={onCompare}>
                  Karşılaştır →
                </button>
              )}
              <button className="link-btn" onClick={onOpen}>
                Tüm detaylar
              </button>
              {dated ? (
                <a href={dated} target="_blank" rel="noreferrer">
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
          </div>
        )}
        <div className="sc-foot">
          <button className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Kapat ▴" : "Detaylar ▾"}
          </button>
          {item.status === "booked" ? (
            <span className="tone-success">{bookedWord(item.category)}</span>
          ) : item.status === "chosen" ? (
            <button className="sc-chosen" onClick={() => void setItemStatus(item, "saved")} title="Seçimi geri al">
              Planda ✓
            </button>
          ) : (
            <button className="sc-choose" onClick={() => void chooseItem(item, group)}>
              Seç
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * A decided need, in one line: what was chosen or booked and where it stands ("Seçildi · bilet
 * alınmadı", "Rezerve ✓"). "Değiştir" brings the cards back; the row opens the full details.
 */
export function SettledRow({
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
  const facts = cardFacts(item, decision, decisions?.ctx);
  const booked = item.status === "booked";
  return (
    <div className={`settled-row${booked ? " booked" : ""}`}>
      <button className="settled-main" onClick={onOpen}>
        <FallbackImg
          className="settled-thumb"
          src={facts.image}
          fallback={
            <span className={`settled-thumb placeholder cat-${item.category}`}>
              <CategoryIcon category={item.category} size={22} />
            </span>
          }
        />
        <span className="settled-text">
          <span className="settled-name">{item.name}</span>
          <span className="settled-sub">{[facts.subtitle, facts.price?.text].filter(Boolean).join(" · ")}</span>
        </span>
      </button>
      <span className="settled-state">
        {booked ? (
          <span className="state-chip booked">{bookedWord(item.category)}</span>
        ) : (
          <>
            <span className="state-chip chosen">Seçildi</span>
            <small className="muted">{notBookedWord(item.category)}</small>
          </>
        )}
      </span>
      {!booked && (
        <span className="settled-actions">
          <button className="link-btn" onClick={() => void setItemStatus(item, "booked")}>
            {TICKETED.includes(item.category) ? "Bileti aldım" : "Rezerve ettim"}
          </button>
          {onChange && (
            <button className="link-btn" aria-expanded={changing} onClick={onChange}>
              {changing ? "Kapat" : "Değiştir"}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
