import { useState } from "react";
import { cardDetails, cardFacts, durationText, type CardFacts } from "../lib/cardFacts";
import { ratingOutOf10, type GroupDecision } from "../lib/decision";
import { L, locale } from "../lib/i18n";
import { formatDateRange, listingKeyOf, metricsOf } from "../lib/items";
import { readingLine } from "../lib/listing";
import { NEED_MARK, type NeedCheck } from "../lib/needs";
import { moneyText, tradeText, type Ranked } from "../lib/choice";
import { dateAlert } from "../lib/progress";
import { rangeOfGroupKey, stayRange } from "../lib/plan";
import { isRental, isSmall, isTrip } from "../lib/travelKinds";
import { withDates } from "../lib/url";
import type { Category, Item } from "../lib/types";
import { chooseItem, removeItem, setItemStatus } from "./actions";
import { FallbackImg } from "./FallbackImg";
import { PivotNote } from "./PivotNote";
import { StatusBar } from "./Status";
import { CategoryIcon } from "./Icons";
import { useShare, VoteBar } from "./Share";
import type { Decisions } from "./useDecisions";

/** The site it's from, with the site's own icon (the traveller has been there), else its first letter. */
/** Where it's from; with a page, one click opens it in a new tab (the board stays where it is). */
export function SourceBadge({ source, href }: { source: CardFacts["source"]; href?: string | null }) {
  if (!source) return null;
  const url = href ?? source.url;
  const inner = (
    <>
      <FallbackImg
        className="sc-favicon"
        src={source.host ? `https://${source.host}/favicon.ico` : null}
        fallback={<span className="sc-favicon letter">{source.label.charAt(0).toLocaleUpperCase(locale())}</span>}
      />
      {source.label}
    </>
  );
  if (!url) return <span className="sc-source">{inner}</span>;
  return (
    <a
      className="sc-source link"
      href={url}
      target="_blank"
      rel="noreferrer"
      title={L(`${source.label} sayfasını yeni sekmede aç`, `Open ${source.label} in a new tab`)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {inner}
      <span className="sc-open" aria-hidden>
        ↗
      </span>
    </a>
  );
}

/** What the traveller asked for, checked on this one: ✓ there, ✕ not, ? the page doesn't say. */
export function Needs({ needs, max = 4 }: { needs: NeedCheck[]; max?: number }) {
  if (!needs.length) return null;
  const shown = needs.slice(0, max);
  return (
    <div className="sc-needs">
      <span className="sc-needs-head">{L("İstediklerin", "What you want")}</span>
      <ul aria-label={L("İstediklerin", "What you want")}>
        {shown.map((n) => (
          <li key={n.key} className={`need ${n.state}`} title={`${n.label}: ${n.text}`}>
            <i aria-hidden>{NEED_MARK[n.state]}</i>
            <span>{n.text}</span>
          </li>
        ))}
        {needs.length > max && <li className="need more">+{needs.length - max}</li>}
      </ul>
    </div>
  );
}

/** A ticket is bought for a flight, a train or an activity; a stay, a rental car or a transfer is reserved. */
const ticketed = (i: Item) => i.category === "flight" || i.category === "activity" || (i.category === "transport" && isTrip(i));
const bookedWord = (i: Item) => (ticketed(i) ? L("Bilet alındı", "Ticket booked") : L("Rezerve edildi", "Booked"));
const notBookedWord = (i: Item) => (ticketed(i) ? L("bilet alınmadı", "no ticket yet") : L("rezerve edilmedi", "not booked"));
const bookAction = (i: Item) => (ticketed(i) ? L("Bileti aldım", "I got the ticket") : L("Rezerve ettim", "I booked it"));

/** Saved without dates but compared for a group's nights: the page reopened with those dates. */
function datedLink(item: Item, decision: GroupDecision | undefined) {
  const nights = decision && item.category === "stay" && !stayRange(item) ? rangeOfGroupKey(decision.key) : null;
  return { nights, url: nights ? withDates(item.url, nights, item.guests.adults) : null };
}

/**
 * What speaks for it and against it, a few words a line: the pluses, then what to mind, each list
 * with its biggest on top (the reason an option is out always leads). A wide card puts them side by
 * side; a narrow one one under the other, so no line is squeezed into a column two words wide.
 */
function ProsCons({ pros, cons }: { pros: CardFacts["pros"]; cons: CardFacts["cons"] }) {
  if (!pros.length && !cons.length) return null;
  return (
    <div className="sc-pc">
      {pros.length > 0 && (
        <ul className="sc-col pros" aria-label={L("Artıları", "Pros")}>
          {pros.slice(0, 3).map((p) => (
            <li key={p.text} className={p.unique ? "unique" : undefined} title={p.text}>
              <i aria-hidden>+</i>
              <span>{p.text}</span>
              {p.unique && <em className="only-here">{L("yalnız bunda", "only this one")}</em>}
            </li>
          ))}
        </ul>
      )}
      {cons.length > 0 && (
        <ul className="sc-col cons" aria-label={L("Eksileri", "Cons")}>
          {cons.slice(0, 3).map((c) => (
            <li key={c.text} className={[c.strong ? "strong" : "", c.unique ? "unique" : ""].filter(Boolean).join(" ") || undefined} title={c.text}>
              <i aria-hidden>−</i>
              <span>{c.text}</span>
              {c.unique && !c.strong && <em className="only-here">{L("yalnız bunda", "only this one")}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * An opened card: one line on where it stands, the facts that decide (only what's known), and the few
 * things for and against it that matter. Everything read about it is in "Tüm detaylar".
 */
function Details({
  item,
  decision,
  decisions,
  status = null,
}: {
  item: Item;
  decision?: GroupDecision;
  decisions: Decisions | null;
  status?: CardFacts["status"];
}) {
  const d = cardDetails(item, decision, decisions?.ctx);
  const listing = decisions?.ctx.listings.get(listingKeyOf(item));
  const reading = readingLine(item, listing);
  return (
    <div className="card-details">
      {d.verdict ? <p className="cd-verdict">{d.verdict}</p> : status && <p className={`small-note tone-${status.tone}`}>{status.text}</p>}
      {d.facts.length > 0 && (
        <dl className="cd-facts">
          {d.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.needs.length > 0 && (
        <div className="cd-list needs">
          <h4>{L("İstediklerin", "What you want")}</h4>
          <ul>
            {d.needs.map((n) => (
              <li key={n.key} className={`need ${n.state}`}>
                <i aria-hidden>{NEED_MARK[n.state]}</i> <b>{n.label}:</b> {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.pros.length > 0 && (
        <div className="cd-list pros">
          <h4>{L("Artıları", "Pros")}</h4>
          <ul>
            {d.pros.map((p) => (
              <li key={p.text}>
                {p.text}
                {p.detail && <span className="muted"> · {p.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.cons.length > 0 && (
        <div className="cd-list cons">
          <h4>{L("Dikkat", "Watch out")}</h4>
          <ul>
            {d.cons.map((c) => (
              <li key={c.text} className={c.strong ? "strong" : undefined}>
                {c.text}
                {c.detail && <span className="muted"> · {c.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {reading && <p className={`small-note tone-${reading.tone}`}>{reading.text}</p>}
    </div>
  );
}

function Links({ item, decision, onOpen, onCompare }: { item: Item; decision?: GroupDecision; onOpen: () => void; onCompare?: () => void }) {
  const { url } = datedLink(item, decision);
  return (
    <div className="sc-links">
      {onCompare && (
        <button className="link-btn" onClick={onCompare}>
          {L("Karşılaştır →", "Compare →")}
        </button>
      )}
      <button className="link-btn" onClick={onOpen}>
        {L("Tüm detaylar", "All details")}
      </button>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {L("Tarihlerle aç ↗", "Open with dates ↗")}
        </a>
      ) : (
        item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">
            {L("Sayfayı aç ↗", "Open page ↗")}
          </a>
        )
      )}
    </div>
  );
}

function Price({ price, compact = false, dated }: { price: CardFacts["price"]; compact?: boolean; dated: boolean }) {
  // With its dates known, the price is simply missing: saying it in the chat is enough.
  if (!price) return <span className="muted">{dated ? L("Fiyat yok · sohbette yazabilirsin", "No price · you can type it in the chat") : L("Fiyat yok · tarih seçip tekrar kaydet", "No price · pick dates and save again")}</span>;
  return (
    <span className={`price-block${compact ? " compact" : ""}`}>
      <span className="price-main">
        <b>{price.text}</b>
        {price.label && <span className="muted">{price.label}</span>}
        {price.provisional && <span className="tone-warning">{L("· geçici", "· provisional")}</span>}
      </span>
      {price.perNight && <span className="price-night">{price.perNight}</span>}
      {price.note && <span className="price-note">{price.note}</span>}
    </span>
  );
}

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
export function SwipeCard({ item, group, decision, decisions, ranked, onOpen, onCompare }: CardProps) {
  const [open, setOpen] = useState(false);
  // Shared trip: both travellers said 👎 → it steps back like "Ele" (a vote undoes it).
  const allNo = useShare()?.tally(item).allNo ?? false;
  const facts = cardFacts(item, decision, decisions?.ctx);
  const option = decision?.options.find((o) => o.item.id === item.id);
  const { nights, url: datedUrl } = datedLink(item, decision);
  const fit = option?.fit ?? "fit";
  const currency = decisions?.ctx.currency ?? "EUR";
  const trade = ranked?.trade ?? null;
  const rating = ratingOf(item);
  const meta = [facts.subtitle, rating ? `${rating.value} ${rating.word}${rating.count ? ` · ${rating.count}` : ""}` : null].filter(Boolean).join(" · ");
  const place = ranked?.rank ?? null;

  return (
    <article
      className={`swipe-card opt fit-${fit}${place === 1 ? " first" : ""}${open ? " open" : ""}${allNo ? " all-no" : ""}`}
      aria-label={item.name}
      data-item-id={item.id}
    >
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
            <h3 className="opt-name sc-title">{facts.title}</h3>
            {meta && <div className="opt-meta">{meta}</div>}
            <div className="opt-price sc-price">
              <Price price={facts.price} dated={Boolean(item.dates.start || item.flight?.departure)} />
            </div>
          </div>
          {trade && ranked?.vsRank && (trade.money || trade.gains.length || trade.losses.length) && (
            <p className="opt-trade" title={L(`${trade.vs} ile karşılaştırınca: ${tradeText(trade, currency)}`, `Compared with ${trade.vs}: ${tradeText(trade, currency)}`)}>
              <span className="opt-vs">{L(`${ranked.vsRank}.'ye göre`, `vs #${ranked.vsRank}`)}</span>
              {[
                trade.money && (
                  <b key="m" className={trade.diff != null && trade.diff < 0 ? "cheaper" : ""}>
                    {moneyText(trade, currency)}
                  </b>
                ),
                trade.gains.length > 0 && <span key="g">{trade.gains.join(", ")}</span>,
                trade.losses.length > 0 && (
                  <span key="l" className="opt-loss">
                    {L("eksiği", "lacks")}: {trade.losses.join(", ")}
                  </span>
                ),
              ]
                .filter(Boolean)
                .flatMap((node, i) => (i ? [<span key={`s${i}`} className="sep">{" · "}</span>, node] : [node]))}
            </p>
          )}
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
              <button className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? L("Kapat ▴", "Close ▴") : L("Detaylar ▾", "Details ▾")}
              </button>
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
                <button className="link-btn quiet" onClick={() => void setItemStatus(item, "dismissed")} title={L("Seçeneklerden çıkar; Elenenler'de durur", "Take it out of the options; it stays under Ruled out")}>
                  {L("Ele", "Rule out")}
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

const ratingWords = (): [number, string][] => [
  [9, L("Harika", "Wonderful")],
  [8, L("Çok iyi", "Very good")],
  [7, L("İyi", "Good")],
  [0, L("Fena değil", "Okay")],
];

/** "9,4 · Harika · 1.002 yorum" from the page's rating, on a 10-point scale. */
function ratingOf(item: Item): { value: string; word: string; count: string | null } | null {
  const r = item.rating;
  const ten = ratingOutOf10(item)?.value;
  if (r.value == null || ten == null) return null;
  return {
    value: r.value.toLocaleString(locale(), { maximumFractionDigits: 1 }),
    word: ratingWords().find(([min]) => ten >= min)![1],
    count: r.count ? L(`${r.count.toLocaleString(locale())} yorum`, `${r.count.toLocaleString(locale())} review${r.count === 1 ? "" : "s"}`) : null,
  };
}

const clock = (iso: string | null | undefined) => (iso && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null);
const shortDay = (iso: string | null | undefined) => (iso ? formatDateRange(iso.slice(0, 10), null) : null);

/** A flight (or train) as a route: from, the line with its duration and stops, to. */
function Route({ item, facts }: { item: Item; facts: CardFacts }) {
  const f = item.flight!;
  const m = metricsOf(item);
  const stops = item.category === "flight" && f.stops != null ? (f.stops === 0 ? L("Direkt", "Direct") : L(`${f.stops} aktarma`, `${f.stops} stop${f.stops === 1 ? "" : "s"}`)) : null;
  return (
    <div className="route">
      <div className="route-top">
        <SourceBadge source={facts.source} />
        {item.optionDetail && <span className="fare-badge">{item.optionDetail}</span>}
      </div>
      <div className="route-line">
        <div className="route-end">
          <b className={f.from!.length > 5 ? "long" : ""}>{f.from}</b>
          <span className="muted">{[clock(f.departure), shortDay(f.departure ?? item.dates.start)].filter(Boolean).join(" · ")}</span>
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
          <span className="muted">{[clock(f.arrival), shortDay(f.arrival ?? f.departure ?? item.dates.start)].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    </div>
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
  // Time running out: a free cancellation ending, or a trip near and still not booked.
  const alert = dateAlert(item, decisions?.ctx.today ?? new Date().toISOString().slice(0, 10));
  /** Said in the chat, no page yet: a plan. */
  const planned = item.origin === "chat";
  const route = (item.category === "flight" || item.category === "transport") && Boolean(item.flight?.from && item.flight?.to);
  const toggle = () => setOpen(!open);
  // A tap on the card shows the other options for this need (when there are some to switch to);
  // ⓘ opens the details. Without alternatives, a tap opens the details too.
  const alternatives = onChange && !booked ? Math.max(0, (decision?.options.length ?? 1) - 1) : 0;
  const tap = alternatives ? onChange! : toggle;
  if (isSmall(item)) return <SettledRow item={item} decision={decision} decisions={decisions} onOpen={onOpen} alternatives={alternatives} onChange={onChange} changing={changing} />;
  return (
    <div className={`settled-card st-${booked ? "booked" : "planned"}${open ? " open" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <StatusBar
        standing={booked ? "booked" : "planned"}
        text={booked ? bookedWord(item) : planned ? L("Planlanıyor", "Planning") : L("Seçildi", "Chosen")}
        sub={booked ? null : notBookedWord(item)}
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
        {route ? <Route item={item} facts={facts} /> : <Media item={item} facts={facts} />}
      </div>
      <div className="stc-foot">
        {(facts.price || !planned) && <Price price={facts.price} compact dated={Boolean(item.dates.start || item.flight?.departure) || booked} />}
        <span className="stc-actions">
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
          {alternatives > 0 && (
            <button className="pill-btn outline" aria-expanded={changing} onClick={onChange}>
              {changing ? L("Kapat", "Close") : L(`Diğer ${alternatives} seçenek`, `${alternatives} other option${alternatives === 1 ? "" : "s"}`)}
            </button>
          )}
          {/* A plan said in the chat (a taxi, a ticket to find) comes off the board in one tap. */}
          {planned && !booked && (
            <button className="pill-btn outline quiet" onClick={() => void removeItem(item)} title={L("Bu planı panodan kaldır", "Remove this plan from the board")}
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
                <button className="link-btn" onClick={() => void removeItem(item)}>
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

/**
 * A small thing of the trip (an eSIM, a taxi, insurance) as one line, the way Layla lists them: its
 * icon, what it is and when, where it stands, the price and the one action it needs. A tap opens the details.
 */
function SettledRow({
  item,
  decision,
  decisions,
  onOpen,
  alternatives,
  onChange,
  changing,
}: {
  item: Item;
  decision?: GroupDecision;
  decisions: Decisions | null;
  onOpen: () => void;
  alternatives: number;
  onChange?: () => void;
  changing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const facts = cardFacts(item, decision, decisions?.ctx);
  const booked = item.status === "booked";
  const planned = item.origin === "chat";
  const when = item.flight?.departure && /T\d{2}:\d{2}/.test(item.flight.departure) ? `${shortDay(item.flight.departure)} ${clock(item.flight.departure)}` : shortDay(item.dates.start);
  const sub = [when, facts.source?.label, item.origin === "chat" ? L("sohbette söyledin", "said in the chat") : null].filter(Boolean).join(" · ");
  return (
    <div className={`settled-row st-${booked ? "booked" : "planned"}${open ? " open" : ""}`} aria-label={item.name} data-item-id={item.id}>
      <button className="sr-main" aria-expanded={open} aria-label={L(`${item.name}: detaylar`, `${item.name}: details`)} onClick={() => setOpen(!open)}>
        <span className={`sr-icon cat-${item.category}`} aria-hidden>
          <CategoryIcon category={item.category} size={18} />
        </span>
        <span className="sr-text">
          <b>{item.name}</b>
          {sub && <span className="muted">{sub}</span>}
        </span>
        {facts.price && <span className="sr-price">{facts.price.text}</span>}
        <span className={`sr-chip st-${booked ? "booked" : "planned"}`}>{booked ? `${bookedWord(item)} ✓` : planned ? L("Planlanıyor", "Planning") : L("Seçildi", "Chosen")}</span>
      </button>
      <span className="sr-actions">
        {booked ? (
          <button className="link-btn quiet" onClick={() => void setItemStatus(item, "chosen")} title={L("Rezerve edilmedi olarak geri al", "Mark as not booked")}>
            {L("Geri al", "Undo")}
          </button>
        ) : (
          <button className="pill-btn outline small" onClick={() => void setItemStatus(item, "booked")}>
            {bookAction(item)}
          </button>
        )}
        {alternatives > 0 && (
          <button className="link-btn" aria-expanded={changing} onClick={onChange}>
            {changing ? L("Kapat", "Close") : L(`Diğer ${alternatives}`, `${alternatives} other${alternatives === 1 ? "" : "s"}`)}
          </button>
        )}
        {planned && !booked && (
          <button className="link-btn quiet" onClick={() => void removeItem(item)} aria-label={L(`${item.name}: kaldır`, `${item.name}: remove`)}
            title={L("Bu planı panodan kaldır", "Remove this plan from the board")}
          >
            {L("Kaldır", "Remove")}
          </button>
        )}
      </span>
      {open && (
        <div className="stc-details">
          <Details item={item} decision={decision} decisions={decisions} />
          <div className="sc-links">
            <Links item={item} decision={decision} onOpen={onOpen} />
            {!planned && !booked && (
              <button className="link-btn" onClick={() => void setItemStatus(item, "saved")}>
                {L("Seçimi geri al", "Undo choice")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
