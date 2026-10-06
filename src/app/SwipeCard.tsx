import { useState } from "react";
import { cardFacts, type CardFacts } from "../lib/cardFacts";
import type { GroupDecision } from "../lib/decision";
import { L } from "../lib/i18n";
import { formatDateRange } from "../lib/items";
import { NEED_MARK } from "../lib/needs";
import type { Ranked } from "../lib/choice";
import { dateAlert } from "../lib/progress";
import { isRental, isTrip } from "../lib/travelKinds";
import type { Category, Item } from "../lib/types";
import { chooseItem, setItemStatus } from "./actions";
import { FallbackImg } from "./FallbackImg";
import { PivotNote } from "./PivotNote";
import { StatusBar } from "./Status";
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
  const { menu, remove, field } = useStageMenu(item);
  return (
    <span className="st-tools">
      <DeleteX name={item.name} onDelete={remove} />
      <CardMenu entries={menu} />
      {field}
    </span>
  );
}

/** A ticket is bought for a flight, a train or an activity; a stay, a rental car or a transfer is reserved. */
const ticketed = (i: Item) => i.category === "flight" || i.category === "activity" || (i.category === "transport" && isTrip(i));
const bookedWord = (i: Item) => (ticketed(i) ? L("Bilet alındı", "Ticket booked") : L("Rezerve edildi", "Booked"));
const notBookedWord = (i: Item) => (ticketed(i) ? L("bilet alınmadı", "no ticket yet") : L("rezerve edilmedi", "not booked"));
const bookAction = (i: Item) => (ticketed(i) ? L("Bileti aldım", "I got the ticket") : L("Rezerve ettim", "I booked it"));

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
                  {L("Seç", "Choose")}
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

/** A stay, a tour, a restaurant: picture, name, what it is, the rating and the price. */
function Media({ item, facts }: { item: Item; facts: CardFacts }) {
  const rating = ratingOf(item);
  const lines = [facts.subtitle, item.cancellation.summary, item.origin === "chat" ? L("Sohbette söyledin", "You said it in the chat") : null].filter(
    (l, i, all): l is string => Boolean(l) && all.indexOf(l) === i,
  );
  return (
    <div className="stc-media-row">
      <FallbackImg
        className="stc-img"
        src={item.imageUrl}
        fallback={
          <span className={`stc-img placeholder cat-${item.category}`}>
            <CategoryIcon category={isRental(item) ? "car" : item.category} size={30} />
          </span>
        }
      />
      <div className="stc-info">
        <SourceBadge source={facts.source} />
        <div className="stc-name">
          <Editable field="name">{item.name}</Editable>
        </div>
        {item.category === "stay" && (
          <div className="stc-line st-edit">
            <StayLine item={item} />
          </div>
        )}
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
export function SettledCard(props: Parameters<typeof SettledCardFace>[0]) {
  return (
    <InlineEdit item={props.item}>
      <SettledCardFace {...props} />
    </InlineEdit>
  );
}

function SettledCardFace({
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
  const env = useCardEnv();
  const [open, setOpen] = useState(false);
  const facts = cardFacts(item, decision, decisions?.ctx);
  const booked = item.status === "booked";
  // Time running out: a free cancellation ending, or a trip near and still not booked.
  const alert = dateAlert(item, decisions?.ctx.today ?? new Date().toISOString().slice(0, 10));
  /** Said in the chat, no page yet: a plan. */
  const planned = item.origin === "chat";
  const toggle = () => setOpen(!open);
  // A tap on the card shows the other options for this need (when there are some to switch to);
  // ⓘ opens the details. Without alternatives, a tap opens the details too.
  const alternatives = onChange && !booked ? Math.max(0, (decision?.options.length ?? 1) - 1) : 0;
  const tap = alternatives ? onChange! : toggle;
  return (
    <div className={`settled-card st-${booked ? "booked" : "planned"}${open ? " open" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <StayTools item={item} />
      <StatusBar
        standing={booked ? "booked" : "planned"}
        text={booked ? bookedWord(item) : L("Planlandı", "Planned")}
        sub={booked ? null : notBookedWord(item)}
        ring={<Ring state={booked ? "done" : "half"} />}
      />
      {alert && <div className={`card-alert ${alert.tone}`}>⏳ {alert.text}</div>}
      <button className="info-btn" aria-label={L("Detaylar", "Details")} aria-expanded={open} title={L("Detaylar", "Details")} onClick={toggle}>
        i
      </button>
      <div
        className="stc-main"
        role="button"
        tabIndex={0}
        aria-expanded={alternatives ? changing : open}
        aria-label={alternatives ? L(`${item.name}: diğer seçenekleri göster`, `${item.name}: show the other options`) : L(`${item.name}: detaylar`, `${item.name}: details`)}
        onClick={tap}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), tap())}
      >
        <Media item={item} facts={facts} />
      </div>
      <div className="stc-foot">
        <Editable field="price">{facts.price && <Price price={facts.price} compact dated={Boolean(item.dates.start || item.flight?.departure) || booked} />}</Editable>
        <span className="stc-actions">
          <DocAccess item={item} docs={env.docsFor(item.id)} />
          {booked ? (
            // A misclick shouldn't stick: the booking can be taken back (the options it closed come back too).
            <button className="pill-btn outline" onClick={() => void setItemStatus(item, "chosen")} title={L("Rezerve edilmedi olarak geri al", "Mark as not booked")}>
              {L("Geri al", "Undo")}
            </button>
          ) : (
            <button className="pill-btn outline" onClick={() => void setItemStatus(item, "booked")}>
              {bookAction(item)}
            </button>
          )}
          {/* The options side by side (0.37): the Comparison window's board; a tap on the card still unfolds them here. */}
          {alternatives > 0 && decision && (
            <button className="pill-btn outline board-btn" onClick={() => env.onCompare(decision.key)}>
              ▦ {L(`Seçenekleri karşılaştır (${alternatives + 1})`, `Compare the options (${alternatives + 1})`)}
            </button>
          )}
          {changing && (
            <button className="pill-btn outline" aria-expanded onClick={onChange}>
              {L("Kapat", "Close")}
            </button>
          )}
          {/* A plan said in the chat (a taxi, a ticket to find) comes off the board in one tap. */}
          {planned && !booked && (
            <button className="pill-btn outline quiet" onClick={() => env.remove(item)} title={L("Bu planı panodan kaldır", "Remove this plan from the board")}
              aria-label={L(`${item.name}: kaldır`, `${item.name}: remove`)}
            >
              {L("Kaldır", "Remove")}
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="stc-details">
          <Details item={item} decision={decision} decisions={decisions} />
          <div className="sc-links">
            <Links item={item} decision={decision} onOpen={onOpen} />
            {planned ? (
              // Not booked: "Kaldır" is on the card itself.
              booked && (
                <button className="link-btn" onClick={() => env.remove(item)}>
                  {L("Planı kaldır", "Remove plan")}
                </button>
              )
            ) : (
              !booked && (
                <button className="link-btn" onClick={() => void setItemStatus(item, "saved")}>
                  {L("Seçimi geri al", "Undo choice")}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
