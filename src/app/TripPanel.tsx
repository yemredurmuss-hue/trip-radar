import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { requestProcessing } from "../lib/browser";
import type { GroupDecision } from "../lib/decision";
import { listingKeyOf, nightsBetween, rankItems, routeUrl, tripDateRange } from "../lib/items";
import { buildLegs, type Leg } from "../lib/legs";
import { buildTimeline } from "../lib/timeline";
import { needsReading } from "../lib/listing";
import { cardFacts } from "../lib/cardFacts";
import { budgetBar, decisionProgress, entryDomId, type DecisionProgress, type Todo, type TodoKind } from "../lib/progress";
import { cityKeyOf, type OptionGroup, type Plan } from "../lib/plan";
import { retryCapture } from "../lib/process";
import { L } from "../lib/i18n";
import { imageProxy, nextCityImage, nextHeroImage, pickCityImage, wantsCityImage } from "../lib/cityImages";
import { acceptMood, moodKey, statusSentence } from "../lib/heroText";
import { getProvider, MissingKeyError } from "../lib/llm";
import { loadPassport } from "../lib/passport";
import { homeCurrencyOf, tripFacts } from "../lib/tripFacts";
import type { Timeline } from "../lib/timeline";

import type { Capture, Item, Trip } from "../lib/types";
import { chooseItem, hideNights, undo as takeBack, updateTrip } from "./actions";
import { legEndsByItem, legModeByItem } from "../lib/cardKinds";
import { inheritedDocs } from "../lib/docs";
import { deleteItem, onRemoved } from "../lib/removal";
import { undoSlot } from "../lib/undo";
import { undoTrip, type Undoable } from "../lib/undoables";
import { addQuick, templateLabel, TEMPLATES, type InsertAt, type Template, type TemplateId } from "../lib/templates";
import { categorize, catDomKey, findInSections, sectionOfItem, type SectionId } from "../lib/categories";
import { firstField, type CardFocus } from "../lib/inlineEdit";
import { newId } from "../lib/db";
import { AddSheet } from "./cards/AddSheet";
import { useTripDocs } from "./cards/DocAccess";
import { LegCard } from "./cards/LegCard";
import { CardEnvContext, NavGroup, PlanCard, type CardEnv } from "./cards/PlanCard";
import { SilhouetteDefs } from "./cards/Silhouettes";
import { UndoToast } from "./cards/UndoToast";
import { isIdea } from "../lib/booking";
import { findTarget, show, TodoList } from "./Progress";
import { TripFacts } from "./TripFacts";
import { cityRanges, countriesOf, heroTally } from "../lib/heroInfo";
import { acceptStyle, budgetLevel, styleChips, styleKey, stylePrompt } from "../lib/tripStyle";
import { intentEntries } from "./IntentCard";
import { TripHero, type HeroCity } from "./TripHero";
import { LegRow } from "./LegRow";
import { CategoryPlan } from "./plan/CategoryPlan";
import { SECTION_META, useSectionOpen } from "./plan/sectionMeta";
import { SettledCard, SwipeCard } from "./SwipeCard";
import { TimelineView, type CardFor, type RenderGroup, type SettledFor, type TimelineMode } from "./Timeline";
import { choiceOf, type Choice } from "../lib/choice";
import { pivotalFindings } from "../lib/pivots";
import type { ValueCard } from "../lib/value";
import type { Decisions } from "./useDecisions";

interface Props {
  trip: Trip;
  items: Item[];
  plan: Plan;
  openCaptures: Capture[];
  decisions: Decisions | null;
  onOpenItem: (item: Item) => void;
  onCompare: (groupKey: string) => void;
  menu: React.ReactNode;
  /** Opens the share dialog (absent where the trip can't be shared). */
  onShare?: () => void;
}

export function TripPanel({ trip, items, plan, openCaptures, decisions, onOpenItem, onCompare, menu, onShare }: Props) {
  // The plan's dates: the ones set, widened by any stay booked or chosen outside them.
  const range = plan.range ?? trip.confirmedDates ?? tripDateRange(items);
  const today = decisions?.ctx.today ?? new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<TimelineMode>("plan");
  const mapUrl = routeUrl(items);
  const working = openCaptures.filter((c) => c.status === "pending" || c.status === "processing");
  const failed = openCaptures.filter((c) => c.status === "error");
  const listings = decisions?.ctx.listings;
  const legs = useMemo(() => buildLegs(plan, trip, listings), [plan, trip, listings]);
  const reading = listings
    ? new Set(items.filter((i) => needsReading(i, listings.get(listingKeyOf(i))) && !listings.get(listingKeyOf(i))?.error).map(listingKeyOf)).size
    : 0;
  const hidden = useMemo(() => new Set(trip.hidden ?? []), [trip.hidden]);
  const timeline = useMemo(() => buildTimeline(plan, legs, items, hidden), [plan, legs, items, hidden]);
  // The Plan by category (spec 0.34): every block and record in one of seven sections; which are open, per trip.
  const rank = useMemo(() => new Map([...(decisions?.byGroup.values() ?? [])].flatMap((d) => d.options.map((o, i) => [o.item.id, i] as const))), [decisions?.byGroup]);
  const sections = useMemo(() => categorize({ plan, timeline, items, legs, hidden, rank }), [plan, timeline, items, legs, hidden, rank]);
  const [isOpen, setOpened] = useSectionOpen(trip.id);
  /** Opens a block of the plan (from the itinerary): its section opens, the card comes into view. */
  const showOnPlan = (key: string) => {
    const hit = findInSections(sections, { entry: key });
    setView("plan");
    if (hit) setOpened(hit.section, true);
    setTimeout(() => show(document.getElementById(entryDomId(key)) ?? (hit && document.getElementById(entryDomId(hit.dom)))), 60);
  };
  // A card that changes section (a change of city now by plane: Ulaşım → Uçuş; a to-do moved to Etkinlikler)
  // isn't lost from under the hand: its new section opens and the page goes to it, with a flash.
  const placed = useRef<{ tripId: string; at: Map<string, SectionId> } | null>(null);
  useEffect(() => {
    const now = new Map(sections.flatMap((s) => s.entries.map((e) => [e.key, s.id] as const)));
    const before = placed.current?.tripId === trip.id ? placed.current.at : null;
    placed.current = { tripId: trip.id, at: now };
    if (!before || view !== "plan") return;
    const moved = sections.flatMap((s) => s.entries).find((e) => before.has(e.key) && before.get(e.key) !== e.section);
    if (!moved) return;
    setOpened(moved.section, true);
    setTimeout(() => show(document.getElementById(entryDomId(catDomKey(moved)))), 60);
  }, [sections, trip.id, view, setOpened]);
  /**
   * A to-do's place: on this view if it's there; else on the Plan (its section opened); else on the other view
   * (an empty transfer is only in the itinerary).
   */
  const reveal = (target: Todo["target"]) => {
    const here = findTarget(target);
    if (here) return show(here);
    const hit = findInSections(sections, target);
    if (hit) {
      setView("plan");
      setOpened(hit.section, true);
      setTimeout(() => show(findTarget(target) ?? document.getElementById(entryDomId(hit.dom))), 60);
      return;
    }
    setView((v) => (v === "plan" ? "days" : "plan"));
    setTimeout(() => show(findTarget(target)), 60);
  };

  // --- plan cards: the way chosen per transfer, files, delete with undo, the add sheet ---
  const legModes = useMemo(() => legModeByItem(legs), [legs]);
  const legEnds = useMemo(() => legEndsByItem(legs), [legs]);
  const inherited = useMemo(() => inheritedDocs(plan.closed), [plan.closed]);
  const docsFor = useTripDocs(trip.id, inherited);
  const undo = useMemo(() => undoSlot<Undoable>(), []);
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  useEffect(() => undo.subscribe(setUndoable), [undo]);
  // Another trip on screen: the last deletion stays deleted.
  useEffect(() => () => void undo.take(), [trip.id, undo]);
  // A plan the chat took back ("taksiyi kaldır") gets the same "Geri al".
  useEffect(() => onRemoved((removed) => removed.item.tripId === trip.id && undo.show({ kind: "removed", removed })), [trip.id, undo]);
  const offer = (u: Undoable) => undoTrip(u) === trip.id && undo.show(u);
  const [sheet, setSheet] = useState<{ at: InsertAt | null; editing: Item | null; only?: readonly TemplateId[] } | null>(null);
  const [focus, setFocus] = useState<CardFocus | null>(null);
  useEffect(() => setFocus(null), [trip.id]);
  /**
   * A tile picked (spec 0.33 §2): the record at once, "X eklendi · Geri al", open on the Plan for editing in
   * its section (opened, scrolled to, first field open; an idea's title, the one field its row has).
   */
  const quickAdd = async (tpl: Template, at: InsertAt | null) => {
    setSheet(null);
    const item = await addQuick(trip.id, tpl, at, newId());
    offer({ kind: "added", item, label: templateLabel(tpl.id) });
    if (view !== "plan") setView("plan");
    setOpened(sectionOfItem(item), true);
    setFocus({ id: item.id, field: isIdea(item) ? "name" : firstField(item, decisions?.ctx.currency ?? "EUR"), scroll: true });
  };
  /** "+ Ekle" of a section and its "+": its one kind at once (Etkinlik, Restoran), or the sheet with only its tiles. */
  const addIn = (section: SectionId | null, at: InsertAt | null) => {
    if (!section) return setSheet({ at, editing: null });
    const ids = SECTION_META[section].templates;
    if (ids.length === 1) return void quickAdd(TEMPLATES.find((t) => t.id === ids[0])!, at);
    setSheet({ at, editing: null, only: ids });
  };
  const env: CardEnv = {
    tripId: trip.id,
    decisions,
    today,
    legModes,
    legEnds,
    docsFor,
    remove: (item) => void deleteItem(item).then((removed) => offer({ kind: "removed", removed })),
    hideNights: (range, label) => void hideNights(trip.id, range, label).then(offer),
    add: (at) => setSheet({ at, editing: null }),
    edit: (item) => setSheet({ at: null, editing: item }),
    focus,
    setFocus,
    onOpenItem,
    onCompare,
  };

  // --- the hero: a photo per city, the paragraph, what's confirmed, the facts column ---
  const cityNames = useMemo(() => citiesOf(plan, items), [plan, items]);
  const cities = useMemo<HeroCity[]>(() => {
    const list = cityNames.map((name) => ({ name, image: trip.cityImages?.[cityKeyOf(name)!] ?? null }));
    // A trip from before the city photos: its one picture goes to the first city (or stands alone).
    if (trip.heroImage && !list.some((c) => c.image)) return list.length ? [{ ...list[0], image: trip.heroImage }, ...list.slice(1)] : [{ name: "", image: trip.heroImage }];
    return list;
  }, [cityNames, trip.cityImages, trip.heroImage]);
  // A city's photo is looked up once (a miss is stored as null, so it isn't asked again). Once the
  // sharing server's photo proxy is set up, a stored miss or Wikipedia picture is asked for again, once
  // per trip and city in a session; a miss then keeps the old picture. The first city's new photo also
  // becomes the trip card's (TripsHome).
  const askedImages = useRef(new Set<string>());
  useEffect(() => {
    const unasked = cityNames.filter((name) => {
      const key = cityKeyOf(name);
      return key && !askedImages.current.has(`${trip.id}:${key}`) && wantsCityImage(trip.cityImages?.[key], true);
    });
    if (!unasked.length) return;
    for (const name of unasked) askedImages.current.add(`${trip.id}:${cityKeyOf(name)}`);
    const firstKey = cityNames.length ? cityKeyOf(cityNames[0]) : null;
    void (async () => {
      const proxy = await imageProxy();
      for (const name of unasked) {
        const key = cityKeyOf(name)!;
        if (!wantsCityImage(trip.cityImages?.[key], Boolean(proxy))) continue;
        try {
          const url = await pickCityImage(name, { proxy });
          await updateTrip(
            trip.id,
            (t) => ({
              ...t,
              cityImages: { ...t.cityImages, [key]: nextCityImage(t.cityImages?.[key], url) },
              ...(key === firstKey ? { heroImage: nextHeroImage(t.heroImage, url) } : {}),
            }),
            { touch: false },
          );
        } catch (error) {
          // An outage is not "no photo": store nothing, so the next visit asks again.
          console.warn("city photo", name, error);
        }
      }
    })();
  }, [trip.id, trip.cityImages, cityNames]);
  // The mood sentence: written once per set of cities by the traveller's model; one with a number is dropped.
  const moodFor = moodKey(cityNames);
  const askedMood = useRef<string | null>(null);
  useEffect(() => {
    if (!cityNames.length || trip.mood?.key === moodFor || askedMood.current === `${trip.id}:${moodFor}`) return;
    askedMood.current = `${trip.id}:${moodFor}`;
    void (async () => {
      try {
        const llm = await getProvider();
        const out = await llm.generateJson(
          L(
            "Gezinin ruhunu anlatan tek kısa cümle yaz. Rakam, tarih, fiyat yazma. En fazla 120 karakter.",
            "Write one short sentence capturing the trip's mood. No numbers, dates or prices. At most 120 characters.",
          ),
          cityNames.join(" → "),
          z.object({ text: z.string() }),
        );
        const text = acceptMood(out.text) ? out.text.trim() : "";
        await updateTrip(trip.id, (t) => ({ ...t, mood: { key: moodFor, text } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("mood sentence", error); // the status sentence stands alone
      }
    })();
  }, [trip.id, trip.mood?.key, moodFor, cityNames]);
  // The style words: picked once per set of cities and what was understood, only from the fixed list.
  const understood = useMemo(() => intentEntries(trip, decisions).entries.map((e) => e.text), [trip, decisions]);
  const styleFor = styleKey(cityNames, understood);
  const askedStyle = useRef<string | null>(null);
  useEffect(() => {
    if (!cityNames.length || trip.style?.key === styleFor || askedStyle.current === `${trip.id}:${styleFor}`) return;
    askedStyle.current = `${trip.id}:${styleFor}`;
    void (async () => {
      try {
        const llm = await getProvider();
        const out = await llm.generateJson(stylePrompt(), [cityNames.join(" → "), ...understood].join("\n"), z.object({ ids: z.array(z.string()) }));
        await updateTrip(trip.id, (t) => ({ ...t, style: { key: styleFor, ids: acceptStyle(out.ids) } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("trip style", error); // the budget's word stands alone
      }
    })();
  }, [trip.id, trip.style?.key, styleFor, cityNames, understood]);
  const [passport, setPassport] = useState("TR");
  useEffect(() => {
    const read = () => void loadPassport().then(setPassport);
    read();
    // Changed in Settings (a dialog over this board).
    const onChange = (changes: Record<string, unknown>) => "passport" in changes && read();
    try {
      chrome.storage.onChanged.addListener(onChange);
      return () => chrome.storage.onChanged.removeListener(onChange);
    } catch {
      return undefined; // no extension storage (a plain page)
    }
  }, []);
  const [todoOpen, setTodoOpen] = useState<TodoKind | null>(null);
  // Another trip's to-do list isn't the one that was open.
  useEffect(() => {
    setTodoOpen(null);
  }, [trip.id]);
  const progress = decisionProgress(timeline, items, plan, decisions?.byGroup, today);
  const bar = decisions ? budgetBar(plan, items, decisions.ctx, decisions.byGroup) : null;
  const facts = useMemo(
    () =>
      tripFacts(items, {
        passport,
        // The traveller's own money (a TR passport: TRY), not the budget's: "€1 = ₺38,20".
        homeCurrency: homeCurrencyOf(passport, decisions?.ctx.currency ?? "EUR"),
        rates: decisions?.ctx.rates ?? null,
        homeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        start: range?.start ?? null,
      }),
    [items, passport, decisions?.ctx.currency, decisions?.ctx.rates, range?.start],
  );
  const settledItem = (i: Item) => i.status === "chosen" || i.status === "booked";
  const tally = useMemo(() => heroTally(plan, items), [plan, items]);
  const chips = styleChips(
    trip.style?.key === styleFor ? acceptStyle(trip.style.ids) : [],
    budgetLevel(trip.budget, range ? nightsBetween(range.start, range.end) + 1 : 0, facts.adults, decisions?.ctx.rates ?? null),
  );
  /** A day card's photo: its city's (the hero's), else the trip's. */
  const cityImageOf = (city: string | null) => (city ? trip.cityImages?.[cityKeyOf(city)!] : null) ?? trip.heroImage ?? null;
  const countries = useMemo(() => countriesOf(items), [items]);
  const places = useMemo(() => cityRanges(plan, cityNames, range), [plan, cityNames, range]);
  const flightGroups = plan.groups.filter((g) => g.category === "flight");
  const flightsDone = flightGroups.length > 0 && flightGroups.every((g) => g.items.some(settledItem));
  const mood = trip.mood?.key === moodFor && trip.mood.text ? trip.mood.text : null;
  const lead = [
    mood,
    range
      ? statusSentence(progress.count, { flightsDone, waitingCity: waitingCityOf(progress, timeline, items) })
      : L("Tarih ve şehir, kaydettikçe netleşir.", "Dates and cities fill in as you save."),
  ]
    .filter(Boolean)
    .join(" ");
  const decisionOf = (item: Item) => [...(decisions?.byGroup.values() ?? [])].find((d) => d.options.some((o) => o.item.id === item.id));
  /** A stay keeps its decision card; everything else is a plan card (cards/PlanCard.tsx). */
  const card: CardFor = (item, group, decision, ranked, onCompareGroup) =>
    item.category === "stay" ? (
      <SwipeCard key={item.id} item={item} group={group} decision={decision ?? decisionOf(item)} decisions={decisions} ranked={ranked} onOpen={() => onOpenItem(item)} onCompare={onCompareGroup} />
    ) : (
      <PlanCard key={item.id} item={item} group={group} decision={decision ?? decisionOf(item)} ranked={ranked} onCompare={onCompareGroup} />
    );
  /** A decided need: a stay's settled card, else the plan card. */
  const settled: SettledFor = (item, decision, onChange, changing) =>
    item.category === "stay" ? (
      <SettledCard key={item.id} item={item} decision={decision ?? decisionOf(item)} decisions={decisions} onOpen={() => onOpenItem(item)} onChange={onChange} changing={changing} />
    ) : (
      <PlanCard key={item.id} item={item} group={[item]} decision={decision ?? decisionOf(item)} onChange={onChange} changing={changing} />
    );
  const leg = (l: Leg, opts: { embedded?: boolean; timed?: boolean } = {}) => (
    <LegRow key={l.key} leg={l} tripId={trip.id} onOpenItem={onOpenItem} onRemove={env.remove} embedded={opts.embedded} timed={opts.timed} />
  );
  const legCard = (l: Leg) => <LegCard key={l.key} leg={l} />;

  const renderGroup: RenderGroup = (group, heading, groupSubtitle, nested = false) => (
    <OptionGroupView
      key={group.key}
      group={group}
      heading={heading}
      subtitle={groupSubtitle}
      nested={nested}
      decision={decisions?.byGroup.get(group.key)}
      card={decisions?.cards.get(group.key)}
      ctx={decisions?.ctx}
      renderCard={card}
      renderSettled={settled}
      onCompare={() => onCompare(group.key)}
    />
  );

  return (
    <CardEnvContext.Provider value={env}>
      <SilhouetteDefs />
      <section className="hx">
        <TripHero
          key={trip.id}
          trip={trip}
          decisions={decisions}
          cities={cities}
          range={range}
          today={today}
          lead={lead}
          chips={chips}
          tally={tally}
          working={working.length + reading}
          menu={menu}
        />
        <TripFacts
          range={range}
          estimated={!!range && !trip.confirmedDates && !plan.range}
          facts={facts}
          home={passport}
          countries={countries}
          cities={cityNames}
          places={places}
          mapUrl={mapUrl}
          today={today}
          bar={bar}
          progress={progress}
          onGo={reveal}
          onShare={onShare}
          todoOpen={todoOpen}
          onTodo={setTodoOpen}
        />
      </section>
      {todoOpen && <TodoList progress={progress} open={todoOpen} onGo={reveal} />}

      {failed.length > 0 && (
        <div className="errors">
          {failed.map((c) => (
            <div key={c.id}>
              <span className="error-text" title={c.error ?? ""}>
                <span className="err">⚠ {c.title || c.url || L("Ekran görüntüsü", "Screenshot")}</span>
                <span className="muted">
                  {L(" — ", " · ")}
                  {c.error}
                </span>
              </span>
              <button
                className="small-btn"
                onClick={async () => {
                  await retryCapture(c.id);
                  requestProcessing();
                }}
              >
                {L("Tekrar dene", "Try again")}
              </button>
            </div>
          ))}
        </div>
      )}

      {timeline.entries.length > 0 && (
        <div className="view-tabs" role="tablist" aria-label={L("Görünüm", "View")}>
          <button role="tab" aria-selected={view === "plan"} className={view === "plan" ? "on" : ""} onClick={() => setView("plan")}>
            {L("Plan", "Plan")}
          </button>
          <button role="tab" aria-selected={view === "days"} className={view === "days" ? "on" : ""} onClick={() => setView("days")}>
            {L("Günlük akış", "Day by day")}
          </button>
        </div>
      )}
      {view === "days" && timeline.entries.length > 0 ? (
        <TimelineView onShow={showOnPlan} timeline={timeline} tripId={trip.id} leg={leg} onAdd={env.add} listings={listings} today={today} cityImage={cityImageOf} />
      ) : (
        <CategoryPlan
          plan={plan}
          sections={sections}
          isOpen={isOpen}
          onOpen={setOpened}
          tripId={trip.id}
          cities={cityNames}
          cards={{ legCard, renderGroup, card, settled }}
          onAdd={addIn}
        />
      )}

      {sheet && (
        <AddSheet at={sheet.at} editing={sheet.editing} only={sheet.only} currency={decisions?.ctx.currency ?? trip.budget?.currency ?? "EUR"} onClose={() => setSheet(null)}
          onPick={(tpl) => void quickAdd(tpl, sheet.at)} />
      )}
      <UndoToast undoable={undoable} onUndo={() => { const u = undo.take(); if (u) void takeBack(u); }} />
    </CardEnvContext.Provider>
  );
}

/** The trip's cities for the hero's photos: in the order the nights go, each once; else the saved stays' cities. */
function citiesOf(plan: Plan, items: Item[]): string[] {
  const seen = new Map<string, string>();
  const add = (city: string | null | undefined) => {
    const key = cityKeyOf(city);
    if (key && !seen.has(key)) seen.set(key, city!);
  };
  for (const b of plan.stayBlocks) add(b.city);
  if (!seen.size) for (const i of items) if (i.status !== "dismissed" && i.category === "stay") add(i.city);
  return [...seen.values()];
}

/** Where the first open decision is (a stay's city, a city's plans, an item's city), for "Madeira'da bir karar bekliyor". */
function waitingCityOf(progress: DecisionProgress, timeline: Timeline, items: Item[]): string | null {
  const todo = progress.todos.find((t) => t.kind === "decide");
  if (!todo) return null;
  const entry = todo.target.entry ? timeline.entries.find((e) => e.key === todo.target.entry) : undefined;
  if (entry?.kind === "stay") return entry.block.city ?? null;
  if (entry?.kind === "plan") return entry.city;
  return (todo.target.item && items.find((i) => i.id === todo.target.item)?.city) || null;
}

function OptionGroupView({
  group,
  heading,
  subtitle,
  nested,
  decision,
  card,
  ctx,
  renderCard,
  renderSettled,
  onCompare,
}: {
  group: OptionGroup;
  heading: string | null;
  subtitle: string | null;
  nested: boolean;
  decision: GroupDecision | undefined;
  card: ValueCard | undefined;
  ctx: Decisions["ctx"] | undefined;
  renderCard: CardFor;
  renderSettled: SettledFor;
  onCompare: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rank = (item: Item) => {
    const index = decision?.options.findIndex((o) => o.item.id === item.id) ?? -1;
    return index >= 0 ? index : null;
  };
  const ranked = rankItems(group.items, rank);
  const decided = ranked.find((i) => i.status === "booked") ?? ranked.find((i) => i.status === "chosen");
  const live = !group.booked && decision;
  const comparable = live && decision.options.filter((o) => !o.excluded).length > 1;
  const single = live && decision.status === "single";
  // The strongest option for each thing that matters (the balanced one first), and the rest.
  const choice = live && ctx && comparable ? choiceOf(decision, ctx) : null;
  // Where an option's place hangs on one thing read on its page: said on its card, with the question.
  const pivots = useMemo(() => (live && ctx && comparable && !group.items.some((i) => i.status === "chosen") ? pivotalFindings(decision, ctx) : []), [live, ctx, comparable, decision, group.items]);
  const head =
    heading || subtitle ? (
      <span className="group-title">
        {heading && <span>{heading}</span>}
        {subtitle && <span className="muted">{subtitle}</span>}
      </span>
    ) : null;
  // Decided: one line (the cards come back with "Değiştir"). A booking settles it for good.
  const change = decided && decided.status === "chosen" && ranked.length > 1 ? () => setChanging(!changing) : undefined;
  // A new pick (or a booking) closes the cards again.
  const decidedId = decided?.id;
  useEffect(() => setChanging(false), [decidedId]);
  // Best first, numbered: the first few at once, the rest one tap away (the engine's order: fit, then
  // to check, then partial, then out).
  const byRank = [...group.items].sort((a, b) => (rank(a) ?? Infinity) - (rank(b) ?? Infinity) || (a.price.amount ?? Infinity) - (b.price.amount ?? Infinity));
  const rankedOf = (item: Item) => {
    const r = choice?.ranked.find((x) => x.option.item.id === item.id);
    return r && { ...r, pivot: pivots.find((p) => p.itemId === item.id) ?? null };
  };
  // Not a stay: the options as one card with ‹ 1/2 ›, the pick and the reasons in its details (cards/PlanCard.tsx).
  if (group.category !== "stay") {
    return (
      <NavGroup items={byRank} heading={head} nested={nested} decision={decision} choice={choice} decided={decided ?? null}
        onChange={change} changing={changing} rankedOf={rankedOf} onCompare={comparable || single ? onCompare : undefined} />
    );
  }
  if (decided && !(changing && change)) {
    return (
      <div className={nested ? "group nested" : "section"}>
        {head && <div className={nested ? "group-head" : "section-head"}>{head}</div>}
        {renderSettled(decided, decision, change, false)}
      </div>
    );
  }
  const lead = byRank.slice(0, VISIBLE);
  const others = byRank.slice(VISIBLE);
  const shown = showAll ? byRank : lead;
  return (
    <div className={nested ? "group nested" : "section"}>
      {decided && renderSettled(decided, decision, change, true)}
      {head && <div className={nested ? "group-head" : "section-head"}>{head}</div>}
      {!decided && choice?.headline && ctx && <Headline choice={choice} alternatives={group.items} onCompare={onCompare} />}
      <div className="option-grid">
        {shown.map((item) => renderCard(item, group.items, decision, rankedOf(item), comparable || single ? onCompare : undefined))}
      </div>
      {others.length > 0 && (
        <button className="link-btn more-options" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? L("Daha az göster", "Show less") : L(`+${others.length} seçenek daha`, `+${others.length} more option${others.length === 1 ? "" : "s"}`)}
        </button>
      )}
      {!decided && !choice?.headline && (comparable || single) && (
        <button className="verdict-line" onClick={onCompare}>
          <span className={single ? "muted" : ""}>{decision!.summary}</span>
          <span className="verdict-cta">{single ? L("Kriterleri gör →", "See criteria →") : L("Karşılaştır →", "Compare →")}</span>
        </button>
      )}
    </div>
  );
}

/** Options shown at once, best first; the rest behind "+N seçenek daha". */
const VISIBLE = 5;

/**
 * The decision in a sentence above the cards: the pick and why, then the alternatives for each priority
 * with their place ("Tasarruf ve sessizlik için 2. Bonfim Loft (€60 daha ucuz)"), what to check before
 * choosing, and the button to take the pick.
 */
function Headline({ choice, alternatives, onCompare }: { choice: Choice; alternatives: Item[]; onCompare: () => void }) {
  const first = choice.ranked.find((r) => r.rank === 1)?.option.item;
  const pages = new Map(alternatives.map((i) => [i.id, i.url]));
  return (
    <div className="reco-line headline">
      <div className="reco-text">
        <p>{choice.headline}</p>
        {choice.verify.length > 0 && (
          <ul className="reco-verify" aria-label={L("Seçmeden kontrol et", "Check before choosing")}>
            {choice.verify.map((v) => (
              <li key={`${v.itemId}:${v.what}`}>
                <b>{v.name}:</b> {v.what}
                {pages.get(v.itemId) && (
                  <a href={pages.get(v.itemId)!} target="_blank" rel="noreferrer">
                    {" "}
                    {L("Sayfada bak ↗", "See on page ↗")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="reco-actions">
        {first && (
          <button className="pill-btn primary" onClick={() => void chooseItem(first, alternatives)}>
            {L(`${first.name} seç`, `Choose ${first.name}`)}
          </button>
        )}
        <button className="link-btn" onClick={onCompare}>
          {L("Karşılaştır →", "Compare →")}
        </button>
      </span>
    </div>
  );
}

/** "Porto, Lizbon ve Madeira" / "Porto, Lisbon and Madeira": names joined in the current language. */
export function joinTr(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ${L("ve", "and")} ${names.at(-1)}`;
}
