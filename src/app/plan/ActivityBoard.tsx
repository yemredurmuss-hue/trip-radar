// Etkinlik ve turlar as drawn in plan v30 (docs/mockups/plan-v30, "Etkinlik ve turlar"): ONE grid of cards of one size.
// Each: a square picture (the source's photo, else the drawing), the name (two lines at most), the source's label on its
// own colour and the city, one price (for how many). What's on the plan has a ✓ in its corner (one press takes it off the
// plan, to the Pano) and its strip, "✓ Bilet aldım" and "Bilet al ↗" side by side; booked: "✓ Bilet alındı", its file
// (or "Belge eksik") and "Ayrıntı ›", the card opening the booking's window. The ideas and the suggestions are dashed
// with a + in the corner and "Plana ekle" (the chat looks for more: "Daha fazla fikir"). On a trip with a purpose its
// ticket leads, wide ("Gezinin sebebi"). Whatever isn't one record (a group of options) keeps its card after them.
import { useEffect, useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { ringOf, topDate } from "../../lib/cardView";
import { brandOf, type Brand } from "../../lib/brands";
import { catDomKey, type CatEntry, type CatSection } from "../../lib/categories";
import { entryDomId } from "../../lib/progress";
import { closedNoteOf, reasonItemOf } from "../../lib/reason";
import { playbookOf } from "../../lib/playbooks";
import { L } from "../../lib/i18n";
import { isAiOption } from "../../lib/pano";
import type { Item } from "../../lib/types";
import { addOffer, chooseItem, setItemPhoto, setItemStatus } from "../actions";
import { durationText } from "../../lib/cardFacts";
import { needKey } from "../../lib/emptyCards";
import { formatPrice } from "../../lib/items";
import { dealPrice, photoFromOffers, sameTour, type Need, type Offer } from "../../lib/offerSource";
import { sameCity, type Plan } from "../../lib/plan";
import { activityLinks, restLinks } from "../../lib/searchLinks";
import { SearchRow } from "../cards/EmptyCard";
import { BrandPill } from "../cards/RideCard";
import { useEmptyEnv } from "../cards/emptyEnv";
import { BookingSheet } from "../cards/BookingSheet";
import { BookedBadge } from "../cards/BookedBadge";
import { CardMenu, DeleteX, Ring } from "../cards/CardShell";
import { DocAccess } from "../cards/DocAccess";
import { datedLink } from "../cards/parts";
import { useCardEnv } from "../cards/PlanCard";
import { useStageMenu } from "../cards/stageMenu";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { Editable, InlineEdit, useInlineEdit } from "../cards/InlineEdit";
import { KindIcon } from "../cards/Silhouettes";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";
import type { Suggestion } from "../../lib/types";
import { useSectionSuggest } from "./sectionSuggest";

/** The drawing's picture for a ticket, a tour or a show (static/illus). */
export const ACTIVITY_ART = "illus/etkinlik-tur.png";

const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);
/** On the plan: chosen or booked (an idea is only saved). */
export const activityPlanned = (i: Item): boolean => i.status === "chosen" || i.status === "booked";

export function ActivityBoard({ section, plan, fallback }: { section: CatSection; plan: Pick<Plan, "stayBlocks">; fallback: (entry: CatEntry) => ReactNode }) {
  const env = useCardEnv();
  const suggest = useSectionSuggest();
  const rows = section.entries.map((e) => ({ e, item: recordOf(e) }));
  const records = rows.filter((r): r is { e: CatEntry; item: Item } => r.item != null);
  const planned = records.filter((r) => activityPlanned(r.item));
  const ideas = records.filter((r) => !activityPlanned(r.item));
  const others = rows.filter((r) => r.item == null).map((r) => r.e);
  const offers = useActivityOffers(plan, records.map((r) => r.item));
  // A tour the chat put on the plan is made from its words, with no photo; the source's offer of the same tour has one:
  // it's kept on the record (the Plan, the Pano and its details show it).
  const missingPhotos = records.filter((r) => !r.item.imageUrl).map((r) => r.item);
  useEffect(() => {
    for (const item of missingPhotos) {
      const photo = photoFromOffers(item, offers.all);
      if (photo) void setItemPhoto(item.id, photo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the offers or the records without a photo change
  }, [offers.all.length, missingPhotos.map((i) => i.id).join(" ")]);
  const sugg = suggest?.list ?? [];
  // v30: on a trip with a purpose (a festival), its ticket leads the section, pinned: "Gezinin sebebi".
  const reason = env.trip ? reasonItemOf(env.trip, planned.map((p) => p.item)) : null;
  const reasonRow = reason ? (planned.find((p) => p.item.id === reason.id) ?? null) : null;
  const restPlanned = reasonRow ? planned.filter((p) => p !== reasonRow) : planned;
  const intent = env.trip?.intent ?? null;
  const closedTours = Boolean(intent && playbookOf(intent.playbook, intent.custom).blocked?.sections?.includes("activity"));
  const [open, setOpen] = useRemembered(`trip-radar:ideasOpen:${env.tripId}:activity`, true);
  const count = sugg.length + ideas.length + offers.tiles.length;
  const more = env.ask;
  // After a festival: where the days after it are spent, for its "Festivalden sonra · dinlenme" (a search, never a made-up place).
  const rest = intent?.playbook === "festival" ? restCityOf(plan, reason?.city ?? null) : null;
  const note = closedTours && intent ? closedNoteOf(intent.playbook, Boolean(rest)) : null;
  const gridCount = restPlanned.length + (open ? count : 0);
  return (
    <div className="ac-wrap ac-one">
      {/* The trip's reason, wide and pinned: the ticket the trip is for. */}
      {reasonRow && (
        <div className="ac-reason">
          <span className="ac-reason-tag">
            <KindIcon kind="activity" size={14} />
            {L("Gezinin sebebi", "The reason for the trip")}
          </span>
          <InlineEdit key={reasonRow.e.key} item={reasonRow.item} only={["name"]}>
            <ActivityRow item={reasonRow.item} domId={entryDomId(catDomKey(reasonRow.e))} />
          </InlineEdit>
        </div>
      )}
      {note && <p className="ac-type-note">{note}</p>}
      {/* v11 (kept): what the ideas are, folding away, and "Daha fazla fikir" (the chat looks for more). */}
      <div className={`ac-ideas-h ac-bar${open ? " open" : ""}`}>
        <button type="button" className="ac-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="ac-chev" aria-hidden>▾</span>
          <b>{L("Öneriler ve fikirler", "Suggestions and ideas")}</b>
          <i>{count}</i>
          <span>{L("bilet ya da rezervasyon gerektirenler", "the ones that take a ticket or a booking")}</span>
        </button>
        <span className="ac-sp" />
        {more && (
          <button type="button" className="ac-more" onClick={() => more(L("Bu gezi için bilet ya da rezervasyon gerektiren birkaç etkinlik ve tur fikri daha öner.", "Suggest a few more activities and tours for this trip, the kind that take a ticket or a booking."))}>
            ✨ {L("Daha fazla fikir", "More ideas")}
          </button>
        )}
      </div>
      <p className="it-key ac-key">
        <span className="it-key-on">✓</span>
        {L("planda", "on the plan")}
        <span className="it-key-add">+</span>
        {L("öneri, basınca plana girer", "an idea, one tap puts it on the plan")}
      </p>
      {!planned.length && count === 0 && <p className="ac-empty-note">{L("Henüz plana bir şey eklenmedi; “+ Plana ekle” ile ekle ya da sohbete yaz.", "Nothing on the plan yet; “+ Add to the plan”, or say it in the chat.")}</p>}
      {rest && gridCount > 0 && <h4 className="ac-sub">{L("Festivalden sonra · dinlenme", "After the festival · rest")}</h4>}
      {gridCount > 0 && (
        <div className="it-grid ax-grid ac-shelf" data-pit-children="">
          {/* What's on the plan first (✓, solid); then the ideas and the suggestions (dashed, +). */}
          {restPlanned.map(({ e, item }) => (
            <InlineEdit key={e.key} item={item} only={["name"]}>
              <ActivityCard item={item} domId={entryDomId(catDomKey(e))} />
            </InlineEdit>
          ))}
          {open && (
            <>
              {sugg.map((x) => (
                <SuggestTile key={x.key} s={x} note={suggest?.notes[x.key] ?? null} onAdd={() => suggest?.add(x)} onDismiss={() => suggest?.dismiss(x)} />
              ))}
              {offers.tiles.map(({ o, need, city }) => (
                <OfferTile key={o.id} offer={o} city={city} adults={offers.adults} onPut={() => void offers.put(o, need)} />
              ))}
              {ideas.map(({ e, item }) => (
                <InlineEdit key={e.key} item={item} only={["name"]}>
                  <ActivityTile item={item} domId={entryDomId(catDomKey(e))} />
                </InlineEdit>
              ))}
            </>
          )}
        </div>
      )}
      {others.map((e) => (
        <div key={e.key} className="ac-other">{fallback(e)}</div>
      ))}
      {open && (
        <>
          {rest && (
            <div className="ac-self ac-rest">
              <p className="ac-self-note">{L("Dinlenmek için kendin bakabilirsin (arama bağlantıları):", "To rest, look yourself (search links):")}</p>
              <div className="ac-self-row">
                <b>{rest}</b>
                <SearchRow links={restLinks(rest)} />
              </div>
            </div>
          )}
          {offers.missing.length > 0 && (
            <div className="ac-self">
              <p className="ac-self-note">
                {offers.available
                  ? L("Bu şehirler için kaynak şu an öneri getirmedi; kendin bakabilirsin:", "The source brought nothing for these cities just now; look yourself:")
                  : L("Canlı tur ve bilet kaynağı bağlı değil; kendin bakabilirsin:", "No live tours-and-tickets source is connected; look yourself:")}
              </p>
              {offers.missing.map((c) => (
                <div key={c.city} className="ac-self-row">
                  <b>{c.city}</b>
                  <SearchRow links={activityLinks(c.city)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The city the days after a festival are spent in (the last stop that isn't the festival's own place), or null. */
export function restCityOf(plan: Pick<Plan, "stayBlocks">, festivalPlace: string | null): string | null {
  const cities = citiesOfPlan(plan);
  const at = festivalPlace ? cities.findIndex((c) => sameCity(c.city, festivalPlace)) : -1;
  // The stops after the festival's own place count (the way in is no rest); not knowing it, any stop after the first.
  const last = cities.at(-1);
  if (!last || cities.length < 2) return null;
  return at >= 0 ? (cities.length - 1 > at ? last.city : null) : festivalPlace ? null : last.city;
}

/** A per-viewer open/closed state kept in the browser (nothing else depends on it). */
export function useRemembered(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try {
      const got = localStorage.getItem(key);
      return got == null ? initial : got === "1";
    } catch {
      return initial;
    }
  });
  return [
    v,
    (next) => {
      setV(next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // kept for this view only
      }
    },
  ];
}

/** Who a card is from, on the picture's corner: ✨ "Önerimiz" (ours), "Sabine ekledi" (a person), "✓ Bilet alındı" (booked). */
function WhoTag({ item, booked = false }: { item: Item; booked?: boolean }) {
  const myName = useMyName();
  const photoOf = usePhotoOf();
  if (booked) return <BookedBadge as="ticket" small />;
  if (isAiOption(item)) return <span className="ax-tag" title={L("AI önerisi", "AI pick")}><span aria-hidden>✨</span> {L("Önerimiz", "Our pick")}</span>;
  const who = item.addedBy ?? myName ?? null;
  if (!who) return null;
  return (
    <span className="ax-tag" title={who}>
      <WhoAvatar name={who} photo={photoOf(who)} /> {L(`${who} ekledi`, `${who} added`)}
    </span>
  );
}

/** A name on a card: two lines at most, the whole of it on hover. */
const nameProps = (name: string) => ({ title: name });

/** The brand's label (the source's own colour) and the place, one line: "Viator · Kyoto · 30 dk". */
function MetaLine({ brand, parts }: { brand: Brand | null; parts: (string | null | undefined)[] }) {
  const text = parts.filter(Boolean).join(" · ");
  return (
    <span className="ac-m it-m ax-meta">
      <BrandPill brand={brand} />
      {text && <span className="ax-where" title={text}>{text}</span>}
    </span>
  );
}

/** A suggestion (the chat's, a rule's) as a card among the ideas: ✨, its name, why, "+ Plana ekle", ×. */
export function SuggestTile({ s, note, onAdd, onDismiss, art = ACTIVITY_ART, tag = null }: { s: Suggestion; note: string | null; onAdd: () => void; onDismiss: () => void; art?: string; /** What it is, in the picture's corner ("Restoran", "Gezilecek"). */ tag?: string | null }) {
  return (
    <div className="it-tile ac-tile ac-sugg ax-c ax-idea" aria-label={s.title} data-suggestion={s.key}>
      <div className="it-pic ac-tile-pic ax-sq">
        <img className="ac-art" src={art} alt="" />
        {tag ? <span className="it-kindtag">{tag}</span> : <span className="ax-tag" title={L("Öneri", "Suggestion")}><span aria-hidden>✨</span> {L("Önerimiz", "Our pick")}</span>}
        {tag && <span className="it-who" title={L("Öneri", "Suggestion")}><span className="it-ai">✨</span></span>}
        <span className="it-tools ax-tools">
          <DeleteX name={s.title} onDelete={onDismiss} label={L("Gerek yok", "Not needed")} className="it-x" />
        </span>
        {s.kind === "add" && <button type="button" className="it-put corner" data-put="" aria-label={L("Plana ekle", "Add to the plan")} title={L("Plana ekle", "Add to the plan")} onClick={onAdd}>+ {L("Plana ekle", "Add to the plan")}</button>}
      </div>
      <b className="it-t ac-t" {...nameProps(s.title)}>{s.title}</b>
      <MetaLine brand={null} parts={[s.payload?.city]} />
      {s.why && <span className="it-m ac-why ax-why" title={s.why}>{s.why}</span>}
      {note && <span className="it-m ac-note" role="status">{note}</span>}
      {!tag && s.kind === "add" && (
        <div className="ax-foot ax-foot-idea">
          <button type="button" className="ax-add" data-put="" onClick={onAdd}>+ {L("Plana ekle", "Add to the plan")}</button>
        </div>
      )}
    </div>
  );
}

/**
 * A tour or a ticket on the plan as its card (Emre 2026-10-09: the photo got lost and the look got worse once on the
 * plan): the photo kept big on the left, the name, its ring, day, city and source, what to do next under them; the
 * price a person (and the total) to the right, as on its tile.
 */
function ActivityRow({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const { travellers } = useEmptyEnv();
  const stageMenu = useStageMenu(item);
  const [sheet, setSheet] = useState(false);
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const docs = env.docsFor(item.id);
  const booked = item.status === "booked";
  const page = datedLink(item, undefined).url ?? item.url;
  const date = topDate(item, "activity");
  const people = item.guests.adults ?? travellers;
  const amount = item.price.amount;
  const perHead = amount != null && amount > 0 && people && people > 1 ? formatPrice(Math.round(amount / people), item.price.currency ?? "EUR") : null;
  const open = () => (booked ? setSheet(true) : env.onOpenItem(item));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className={`ac-row${booked ? " booked" : " chosen"}${item.imageUrl ? " has-photo" : ""}`} aria-label={item.name} data-item-id={item.id} id={domId}
      onClick={(e) => !(e.target as HTMLElement).closest("button, a, input, .pk-menu, .pk-ed-wrap") && open()}>
      {/* The row opens from one real button laid behind its controls: no button or link sits inside another one. */}
      <button type="button" className="ac-hit" aria-label={item.name} onClick={open} />
      <span className="ac-photo">
        <FallbackImg className="ac-pic" src={item.imageUrl ?? null} fallback={<img className="ac-pic art" src={ACTIVITY_ART} alt="" />} />
      </span>
      <span className="ac-main">
        <b className="ac-t" title={item.name}>
          <Editable field="name">{item.name}</Editable>
        </b>
        <span className="ac-m">
          <Ring state={ringOf(item)} />
          {[date, item.city].filter(Boolean).join(" · ")}
          {facts.source && <span className="ac-src">· {facts.source.label}</span>}
        </span>
        <span className="ac-acts" onClick={stop}>
          {booked ? (
            <>
              <BookedBadge as="ticket" small />
              <DocAccess item={item} docs={docs} />
              <button type="button" className="ac-detail" onClick={() => setSheet(true)}>{L("Ayrıntı", "Details")} ›</button>
            </>
          ) : (
            <>
              <button type="button" className="pk-aldim" aria-label={L(`${item.name}: aldım`, `${item.name}: got it`)} onClick={() => void setItemStatus(item, "booked")}>
                ✓ {L("Bilet aldım", "I got the ticket")}
              </button>
              {page && (
                <a className="ac-go" href={page} target="_blank" rel="noreferrer">
                  {facts.source?.host && <FallbackImg className="sc-favicon" src={`https://${facts.source.host}/favicon.ico`} fallback={null} />}
                  {L("Bilet al ↗", "Get the ticket ↗")}
                </a>
              )}
              <DocAccess item={item} docs={docs} />
            </>
          )}
        </span>
      </span>
      <span className="ac-side" onClick={stop}>
        <span className="ac-tools">
          <DeleteX name={item.name} onDelete={stageMenu.hide} label={booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")} className="ac-x" />
          <CardMenu entries={stageMenu.menu} />
        </span>
        {facts.price && (
          <span className="ac-price-big">
            {/* v30: one price, the whole of it, and for how many. */}
            <b>{facts.price.text}</b>
            <small>{perHead && people ? L(`${people} kişi`, `${people} people`) : facts.price.label}</small>
          </span>
        )}
      </span>
      {stageMenu.field}
      {sheet && (
        <BookingSheet item={item} kind="activity" facts={facts} docs={docs} date={date}
          onChange={stageMenu.change} onCancel={stageMenu.cancel} onUnbook={() => void setItemStatus(item, "chosen")} onDetails={() => env.onOpenItem(item)} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}

/** An idea (saved, not on the plan): the card dashed, a + in the corner, "Plana ekle" under it. */
function ActivityTile({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const stageMenu = useStageMenu(item);
  const { travellers } = useEmptyEnv();
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const edit = useInlineEdit();
  const people = item.guests.adults ?? travellers;
  const put = () => void chooseItem(item, []);
  return (
    <div className="it-tile ac-tile ax-c ax-idea" aria-label={item.name} data-item-id={item.id} id={domId} title={item.summary ?? undefined}>
      <div className="it-pic ac-tile-pic ax-sq">
        <FallbackImg className="it-photo" src={item.imageUrl ?? null} fallback={<img className="ac-art" src={ACTIVITY_ART} alt="" />} />
        <WhoTag item={item} />
        <span className="it-tools ax-tools">
          <DeleteX name={item.name} onDelete={stageMenu.hide} label={L("Gerek yok", "Not needed")} className="it-x" />
          <CardMenu entries={stageMenu.menu} />
        </span>
        <button type="button" className="it-put corner" data-put="" aria-label={L("Plana ekle", "Add to the plan")} title={L("Plana ekle", "Add to the plan")} onClick={put}>+ {L("Plana ekle", "Add to the plan")}</button>
      </div>
      <b className="it-t ac-t" {...nameProps(item.name)}>
        {edit?.open === "name" ? (
          <Editable field="name">{item.name}</Editable>
        ) : (
          <button type="button" className="ac-name" onClick={() => env.onOpenItem(item)}>{item.name}</button>
        )}
      </b>
      <MetaLine brand={brandOf(facts.source?.label, facts.source?.host)} parts={[item.city]} />
      <span className="ax-price">{facts.price ? <><b>{facts.price.text}</b><small>{people && people > 1 ? L(`${people} kişi`, `${people} people`) : facts.price.label}</small></> : null}</span>
      <div className="ax-foot ax-foot-idea">
        <button type="button" className="ax-add" data-put="" onClick={put}>+ {L("Plana ekle", "Add to the plan")}</button>
      </div>
      {stageMenu.field}
    </div>
  );
}

/**
 * A tour or a ticket on the plan (chosen or booked) as the drawing's card: the square picture with a ✓ in the corner (one
 * press takes it off the plan, to the Pano), the name, the source's label and the city, one price (for how many); its strip,
 * "✓ Bilet aldım" and "Bilet al ↗" side by side, or, booked, "✓ Bilet alındı", its file and "Ayrıntı ›".
 */
function ActivityCard({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const { travellers } = useEmptyEnv();
  const stageMenu = useStageMenu(item);
  const [sheet, setSheet] = useState(false);
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const docs = env.docsFor(item.id);
  const booked = item.status === "booked";
  const page = datedLink(item, undefined).url ?? item.url;
  const date = topDate(item, "activity");
  const people = item.guests.adults ?? travellers;
  const open = () => (booked ? setSheet(true) : env.onOpenItem(item));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className={`ac-row ax-c ax-on${booked ? " booked" : " chosen"}`} aria-label={item.name} data-item-id={item.id} id={domId}
      onClick={(e) => !(e.target as HTMLElement).closest("button, a, input, .pk-menu, .pk-ed-wrap") && open()}>
      <button type="button" className="ac-hit" aria-label={item.name} onClick={open} />
      <span className="ax-sq ac-photo">
        <FallbackImg className="ac-pic" src={item.imageUrl ?? null} fallback={<img className="ac-pic art" src={ACTIVITY_ART} alt="" />} />
        <WhoTag item={item} booked={booked} />
        <span className="ax-tools" onClick={stop}>
          <DeleteX name={item.name} onDelete={stageMenu.hide} label={booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")} className="ac-x" />
          <CardMenu entries={stageMenu.menu} />
        </span>
        {booked ? (
          <span className="ax-tick on" aria-hidden>✓</span>
        ) : (
          <button type="button" className="ax-tick on" aria-label={L(`${item.name}: plandan çıkar`, `${item.name}: take off the plan`)} title={L("Planda · çıkarınca Pano'ya gider", "On the plan · taking it off sends it to the Board")}
            onClick={(e) => { stop(e); void setItemStatus(item, "saved"); }}>✓</button>
        )}
      </span>
      <b className="ac-t" {...nameProps(item.name)}>
        <Editable field="name">{item.name}</Editable>
      </b>
      <MetaLine brand={brandOf(facts.source?.label, facts.source?.host)} parts={[item.city, date]} />
      <span className="ax-price">
        {facts.price ? <><b>{facts.price.text}</b><small>{people && people > 1 ? L(`${people} kişi`, `${people} people`) : facts.price.label}</small></> : null}
      </span>
      <div className="ax-foot ac-acts" onClick={stop}>
        {booked ? (
          <>
            <DocAccess item={item} docs={docs} />
            <button type="button" className="ac-detail" onClick={() => setSheet(true)}>{L("Ayrıntı", "Details")} ›</button>
          </>
        ) : (
          <>
            <button type="button" className="pk-aldim" aria-label={L(`${item.name}: aldım`, `${item.name}: got it`)} onClick={() => void setItemStatus(item, "booked")}>
              ✓ {L("Bilet aldım", "I got the ticket")}
            </button>
            {page && (
              <a className="ac-go" href={page} target="_blank" rel="noreferrer">
                {facts.source?.host && <FallbackImg className="sc-favicon" src={`https://${facts.source.host}/favicon.ico`} fallback={null} />}
                {L("Bilet al ↗", "Get the ticket ↗")}
              </a>
            )}
            <DocAccess item={item} docs={docs} />
          </>
        )}
      </div>
      {stageMenu.field}
      {sheet && (
        <BookingSheet item={item} kind="activity" facts={facts} docs={docs} date={date}
          onChange={stageMenu.change} onCancel={stageMenu.cancel} onUnbook={() => void setItemStatus(item, "chosen")} onDetails={() => env.onOpenItem(item)} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}

/** The trip's cities in order, a city's nights side by side as one (where to look for its tours and tickets). */
export function citiesOfPlan(plan: Pick<Plan, "stayBlocks">): { city: string; start: string; end: string }[] {
  const out: { city: string; start: string; end: string }[] = [];
  for (const b of plan.stayBlocks) {
    const city = b.city ?? (b.kind !== "open" ? b.item.city : null);
    if (!city) continue;
    const last = out.at(-1);
    if (last && sameCity(last.city, city)) last.end = b.range.end;
    else out.push({ city, start: b.range.start, end: b.range.end });
  }
  return out;
}

const PER_CITY = 4;

/**
 * v11 (Emre, 2026-10-09: "kaynaklarımızdan, API'lerden gerçek öneri olarak çıkmasını bekliyorduk"): each city's tours
 * and tickets from the connected source (Viator), for the shelf's tiles — "+ Plana ekle" puts one on the plan at once.
 * Nothing is made up: the cities the source brought nothing for are listed for their own searches ("Kendin ara").
 */
function useActivityOffers(plan: Pick<Plan, "stayBlocks">, saved: Item[]) {
  const { offers: source, tripId, travellers } = useEmptyEnv();
  const cities = citiesOfPlan(plan);
  const key = cities.map((c) => `${c.city}:${c.start}`).join("|");
  const available = source.available();
  const [byCity, setByCity] = useState<Record<string, { need: Need; offers: Offer[] } | "none">>({});
  const [taken, setTaken] = useState<string[]>([]);
  useEffect(() => {
    if (!available) return;
    let live = true;
    for (const c of cities) {
      const need: Need = { key: needKey("activity", c.city, c.start, c.end), section: "activity", kind: "activity", city: c.city, start: c.start, end: c.end, adults: travellers };
      source.offers(need).then(
        (list) => live && setByCity((m) => ({ ...m, [c.city]: list.length ? { need, offers: list.filter((o) => o.kind === "activity") } : "none" })),
        () => live && setByCity((m) => ({ ...m, [c.city]: "none" })),
      );
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only for other cities
  }, [available, source, key]);
  const pages = new Set(saved.map((i) => i.url).filter(Boolean));
  const tiles = cities.flatMap((c) => {
    const got = byCity[c.city];
    // Not one that's saved already (its page, or the same tour by name: one the chat put on the plan).
    return got && got !== "none" ? got.offers.filter((o) => !pages.has(o.url) && !taken.includes(o.id) && !saved.some((i) => sameTour(i, o))).slice(0, PER_CITY).map((o) => ({ o, need: got.need, city: c.city })) : [];
  });
  const missing = cities.filter((c) => !available || byCity[c.city] === "none");
  const put = async (o: Offer, need: Need) => {
    setTaken((t) => [...t, o.id]);
    const item = await addOffer(tripId, o, need);
    await chooseItem(item, []);
  };
  const all = Object.values(byCity).flatMap((x) => (x === "none" ? [] : x.offers));
  return { tiles, missing, available, put, adults: travellers, all };
}

function OfferTile({ offer: o, city, adults, onPut }: { offer: Offer; city: string; adults: number | null; onPut: () => void }) {
  const deal = dealPrice(o, adults);
  const per = deal && adults && adults > 1 ? deal.amount / adults : deal?.amount ?? null;
  const meta = [city, o.durationMinutes ? durationText(o.durationMinutes) : o.meta].filter(Boolean).join(" · ");
  return (
    <div className="it-tile ac-tile ac-offer ax-c ax-idea" aria-label={o.title} data-offer={o.id} title={o.why || undefined}>
      <div className="it-pic ac-tile-pic ax-sq">
        <FallbackImg className="it-photo" src={o.photo ?? null} fallback={<img className="ac-art" src={ACTIVITY_ART} alt="" />} />
        <span className="ax-tag" title={L("Kaynaktan öneri", "From the source")}><span aria-hidden>✨</span> {L("Önerimiz", "Our pick")}</span>
        <button type="button" className="it-put corner" data-put="" aria-label={L("Plana ekle", "Add to the plan")} title={L("Plana ekle", "Add to the plan")} onClick={onPut}>+ {L("Plana ekle", "Add to the plan")}</button>
      </div>
      <b className="it-t ac-t" {...nameProps(o.title)}>
        <a href={o.url} target="_blank" rel="noreferrer" className="ac-name">{o.title}</a>
      </b>
      <MetaLine brand={brandOf(o.source, null)} parts={[meta]} />
      <span className="ax-price">{per != null ? <span className="ac-pp"><b>{formatPrice(Math.round(per), o.currency ?? "EUR")}</b> <small>{L("kişi başı", "per person")}</small></span> : null}</span>
      <div className="ax-foot ax-foot-idea">
        <button type="button" className="ax-add" data-put="" onClick={onPut}>+ {L("Plana ekle", "Add to the plan")}</button>
      </div>
    </div>
  );
}
