import { useState } from "react";
import { cardFacts } from "../lib/cardFacts";
import type { GroupDecision } from "../lib/decision";
import { L } from "../lib/i18n";
import { formatDateRange } from "../lib/items";
import { NEED_MARK } from "../lib/needs";
import type { Ranked } from "../lib/choice";
import { isRental, isTrip } from "../lib/travelKinds";
import type { Item } from "../lib/types";
import { chooseItem, setItemStatus } from "./actions";
import { FallbackImg } from "./FallbackImg";
import { PivotNote } from "./PivotNote";
import { lookWord } from "../lib/stageWords";
import { CategoryIcon } from "./Icons";
import { datedLink, Details, Links, Price, ProsCons, ratingOf, SourceBadge, TradeLine } from "./cards/parts";
import { DocAccess } from "./cards/DocAccess";
import { Editable, InlineEdit } from "./cards/InlineEdit";
import { StayLine } from "./cards/StayLine";
import { CardMenu, DeleteX, Ring } from "./cards/CardShell";
import { useCardEnv } from "./cards/PlanCard";
import { useStageMenu } from "./cards/stageMenu";
import { useShare, VoteBar } from "./Share";
import type { Decisions } from "./useDecisions";

/** A stay's ••• (Düzenle for a plan, Ele for a saved option, Sil) and the hover × left of it, top right. */
function StayTools({ item }: { item: Item }) {
  // By its stage (stageMenu.tsx): Değiştir, Belge ekle, İptal ettim; a booking is deleted only after asking.
  // v11: the × is "Gerek yok" (Gizlenenler, as it stood); on a booking it asks "İptal ettin mi?" first.
  const { menu, hide, booked, field } = useStageMenu(item);
  return (
    <span className="st-tools">
      <DeleteX name={item.name} onDelete={hide} label={booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")} />
      <CardMenu entries={menu} />
      {field}
    </span>
  );
}

/** A ticket is bought for a flight, a train or an activity; a stay, a rental car or a transfer is reserved. */
const ticketed = (i: Item) => i.category === "flight" || i.category === "activity" || (i.category === "transport" && isTrip(i));
const bookedWord = (i: Item) => lookWord("booked", { as: ticketed(i) ? "ticket" : undefined });

interface CardProps {
  item: Item;
  /** The options it's compared with (a choice replaces another chosen one among them). */
  group: Item[];
  decision?: GroupDecision;
  decisions: Decisions | null;
  /** Its place (1, 2, 3...), what it's strongest on, and why it stands there. */
  ranked?: Ranked;
  onOpen: () => void;
  onCompare?: () => void;
}

const fitWords = () => ({ check: L("Seçmeden kontrol et", "Check before choosing"), partial: L("Kısmi", "Partial"), unfit: L("Uygun değil", "Doesn't fit") });

/**
 * One option in its place: the number and the score, what it's strongest on ("EN EKONOMİK · EN
 * SESSİZ"), its name and price; why it stands there (against the first, or for the first against the
 * second: the money, what it gives, what it gives up); a mark for each thing asked for; and what speaks
 * for it and against it. The reasons behind the score and the evidence are one tap away.
 */
/** Its name, city, nights and price are edited where they stand (spec 0.33 §3). */
export function SwipeCard(props: CardProps) {
  return (
    <InlineEdit item={props.item}>
      <SwipeCardFace {...props} />
    </InlineEdit>
  );
}

function SwipeCardFace({ item, group, decision, decisions, ranked, onOpen, onCompare }: CardProps) {
  const env = useCardEnv();
  const [open, setOpen] = useState(false);
  // Shared trip: both travellers said 👎 → it steps back like "Çıkar" (a vote undoes it).
  const allNo = useShare()?.tally(item).allNo ?? false;
  const facts = cardFacts(item, decision, decisions?.ctx);
  const option = decision?.options.find((o) => o.item.id === item.id);
  const { nights, url: datedUrl } = datedLink(item, decision);
  const fit = option?.fit ?? "fit";
  const currency = decisions?.ctx.currency ?? "EUR";
  const rating = ratingOf(item);
  const meta = [facts.subtitle, rating ? `${rating.value} ${rating.word}${rating.count ? ` · ${rating.count}` : ""}` : null].filter(Boolean).join(" · ");
  const place = ranked?.rank ?? null;

  return (
    <article
      className={`swipe-card opt fit-${fit}${place === 1 ? " first" : ""}${open ? " open" : ""}${allNo ? " all-no" : ""}`}
      aria-label={item.name}
      data-item-id={item.id}
    >
      <StayTools item={item} />
      <div className={`opt-layout${facts.image ? "" : " no-photo"}`}>
        {/* The picture large, as on the site: its place, its score and the way to its page on it. */}
        <div className="opt-photo">
          <FallbackImg
            className="opt-img"
            src={facts.image}
            fallback={
              <div className={`opt-img placeholder cat-${item.category}`}>
                <CategoryIcon category={isRental(item) ? "car" : item.category} size={40} />
              </div>
            }
          />
          {place != null && (
            <span className="opt-rank" aria-label={L(`${place}. sırada`, `Ranked #${place}`)}>
              {place}
            </span>
          )}
          {facts.score != null && (
            <span className={`opt-score${place === 1 ? " best" : ""}`} title={L(
                "Uyum puanı (100 üzerinden): önceliklerin, istediklerin ve okunan yorumlar",
                "Fit score (out of 100): your priorities, what you want and the reviews read",
              )}>
              <b>{facts.score}</b>
              <small>{L("puan", "score")}</small>
            </span>
          )}
          <SourceBadge source={facts.source} href={datedUrl} />
        </div>
        <div className="opt-body">
          <div className="opt-text">
            {ranked && ranked.badges.length > 0 && <div className="opt-label">{ranked.badges.join(" · ")}</div>}
            <h3 className="opt-name sc-title">
              <Editable field="name">{facts.title}</Editable>
            </h3>
            <div className="opt-where st-edit">
              <StayLine item={item} />
            </div>
            {meta && <div className="opt-meta">{meta}</div>}
            <div className="opt-price sc-price">
              <Editable field="price">{facts.price && <Price price={facts.price} dated={Boolean(item.dates.start || item.flight?.departure)} />}</Editable>
            </div>
          </div>
          {ranked && <TradeLine ranked={ranked} currency={currency} className="opt-trade" />}
          {ranked && ranked.unknown.length > 0 && (
            <p className="opt-unknown" title={L(
                "İstediğin bir konuda diğer seçeneklerin yorumları konuşuyor, bununkiler hiç bahsetmiyor",
                "Reviews of the other options talk about something you want; this one's never mention it",
              )}>
              ? {ranked.unknown.join(", ")}:{" "}
              {L(
                "diğerlerinin yorumlarında geçiyor, bunda hiç geçmiyor; bilinmiyor, sayfada bak",
                "mentioned in the others' reviews, never in this one's; unknown, check the page",
              )}
            </p>
          )}
          {facts.needs.length > 0 && (
            <ul className="opt-checks sc-needs" aria-label={L("İstediklerin", "What you want")}>
              {facts.needs.slice(0, 5).map((n) => (
                <li key={n.key} className={`need ${n.state}`} title={n.text}>
                  <i aria-hidden>{NEED_MARK[n.state]}</i>
                  <span>{n.label}</span>
                </li>
              ))}
            </ul>
          )}
          <ProsCons pros={facts.pros} cons={facts.cons} />
          {ranked?.pivot && item.status === "saved" && <PivotNote item={item} pivot={ranked.pivot} />}
          <VoteBar item={item} />
          {fit !== "fit" && option && option.fitNotes.length > 0 && (
            <p className={`opt-status ${fit}`}>
              <b>{fitWords()[fit]}:</b> {option.fitNotes.join(" · ")}
            </p>
          )}
          <div className="sc-foot opt-foot">
            <span className="opt-links">
              <Ring state={item.status === "booked" ? "done" : item.status === "chosen" ? "half" : "open"} />
              <button className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? L("Kapat ▴", "Close ▴") : L("Detaylar ▾", "Details ▾")}
              </button>
              <DocAccess item={item} docs={env.docsFor(item.id)} />
            </span>
            {item.status === "booked" ? (
              <span className="tone-success">✓ {bookedWord(item)}</span>
            ) : item.status === "chosen" ? (
              <button className="pill-btn soft" onClick={() => void setItemStatus(item, "saved")} title={L("Seçimi geri al", "Undo choice")}>
                {L("Planda ✓", "In plan ✓")}
              </button>
            ) : item.status === "dismissed" ? (
              <button className="pill-btn outline" onClick={() => void setItemStatus(item, "saved")} title={L("Seçeneklere geri al", "Back to options")}>
                {L("Geri al", "Undo")}
              </button>
            ) : (
              <span className="sc-actions">
                <button className="link-btn quiet" onClick={() => void setItemStatus(item, "dismissed")} title={L("Seçeneklerden çıkar; bölümün Gizlenenler'inde durur", "Take it out of the options; it waits under the section's Hidden")}>
                  {L("Çıkar", "Rule out")}
                </button>
                <button className="pill-btn primary" onClick={() => void chooseItem(item, group)}>
                  {L("Plana koy", "Add to plan")}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="sc-details">
          <Details item={item} decision={decision} decisions={decisions} status={facts.status} />
          {nights && (
            <p className="muted small-note">
              {L(
                `Tarihsiz kaydedildi; ${formatDateRange(nights.start, nights.end)} için geçici karşılaştırılıyor. Tarihlerle açıp tekrar kaydedersen gerçek fiyat işlenir.`,
                `Saved without dates; compared for ${formatDateRange(nights.start, nights.end)} for now. Open it with dates and save again to get the real price.`,
              )}
            </p>
          )}
          <Links item={item} decision={decision} onOpen={onOpen} onCompare={onCompare} />
        </div>
      )}
    </article>
  );
}
