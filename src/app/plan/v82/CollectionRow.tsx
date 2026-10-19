// The collection family (plan v82: things to book and do, by city; aşama 4): two rows of 224 px cards (KCard), four across.
// Planında has every card on the plan, row after row (Emre, 19 Ekim: twelve activities on the plan are twelve on the plan).
// While nothing is there it has no empty slots, one line in its head, "Henüz plana koymadın · önerilerden + Plana koy", and
// Öneriler stays open even when folded (Emre, 19 Ekim, again); Öneriler stops at a row, the rest "+n Pano'da" (the Pano,
// where all of it gathers to sift and compare, opened on this city). Yapılacaklar' Planında head has its chips (Hepsi, Gezilecek, Restoranlar; C20), Etkinlik's
// Öneriler folds away (C26, remembered in this browser as the live bar was). Öneriler holds the saved ideas, the connected
// source's tours for the city (the live board's Viator cards, their photos kept on the records; a town it doesn't know is
// searched in its country; a town with few has the trip's nearby cities' and the country's too, each card saying where),
// then Yapılacaklar' suggestions to add (Emre, 19 Ekim; Etkinlik takes none: only real tours and saved ones, 0.38.4);
// "Kendin ara" on its right. "+ Plana koy" flies the card to its slot (E6, putFly). The box around it is CollectionBox.
import { useEffect, useState, type ReactNode } from "react";
import { citiesOfPlan, type SectionId } from "../../../lib/categories";
import { askMore, collectionRow, filterWord, ideasCaption, inFilter, K_FILTERS, mapsSearch, nearPlaces, offerCard, ROW_CELLS, rowCells, stopCountry, type KCardVM, type KFilter } from "../../../lib/collectionCards";
import { needKey, type ActivityGap } from "../../../lib/emptyCards";
import { L } from "../../../lib/i18n";
import { selfSearches, type SelfSearch } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { formatDateRange } from "../../../lib/items";
import { photoFromOffers, sameTour, type Need, type Offer } from "../../../lib/offerSource";
import { cityTours, tourWords } from "../../../lib/offerSources";
import { sameCity, type Plan } from "../../../lib/plan";
import type { Item } from "../../../lib/types";
import { addOffer, chooseItem, setItemPhoto } from "../../actions";
import { useEmptyEnv } from "../../cards/emptyEnv";
import { useCardEnv } from "../../cards/PlanCard";
import { useCollectEnv } from "./collectEnv";
import { Ic } from "./icons";
import { EmptySlots, MoreTile, OfferCard, RecordCard, SuggestCard } from "./KCard";
import { SelfLinks } from "./OptionCompact";
import { useV82Env } from "./v82Env";

export interface CollectionRowProps {
  vm: IntentVM;
  /** The kind's drawing (the box's head has it; a card with no photo has its family's own, KCard). */
  art?: string;
  /** "+ Plana koy" and the card's ×. */
  onPut: (o: Pick<OptionVM, "item">) => void;
  onTakeOff: (o: Pick<OptionVM, "item">) => void;
}

/** The source's tours a city shows at most (the live board's). */
const PER_CITY = 4;

/** A per-viewer open/closed state kept in this browser (nothing else depends on it). */
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
 * The connected source's tours for a city of Etkinlik (v11: real offers, never made up), the ones for the trip's kind and
 * style first (a surf trip: surf lessons; 0.38.5), the saved ones left out; a record the chat made from its words gets the
 * same tour's photo. Nothing while no source is connected.
 */
function useCityOffers(city: string | null, plan: Pick<Plan, "stayBlocks"> | null, saved: Item[], tripId: string) {
  const { offers: source, travellers } = useEmptyEnv();
  const { byId } = useV82Env();
  const { trip } = useCardEnv();
  const words = tourWords(trip);
  const wordsKey = words.join("|");
  const stop = city && plan ? (citiesOfPlan(plan).find((c) => sameCity(c.city, city)) ?? null) : null;
  const need: Need | null = stop ? { key: needKey("activity", stop.city, stop.start, stop.end), section: "activity", kind: "activity", city: stop.city, start: stop.start, end: stop.end, adults: travellers } : null;
  const country = stop && plan ? stopCountry(plan, stop.city) : null;
  const near = stop && plan ? nearPlaces(plan, byId.values(), stop.city, country) : [];
  const nearKey = near.map((p) => p.city).join("|");
  const [got, setGot] = useState<{ key: string; list: Offer[] } | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const available = source.available();
  useEffect(() => {
    if (!need || !available) return;
    let live = true;
    const at = `${need.key}|${wordsKey}`;
    void cityTours(source, need, country, near, words).then((list) => live && setGot({ key: at, list }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked again only for another city, days, country, nearby cities or trip kind
  }, [need?.key, country, nearKey, wordsKey, available, source]);
  const all = got && need && got.key === `${need.key}|${wordsKey}` ? got.list : [];
  const missing = saved.filter((i) => !i.imageUrl);
  useEffect(() => {
    for (const item of missing) {
      const photo = photoFromOffers(item, all);
      if (photo) void setItemPhoto(item.id, photo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the offers or the records without a photo change
  }, [all.length, missing.map((i) => i.id).join(" ")]);
  // A tour saved in another city of the trip (a nearby city's, put on the plan there) isn't offered here again.
  const elsewhere = new Set([...byId.values()].filter((i) => i.status !== "dismissed" && i.url).map((i) => i.url));
  const offers = all.filter((o) => !taken.includes(o.id) && !elsewhere.has(o.url) && !saved.some((i) => sameTour(i, o))).slice(0, PER_CITY);
  const put = async (o: Offer) => {
    if (!need) return;
    setTaken((t) => [...t, o.id]);
    const item = await addOffer(tripId, o, need);
    await chooseItem(item, []);
  };
  return { offers, put };
}

export function CollectionRow({ vm, onPut, onTakeOff }: CollectionRowProps) {
  const env = useCardEnv();
  const v82 = useV82Env();
  const cx = useCollectEnv();
  const plan = cx?.plan ?? null;
  const records = vm.itemIds.map((id) => v82.byId.get(id)).filter((i): i is Item => i != null && i.status !== "dismissed");
  const { offers, put } = useCityOffers(vm.section === "activity" ? vm.head.city : null, plan, records, env.tripId);
  const row = collectionRow(vm, v82.byId, { trip: env.trip, people: v82.selfAt.adults, ctx: env.decisions?.ctx, offers });
  const todo = vm.section === "todo";
  const [filter, setFilter] = useState<KFilter>("all");
  const [open, setOpen] = useRemembered(`trip-radar:ideasOpen:${env.tripId}:${vm.section}`, true);
  const plans = row.plan.filter((c) => inFilter(c, filter));
  const ideas = row.ideas.filter((c) => inFilter(c, filter));
  const o = rowCells(ideas);
  const links: SelfSearch[] = todo ? [mapsSearch(vm.head.city, filter)].filter((l): l is SelfSearch => l != null) : selfSearches(vm, v82.selfAt);
  const city = vm.head.city ?? vm.head.name;
  const pano = () => env.onPano(vm.key);

  const cardOf = (c: KCardVM): ReactNode => {
    if (c.item) return <RecordCard key={c.key} card={c} vm={vm} plan={plan} search={links[0] ?? null} onPut={(item) => onPut({ item })} onTakeOff={(item) => onTakeOff({ item })} />;
    if (c.suggestion) {
      const s = c.suggestion;
      return <SuggestCard key={c.key} card={c} onPut={() => v82.addSuggestion?.(s)} onDismiss={() => v82.dismissSuggestion?.(s)} />;
    }
    if (c.offer) {
      const offer = c.offer;
      return <OfferCard key={c.key} card={c} onPut={() => void put(offer)} />;
    }
    return null;
  };

  return (
    <>
      <div className="q-planw">
        <div className="q-oh">
          <b className="q-ot">{L("Planında", "On your plan")}</b>
          <small className="q-ppn">{plans.length || ""}</small>
          {plans.length === 0 && (
            <small className="z-pe">
              {ideas.length > 0 ? L("Henüz plana koymadın · önerilerden “+ Plana koy”", "Nothing on your plan yet · “+ Add to plan” from the suggestions") : L("Henüz plana koymadın", "Nothing on your plan yet")}
            </small>
          )}
          {todo && row.counts.all > 0 && (
            <>
              <span className="q-sp" />
              <span className="z-fchips" role="group" aria-label={L(`${city}: ne`, `${city}: what`)}>
                {K_FILTERS.map((f) => (
                  <button key={f} type="button" className="z-fc" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {filterWord(f)} <i>{row.counts[f]}</i>
                  </button>
                ))}
              </span>
            </>
          )}
        </div>
        <div className="q-prow z-ks" data-row="plan">
          {plans.map(cardOf)}
          {/* (the last row filled to four with unseen cells; none while empty: putFly lands on the new card itself, E6) */}
          <EmptySlots n={(ROW_CELLS - (plans.length % ROW_CELLS)) % ROW_CELLS} />
        </div>
      </div>
      {ideas.length > 0 && (
        <div className="q-opts">
          <div className="q-oh">
            <b className="q-ot">{L("Öneriler", "Suggestions")}</b>
            <small className="q-oc">{ideasCaption(ideas.length, o.shown.length)}</small>
            <span className="q-sp" />
            <SelfLinks links={links} />
            {/* C26: the ideas fold away (the live "Öneriler ve fikirler" bar), remembered in this browser; not while the plan is empty. */}
            {!todo && plans.length > 0 && (
              <button type="button" className={`z-fold${open ? "" : " shut"}`} aria-expanded={open} onClick={() => setOpen(!open)}
                aria-label={open ? L(`${city}: önerileri katla`, `${city}: fold the suggestions`) : L(`${city}: önerileri aç`, `${city}: show the suggestions`)}>
                <Ic name="chev" size={13} stroke={2.4} />
                {open ? L("Katla", "Fold") : L("Aç", "Show")}
              </button>
            )}
          </div>
          {(todo || open || plans.length === 0) && (
            <div className="q-cards z-ks" data-row="ideas">
              {o.shown.map(cardOf)}
              {o.more > 0 && <MoreTile n={o.more} title={L(`${city}: öneriler`, `${city}: suggestions`)} onOpen={pano} />}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Etkinlik ve turlar' cities with nothing yet (emptyCards.activityGaps; the live board's empty city row): one thin line each
 * at the rail's end, its days, "✨ AI'a arat" (the chat looks) and "Kendin ara". Not an intent: nothing waits on it. When the
 * connected source has tours for it, they are cards under the line (the live board's offers in an empty city's row), "+ Plana
 * koy" puts one on the plan and the city gets its own box.
 */
export function CityGaps({ gaps, section }: { gaps: ActivityGap[]; section: SectionId }) {
  if (!gaps.length) return null;
  return (
    <>
      {gaps.map((g) => (
        <CityGap key={g.city} gap={g} section={section} />
      ))}
    </>
  );
}

function CityGap({ gap: g, section }: { gap: ActivityGap; section: SectionId }) {
  const env = useCardEnv();
  const v82 = useV82Env();
  const cx = useCollectEnv();
  const { offers, put } = useCityOffers(g.city, cx?.plan ?? null, [], env.tripId);
  const links = selfSearches({ kind: "activity", head: { name: g.city, route: null, parts: [], kindWord: null, word: null, wants: [], image: null, city: g.city, date: g.range.start, nights: 0 }, options: [], chosen: null }, v82.selfAt);
  const cards = offers.map((o) => offerCard(o, v82.selfAt.adults));
  const o = rowCells(cards);
  const line = (
    <>
      <Ic name="pin" size={14} />
      <b>{g.city}</b>
      <span>{formatDateRange(g.range.start, g.range.end)}</span>
      <span className="z-dim">· {L("henüz etkinlik yok", "no activities yet")}</span>
      <span className="q-sp" />
      {env.ask && (
        <button type="button" className="z-ask" onClick={() => env.ask!(askMore(section, g.city))}>
          <Ic name="spark" size={13} />
          {L("AI'a arat", "Ask the AI")}
        </button>
      )}
      <SelfLinks links={links} />
    </>
  );
  if (!cards.length) {
    return (
      <p className="q-gapl" data-city={g.city}>
        {line}
      </p>
    );
  }
  return (
    <div className="q-gapl has-offers" data-city={g.city}>
      <p className="q-gaph">{line}</p>
      <div className="q-cards z-ks" data-row="ideas">
        {o.shown.map((c) => (
          <OfferCard key={c.key} card={c} onPut={() => c.offer && void put(c.offer)} />
        ))}
      </div>
    </div>
  );
}
