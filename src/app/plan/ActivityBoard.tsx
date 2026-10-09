// Etkinlik ve turlar as drawn in v11 (docs/mockups/2026-10-08-japonya-web-v11.html, expBody): what's on the plan
// is a row — the picture, the name, its ring, day, city, source and price; chosen: "✓ Aldım" and "Bilet al ↗";
// booked: "✓ Bilet alındı", its file (or "Belge eksik") and "Ayrıntı ›", the row opening the booking's window;
// × on each. Under them "Fikirler · bilet ya da rezervasyon gerektirenler" with "Daha fazla fikir" (the chat
// looks for more), and the ideas as tiles like Yapılacak şeyler's: the picture, who saved it, ×, the name, city,
// source and price, "+ Plana koy". Whatever isn't one record (a group of options) keeps its card after them.
import { useEffect, useState, type ReactNode } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { ringOf, topDate } from "../../lib/cardView";
import { catDomKey, type CatEntry, type CatSection } from "../../lib/categories";
import { entryDomId } from "../../lib/progress";
import { L } from "../../lib/i18n";
import { isAiOption } from "../../lib/pano";
import type { Item } from "../../lib/types";
import { addOffer, chooseItem, setItemStatus } from "../actions";
import { durationText } from "../../lib/cardFacts";
import { needKey } from "../../lib/emptyCards";
import { formatPrice } from "../../lib/items";
import { dealPrice, type Need, type Offer } from "../../lib/offerSource";
import { sameCity, type Plan } from "../../lib/plan";
import { activityLinks, BRANDS } from "../../lib/searchLinks";
import { SearchRow } from "../cards/EmptyCard";
import { useEmptyEnv } from "../cards/emptyEnv";
import { BookingSheet } from "../cards/BookingSheet";
import { CardMenu, DeleteX, Ring } from "../cards/CardShell";
import { DocAccess } from "../cards/DocAccess";
import { datedLink } from "../cards/parts";
import { useCardEnv } from "../cards/PlanCard";
import { useStageMenu } from "../cards/stageMenu";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { Editable, InlineEdit, useInlineEdit } from "../cards/InlineEdit";
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
  const sugg = suggest?.list ?? [];
  const [open, setOpen] = useRemembered(`trip-radar:ideasOpen:${env.tripId}:activity`, true);
  const count = sugg.length + ideas.length + offers.tiles.length;
  const more = env.ask;
  return (
    <div className="ac-wrap">
      {/* v11 revision (Emre 2026-10-09): what's on the plan in its own place, big; the suggestions and ideas apart. */}
      <section className="ac-block ac-on-plan" aria-label={L("Planda", "On the plan")}>
        <p className="ac-h">
          <b>{L("Planda", "On the plan")}</b>
          <i>{planned.length}</i>
          {!planned.length && <span>{L("Henüz bir şey yok; aşağıdaki önerilerden “+ Plana koy”.", "Nothing yet; “+ Add to plan” from the suggestions below.")}</span>}
        </p>
        {planned.length > 0 && (
          <div className="ac-planned">
            {/* The name is edited where it stands (just added from "+ Ekle", a page's title corrected). */}
            {planned.map(({ e, item }) => (
              <InlineEdit key={e.key} item={item} only={["name"]}>
                <ActivityRow item={item} domId={entryDomId(catDomKey(e))} />
              </InlineEdit>
            ))}
          </div>
        )}
        {others.map((e) => (
          <div key={e.key} className="ac-other">{fallback(e)}</div>
        ))}
      </section>
      <section className={`ac-block ac-ideas${open ? " open" : ""}`} aria-label={L("Öneriler ve fikirler", "Suggestions and ideas")}>
        <div className="ac-ideas-h">
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
        {open && (
          <>
            {count > 0 && (
              <div className="it-grid ac-shelf">
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
      </section>
    </div>
  );
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

/** A suggestion (the chat's, a rule's) as a tile among the ideas: ✨, its name, why, "+ Plana koy", ×. */
export function SuggestTile({ s, note, onAdd, onDismiss, art = ACTIVITY_ART }: { s: Suggestion; note: string | null; onAdd: () => void; onDismiss: () => void; art?: string }) {
  return (
    <div className="it-tile ac-tile ac-sugg" aria-label={s.title} data-suggestion={s.key}>
      <div className="it-pic ac-tile-pic">
        <img className="ac-art" src={art} alt="" />
        <span className="it-who" title={L("Öneri", "Suggestion")}>
          <span className="it-ai">✨</span>
        </span>
        <span className="it-tools">
          <DeleteX name={s.title} onDelete={onDismiss} label={L("Gerek yok", "Not needed")} className="it-x" />
        </span>
      </div>
      <b className="it-t">{s.title}</b>
      {s.payload?.city && <span className="it-m">📍 {s.payload.city}</span>}
      {s.why && <span className="it-m ac-why">{s.why}</span>}
      {note && <span className="it-m ac-note" role="status">{note}</span>}
      {s.kind === "add" && (
        <div className="it-foot">
          <button type="button" className="it-put" onClick={onAdd}>+ {L("Plana koy", "Add to plan")}</button>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const stageMenu = useStageMenu(item);
  const [sheet, setSheet] = useState(false);
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const docs = env.docsFor(item.id);
  const booked = item.status === "booked";
  const page = datedLink(item, undefined).url ?? item.url;
  const date = topDate(item, "activity");
  const open = () => (booked ? setSheet(true) : env.onOpenItem(item));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className={`ac-row${booked ? " booked" : " chosen"}`} aria-label={item.name} data-item-id={item.id} id={domId} role="button" tabIndex={0}
      onClick={(e) => !(e.target as HTMLElement).closest("button, a, input, .pk-menu, .pk-ed-wrap") && open()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), open())}>
      <FallbackImg className="ac-pic" src={item.imageUrl ?? null} fallback={<img className="ac-pic art" src={ACTIVITY_ART} alt="" />} />
      <b className="ac-t">
        <Editable field="name">{item.name}</Editable>
      </b>
      <span className="ac-m">
        <Ring state={ringOf(item, "activity")} />
        {[date, item.city].filter(Boolean).join(" · ")}
        {facts.source && <span className="ac-src">· {facts.source.label}</span>}
      </span>
      <span className="ac-r" onClick={stop}>
        {facts.price && (
          <span className="ac-price-big">
            <b>{facts.price.text}</b>
            {facts.price.label && <small>{facts.price.label}</small>}
          </span>
        )}
        {booked ? (
          <>
            <span className="ac-proof">✓ {L("Bilet alındı", "Ticket bought")}</span>
            <DocAccess item={item} docs={docs} />
            <button type="button" className="ac-detail" onClick={() => setSheet(true)}>{L("Ayrıntı", "Details")} ›</button>
          </>
        ) : (
          <>
            <button type="button" className="pk-aldim" aria-label={L(`${item.name}: aldım`, `${item.name}: got it`)} onClick={() => void setItemStatus(item, "booked")}>
              ✓ {L("Aldım", "Got it")}
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
        <DeleteX name={item.name} onDelete={stageMenu.hide} label={booked ? L("Kaldır", "Take off") : L("Gerek yok", "Not needed")} className="ac-x" />
        <CardMenu entries={stageMenu.menu} />
      </span>
      {stageMenu.field}
      {sheet && (
        <BookingSheet item={item} kind="activity" facts={facts} docs={docs} date={date}
          onChange={stageMenu.change} onCancel={stageMenu.cancel} onUnbook={() => void setItemStatus(item, "chosen")} onDetails={() => env.onOpenItem(item)} onClose={() => setSheet(false)} />
      )}
    </div>
  );
}

function ActivityTile({ item, domId }: { item: Item; domId: string }) {
  const env = useCardEnv();
  const stageMenu = useStageMenu(item);
  const myName = useMyName();
  const photoOf = usePhotoOf();
  const facts = cardFacts(item, undefined, env.decisions?.ctx);
  const who = isAiOption(item) ? "ai" : (item.addedBy ?? null);
  const meta = [item.city, facts.source?.label, facts.price?.text].filter(Boolean).join(" · ");
  const edit = useInlineEdit();
  return (
    <div className="it-tile ac-tile" aria-label={item.name} data-item-id={item.id} id={domId} title={item.summary ?? undefined}>
      <div className="it-pic ac-tile-pic">
        <FallbackImg className="it-photo" src={item.imageUrl ?? null} fallback={<img className="ac-art" src={ACTIVITY_ART} alt="" />} />
        <span className="it-who" title={who === "ai" ? L("AI önerisi", "AI pick") : who ?? myName ?? undefined}>
          {who === "ai" ? <span className="it-ai">✨</span> : <WhoAvatar name={who ?? (myName || L("Ben", "Me"))} photo={photoOf(who ?? myName)} />}
        </span>
        <span className="it-tools">
          <DeleteX name={item.name} onDelete={stageMenu.hide} label={L("Gerek yok", "Not needed")} className="it-x" />
          <CardMenu entries={stageMenu.menu} />
        </span>
      </div>
      <b className="it-t">
        {edit?.open === "name" ? (
          <Editable field="name">{item.name}</Editable>
        ) : (
          <button type="button" className="ac-name" onClick={() => env.onOpenItem(item)}>{item.name}</button>
        )}
      </b>
      {meta && <span className="it-m">{meta}</span>}
      <div className="it-foot">
        <button type="button" className="it-put" onClick={() => void chooseItem(item, [])}>+ {L("Plana koy", "Add to plan")}</button>
      </div>
      {stageMenu.field}
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
 * and tickets from the connected source (Viator), for the shelf's tiles — "+ Plana koy" puts one on the plan at once.
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
    return got && got !== "none" ? got.offers.filter((o) => !pages.has(o.url) && !taken.includes(o.id)).slice(0, PER_CITY).map((o) => ({ o, need: got.need, city: c.city })) : [];
  });
  const missing = cities.filter((c) => !available || byCity[c.city] === "none");
  const put = async (o: Offer, need: Need) => {
    setTaken((t) => [...t, o.id]);
    const item = await addOffer(tripId, o, need);
    await chooseItem(item, []);
  };
  return { tiles, missing, available, put, adults: travellers };
}

function OfferTile({ offer: o, city, adults, onPut }: { offer: Offer; city: string; adults: number | null; onPut: () => void }) {
  const brandKey = o.source.toLocaleLowerCase("en").replace(/[^a-z]/g, "") as keyof typeof BRANDS;
  const brand = BRANDS[brandKey] ?? null;
  const deal = dealPrice(o, adults);
  const per = deal && adults && adults > 1 ? deal.amount / adults : deal?.amount ?? null;
  const meta = [city, o.durationMinutes ? durationText(o.durationMinutes) : o.meta].filter(Boolean).join(" · ");
  return (
    <div className="it-tile ac-tile ac-offer" aria-label={o.title} data-offer={o.id} title={o.why || undefined}>
      <div className="it-pic ac-tile-pic">
        <FallbackImg className="it-photo" src={o.photo ?? null} fallback={<img className="ac-art" src={ACTIVITY_ART} alt="" />} />
        <span className="it-who" title={L("Kaynaktan öneri", "From the source")}>
          <span className="it-ai">✨</span>
        </span>
      </div>
      <b className="it-t">
        <a href={o.url} target="_blank" rel="noreferrer" className="ac-name">{o.title}</a>
      </b>
      <span className="it-m">
        📍 {meta}
        {brand && (
          <span className="ac-bm" style={{ background: brand.color }} title={brand.name}>
            {brand.letter}
          </span>
        )}
      </span>
      {per != null && <span className="it-m ac-pp">{L(`${formatPrice(Math.round(per), o.currency ?? "EUR")} · kişi`, `${formatPrice(Math.round(per), o.currency ?? "EUR")} · person`)}</span>}
      <div className="it-foot">
        <button type="button" className="it-put" onClick={onPut}>+ {L("Plana koy", "Add to plan")}</button>
      </div>
    </div>
  );
}
