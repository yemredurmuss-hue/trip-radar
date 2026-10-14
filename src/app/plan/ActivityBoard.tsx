// Etkinlik ve turlar as drawn in plan v46 (v40-v41), city by city: each city of the trip is one row of cards (it scrolls
// sideways, four fit), under a heading with its dates and what stands there ("2 planda · 1 bilet alındı · 1 öneri"); a city
// with nothing yet says so and asks the chat ("AI'a arat"). ONE card does for everything: a tour on the plan, a booked
// ticket, a saved idea, the source's offer, a suggestion: the picture with who found it in the corner (a face; booked, the
// green badge), the name (never cut), the source and the time, a price a person (and the total), the source's name as the
// button. In a row: the trip's reason first ("Gezinin sebebi"), then what's bought, what's on the plan, the ideas.
import { lookWord } from "../../lib/stageWords";
import { useEffect, useState, type ReactNode } from "react";
import { cardFacts, durationText } from "../../lib/cardFacts";
import { ticketPrices } from "../../lib/cardTicket";
import { topDate } from "../../lib/cardView";
import { brandOf, type Brand } from "../../lib/brands";
import { catDomKey, citiesOfPlan, EVENT_RANK, eventsByCity, type CatEntry, type CatSection } from "../../lib/categories";
import { entryDomId } from "../../lib/progress";
import { closedNoteOf, reasonItemOf } from "../../lib/reason";
import { playbookOf } from "../../lib/playbooks";
import { L } from "../../lib/i18n";
import { nNights } from "../../lib/i18nText";
import { formatDateRange, formatPrice, isoDate } from "../../lib/items";
import { isAiOption } from "../../lib/pano";
import type { Item, Suggestion } from "../../lib/types";
import { addOffer, chooseItem, setItemPhoto, setItemStatus } from "../actions";
import { needKey } from "../../lib/emptyCards";
import { dealPrice, photoFromOffers, sameTour, type Need, type Offer } from "../../lib/offerSource";
import { sameCity, type Plan } from "../../lib/plan";
import { activityLinks, restLinks } from "../../lib/searchLinks";
import { SearchRow } from "../cards/EmptyCard";
import { BrandPill } from "../cards/RideCard";
import { useEmptyEnv } from "../cards/emptyEnv";
import { BookingSheet } from "../cards/BookingSheet";
import { BookedBadge } from "../cards/BookedBadge";
import { CardMenu, DeleteX } from "../cards/CardShell";
import { DocAccess } from "../cards/DocAccess";
import { datedLink } from "../cards/parts";
import { useCardEnv } from "../cards/PlanCard";
import { useStageMenu } from "../cards/stageMenu";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { Editable, InlineEdit } from "../cards/InlineEdit";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";
import { useSectionSuggest } from "./sectionSuggest";

/** The drawing's picture for a ticket, a tour or a show (static/illus). */
const ACTIVITY_ART = "illus/etkinlik-tur.png";

const recordOf = (e: CatEntry): Item | null => (e.piece.kind === "item" ? e.piece.item : e.piece.kind === "entry" && e.piece.entry.kind === "event" ? e.piece.entry.item : null);
/** On the plan: chosen or booked (an idea is only saved). */
const activityPlanned = (i: Item): boolean => i.status === "chosen" || i.status === "booked";

/** A card of a city's row: where it stands, whose city, and the card itself. */
type Card = { key: string; city: string | null; state: "booked" | "plan" | "idea"; rank: number; node: ReactNode; /** Its day (YYYY-MM-DD), to find the stop of a city the trip passes twice. */ at?: string | null };

export function ActivityBoard({ section, plan, fallback, onAdd }: { section: CatSection; plan: Pick<Plan, "stayBlocks">; fallback: (entry: CatEntry) => ReactNode; /** The toolbar's "Ekle": this section's own kind, no day. */ onAdd?: () => void }) {
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
  // v30: on a trip with a purpose (a festival), its ticket leads its city's row, pinned: "Gezinin sebebi".
  const reason = env.trip ? reasonItemOf(env.trip, planned.map((p) => p.item)) : null;
  const intent = env.trip?.intent ?? null;
  const closedTours = Boolean(intent && playbookOf(intent.playbook, intent.custom).blocked?.sections?.includes("activity"));
  const [open, setOpen] = useRemembered(`trip-radar:ideasOpen:${env.tripId}:activity`, true);
  const count = sugg.length + ideas.length + offers.tiles.length;
  const more = env.ask;
  // After a festival: where the days after it are spent, for its "Festivalden sonra · dinlenme" (a search, never a made-up place).
  const rest = intent?.playbook === "festival" ? restCityOf(plan, reason?.city ?? null) : null;
  const note = closedTours && intent ? closedNoteOf(intent.playbook, Boolean(rest)) : null;
  const myName = useMyName();
  const photoOf = usePhotoOf();

  // Everything that has a card, in the order a tie keeps (what's on the plan, the suggestions, the source's tours, the ideas).
  const card = (key: string, city: string | null, state: Card["state"], node: ReactNode, isReason = false, at: string | null = null): Card => ({ key, city, state, rank: EVENT_RANK[isReason ? "reason" : state], node, at });
  const cards: Card[] = [
    ...planned.map(({ e, item }) => {
      const isReason = item.id === reason?.id;
      return card(e.key, item.city ?? null, item.status === "booked" ? "booked" : "plan", (
        <InlineEdit key={e.key} item={item} only={["name"]}>
          <ItemCard item={item} domId={entryDomId(catDomKey(e))} reason={isReason} />
        </InlineEdit>
      ), isReason, isoDate(item.dates.start));
    }),
    ...sugg.map((x) => card(x.key, x.payload?.city ?? null, "idea", <SuggestCard s={x} note={suggest?.notes[x.key] ?? null} onAdd={() => suggest?.add(x)} onDismiss={() => suggest?.dismiss(x)} />)),
    ...offers.tiles.map(({ o, need, city }) => card(o.id, city, "idea", <OfferCard offer={o} adults={offers.adults} onPut={() => void offers.put(o, need)} />)),
    ...ideas.map(({ e, item }) =>
      card(e.key, item.city ?? null, "idea", (
        <InlineEdit key={e.key} item={item} only={["name"]}>
          <ItemCard item={item} domId={entryDomId(catDomKey(e))} />
        </InlineEdit>
      ), false, isoDate(item.dates.start)),
    ),
  ];
  const cities = citiesOfPlan(plan);
  const groups = eventsByCity(cities, cards);
  const asked = (city: string) => L(`${city} için bilet ya da rezervasyon gerektiren birkaç etkinlik ve tur öner.`, `Suggest a few activities and tours for ${city}, the kind that take a ticket or a booking.`);
  return (
    <div className="ev-wrap">
      {note && <p className="ev-note">{note}</p>}
      {/* v46: the drawing's one line: who found what (left), "Başka öneriler" (the chat looks for more) and "Ekle" (right). */}
      <div className="ev-top">
        <p className="ev-key">
          <span className="ev-who ai" aria-hidden>✨</span>
          {L("AI buldu", "AI found")}
          {myName && (
            <>
              {" · "}
              <span className="ev-who"><WhoAvatar name={myName} photo={photoOf(myName)} /></span>
              {L("siz eklediniz", "you added")}
            </>
          )}
          {more && ` · ${L("Beğenmediğini ↻ ile değiştir.", "Don't like one? Swap it with ↻.")}`}
        </p>
        <span className="ev-sp" />
        {more && (
          <button type="button" className="ev-ghost" onClick={() => more(L("Bu gezi için bilet ya da rezervasyon gerektiren birkaç etkinlik ve tur fikri daha öner.", "Suggest a few more activities and tours for this trip, the kind that take a ticket or a booking."))}>
            ✨ {L("Başka öneriler", "More suggestions")}
          </button>
        )}
        {onAdd && (
          <button type="button" className="ev-ghost ev-add" onClick={onAdd} aria-label={L("Etkinlik ve turlar: ekle", "Activities and tours: add")}>
            <UiIcon name="plus" size={13} />
            {L("Ekle", "Add")}
          </button>
        )}
      </div>
      {/* v11 (kept): what the ideas are, folding away. */}
      <div className={`ev-bar${open ? " open" : ""}`}>
        <button type="button" className="ev-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="ev-chev" aria-hidden>▾</span>
          <b>{L("Öneriler ve fikirler", "Suggestions and ideas")}</b>
          <i>{count}</i>
          <span>{L("bilet ya da rezervasyon gerektirenler", "the ones that take a ticket or a booking")}</span>
        </button>
      </div>
      {!groups.length && <p className="ev-empty">{L("Henüz plana bir şey eklenmedi; “+ Plana koy” ile ekle ya da sohbete yaz.", "Nothing on the plan yet; “+ Add to plan”, or say it in the chat.")}</p>}
      <div className="ev-cities">
        {groups.map((g, gi) => {
          const stay = g.city ? cities[gi] ?? null : null;
          const when = stay ? (isoDate(stay.start) ? formatDateRange(stay.start, stay.end) : stay.nights > 0 ? nNights(stay.nights) : null) : null;
          // The days after the festival belong to the LAST stop of that city (the way in is no rest).
          const afterFest = Boolean(rest && g.city && sameCity(rest, g.city) && gi === lastStopOf(groups, rest));
          const onPlan = g.cards.filter((c) => c.state !== "idea").length;
          const bought = g.cards.filter((c) => c.state === "booked").length;
          const waiting = g.cards.length - onPlan;
          const counts = [
            onPlan > 0 && L(`${onPlan} planda`, `${onPlan} on the plan`),
            bought > 0 && <span key="b" className="ok">{L(`${bought} bilet alındı`, `${bought} ${bought === 1 ? "ticket" : "tickets"} bought`)}</span>,
            waiting > 0 && L(`${waiting} öneri`, `${waiting} ${waiting === 1 ? "suggestion" : "suggestions"}`),
          ].filter(Boolean);
          const nothing = g.cards.length === 0;
          // The ideas folded away still count in the heading; their cards wait.
          const visible = g.cards.filter((c) => open || c.state !== "idea").map((c) => <div key={c.key} className="ev-slot">{c.node}</div>);
          return (
            <section key={g.city ?? "none"} className={`ev-city${nothing ? " empty" : ""}`} aria-label={g.city ?? L("Şehri belli değil", "City not set")}>
              <div className="ev-city-h">
                <UiIcon name="pin" size={14} />
                <b>{g.city ?? L("Şehri belli değil", "City not set")}</b>
                {when && <span>{when}</span>}
                {afterFest && <span className="ev-after">{L("Festivalden sonra · dinlenme", "After the festival · rest")}</span>}
                <span className="ev-n-h">· {counts.length ? counts.flatMap((c, i) => (i ? [" · ", c] : [c])) : L("henüz etkinlik yok", "no activities yet")}</span>
                {nothing && more && g.city && (
                  <button type="button" className="ev-ask" onClick={() => more(asked(g.city!))}>
                    ✨ {L("AI'a arat", "Ask the AI")}
                  </button>
                )}
              </div>
              {visible.length > 0 && <div className="ev-row" data-pit-children="">{visible}</div>}
            </section>
          );
        })}
      </div>
      {others.map((e) => (
        <div key={e.key}>{fallback(e)}</div>
      ))}
      {open && (
        <>
          {rest && (
            <div className="ev-self">
              <p className="ev-self-note">{L("Dinlenmek için kendin bakabilirsin (arama bağlantıları):", "To rest, look yourself (search links):")}</p>
              <div className="ev-self-row">
                <b>{rest}</b>
                <SearchRow links={restLinks(rest)} />
              </div>
            </div>
          )}
          {offers.missing.length > 0 && (
            <div className="ev-self">
              <p className="ev-self-note">
                {offers.available
                  ? L("Bu şehirler için kaynak şu an öneri getirmedi; kendin bakabilirsin:", "The source brought nothing for these cities just now; look yourself:")
                  : L("Canlı tur ve bilet kaynağı bağlı değil; kendin bakabilirsin:", "No live tours-and-tickets source is connected; look yourself:")}
              </p>
              {offers.missing.map((c) => (
                <div key={c.city} className="ev-self-row">
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

/** The index of the last row of a city (a city the trip passes twice has two). */
const lastStopOf = (groups: readonly { city: string | null }[], city: string): number => groups.map((g) => g.city != null && sameCity(g.city, city)).lastIndexOf(true);

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
function useRemembered(key: string, initial: boolean): [boolean, (v: boolean) => void] {
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

/**
 * The one card. What it shows is handed to it; the three small cards under it (a record, the source's offer, a
 * suggestion) only work out what to hand. `state`: booked (green ground, its badge in the corner), plan (on the plan:
 * green line), idea (a dashed button puts it on the plan).
 */
function EventCard({ state, ai = false, label, photo, art, corner, pinned = false, tools, name, meta, price, action, foot, why, note, hit, attrs, domId, hint }: {
  state: "booked" | "plan" | "idea";
  /** Found by us and on the plan: the drawing's violet line (a person's own is green, an idea grey). */
  ai?: boolean;
  label: string;
  photo: string | null;
  art: string;
  /** Who found it (a face), or "Bilet alındı" when bought. */
  corner: ReactNode;
  pinned?: boolean;
  tools?: ReactNode;
  name: ReactNode;
  meta: ReactNode;
  price: { each: string; unit: string; total: string | null } | null;
  action: ReactNode;
  foot?: ReactNode;
  why?: string | null;
  note?: string | null;
  /** A press on the card (its record opens). */
  hit?: () => void;
  attrs?: Record<string, string>;
  domId?: string;
  hint?: string;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className={`ev-card ${state === "plan" ? "chosen" : state}${state === "plan" && ai ? " ai" : ""}`} aria-label={label} id={domId} title={hint} {...attrs}
      onClick={hit ? (e) => !(e.target as HTMLElement).closest("button, a, input, .pk-menu, .pk-ed-wrap") && hit() : undefined}>
      {hit && <button type="button" className="ev-hit" aria-label={label} onClick={hit} />}
      <span className="ev-img">
        <FallbackImg className="ev-photo" src={photo} fallback={<img className="ev-art" src={art} alt="" />} />
        {corner}
        {/* Durum asla yalnız renkle (§2.3-7, S16): a card on the plan, not bought, says Seçildi. */}
        {state === "plan" && <span className="ev-chosen">✓ {lookWord("chosen")}</span>}
        {pinned && (
          <span className="ev-pin">
            <KindIcon kind="activity" size={12} />
            {L("Gezinin sebebi", "The reason for the trip")}
          </span>
        )}
        {tools && <span className="ev-tools" onClick={stop}>{tools}</span>}
      </span>
      <span className="ev-body">
        <b className="ev-n" title={label}>{name}</b>
        {meta}
        {why && <span className="ev-why" title={why}>{why}</span>}
        {note && <span className="ev-why note" role="status">{note}</span>}
        <span className="ev-f" onClick={stop}>
          {price ? (
            <span className="ev-p">
              <span><b>{price.each}</b> {price.unit}</span>
              {price.total && <small>{price.total}</small>}
            </span>
          ) : (
            <span />
          )}
          {action}
        </span>
        {foot && <span className="ev-d" onClick={stop}>{foot}</span>}
      </span>
    </div>
  );
}

/** The source's name and the time, one line: "Viator · 30 dk". */
function Meta({ brand, text }: { brand: Brand | null; text: string | null }) {
  return brand || text ? (
    <span className="ev-s">
      <BrandPill brand={brand} />
      {text && <span title={text}>{text}</span>}
    </span>
  ) : null;
}

/** "+ Plana koy": an idea onto the plan. */
function PutButton({ onPut }: { onPut: () => void }) {
  return (
    <button type="button" className="ev-put" data-put="" onClick={onPut}>
      + {L("Plana koy", "Add to plan")}
    </button>
  );
}

/** The face of whoever found a card, in the picture's corner: ✨ when we did, else the person's own. */
function Who({ name, ai, title }: { name?: string | null; ai?: boolean; title: string }) {
  const photoOf = usePhotoOf();
  if (ai) return <span className="ev-who ai" title={title}><span aria-hidden>✨</span></span>;
  if (!name) return null;
  return (
    <span className="ev-who" title={title}>
      <WhoAvatar name={name} photo={photoOf(name)} />
    </span>
  );
}

/** A record of the trip: a tour or a ticket on the plan, booked or not, or a saved idea. */
function ItemCard({ item, domId, reason = false }: { item: Item; domId: string; reason?: boolean }) {
  const env = useCardEnv();
  const { travellers } = useEmptyEnv();
  const myName = useMyName();
  const stageMenu = useStageMenu(item);
  const [sheet, setSheet] = useState(false);
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const docs = env.docsFor(item.id);
  const booked = item.status === "booked";
  const onPlan = activityPlanned(item);
  const page = datedLink(item, undefined).url ?? item.url;
  const date = topDate(item, "activity");
  const people = item.guests.adults ?? travellers;
  const prices = ticketPrices(item, facts.price);
  const price = prices?.each
    ? { each: prices.each, unit: L("kişi başı", "per person"), total: people && people > 1 ? L(`${people} kişi · ${prices.total}`, `${people} people · ${prices.total}`) : null }
    : facts.price
      ? { each: facts.price.text, unit: facts.price.label ?? "", total: null }
      : null;
  const open = () => (booked ? setSheet(true) : env.onOpenItem(item));
  const who = item.addedBy ?? myName ?? null;
  const siteName = facts.source?.label ?? L("Bilet al", "Get the ticket");
  return (
    <>
      <EventCard
        state={booked ? "booked" : onPlan ? "plan" : "idea"}
        ai={isAiOption(item)}
        label={item.name}
        domId={domId}
        attrs={{ "data-item-id": item.id }}
        hint={item.summary ?? undefined}
        photo={item.imageUrl ?? null}
        art={ACTIVITY_ART}
        pinned={reason}
        corner={booked ? <BookedBadge as="ticket" small /> : <Who name={who} ai={isAiOption(item)} title={isAiOption(item) ? L("AI buldu", "AI found") : L(`${who} ekledi`, `${who} added`)} />}
        hit={open}
        tools={
          <>
            {onPlan && !booked && env.ask && (
              <button type="button" className="ev-tool" aria-label={L(`${item.name}: yerine başkasını öner`, `${item.name}: suggest another`)} title={L("Yerine başkasını öner", "Suggest another in its place")}
                onClick={() => env.ask!(L(`“${item.name}” yerine başka bir etkinlik ya da tur öner.`, `Suggest another activity or tour in place of “${item.name}”.`))}>↻</button>
            )}
            {onPlan && !booked && (
              <button type="button" className="ev-tool got" aria-label={L(`${item.name}: aldım`, `${item.name}: got it`)} title={L("Bileti başka yerden aldıysan işaretle", "Mark it if you bought the ticket elsewhere")} onClick={() => void setItemStatus(item, "booked")}>
                <UiIcon name="check" size={13} />
              </button>
            )}
            <DeleteX name={item.name} onDelete={stageMenu.hide} label={booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")} />
            <CardMenu entries={stageMenu.menu} />
          </>
        }
        name={<Editable field="name">{item.name}</Editable>}
        meta={<Meta brand={onPlan && !booked && page ? null : brandOf(facts.source?.label, facts.source?.host)} text={date} />}
        price={price}
        action={
          !onPlan ? (
            <PutButton onPut={() => void chooseItem(item, [])} />
          ) : booked ? null : page ? (
            <a className="ev-go" href={page} target="_blank" rel="noreferrer" aria-label={L(`Bilet al: ${siteName}`, `Get the ticket: ${siteName}`)} title={L(`${siteName} sitesinde bilet al`, `Get the ticket on ${siteName}`)}>
              {facts.source?.host && <FallbackImg className="sc-favicon" src={`https://${facts.source.host}/favicon.ico`} fallback={null} />}
              {siteName} ↗
            </a>
          ) : null
        }
        foot={
          booked ? (
            <>
              <DocAccess item={item} docs={docs} />
              <span className="ev-sp" />
              <button type="button" className="ev-detail" onClick={() => setSheet(true)}>{L("Ayrıntı", "Details")} ›</button>
            </>
          ) : onPlan ? (
            <DocAccess item={item} docs={docs} />
          ) : null
        }
      />
      {stageMenu.field}
      {sheet && (
        <BookingSheet item={item} kind="activity" facts={facts} docs={docs} date={date}
          onChange={stageMenu.change} onCancel={stageMenu.cancel} onUnbook={() => void setItemStatus(item, "chosen")} onDetails={() => env.onOpenItem(item)} onClose={() => setSheet(false)} />
      )}
    </>
  );
}

/** What the source offers for a city (Viator): its page on the name, the price a person, "+ Plana koy". */
function OfferCard({ offer: o, adults, onPut }: { offer: Offer; adults: number | null; onPut: () => void }) {
  const deal = dealPrice(o, adults);
  const per = deal && adults && adults > 1 ? deal.amount / adults : deal?.amount ?? null;
  const currency = o.currency ?? "EUR";
  const meta = o.durationMinutes ? durationText(o.durationMinutes) : o.meta;
  return (
    <EventCard
      state="idea"
      label={o.title}
      attrs={{ "data-offer": o.id }}
      hint={o.why || undefined}
      photo={o.photo ?? null}
      art={ACTIVITY_ART}
      corner={<Who ai title={L("Kaynaktan öneri", "From the source")} />}
      name={<a href={o.url} target="_blank" rel="noreferrer" className="ev-link">{o.title}</a>}
      meta={<Meta brand={brandOf(o.source, null)} text={meta ?? null} />}
      price={per != null ? { each: formatPrice(Math.round(per), currency), unit: L("kişi başı", "per person"), total: adults && adults > 1 ? L(`${adults} kişi · ${formatPrice(Math.round(per * adults), currency)}`, `${adults} people · ${formatPrice(Math.round(per * adults), currency)}`) : null } : null}
      action={<PutButton onPut={onPut} />}
    />
  );
}

/** A suggestion (the chat's, a rule's) among a city's ideas: ✨, its name, why, "+ Plana koy", ×. */
function SuggestCard({ s, note, onAdd, onDismiss }: { s: Suggestion; note: string | null; onAdd: () => void; onDismiss: () => void }) {
  return (
    <EventCard
      state="idea"
      label={s.title}
      attrs={{ "data-suggestion": s.key }}
      photo={null}
      art={ACTIVITY_ART}
      corner={<Who ai title={L("Öneri", "Suggestion")} />}
      tools={<DeleteX name={s.title} onDelete={onDismiss} label={L("Gerek yok", "Not needed")} />}
      name={s.title}
      meta={null}
      why={s.why}
      note={note}
      price={null}
      action={s.kind === "add" ? <PutButton onPut={onAdd} /> : null}
    />
  );
}

/** A suggestion as a tile among the ideas of Yapılacak şeyler (ideas/IdeaTiles): ✨, its kind in the corner, why, "+ Plana ekle", ×. */
export function SuggestTile({ s, note, onAdd, onDismiss, art, tag }: { s: Suggestion; note: string | null; onAdd: () => void; onDismiss: () => void; art: string; /** What it is, in the picture's corner ("Restoran", "Gezilecek"). */ tag: string }) {
  return (
    <div className="it-tile ac-tile ac-sugg" aria-label={s.title} data-suggestion={s.key}>
      <div className="it-pic ac-tile-pic">
        <img className="ac-art" src={art} alt="" />
        <span className="it-kindtag">{tag}</span>
        <span className="it-who" title={L("Öneri", "Suggestion")}><span className="it-ai">✨</span></span>
        <span className="it-tools">
          <DeleteX name={s.title} onDelete={onDismiss} label={L("Gerek yok", "Not needed")} className="it-x" />
        </span>
        {s.kind === "add" && <button type="button" className="it-put corner" data-put="" aria-label={L("Plana ekle", "Add to the plan")} title={L("Plana ekle", "Add to the plan")} onClick={onAdd}>+ {L("Plana ekle", "Add to the plan")}</button>}
      </div>
      <b className="it-t ac-t" title={s.title}>{s.title}</b>
      {s.payload?.city && <span className="it-m ac-m">{s.payload.city}</span>}
      {s.why && <span className="it-m ac-why" title={s.why}>{s.why}</span>}
      {note && <span className="it-m ac-note" role="status">{note}</span>}
    </div>
  );
}

const PER_CITY = 4;

/**
 * v11 (Emre, 2026-10-09: "kaynaklarımızdan, API'lerden gerçek öneri olarak çıkmasını bekliyorduk"): each city's tours
 * and tickets from the connected source (Viator), for the cities' rows: "+ Plana koy" puts one on the plan at once.
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
