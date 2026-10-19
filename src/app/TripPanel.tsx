import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { z } from "zod";
import { requestProcessing } from "../lib/browser";
import type { GroupDecision } from "../lib/decision";
import { formatDateRange, listingKeyOf, nightsBetween, rankItems, routeUrl, tripDateRange } from "../lib/items";
import { buildLegs, staleHiddenMoves, type Leg } from "../lib/legs";
import { buildTimeline } from "../lib/timeline";
import { needsReading } from "../lib/listing";
import { cardFacts } from "../lib/cardFacts";
import { budgetBar, sectionAllotments, decisionProgress, entryDomId, type Todo } from "../lib/progress";
import { cachedWeather } from "../lib/climate";
import { addDays, cityKeyOf, groupKeyOf, sameCity, type OptionGroup, type Plan } from "../lib/plan";
import { retryCapture } from "../lib/process";
import { L } from "../lib/i18n";
import { creditOf, findCityPhoto, imageProxy, keptCredits, nextCityImage, nextHeroImage, wantsCityImage } from "../lib/cityImages";
import { acceptMood, moodKey } from "../lib/heroText";
import { getProvider, MissingKeyError } from "../lib/llm";
import { resetConversation } from "../lib/assistant";
import { collectionsOf, type IntentInput } from "../lib/intents";
import { journeyChapters, type StepTarget } from "../lib/journeyChapters";
import { countedIntents, localNow, tripModeOf } from "../lib/tripPhase";
import { timedNext, timedNextLabel, todayStrip, type TimedNext, type TodayInput } from "../lib/tripToday";
import type { PlanTarget } from "../lib/chatCards";
import { mosaicOf, placesOfIntents } from "../lib/heroMosaic";
import { budgetView, datesTip, heroCounts, heroLine } from "../lib/heroStrip";
import { nextLabel, nextShort, nextStep, type NextIntent, type NextStep } from "../lib/nextStep";
import { nNights } from "../lib/i18nText";
import { loadHome, loadPassport } from "../lib/passport";
import { displayCurrency } from "../lib/displayCurrency";
import { homeCurrencyOf, tripFacts } from "../lib/tripFacts";

import type { Capture, Item, Suggestion, Trip } from "../lib/types";
import { chooseItem, hideNights, markSuggestionAdded, setVisaDone, undo as takeBack, updateTrip } from "./actions";
import { legEndsByItem, legModeByItem } from "../lib/cardKinds";
import { inheritedDocs } from "../lib/docs";
import { deleteItem, onHidden, onRemoved } from "../lib/removal";
import { undoSlot } from "../lib/undo";
import { undoTrip, type Undoable } from "../lib/undoables";
import { addQuick, templateLabel, TEMPLATES, type InsertAt, type Template, type TemplateId } from "../lib/templates";
import { categorize, catDomKey, findInSections, planProgress, sectionOfItem, SECTION_ORDER, type SectionId } from "../lib/categories";
import { planList } from "../lib/planList";
import { firstField, keepDraftFor, type CardFocus } from "../lib/inlineEdit";
import { newId } from "../lib/db";
import { AddButton, AddSheet } from "./cards/AddSheet";
import { openDoc, useTripDocs } from "./cards/DocAccess";
import { LegCard } from "./cards/LegCard";
import { EmptyLegCard, EmptyRecordCard } from "./cards/EmptyCard";
import { EmptyEnvContext, type EmptyEnv } from "./cards/emptyEnv";
import { isEmptyLeg, isEmptyRecord } from "../lib/emptyCards";
import { liveSource } from "../lib/offerSources";
import { foreignCountries, homeFromFlights } from "../lib/suggestions";
import { CardEnvContext, NavGroup, PlanCard, type CardEnv } from "./cards/PlanCard";
import { SilhouetteDefs } from "./cards/Silhouettes";
import { UndoToast } from "./cards/UndoToast";
import { isIdea } from "../lib/booking";
import { findTarget, show, TodoList } from "./Progress";
import { cityRanges, countryCodesOf, countryNames, sectionTally } from "../lib/heroInfo";
import { answerParents, answersAny, mainPlaceOf, mainPlaces, placesKey, placesPrompt, placesSystemPrompt, resolveParents } from "../lib/destinations";
import { acceptNoteLabel, type Pref } from "../lib/preferences";
import { acceptStyle, budgetLevel, styleChips, styleKey, stylePrompt } from "../lib/tripStyle";
import { intentEntries } from "./IntentCard";
import type { HeroCity } from "./TripHero";
import { Hero } from "./hero/Hero";
import { HeroMini } from "./hero/HeroMini";
import type { HeroNext } from "./hero/HeroStrip";
import { TodayStrip, todayRowEl, useMinuteClock } from "./hero/TodayStrip";
import type { TripMenuActions } from "./hero/TripMenu";
import { PrintPlan } from "./PrintPlan";
import { PlanKey, PlanOrder } from "./plan/PlanOrder";
import type { GoTarget } from "./plan/JourneyCards";
import { chapterDomId, JourneyView } from "./plan/journey/JourneyView";
import type { PlanLink } from "./chat/planLink";
import { TipOn } from "./HoverTip";
import { PanoNewsTip } from "./PanoNewsTip";
import { usePanoDot } from "./usePanoDot";
import { claimOpening, playOpening } from "./opening";
import { reducedMotion } from "./motion";
import { heroNumbers, openNeedsText, plannedBookedText } from "../lib/lifecycle";
import { panoEntries } from "../lib/pano";
import type { PanoAt, PanoView } from "../lib/panoBoard";
import { countdown, countdownText } from "../lib/countdown";
import { kindLabel, LegRow } from "./LegRow";
import { HistoryDialog } from "./HistoryDialog";
import { ChangeNotices } from "./ShareSafety";
import type { HiddenInput } from "../lib/history";
import { BoardMap } from "./map/BoardMap";
import { CategoryPlan } from "./plan/CategoryPlan";
import { SECTION_META, useSectionOpen } from "./plan/sectionMeta";
import { SwipeCard } from "./SwipeCard";
import { useArrivals } from "./arrive/useArrivals";
import { useSuggestions } from "./useSuggestions";
import { DAY_MODES } from "../lib/dayView";
import { setDayMode, useDayMode } from "./days/dayMode";
import { TimelineView, type CardFor, type RenderGroup, type SettledFor, type TimelineMode } from "./Timeline";
import { PanoDialog } from "./board/v82/PanoDialog";
import { NeedGroup } from "./cards/NeedCard";
import { draftOf } from "../lib/draft";
import { journeyOf } from "../lib/tripShape";
import { UndatedIdeas } from "./ideas/IdeaTiles";
import { choiceOf, type Choice } from "../lib/choice";
import { pivotalFindings } from "../lib/pivots";
import type { ValueCard } from "../lib/value";
import type { Decisions } from "./useDecisions";
import { useWho } from "./Travellers";
import { onTripChange } from "../lib/tripUndo";
import { takeLangUndo } from "./langSwitch";
import { StartGuideCard } from "./start/StartGuideCard";
import { WorkLine } from "./WorkPill";
import { isPlaceholder } from "../lib/startTrip";

interface Props {
  trip: Trip;
  items: Item[];
  plan: Plan;
  openCaptures: Capture[];
  decisions: Decisions | null;
  onOpenItem: (item: Item) => void;
  onCompare: (groupKey: string) => void;
  /** Opens the share dialog (absent where the trip can't be shared). */
  onShare?: () => void;
  /** Geçmiş ve çöp kutusu is open (the ••• menu, 0.37); closing it. */
  historyOpen?: boolean;
  onHistoryClose?: () => void;
  /** v11: a line for the trip's chat ("Daha fazla fikir", a card's ✨), sent there as if typed. */
  onAsk?: (text: string) => void;
  /** The trip's ⋯ menu on the hero (v83 C1): what the board itself opens (Geçmiş ve çöp kutusu, Ayarlar, deleting the trip). */
  onHistory?: () => void;
  onSettings?: () => void;
  onDeleteTrip?: () => void;
  /** C34: the boxes and "Planda göster" / "Bunu seç", handed up for the chat beside the Plan (App.tsx); null once gone. */
  onPlanLink?: (link: PlanLink | null) => void;
}

export function TripPanel({ trip, items, plan, openCaptures, decisions, onOpenItem, onCompare, onShare, historyOpen = false, onHistoryClose, onAsk, onHistory, onSettings, onDeleteTrip, onPlanLink }: Props) {
  // The plan's dates: the ones set, widened by any stay booked or chosen outside them.
  const range = plan.range ?? trip.confirmedDates ?? tripDateRange(items);
  const today = decisions?.ctx.today ?? new Date().toISOString().slice(0, 10);
  const dayMode = useDayMode();
  const [view, setView] = useState<TimelineMode | "story" | "docs" | "map" | "board">("plan");
  // v82 (aşama 6): the Pano is a window over the plan, not a view. Where it is open: a top entry ("docs": Belgeler, C5), a
  // category, an intent (its key, or a record's group from an old card's "Pano'da aç"); null while it is shut.
  const [pano, setPano] = useState<PanoAt | null>(null);
  /** Opens the Pano window, at a place or on one of its side menu's top entries (the hero's gezi menüsü: `openPano("docs")`). */
  const openPano = useCallback((at: PanoAt | PanoView = {}) => setPano(typeof at === "string" ? { view: at } : { ...at }), []);
  // The group a legacy "board" view was asked for with (the sticky bar's Plan | Pano switch sets it, then the view).
  const [panoFocus, setPanoFocus] = useState<string | null>(null);
  // Belgeler and the Pano were views until v82: whatever still asks for one (the sticky bar, the ••• menu) opens the window instead.
  useLayoutEffect(() => {
    if (view !== "board" && view !== "docs") return;
    openPano(view === "docs" ? { view: "docs" } : { need: panoFocus ?? undefined });
    setPanoFocus(null);
    setView("plan");
  }, [view, panoFocus, openPano]);
  // "Son ziyaretten beri": what the other traveller did since the Pano was last open (a dot on its tab), on a shared trip.
  const panoNews = usePanoDot(trip.id, items, pano != null);
  // "Sihirli açılış": the first time this trip's Plan is ever open in this browser (once per trip), what is in view comes in in reading order and the
  // counters count up; below the fold as it is scrolled into view (opening.ts). Never on a tab switch or a re-render; a touch or key ends it at once.
  // (v82: the Pano is a window that grows in by itself, E8; the v11 Pano's own opening of its strips is no longer played.)
  const openingTried = useRef(new Set<string>());
  useLayoutEffect(() => {
    if (view !== "plan" || openingTried.current.has(view)) return;
    openingTried.current.add(view);
    if (!claimOpening(trip.id)) return;
    const run = playOpening();
    return () => run?.finish();
  }, [view, trip.id]);
  const working = openCaptures.filter((c) => c.status === "pending" || c.status === "processing");
  const failed = openCaptures.filter((c) => c.status === "error");
  const listings = decisions?.ctx.listings;
  const legs = useMemo(() => buildLegs(plan, trip, listings), [plan, trip, listings]);
  // The trip's shape under the Plan's head (v11): its stops and the way between them.
  const shape = useMemo(() => journeyOf(plan, legs, items), [plan, legs, items]);
  const reading = listings
    ? new Set(items.filter((i) => needsReading(i, listings.get(listingKeyOf(i))) && !listings.get(listingKeyOf(i))?.error).map(listingKeyOf)).size
    : 0;
  const hidden = useMemo(() => new Set(trip.hidden ?? []), [trip.hidden]);
  const timeline = useMemo(() => buildTimeline(plan, legs, items, hidden), [plan, legs, items, hidden]);
  // The Plan by category (spec 0.34): every block and record in one of seven sections; which are open, per trip.
  const rank = useMemo(() => new Map([...(decisions?.byGroup.values() ?? [])].flatMap((d) => d.options.map((o, i) => [o.item.id, i] as const))), [decisions?.byGroup]);
  // The decision each option is in, and the option a need's card shows as "Önerimiz" (lib/draft.ts): the headers count them (F7).
  const decisionByItem = useMemo(() => new Map([...(decisions?.byGroup.values() ?? [])].flatMap((d) => d.options.map((o) => [o.item.id, d] as const))), [decisions?.byGroup]);
  const draftFor = useCallback((list: Item[]) => draftOf(list, decisionByItem.get(list[0]?.id)), [decisionByItem]);
  // A record's files (its own and those of the plans it replaced): a booking with one is Hazır (lifecycle.ts).
  const inherited = useMemo(() => inheritedDocs(plan.closed), [plan.closed]);
  const docsFor = useTripDocs(trip.id, inherited);
  // Where each need stands (lifecycle.ts): a place the start only made room for and an empty card are Aranacak.
  const stageCtx = useCallback(
    (item: Item) => ({ placeholder: isPlaceholder(trip, item), empty: isEmptyRecord(trip, item, docsFor(item.id).length, items), docs: docsFor(item.id).length }),
    [trip, items, docsFor],
  );
  // Who comes their own way in (kişiye özel): the way in is theirs to find too.
  const ownWayIn = useMemo(() => Object.keys(trip.travellers?.from ?? {}), [trip.travellers?.from]);
  const sections = useMemo(
    () => categorize({ plan, timeline, items, legs, hidden, rank, today, stageCtx, ownWayIn, draftFor }),
    [plan, timeline, items, legs, hidden, rank, today, stageCtx, ownWayIn, draftFor],
  );
  // What Gizlenenler holds, for the history's "Geri getir" (0.37): ruled-out records, transfers and nights not needed.
  const hiddenForHistory = useMemo<HiddenInput[]>(
    () =>
      sections.flatMap((s) => s.hidden).flatMap((h): HiddenInput[] => {
        if (h.kind === "dismissed") return [{ kind: "dismissed", item: h.item }];
        if (h.kind === "leg") {
          const cities = `${h.leg.from.city ?? h.leg.from.label} → ${h.leg.to.city ?? h.leg.to.label}`;
          return [{ kind: "hidden", key: h.key, label: cities, names: [cities, kindLabel()[h.leg.kind]] }];
        }
        if (h.kind === "nights") {
          const label = `${h.city ?? L("Konaklama", "Stay")} ${formatDateRange(h.range.start, h.range.end)}`;
          return [{ kind: "hidden", key: h.key, label, names: [label, h.city ?? ""] }];
        }
        return [];
      }),
    [sections],
  );
  const [isOpen, setOpened] = useSectionOpen(trip.id);
  /** Opens a block of the plan (from the itinerary): its section opens, the card comes into view. */
  const showOnPlan = (key: string) => {
    // A line of Gün gün with no entry of its own ("item:ID", "idea:ID") is found by its record.
    const rec = /^(?:item|idea):(.+)$/.exec(key);
    const hit = findInSections(sections, rec ? { item: rec[1] } : { entry: key });
    setView("plan");
    if (hit) setOpened(hit.section, true);
    setTimeout(() => show(document.getElementById(entryDomId(key)) ?? (hit && document.getElementById(entryDomId(hit.dom)))), 60);
  };
  /** A small card of "Yolculuk sırasıyla" (a stay, an event, a place) goes to its real card on the Plan: its section opens, the card comes into view with a flash. */
  const showFromStory = (target: GoTarget) => {
    const hit = findInSections(sections, target);
    setView("plan");
    if (hit) setOpened(hit.section, true);
    setTimeout(() => show(findTarget(target) ?? (hit && document.getElementById(entryDomId(hit.dom)))), 60);
  };
  // A card that changes section (a change of city now by plane: Ulaşım → Uçuş; a to-do moved to Etkinlikler)
  // isn't lost from under the hand: its new section opens and the page goes to it, with a flash.
  const placed = useRef<{ tripId: string; at: Map<string, SectionId> } | null>(null);
  useEffect(() => {
    const now = new Map(sections.flatMap((s) => s.entries.map((e) => [e.key, s.id] as const)));
    const before = placed.current?.tripId === trip.id ? placed.current.at : null;
    placed.current = { tripId: trip.id, at: now };
    if (!before || view !== "plan") return;
    // Compared where it's drawn both times (v11: a restaurant is drawn under Yapılacak şeyler, a chore under Hazırlık,
    // while their own section stays "food" / "other"): else every one of them "moved" on every change and the page
    // kept going to Hazırlık.
    const hit = sections.flatMap((s) => s.entries.map((e) => ({ e, id: s.id }))).find(({ e, id }) => before.has(e.key) && before.get(e.key) !== id);
    if (!hit) return;
    setOpened(hit.id, true);
    setTimeout(() => show(document.getElementById(entryDomId(catDomKey(hit.e)))), 60);
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
  // What's being read shows in its section; what lands slides in (arrive/useArrivals.tsx).
  const arrivals = useArrivals({ tripId: trip.id, items, sections, openCaptures, view, isOpen, setOpened, reveal });

  // --- plan cards: the way chosen per transfer, files, delete with undo, the add sheet ---
  const legModes = useMemo(() => legModeByItem(legs), [legs]);
  const legEnds = useMemo(() => legEndsByItem(legs), [legs]);
  const undo = useMemo(() => undoSlot<Undoable>(), []);
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  useEffect(() => undo.subscribe(setUndoable), [undo]);
  // Another trip on screen: the last deletion stays deleted.
  useEffect(() => () => void undo.take(), [trip.id, undo]);
  // A plan the chat took back ("taksiyi kaldır") gets the same "Geri al".
  useEffect(() => onRemoved((removed) => removed.item.tripId === trip.id && undo.show({ kind: "removed", removed })), [trip.id, undo]);
  // A transfer the chat hid ("Gaula → Madeira'yı kaldır") gets the "Geri al" of the board's "Gerek yok".
  useEffect(() => onHidden((h) => h.tripId === trip.id && undo.show({ kind: "hidden", ...h })), [trip.id, undo]);
  // A setting the chat changed ("bütçeyi euro göster", "Sabine de geliyor") gets the same "Geri al".
  useEffect(() => onTripChange((change) => change.tripId === trip.id && undo.show({ kind: "trip", change })), [trip.id, undo]);
  // The board's language the chat switched: the page reloaded into it, and its "Geri al" waits here once.
  useEffect(() => {
    const switched = takeLangUndo(trip.id);
    if (switched) undo.show({ kind: "lang", tripId: trip.id, ...switched });
  }, [trip.id, undo]);
  // A change of city hidden with "Gerek yok" that got a flight or a way since is back for good: its key goes, so
  // it can't hide again on its own if that flight is taken off later.
  useEffect(() => {
    const stale = staleHiddenMoves(legs, trip.hidden);
    if (stale.length) void updateTrip(trip.id, (t) => ({ ...t, hidden: (t.hidden ?? []).filter((k) => !stale.includes(k)) }), { touch: false });
  }, [legs, trip.id, trip.hidden]);
  const offer = (u: Undoable) => undoTrip(u) === trip.id && undo.show(u);
  /** `suggestion`: opened by a suggestion's "Plana ekle" it couldn't make whole; a tile picked marks it added. */
  const [sheet, setSheet] = useState<{ at: InsertAt | null; editing: Item | null; only?: readonly TemplateId[]; suggestion?: Suggestion } | null>(null);
  const [focus, setFocus] = useState<CardFocus | null>(null);
  useEffect(() => setFocus(null), [trip.id]);
  // A box that went away without Enter, Tab or Esc (another card opened): what was typed in it doesn't come back.
  useEffect(() => keepDraftFor(focus), [focus]);
  /**
   * A tile picked (spec 0.33 §2): the record at once, "X eklendi · Geri al", open on the Plan for editing in
   * its section (opened, scrolled to, first field open; an idea's title, the one field its row has).
   */
  const quickAdd = async (tpl: Template, at: InsertAt | null) => {
    setSheet(null);
    const id = newId();
    arrivals.quiet(id); // it has its own "eklendi · Geri al"
    const item = await addQuick(trip.id, tpl, at, id);
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
    trip,
    decisions,
    today,
    legModes,
    legEnds,
    docsFor,
    remove: (item) => void deleteItem(item).then((removed) => offer({ kind: "removed", removed })),
    offer,
    hideNights: (range, label) => void hideNights(trip.id, range, label).then(offer),
    add: (at) => setSheet({ at, editing: null }),
    edit: (item) => setSheet({ at: null, editing: item }),
    focus,
    setFocus,
    onOpenItem,
    onCompare,
    onPano: (group) => openPano({ need: group }),
    ask: onAsk,
    weather: (city) => {
      const place = city ? places.find((p) => sameCity(p.city, city)) : null;
      return place ? (cachedWeather(`${place.city}|${place.start}|${place.end}|${today}`) ?? null) : null;
    },
  };

  // --- the hero: a photo per city, the paragraph, what's confirmed, the facts column ---
  // The Plan's cities (every place slept in), and the hero's: the main places they belong to (destinations.ts;
  // a stay in Gaula is Madeira's). The model says which place is inside which, once per set of cities; until it
  // answers (no key, an error), only a stay whose address names another of the trip's places is folded.
  const cityNames = useMemo(() => citiesOf(plan, items), [plan, items]);
  const placesFor = placesKey(cityNames);
  const here = `${trip.id}:${placesFor}`;
  // Which set of places is on screen now, for an answer that comes back after it changed.
  const placesNow = useRef(here);
  placesNow.current = here;
  // The model's answer, used at once (the stored copy follows through IndexedDB); the sets it couldn't answer.
  const [answered, setAnswered] = useState<{ at: string; parents: Record<string, string> } | null>(null);
  const [unanswered, setUnanswered] = useState<ReadonlySet<string>>(() => new Set());
  const known = trip.placeParents?.key === placesFor ? trip.placeParents.parents : answered?.at === here ? answered.parents : null;
  // The model's answer (checked) or the guess from the addresses; the table of islands and regions fills in the rest,
  // so Gaula is Madeira's with no key too.
  const parents = useMemo(() => resolveParents(cityNames, items, known), [known, cityNames, items]);
  const mains = useMemo(() => mainPlaces(cityNames, parents), [cityNames, parents]);
  const mainNames = useMemo(() => mains.map((m) => m.name), [mains]);
  const askedParents = useRef(new Set<string>());
  useEffect(() => {
    if (cityNames.length < 2 || trip.placeParents?.key === placesFor || askedParents.current.has(here)) return;
    const asked = here;
    askedParents.current.add(asked);
    const countryOf = (city: string) => {
      const code = items.find((i) => i.category === "stay" && i.status !== "dismissed" && cityKeyOf(i.city) === cityKeyOf(city) && i.countryCode)?.countryCode;
      return code ? (countryNames([code])[0] ?? null) : null;
    };
    void (async () => {
      try {
        const llm = await getProvider();
        const out = await llm.generateJson(
          placesSystemPrompt(),
          placesPrompt(cityNames, countryOf),
          z.object({ places: z.array(z.object({ place: z.string(), parent: z.string().nullable() })) }),
        );
        // What it folded, and "" for a place it kept on purpose (null), so the table can't fold that one.
        const accepted = answerParents(cityNames, out.places);
        // The places changed while it answered: not written over; asked again if this set comes back.
        if (placesNow.current !== asked) return void askedParents.current.delete(asked);
        // An empty list is an answer (nothing to fold) and is kept; a list about none of the trip's places is a
        // misread one ("Gaula (Portekiz)" before 0.35.6): not kept, so it's asked again the next time the board opens.
        if (out.places.length && !answersAny(cityNames, out.places)) throw new Error("the answer names none of the places");
        setAnswered({ at: asked, parents: accepted });
        await updateTrip(trip.id, (t) => ({ ...t, placeParents: { key: placesFor, parents: accepted } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("main places", error); // the guess from the addresses stands
        setUnanswered((s) => new Set(s).add(asked));
      }
    })();
  }, [trip.id, trip.placeParents?.key, placesFor, here, cityNames, items]);
  // What's asked of the model per place (photos, mood, style) waits for the main places, so Gaula isn't asked for.
  const placesSettled = cityNames.length < 2 || known !== null || unanswered.has(here);
  const cities = useMemo<HeroCity[]>(() => {
    // A main place's photo, else (none yet, or none found) the first of its places that has one: Funchal's for Madeira.
    const photo = (key: string | null) => (key ? trip.cityImages?.[key] : null) || null;
    const list = mains.map((m) => ({ name: m.name, image: photo(cityKeyOf(m.name)) ?? m.members.map((c) => photo(cityKeyOf(c))).find(Boolean) ?? null }));
    // A trip from before the city photos: its one picture goes to the first city (or stands alone).
    const shown =
      trip.heroImage && !list.some((c) => c.image) ? (list.length ? [{ ...list[0], image: trip.heroImage }, ...list.slice(1)] : [{ name: "", image: trip.heroImage }]) : list;
    // Who took each: as the proxy said, else what the address tells (Wikipedia, Pexels).
    return shown.map((c) => ({ ...c, credit: creditOf(c.image, trip.photoCredits) }));
  }, [mains, trip.cityImages, trip.heroImage, trip.photoCredits]);
  // A city's photo is looked up once (a miss is stored as null, so it isn't asked again). Once the
  // sharing server's photo proxy is set up, a stored miss or Wikipedia picture is asked for again, once
  // per trip and city in a session; a miss then keeps the old picture. The first city's new photo also
  // becomes the trip card's (TripsHome).
  const askedImages = useRef(new Set<string>());
  useEffect(() => {
    if (!placesSettled) return;
    const unasked = mainNames.filter((name) => {
      const key = cityKeyOf(name);
      return key && !askedImages.current.has(`${trip.id}:${key}`) && wantsCityImage(trip.cityImages?.[key], true);
    });
    if (!unasked.length) return;
    for (const name of unasked) askedImages.current.add(`${trip.id}:${cityKeyOf(name)}`);
    const firstKey = mainNames.length ? cityKeyOf(mainNames[0]) : null;
    void (async () => {
      const proxy = await imageProxy();
      for (const name of unasked) {
        const key = cityKeyOf(name)!;
        if (!wantsCityImage(trip.cityImages?.[key], Boolean(proxy))) continue;
        try {
          const found = await findCityPhoto(name, { proxy });
          const url = found?.url ?? null;
          await updateTrip(
            trip.id,
            (t) => {
              const next = {
                ...t,
                cityImages: { ...t.cityImages, [key]: nextCityImage(t.cityImages?.[key], url) },
                ...(key === firstKey ? { heroImage: nextHeroImage(t.heroImage, url) } : {}),
              };
              return { ...next, photoCredits: keptCredits(next, [found]) };
            },
            { touch: false },
          );
        } catch (error) {
          // An outage is not "no photo": store nothing, so the next visit asks again.
          console.warn("city photo", name, error);
        }
      }
    })();
  }, [trip.id, trip.cityImages, mainNames, placesSettled]);
  // The mood sentence: written once per set of main places by the traveller's model; one with a number is dropped.
  const moodFor = moodKey(mainNames);
  const askedMood = useRef<string | null>(null);
  useEffect(() => {
    if (!placesSettled || !mainNames.length || trip.mood?.key === moodFor || askedMood.current === `${trip.id}:${moodFor}`) return;
    askedMood.current = `${trip.id}:${moodFor}`;
    void (async () => {
      try {
        const llm = await getProvider();
        const out = await llm.generateJson(
          L(
            "Gezinin ruhunu anlatan tek kısa cümle yaz. Rakam, tarih, fiyat yazma. En fazla 120 karakter.",
            "Write one short sentence capturing the trip's mood. No numbers, dates or prices. At most 120 characters.",
          ),
          mainNames.join(" → "),
          z.object({ text: z.string() }),
        );
        const text = acceptMood(out.text) ? out.text.trim() : "";
        await updateTrip(trip.id, (t) => ({ ...t, mood: { key: moodFor, text } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("mood sentence", error); // the status sentence stands alone
      }
    })();
  }, [trip.id, trip.mood?.key, moodFor, mainNames, placesSettled]);
  // The style words: picked once per set of main places and what the traveller wrote about the trip (their
  // notes: "balayı", "macera istiyoruz"), only from the fixed list. Priorities, findings and guesses change
  // often and say nothing about the trip's character, so they don't ask again (asking again re-rolled the words).
  const intent = useMemo(() => intentEntries(trip, decisions).entries, [trip, decisions]);
  const understood = useMemo(() => intent.filter((e) => e.key.startsWith("n:")).map((e) => e.text), [intent]);
  const styleFor = styleKey(mainNames, understood);
  const askedStyle = useRef<string | null>(null);
  useEffect(() => {
    if (!placesSettled || !mainNames.length || trip.style?.key === styleFor || askedStyle.current === `${trip.id}:${styleFor}`) return;
    askedStyle.current = `${trip.id}:${styleFor}`;
    void (async () => {
      try {
        const llm = await getProvider();
        // The words shown now go along: kept unless what changed clearly calls for others.
        const now = acceptStyle(trip.style?.ids ?? []);
        const keep = now.length ? L(`Şu anki etiketler: ${now.join(", ")}. Yalnız açıkça uymuyorlarsa değiştir.`, `Current tags: ${now.join(", ")}. Change them only if they clearly no longer fit.`) : "";
        const out = await llm.generateJson(stylePrompt(), [mainNames.join(" → "), ...understood, keep].filter(Boolean).join("\n"), z.object({ ids: z.array(z.string()) }));
        await updateTrip(trip.id, (t) => ({ ...t, style: { key: styleFor, ids: acceptStyle(out.ids) } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("trip style", error); // the budget's word stands alone
      }
    })();
  }, [trip.id, trip.style?.key, styleFor, mainNames, understood, placesSettled]);
  // "Tercihler" names a note in a few words: one the code can't name (no topic it knows) is named by the model,
  // once per note and wording, all waiting notes in one ask; an answer that isn't a label is kept as "" so the
  // first words stand and it isn't asked again.
  const unnamed = intent.flatMap((e) => (e.pref.kind === "note" && e.pref.level == null && e.pref.labelKey && trip.prefLabels?.[e.pref.labelKey] === undefined ? [e.pref] : []));
  const unnamedFor = unnamed.map((p) => p.labelKey).join("|");
  const askedLabels = useRef(new Set<string>());
  useEffect(() => {
    const notes = unnamed.filter((p): p is Extract<Pref, { kind: "note" }> => p.kind === "note" && !askedLabels.current.has(`${trip.id}:${p.labelKey}`));
    if (!notes.length) return;
    for (const p of notes) askedLabels.current.add(`${trip.id}:${p.labelKey}`);
    void (async () => {
      try {
        const llm = await getProvider();
        const out = await llm.generateJson(
          L(
            "Her not için 1–3 kelimelik kısa bir konu etiketi yaz (ör. \"Şarap tadımı\", \"Balkon\", \"Erken giriş\"). Cümle değil, etiket. Türkçe yaz. id'yi aynen geri yaz.",
            "For each note write a short 1–3 word topic label (e.g. \"Wine tasting\", \"Balcony\", \"Early check-in\"). A label, not a sentence. Write in English. Return each id as given.",
          ),
          `<notes>\n${notes.map((p, n) => JSON.stringify({ id: String(n + 1), text: p.topic })).join("\n")}\n</notes>`,
          z.object({ labels: z.array(z.object({ id: z.string(), label: z.string() })) }),
        );
        const named = Object.fromEntries(notes.map((p, n) => [p.labelKey!, acceptNoteLabel(out.labels.find((l) => l.id.trim() === String(n + 1))?.label)]));
        await updateTrip(trip.id, (t) => ({ ...t, prefLabels: { ...t.prefLabels, ...named } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("preference labels", error); // the first words stand
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked by the set of unnamed notes
  }, [trip.id, unnamedFor]);
  const [passport, setPassport] = useState("TR");
  // The passport as set in Settings (null while it's the default): the suggestions about going abroad wait for it.
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      void loadPassport().then(setPassport);
      void loadHome().then(setHome);
    };
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
  const [todoOpen, setTodoOpen] = useState<"all" | "deadline" | null>(null);
  // The plan as a PDF (PrintPlan.tsx): drawn while the print window is open.
  const [printing, setPrinting] = useState(false);
  // Belgeler from the hero's ⋯ menu: the Pano window on its Belgeler view (C5).
  const openDocs = () => openPano("docs");
  const heroRef = useRef<HTMLElement>(null);
  // Another trip's to-do list isn't the one that was open.
  useEffect(() => {
    setTodoOpen(null);
  }, [trip.id]);
  const progress = decisionProgress(timeline, items, plan, decisions?.byGroup, today, (i) => isPlaceholder(trip, i));
  const bar = decisions ? budgetBar(plan, items, decisions.ctx, decisions.byGroup) : null;
  // v11: each section's share of the budget ("€500 ayrıldı"), by what it's likely to cost.
  const allot = bar ? sectionAllotments(bar) : null;
  const facts = useMemo(
    () =>
      tripFacts(items, {
        passport,
        // The traveller's own money (a TR passport: TRY), not the budget's: "€1 = ₺38,20".
        homeCurrency: displayCurrency() ?? homeCurrencyOf(passport, decisions?.ctx.currency ?? "EUR"),
        rates: decisions?.ctx.rates ?? null,
        homeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        start: range?.start ?? null,
      }),
    [items, passport, decisions?.ctx.currency, decisions?.ctx.rates, range?.start],
  );
  const who = useWho(trip, facts.adults);
  // The countries abroad an eSIM is for (the eSIM's empty card): home as Settings has it, else where the first flight leaves.
  const esimCountries = useMemo(() => {
    const own = home ?? homeFromFlights(items);
    return own ? foreignCountries(items, own) : [];
  }, [home, items]);
  // Öneriler: the rules' and the AI's/chat's suggestions atop their sections (never counted); the AI review when due,
  // told the hero's main places and who goes.
  const suggestions = useSuggestions({
    trip, plan, items, timeline, legs, mains, home, today, ready: placesSettled, offer, quiet: arrivals.quiet,
    travellers: who.count || null,
    openSheet: (s, template, at) => setSheet({ at, editing: null, only: [template], suggestion: s }),
    onAdded: (item) => {
      if (view !== "plan") setView("plan");
      setOpened(sectionOfItem(item), true);
      setFocus({ id: item.id, field: null, scroll: true });
    },
  });
  // The plan line: what the Plan's sections hold (each header's "y"), so both always say the same thing.
  const tally = useMemo(() => sectionTally(sections), [sections]);
  const chips = styleChips(
    // The last words stay on screen while new ones are asked for (no empty flash, no flicker).
    acceptStyle(trip.style?.ids ?? []),
    // Per person: the people named or counted (Travellers), else the saves' adults.
    budgetLevel(trip.budget, range ? nightsBetween(range.start, range.end) + 1 : 0, who.count || facts.adults, decisions?.ctx.rates ?? null),
  );
  /** A day card's photo: its city's, else its main place's (the hero's: Gaula's day shows Madeira), else the trip's. */
  const cityImageOf = (city: string | null) =>
    (city ? (trip.cityImages?.[cityKeyOf(city)!] ?? trip.cityImages?.[cityKeyOf(mainPlaceOf(mains, city))!]) : null) ?? trip.heroImage ?? null;
  const countries = useMemo(() => countryCodesOf(items), [items]);
  const places = useMemo(() => cityRanges(plan, mains, range), [plan, mains, range]);
  const mood = trip.mood?.key === moodFor && trip.mood.text ? trip.mood.text : null;
  // The sections' "3/4"s added up: whether anything is saved yet, and (with nothing left to do) all set.
  const done = useMemo(() => planProgress(sections), [sections]);
  // The hero's "Planlama %75" and the list it opens, from the same needs: booked / planned / waiting for a
  // decision. A flight or a stay the start chat only made room for waits for a decision (startTrip.ts isPlaceholder).
  const todo = planList(sections, progress.todos, today);
  /** A section of the Plan (a cell of the hero's plan line): opened and scrolled to (else its "Ekle" chip). */
  const openSection = (id: SectionId) => {
    const drawn = sections.some((s) => s.id === id && (s.entries.length || s.hidden.length));
    setView("plan");
    if (drawn) setOpened(id, true);
    setTimeout(() => {
      const el = document.querySelector(`[data-section="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else show(document.querySelector(`[data-section-chip="${id}"]`));
    }, 60);
  };
  const endPrint = useCallback(() => setPrinting(false), []);
  // What the PDF's own summary says when the hero can't be copied (lifecycle.heroNumbers).
  const numbers = heroNumbers(todo.counts);

  // --- the trip in time (F2, D8): its own clock (the destination's), and whether it is being planned, lived or over ---
  const zone = facts.local?.info.timeZone ?? null;
  // A new moment each minute from two days before the first day to the last (check-in, the Bugün strip's hours).
  const at = useMinuteClock(!!range && today >= addDays(range.start, -2) && today <= range.end);
  const local = localNow(at, zone);
  const mode = tripModeOf(range, today);

  // --- the v82 hero (aşama 1): the backbone's intents (lib/intents.ts) give its two shares (B9), its mosaic and "Sıradaki" ---
  const intentInput = useMemo<IntentInput>(
    () => ({ trip, plan, sections, items, today, decisions: decisions?.byGroup, ctx: decisions?.ctx, docsFor, people: who.count || null, suggestions: suggestions.bySection, now: at }),
    [trip, plan, sections, items, today, decisions, docsFor, who.count, suggestions.bySection, at],
  );
  const collections = useMemo(() => collectionsOf(intentInput), [intentInput]);
  const heroIntents = useMemo(() => collections.flatMap((c) => c.intents), [collections]);
  // Row 127 (D8, K17): on the trip a need left open on a day gone by is no decision, after it none is; never a night on the
  // plane. The shares, "n karar", "Sıradaki" and the first decision go by these.
  const counted = useMemo(() => countedIntents(heroIntents, { today, mode, plan, items }), [heroIntents, today, mode, plan, items]);
  const counts = useMemo(() => heroCounts(counted), [counted]);
  const mosaic = useMemo(
    () =>
      mosaicOf({
        cities: cities.map((c) => {
          const days = places.find((p) => p.city === c.name);
          return { name: c.name, image: c.image, credit: c.credit ?? null, nights: days ? nNights(nightsBetween(days.start, days.end)) : null };
        }),
        places: placesOfIntents(heroIntents, (image) => creditOf(image, trip.photoCredits)),
      }),
    [cities, places, heroIntents, trip.photoCredits],
  );
  const estimated = !!range && !trip.confirmedDates && !plan.range;
  const heroDates = range ? { range, estimated, countdown: countdownText(countdown(range, today)), tip: datesTip(places, estimated) } : null;
  const heroBudget = useMemo(() => {
    const view = budgetView(bar, who.count || facts.adults || 0);
    return bar && view ? { view, bar } : null;
  }, [bar, who.count, facts.adults]);
  const visaToGet = facts.visa?.kind === "visa" && !trip.visaDone;
  /** An intent of the Plan: its category opens, the page goes to it with a flash. */
  const goIntent = (intent: NextIntent) => {
    setView("plan");
    setOpened(intent.section, true);
    setTimeout(() => show(intent.domKeys.map((k) => document.getElementById(entryDomId(k))).find(Boolean) ?? document.querySelector(`[data-section="${intent.section}"]`)), 60);
  };
  const goVisa = () => {
    setView("plan");
    setOpened("other", true);
    setTimeout(() => show(document.querySelector("[data-visa]")), 60);
  };
  // F4: "Sıradaki" updates itself; C30: "İlk kaydı ekle" with nothing saved, the PDF once all is bought, sharing when nothing is left.
  const step: NextStep = nextStep({ intents: counted, saved: done.total > 0, visa: visaToGet, sharable: !!onShare });
  const runStep: Record<NextStep["kind"], (() => void) | null> = {
    first: () => addIn(null, null),
    visa: goVisa,
    intent: step.kind === "intent" ? () => goIntent(step.intent) : null,
    pdf: () => setPrinting(true),
    share: onShare ?? null,
    ready: null,
  };
  // --- "Bugün" (D8, v83 "gezi sırasında"): on the trip's days the strip in the hero's place, by the trip's own clock ---
  const todayInput = useMemo<TodayInput>(
    () => ({ trip, plan, timeline, items, today: local.day, time: local.time, at, listings, docsFor }),
    [trip, plan, timeline, items, local.day, local.time, at, listings, docsFor],
  );
  const strip = useMemo(() => todayStrip(todayInput), [todayInput]);
  // F2, F4: time decides "Sıradaki" on the trip (today's next thing) and in a booked flight's last 48 hours (its check-in);
  // else the decisions do.
  const timed = useMemo(() => timedNext(todayInput, strip), [todayInput, strip]);
  const runTimed = (n: TimedNext): (() => void) => {
    if (n.kind === "checkin") {
      const box = heroIntents.find((i) => i.itemIds.includes(n.item.id));
      return () => (box ? goIntent(box) : reveal({ item: n.item.id }));
    }
    return () => show(n.kind === "today" ? todayRowEl(n.row.key) : document.querySelector(".x-today .xt-next"));
  };
  const timedTitle = (n: TimedNext): string | undefined =>
    n.kind === "checkin" && n.item.bookingRef ? L(`PNR ${n.item.bookingRef} · kalkışa ${n.hours} saat`, `PNR ${n.item.bookingRef} · ${n.hours} hours to go`) : undefined;
  const heroNext: HeroNext = timed
    ? { label: timedNextLabel(timed), title: timedTitle(timed), run: runTimed(timed) }
    : {
        label: step.kind === "pdf" && printing ? L("PDF hazırlanıyor…", "Making the PDF…") : nextLabel(step),
        title: step.kind === "pdf" ? L("Gezinin özeti ve gün gün akışı, bir PDF dosyası olarak", "The trip's summary and its days, as a PDF file") : undefined,
        run: runStep[step.kind],
      };
  // F5: a tap on "%61 planda" goes to the first decision (a visa to get first, as "Sıradaki" does).
  const firstOpen = counted.find((i) => i.status === "suggested" || i.status === "deciding" || i.status === "searching");
  const onFirstDecision = visaToGet ? goVisa : firstOpen ? () => goIntent(firstOpen) : null;
  const tripMenu: TripMenuActions = {
    onDocs: openDocs,
    onShare,
    onPdf: () => setPrinting(true),
    mapUrl: routeUrl(items),
    onHistory,
    onNewChat: () => void resetConversation(trip.id),
    onLink: () => document.querySelector<HTMLInputElement>('.composer input[type="text"]')?.focus(),
    onSettings,
    onDelete: onDeleteTrip,
  };

  // --- "Yolculuk sırasıyla" (v81-v83; lib/journeyChapters.ts): the same boxes in the order the trip is lived ---
  const journey = useMemo(() => journeyChapters({ input: intentInput, timeline, collections }), [intentInput, timeline, collections]);
  /**
   * A box on the Plan by category: its category opens, the box (plan v82: `data-intent`) or its card comes into view with
   * a flash; else its entry, else its category. `card`: the record's own card first (a row's card, a chat card's record).
   */
  const goBox = (t: { intentKey: string | null; section: SectionId; domKeys: readonly string[]; itemId: string | null }, card = false) => {
    if (card && t.itemId && findInSections(sections, { item: t.itemId })) return showFromStory({ item: t.itemId });
    setView("plan");
    setOpened(t.section, true);
    setTimeout(() => {
      const box = t.intentKey ? document.querySelector(`[data-intent="${CSS.escape(t.intentKey)}"]`) : null;
      const entry = t.domKeys.map((k) => document.getElementById(entryDomId(k))).find(Boolean) ?? null;
      const record = t.itemId ? findTarget({ item: t.itemId }) : null;
      show((card ? (record ?? box) : (box ?? record)) ?? entry ?? document.querySelector(`[data-section="${t.section}"]`));
    }, 60);
  };
  /** "Bunu seç" / "Plana koy": the record taken in its box (one chosen before it for the same need goes back to the options). */
  const take = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const box = heroIntents.find((i) => i.itemIds.includes(itemId));
    void chooseItem(item, box ? items.filter((i) => box.itemIds.includes(i.id)) : [item]);
  };
  /** A booking's file, the first one (the box's Ayrıntı lists them all). */
  const openFirstDoc = (itemId: string) => {
    const first = docsFor(itemId)[0];
    if (first) void openDoc(first.id);
  };
  const journeyOn = {
    onGo: (t: StepTarget) => goBox(t, t.itemId != null),
    // The choice is the Plan's at once: the step turns "Seçildi" where it stands.
    onTake: (itemId: string) => take(itemId),
    onDoc: openFirstDoc,
  };
  /** The Bugün strip's "Yolculuk sırasıyla →": the view, at today's chapter. */
  const openJourneyToday = () => {
    setView("story");
    const key = journey.todayKey;
    if (key) setTimeout(() => document.getElementById(chapterDomId(key))?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }), 60);
  };
  // D8: on the trip the Plan opens in trip order (today's chapter first, the ones behind folded), once per trip shown.
  const viewFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (viewFor.current === trip.id) return;
    viewFor.current = trip.id;
    if (mode === "trip" && journey.available) setView("story");
  }, [trip.id, mode, journey.available]);
  // D15: no dates, no trip order; a trip whose dates went while it was open goes back to the categories.
  useEffect(() => {
    if (view === "story" && !journey.available) setView("plan");
  }, [view, journey.available]);
  const orderOff = journey.available ? undefined : { story: journey.reason ?? "" };

  // C34: the chat beside the Plan draws its cards from these boxes and goes to them ("Planda göster", "Bunu seç").
  const chatLive = useRef({ goBox, take, openPano });
  chatLive.current = { goBox, take, openPano };
  useEffect(() => {
    const show = (t: PlanTarget) => {
      const { goBox: go, openPano: pano } = chatLive.current;
      if (t.kind === "intent") go({ ...t, itemId: null });
      else if (t.kind === "section") go({ intentKey: null, section: t.section, domKeys: [], itemId: t.itemId }, true);
      else pano(t.intentKey ? { need: t.intentKey } : { section: t.section });
    };
    onPlanLink?.({
      tripId: trip.id,
      collections,
      show,
      pick: (itemId, t) => {
        chatLive.current.take(itemId);
        // Taken, it is what its box shows (an option past the first three too): the box comes into view.
        if (t.kind !== "section") chatLive.current.goBox({ intentKey: t.intentKey, section: t.section, domKeys: t.kind === "intent" ? t.domKeys : [], itemId: null });
        else show(t);
      },
    });
  }, [trip.id, collections, onPlanLink]);
  useEffect(() => () => onPlanLink?.(null), [onPlanLink]);
  const decisionOf = (item: Item) => decisionByItem.get(item.id);
  /** A stay keeps its decision card; everything else is a plan card (cards/PlanCard.tsx). */
  const card: CardFor = (item, group, decision, ranked, onCompareGroup) =>
    item.category === "stay" ? (
      <SwipeCard key={item.id} item={item} group={group} decision={decision ?? decisionOf(item)} decisions={decisions} ranked={ranked} onOpen={() => onOpenItem(item)} onCompare={onCompareGroup} />
    ) : (
      <PlanCard key={item.id} item={item} group={group} decision={decision ?? decisionOf(item)} ranked={ranked} onCompare={onCompareGroup} />
    );
  /** A decided need: the plan card (v11: a stay's too, its picture, nights, "Aldım" or its stamp). */
  const settled: SettledFor = (item, decision, onChange, changing) => (
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

  // Boş kartlar (spec 2026-10-06-bos-kartlar-design.md), on the Plan only: a need with nothing booked or saved yet
  // (a flight or stay the start made room for, a flight said with nothing chosen, a transfer with no plan) is the
  // approved card made plain. A need with another option, a file or a booking keeps today's full card.
  // The card being filled in where it stands (a tile just added, a field opened) is the full card while it's edited:
  // its hour and price are there to type; once left with nothing concrete on it, it's empty again.
  const emptyRecord = (item: Item) => !(focus?.id === item.id && focus.field != null) && isEmptyRecord(trip, item, env.docsFor(item.id).length, items);
  const planRenderGroup: RenderGroup = (group, heading, groupSubtitle, nested = false) => {
    const lone = group.items.length === 1 ? group.items[0] : null;
    if (!lone || !emptyRecord(lone)) return renderGroup(group, heading, groupSubtitle, nested);
    return (
      <div key={group.key} className={nested ? "group nested" : "section"} data-option-ids={lone.id}>
        {(heading || groupSubtitle) && (
          <div className={nested ? "group-head" : "section-head"}>
            <span className="group-title">
              {heading && <span>{heading}</span>}
              {groupSubtitle && <span className="muted">{groupSubtitle}</span>}
            </span>
          </div>
        )}
        <EmptyRecordCard item={lone} />
      </div>
    );
  };
  // A decided record drawn alone (an activity on its day, a plan in its city): empty while it has no concrete option.
  const planSettled: SettledFor = (item, decision, onChange, changing) =>
    !onChange && item.category !== "stay" && emptyRecord(item) ? <EmptyRecordCard key={item.id} item={item} /> : settled(item, decision, onChange, changing);
  const planLegCard = (l: Leg) => (isEmptyLeg(l) ? <EmptyLegCard key={l.key} leg={l} /> : legCard(l));
  const emptyEnv: EmptyEnv = {
    tripId: trip.id,
    travellers: who.count || null,
    esimCountries,
    // No offers' source is connected yet: the "✨ Senin için N öneri" row is never drawn.
    offers: liveSource,
    // Kişiye özel rezervasyon: whose a plan is, a person's own head count and place.
    trip,
    items,
  };

  const panoTotal = panoEntries(items, decisions?.byGroup).length;
  return (
    <CardEnvContext.Provider value={env}>
      <SilhouetteDefs />
      {/* v30: two tabs atop the board, Plan · Pano. "Gün gün" is the Plan's third way to read (PlanOrder). v82: the Pano tab opens the
          Pano window over the plan (and reads as chosen while it is open); Belgeler is in that window's side menu (C5). */}
      {timeline.entries.length > 0 && (
        <div className="view-tabs" role="tablist" aria-label={L("Görünüm", "View")}>
          <button role="tab" aria-selected={!pano} className={!pano ? "on" : ""} onClick={() => (setPano(null), setView("plan"))}>
            {L("Plan", "Plan")}
          </button>
          <TipOn tip={panoNews.length ? <PanoNewsTip news={panoNews} /> : null} below>
            {(bind) => (
              <button {...bind} role="tab" aria-selected={!!pano} aria-haspopup="dialog" aria-expanded={!!pano} className={pano ? "on" : ""} onClick={() => openPano()}>
                {L("Pano", "Board")}
                {panoTotal > 0 && <span className="tab-n" aria-hidden>{panoTotal}</span>}
                {panoNews.length > 0 && <i className="tab-dot" aria-hidden />}
              </button>
            )}
          </TipOn>
        </div>
      )}
      {/* (hareket dili, m-isik) a thin light along the top while captures are read or prices looked up */}
      <WorkLine on={working.length + reading > 0} />
      {/* v82: the thin bar while the hero is scrolled away (the hero's own numbers, its "Sıradaki"). */}
      <HeroMini
        hero={heroRef}
        active={view !== "board"}
        title={trip.title}
        cover={mosaic.cover?.image ?? trip.heroImage ?? null}
        line={heroLine({ range, estimated, people: who.count, counts, budget: null, short: true })}
        counts={counts}
        budget={heroBudget?.view ?? null}
        view="plan"
        onView={(v) => (v === "board" ? (setPanoFocus(null), setView("board")) : setView("plan"))}
        next={heroNext}
        nextShort={timed ? timedNextLabel(timed) : nextShort(step)}
      />
      {/* The Pano is a work table of its own: no hero over it (v11). */}
      {view !== "board" && (
        <Hero
          key={trip.id}
          trip={trip}
          sectionRef={heroRef}
          cities={cities.map((c) => c.name).filter(Boolean)}
          mood={mood}
          mosaic={mosaic}
          working={working.length + reading}
          menu={tripMenu}
          dates={heroDates}
          who={who}
          items={items}
          onShare={onShare}
          counts={counts}
          onFirstDecision={onFirstDecision}
          budget={heroBudget}
          next={heroNext}
          facts={facts}
          countries={countryNames(countries)}
          places={places}
          home={passport}
          now={today}
          styles={chips}
          decisions={decisions}
          today={
            strip ? (
              <TodayStrip vm={strip} places={places} country={countryNames(countries).length === 1 ? countryNames(countries)[0] : null} now={today} onJourney={openJourneyToday} onDoc={openFirstDoc} />
            ) : undefined
          }
        />
      )}
      {todoOpen && view !== "board" && <TodoList list={todo} open={todoOpen} onGo={reveal} />}
      {printing && (
        <PrintPlan
          trip={trip}
          cities={cities}
          range={range}
          estimated={!!range && !trip.confirmedDates && !plan.range}
          tally={tally}
          progress={{ head: numbers.pct != null ? plannedBookedText(numbers.pct) : null, meta: numbers.open ? openNeedsText(numbers.open) : null }}
          who={who}
          chips={chips}
          bar={bar}
          facts={facts}
          home={passport}
          countries={countries}
          items={items}
          timeline={timeline}
          listings={listings}
          mainPlaces={mains}
          cityImage={cityImageOf}
          onDone={endPrint}
          hero={heroRef}
        />
      )}

      {/* On the Plan a failed capture is its own card ("Okunamadı · Tekrar dene · Kaldır"); here on the other views. */}
      {failed.length > 0 && view !== "plan" && (
        <div className="errors">
          {failed.map((c) => (
            <div key={c.id}>
              <span className="error-text" title={c.error ?? ""}>
                <span className="err">⚠ {c.title || c.url || L("Ekran görüntüsü", "Screenshot")}</span>
                <span className="muted">
                  {" · "}
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

      <ChangeNotices tripId={trip.id} />
      {/* A trip made by the start chat: its one-time start card above the plan (start/StartGuideCard.tsx). */}
      {trip.startGuide && !trip.startGuide.closed && (
        <StartGuideCard
          trip={trip}
          items={items}
          plan={plan}
          openSuggestions={SECTION_ORDER.reduce((n, id) => n + (suggestions.bySection[id]?.filter((s) => s.key !== "rule:esim").length ?? 0), 0)}
          onGo={(step) => {
            if (step === "stays") return openSection("stay");
            if (step === "flights") return openSection(trip.startGuide?.road ? "transport" : "flight");
            // The suggestions sit atop their sections: the first section with one, else the Plan.
            const first = SECTION_ORDER.find((id) => (suggestions.bySection[id]?.length ?? 0) > 0);
            if (first) openSection(first);
            else setView("plan");
          }}
        />
      )}
      {(view === "story" || view === "days" || view === "map") && timeline.entries.length > 0 && (
        <div className="plan-bar-slim">
          <strong className="plan-h">{L("Plan", "Plan")}</strong>
          <PlanOrder view={view === "story" ? "story" : "days"} onView={(v) => setView(v)} off={orderOff} />
          <AddButton onClick={() => addIn(null, null)} />
          <PlanKey />
        </div>
      )}
      {(view === "days" || view === "map") && timeline.entries.length > 0 && (
        <div className="days-mode" role="group" aria-label={L("Gün gün", "Day by day")}>
          {DAY_MODES.map((m) => (
            <button key={m} type="button" aria-pressed={view === "days" && dayMode === m} onClick={() => (setDayMode(m), setView("days"))}>
              {m === "compact" ? L("Kompakt", "Compact") : m === "list" ? L("Liste", "List") : L("Kartlar", "Cards")}
            </button>
          ))}
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
            {L("Harita", "Map")}
          </button>
        </div>
      )}
      {/* v82: the Pano window over the plan (board/v82/PanoDialog): what it shows is the Plan's own intents and records. */}
      {pano && (
        <PanoDialog
          at={pano}
          trip={trip}
          plan={plan}
          sections={sections}
          items={items}
          today={today}
          decisions={decisions}
          docsFor={docsFor}
          people={who.count || null}
          inherited={inherited}
          onClose={() => setPano(null)}
          onReveal={(id) => reveal({ item: id })}
          onAsk={onAsk}
          onRemove={env.remove}
          offer={offer}
        />
      )}
      {view === "story" && journey.available ? (
        <>
          {plan.notices.map((x) => (
            <div key={x.text} className="notice">
              ⚠ {x.text}
            </div>
          ))}
          {/* v81-v83 "Yolculuk sırasıyla": the same boxes in the order the trip is lived (plan/journey). */}
          <JourneyView journey={journey} tripId={trip.id} on={journeyOn} />
        </>
      ) : view === "map" ? (
        <BoardMap trip={trip} plan={plan} legs={legs} />
      ) : view === "days" && timeline.entries.length > 0 ? (
        <>
        {plan.notices.map((x) => (
          <div key={x.text} className="notice">
            ⚠ {x.text}
          </div>
        ))}
        <UndatedIdeas items={items} plan={plan} />
        <TimelineView onShow={showOnPlan} timeline={timeline} tripId={trip.id} onAdd={env.add} listings={listings} today={today} dayTimes={trip.dayTimes} dayOrder={trip.dayOrder} dayLoose={trip.dayLoose} mainPlaces={mains} cards={{ legCard, renderGroup, settled }} cityImage={cityImageOf} />
        </>
      ) : (
        <EmptyEnvContext.Provider value={emptyEnv}>
          <CategoryPlan
            allot={allot && bar ? { by: allot, currency: bar.currency } : null}
            plan={plan}
            sections={sections}
            isOpen={arrivals.isOpen}
            onOpen={arrivals.onOpen}
            pending={arrivals.pending}
            tripId={trip.id}
            cities={cityNames}
            cards={{ legCard: planLegCard, renderGroup: planRenderGroup, card, settled: planSettled }}
            onAdd={addIn}
            today={today}
            items={items}
            suggestions={suggestions}
            visa={facts.visa}
            visaDone={!!trip.visaDone}
            shape={shape && { ...shape, photos: trip.cityImages, places, today }}
            onStop={(s) => openSection(s.kind === "end" ? "flight" : "stay")}
            order={<PlanOrder view="plan" onView={(v) => setView(v)} off={orderOff} />}
            onVisaDone={(done) => void setVisaDone(trip.id, done)}
          />
        </EmptyEnvContext.Provider>
      )}

      {sheet && (
        <AddSheet at={sheet.at} editing={sheet.editing} only={sheet.only} currency={decisions?.ctx.currency ?? trip.budget?.currency ?? "EUR"} onClose={() => setSheet(null)}
          onPick={(tpl) => {
            const s = sheet.suggestion;
            void quickAdd(tpl, sheet.at).then(() => s && markSuggestionAdded(trip.id, s));
          }} />
      )}
      <UndoToast
        undoable={undoable}
        error={undoError}
        onUndo={() => {
          const u = undo.take();
          if (!u) return;
          // An undo that can't be done (a setting changed again since) says why where the toast was.
          takeBack(u).catch((error) => {
            setUndoError(error instanceof Error ? error.message : String(error));
            setTimeout(() => setUndoError(null), 6000);
          });
        }}
      />
      {historyOpen && onHistoryClose && (
        <HistoryDialog trip={trip} items={items} hidden={[...hiddenForHistory, ...suggestions.dismissed]} onClose={onHistoryClose} onShow={(id) => setTimeout(() => reveal({ item: id }), 60)} />
      )}
      {arrivals.toast}
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
  // F7: a flight or stay still to choose, with a real option to show: its card is that option as "Önerimiz".
  const draft = decided ? null : draftOf(group.items, decision);
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
  const change = (decided && decided.status === "chosen" && ranked.length > 1) || draft ? () => setChanging(!changing) : undefined;
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
  // v11: a stay chosen or booked is that same card (its picture, its nights, "Aldım", "Pano'da N alternatif",
  // "Rezerve et ↗"; booked: its stamp, the booking's window), its other options back in the choice window.
  if (group.category !== "stay" || decided || draft) {
    return (
      <NavGroup items={byRank} heading={head} nested={nested} decision={decision} choice={choice} decided={decided ?? null} draft={draft}
        onChange={change} changing={changing} rankedOf={rankedOf} onCompare={comparable || single ? onCompare : undefined} />
    );
  }
  // v11: a stay with options and no choice yet is one card too ("Porto · 8–11 Eki · 3 seçenek ›"), the pick and its
  // reasons at the top of its window.
  if (!decided && byRank.length >= 1) {
    return <NeedGroup items={byRank} heading={head} nested={nested} decision={decision} choice={choice} onCompare={comparable || single ? onCompare : undefined} />;
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
