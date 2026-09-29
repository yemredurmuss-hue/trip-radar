import { useState } from "react";
import type { GroupDecision } from "../lib/decision";
import { formatPrice, listingKeyOf, rowLabel } from "../lib/items";
import { readingLine } from "../lib/listing";
import { rangeOfGroupKey, stayRange } from "../lib/plan";
import { withDates } from "../lib/url";
import { prosConsFor, type ProCon } from "../lib/proscons";
import type { Item } from "../lib/types";
import { setItemStatus } from "./actions";
import { Evidence } from "./Evidence";
import { FallbackImg } from "./FallbackImg";
import { CategoryIcon, Chevron } from "./Icons";
import { decisionLabel, type Decisions } from "./useDecisions";

interface Props {
  item: Item;
  /** The options it is compared with (for its row label when there's no decision). */
  group: Item[];
  decision?: GroupDecision;
  decisions: Decisions | null;
  /** What sets it apart in its group ("Fiyat/performans", "En iyi konum"...). */
  roles?: string[];
  onOpen: () => void;
  onCompare?: () => void;
}

/**
 * One option. Closed: what it is, where it stands, and the one thing for it and against it that
 * matter most. Open (a click): every pro and con with the evidence behind it, and what to do next.
 */
export function OptionCard({ item, group, decision, decisions, roles = [], onOpen, onCompare }: Props) {
  const [open, setOpen] = useState(false);
  const currency = decisions?.ctx.currency ?? "EUR";
  const base = rowLabel(item, group);
  const decided = item.status === "saved" ? decisionLabel(item, decision, currency) : null;
  const warning = decided && base.tone === "warning" && decided.tone !== "warning" ? base.text : null;
  const label = decided ?? base;
  const settled = item.status === "chosen" || item.status === "booked";
  const option = decision?.options.find((o) => o.item.id === item.id);
  const out = Boolean(option?.eliminated || option?.unmet.length);
  const pc = prosConsFor(item, decision, decisions?.ctx.listings, decisions?.ctx);
  const reading = readingLine(item, decisions?.ctx.listings.get(listingKeyOf(item)));
  const pro = pc?.pros.find((p) => !p.unverified && !p.stale);
  const con = pc?.cons.find((c) => !c.accepted && !c.stale);
  const highlight = !out && (decided?.best || settled);
  // Saved without dates but compared for these nights: reopen the page with them to get the real price.
  const nights = decision && item.category === "stay" && !stayRange(item) ? rangeOfGroupKey(decision.key) : null;
  const dated = nights ? withDates(item.url, nights, item.guests.adults) : null;

  return (
    <div className={`opt-card${highlight ? " highlight" : ""}${out ? " out" : ""}${open ? " open" : ""}`}>
      <button className="opt-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <FallbackImg
          className="thumb"
          src={item.category === "flight" ? null : item.imageUrl}
          fallback={
            <span className="thumb icon">
              <CategoryIcon category={item.category} />
            </span>
          }
        />
        <span className="opt-main">
          <span className="row-name">{item.name}</span>
          <span className="opt-tags">
            {decided?.score != null && <span className={`score-pill${decided.best ? " best" : ""}`}>{decided.score}</span>}
            <span className={`tone-${label.tone}`}>{label.text}</span>
            {warning && <span className="tone-warning">· {warning}</span>}
            {!out && roles.map((r) => <span key={r} className="role">{r}</span>)}
          </span>
          {!open && (pro || con) && (
            <span className="opt-glance">
              {con?.decisive ? (
                <Glance line={con} sign="−" />
              ) : (
                <>
                  {pro && <Glance line={pro} sign="+" />}
                  {con && <Glance line={con} sign="−" />}
                </>
              )}
            </span>
          )}
        </span>
        <span className="row-price">
          {item.price.amount != null ? formatPrice(item.price.amount, item.price.currency) : ""}
          {item.price.scope === "per_night" && <span className="muted" style={{ fontSize: 13 }}>/gece</span>}
        </span>
        <span className="chev" style={{ transform: open ? "rotate(90deg)" : undefined }}>
          <Chevron />
        </span>
      </button>
      {open && (
        <div className="opt-body">
          <Evidence item={item} decision={decision} decisions={decisions} heading={false} />
          {!pc?.pros.length && !pc?.cons.length && !reading && <p className="muted small-note">Bu kayıt için henüz artı/eksi yok.</p>}
          {nights && (
            <p className="muted small-note">
              Tarihsiz kaydedildiği için bu gecelerle geçici olarak karşılaştırılıyor. Sayfayı tarihlerle açıp eklentiyle tekrar
              kaydedersen gerçek fiyatı bu kayda işlenir.
            </p>
          )}
          <div className="opt-actions">
            {item.status === "booked" ? (
              <span className="tone-success">Rezerve edildi ✓</span>
            ) : item.status === "chosen" ? (
              <button className="link-btn" onClick={() => void setItemStatus(item, "saved")}>
                Planda ✓ · geri al
              </button>
            ) : (
              <button className="dc-choose" onClick={() => void setItemStatus(item, "chosen")}>
                Plana al
              </button>
            )}
            {onCompare && (
              <button className="link-btn" onClick={onCompare}>
                Karşılaştır →
              </button>
            )}
            <button className="link-btn" onClick={onOpen}>
              Tüm detaylar
            </button>
            {dated ? (
              <a href={dated} target="_blank" rel="noreferrer" title="Bu gecelerle açılır; eklentiyle tekrar kaydedince fiyat bu kayda işlenir">
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
    </div>
  );
}

function Glance({ line, sign }: { line: ProCon; sign: string }) {
  const kind = sign === "+" ? "pro" : line.decisive || line.serious ? "con strong" : "con";
  return (
    <span className={`glance ${kind}`} title={line.detail ?? undefined}>
      <b aria-hidden>{sign}</b> {line.text}
    </span>
  );
}
