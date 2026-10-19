// The Plan by category (plan v82, docs/superpowers/specs/2026-10-18-v82-gecis 02-spec.md §4 aşama 2 and 3a; before it
// spec 0.34 and v11): the head ("Plan · Gezinin omurgası · n karar bekliyor" and the three ways to read it), then each
// category one card with its closed row (78 px), one open at a time (B8): opening one closes the others and brings it to
// the top in one move unless it is there already (E1). A category drawn the new way (V82_SECTIONS) has its intents on a
// rail inside (TimelineRail, IntentBox); the others keep their old body for now (their timeline of cards), side by side
// for a short while. Hazırlık is drawn on every trip (its list works out chores from the trip, Bilmen gerekenler and the
// Bavul, aşama 7); any other category with nothing in it isn't; "+ Yeni ihtiyaç ekle" at the end adds any kind (B6).
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isIdeaSection, planSectionOfItem, sectionProgress, type CatEntry, type CatSection, type SectionId } from "../../lib/categories";
import { activityGaps } from "../../lib/emptyCards";
import { countryNames } from "../../lib/heroInfo";
import { L } from "../../lib/i18n";
import { doneCount } from "../../lib/collectionCards";
import { countParts, decideCount, decisionNames, firstDecision, rowThumbs } from "../../lib/intentFrame";
import { collectionsOf, type Collection, type IntentInput } from "../../lib/intents";
import { formatPrice } from "../../lib/items";
import { nightsSummary } from "../../lib/lifecycle";
import { sameCity, type Plan } from "../../lib/plan";
import { eMove, scrollBy } from "../../lib/planOpen";
import type { BudgetSlice } from "../../lib/progress";
import { entryDomId } from "../../lib/progress";
import type { InsertAt } from "../../lib/templates";
import type { JourneyHop, JourneyStop } from "../../lib/tripShape";
import type { Item } from "../../lib/types";
import type { Visa } from "../../lib/visa";
import { useEmptyEnv } from "../cards/emptyEnv";
import { useCardEnv } from "../cards/PlanCard";
import { reducedMotion } from "../motion";
import { show } from "../Progress";
import type { BoardSuggestions } from "../useSuggestions";
import { Hidden } from "./HiddenList";
import { PrepList } from "./PrepList";
import { usePrepSummary } from "./prep/usePrep";
import { ideaCount, Section } from "./Section";
import { SECTION_META } from "./sectionMeta";
import { SectionSuggestContext } from "./sectionSuggest";
import { SectionTimeline, type SectionCards } from "./SectionTimeline";
import { SuggestionCards } from "./SuggestionCards";
import type { RowView } from "./v82/CategoryRow";
import { CollectEnvContext } from "./v82/collectEnv";
import { CollectionBox } from "./v82/CollectionBox";
import { CityGaps } from "./v82/CollectionRow";
import { artOf, IntentBox } from "./v82/IntentBox";
import { PlanHeader } from "./v82/PlanHeader";
import { TimelineRail } from "./v82/TimelineRail";
import { intentEl, V82EnvContext, type V82Env } from "./v82/v82Env";
import { VisaRow } from "./VisaRow";

/** The sections whose suggestions are tiles among their ideas. */
const TILED: SectionId[] = ["activity", "todo"];

/**
 * v82 geçişi (C raporu §3): the categories drawn with the new intent boxes (lib/intents.ts) instead of their old timeline.
 * A category joins once its boxes are built: 3a stay and other (the stay family's frame), 3b flight and transport (the
 * ticket), 4 activity and todo (the rows of cards).
 */
export const V82_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>(["stay", "other", "activity", "todo"]);

const SLICE: Partial<Record<SectionId, BudgetSlice>> = { flight: "flight", stay: "stay", transport: "transport", activity: "activity", other: "other" };

const NO_ENTRIES: CatEntry[] = [];

/** What sits pinned over the plan when it scrolls (the thin bar, app.css scroll-margin-top 76px). */
const PINNED = 76;
/** E1's one scroll: 380 ms, e-move. */
const SCROLL_MS = 380;

/** The element that scrolls the plan (the board's panel), else the page. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === "auto" || y === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** E1: the head just opened comes up under what's pinned, in one move (at once with reduced motion), unless it's near the top. */
function bringUp(head: HTMLElement) {
  const box = scrollerOf(head);
  const page = box === document.scrollingElement || box === document.documentElement;
  const view = page ? { top: 0, height: window.innerHeight } : { top: box.getBoundingClientRect().top, height: box.clientHeight };
  const by = scrollBy(head.getBoundingClientRect().top, view, PINNED);
  if (!by) return;
  const from = box.scrollTop;
  if (reducedMotion()) {
    box.scrollTop = from + by;
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / SCROLL_MS);
    box.scrollTop = from + by * eMove(t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function CategoryPlan({ allot = null, plan, sections, isOpen, onOpen, tripId, cities, cards, onAdd, today, items, pending, suggestions, visa = null, visaDone = false, onVisaDone, shape = null, order = null, info = {}, decide }: {
  plan: Plan;
  sections: CatSection[];
  /** Open now: the traveller's choice, remembered (sectionMeta.useSectionOpen), or held open while a link is read into it. */
  isOpen: (section: CatSection) => boolean;
  onOpen: (id: SectionId, open: boolean) => void;
  tripId: string;
  cities: string[];
  cards: SectionCards;
  /** Adds in a section (its kind; at a day and city when given), or (null) anything from the plan's end. */
  onAdd: (section: SectionId | null, at: InsertAt | null) => void;
  today: string;
  items: Item[];
  /** What's being read now (arrive/useArrivals): under the head when its place can't be guessed, else atop its section (drawn even while empty). */
  pending?: { lead: ReactNode; bySection: Partial<Record<SectionId, ReactNode>> };
  /** Öneriler (useSuggestions): a missing eSIM or policy is an intent (C16); the rest cards atop their section. */
  suggestions?: Pick<BoardSuggestions, "bySection" | "add" | "dismiss" | "notes">;
  /** The traveller's visa for the trip's country: Belgeler ve internet's first line, drawn even with nothing else there. */
  visa?: Visa | null;
  visaDone?: boolean;
  onVisaDone?: (done: boolean) => void;
  /** The trip's stops and the ways between them: Yapılacaklar draws the way between one city's row and the next. */
  /** "n karar bekliyor" as the hero counts it (tripPhase.countedIntents, row 127): on the trip a need whose day went by is none. */
  decide?: number;
  shape?: { stops: JourneyStop[]; hops: JourneyHop[] } | null;
  /** The three ways to read the plan (PlanOrder), drawn in the plan's head. */
  order?: ReactNode;
  /** v11: the budget shared out by section ("€500 ayrıldı"), when the trip has one. */
  allot?: { by: Record<BudgetSlice, number>; currency: string } | null;
  /** A category's short note when the trip's form changed something there (spec §1.4; its signals come with phase 3b). */
  info?: Partial<Record<SectionId, string>>;
}) {
  const env = useCardEnv();
  const empty = useEmptyEnv();
  const n = plan.nights;
  const waiting = (s: CatSection) => pending?.bySection[s.id] != null;
  const suggested = (s: CatSection) => [...(suggestions?.bySection[s.id] ?? []), ...(s.id === "todo" ? (suggestions?.bySection.food ?? []) : [])];
  const v82 = (s: CatSection) => V82_SECTIONS.has(s.id);
  // The new categories' suggestions to add are their intents (C16); only a warning stays a card.
  const cardSuggestions = (s: CatSection) => (v82(s) ? suggested(s).filter((x) => x.kind !== "add") : suggested(s));
  const gaps = activityGaps(plan, items);
  const visaLine = (s: CatSection) => s.id === "other" && visa != null && visa.kind !== "none";
  const dismissed = useMemo(() => (env.trip.suggestions ?? []).filter((s) => s.state === "dismissed"), [env.trip.suggestions]);
  // Hazırlık's closed row counts what its open list does (the worked-out chores too, never the Bavul's lines).
  const prep = usePrepSummary(sections.find((s) => s.id === "prep")?.prep ?? NO_ENTRIES);
  const input: IntentInput = {
    trip: env.trip,
    plan,
    sections,
    items,
    today,
    decisions: env.decisions?.byGroup ?? null,
    ctx: env.decisions?.ctx,
    docsFor: env.docsFor,
    allot,
    suggestions: suggestions?.bySection,
    prep,
  };
  const collections = collectionsOf(input);
  const collectionOf = (id: SectionId): Collection | null => collections.find((c) => c.section.id === id) ?? null;
  const shown = sections.filter(
    (s) =>
      s.id === "prep" ||
      s.entries.length ||
      s.hidden.length ||
      waiting(s) ||
      suggested(s).length ||
      (s.id === "activity" && gaps.length > 0) ||
      visaLine(s) ||
      (v82(s) && dismissed.some((d) => d.section === s.id && d.kind === "add")),
  );

  // --- one open at a time, brought up in one move (E1) ---
  const sheet = useRef<HTMLDivElement>(null);
  const opening = useRef<{ id: SectionId; top: number; goTo: boolean } | null>(null);
  const [lastOpened, setLastOpened] = useState<SectionId | null>(null);
  const openId = shown.find((s) => isOpen(s))?.id ?? null;
  const headOf = (id: SectionId) => sheet.current?.querySelector<HTMLElement>(`.q-sec[data-section="${id}"]`) ?? null;
  const open = (id: SectionId, goTo = false) => {
    const el = headOf(id);
    opening.current = { id, top: el?.getBoundingClientRect().top ?? 0, goTo };
    setLastOpened(id);
    // One open at a time (B8): one held open for a card being read lets go too (arrive/useArrivals).
    for (const other of shown) if (other.id !== id && isOpen(other)) onOpen(other.id, false);
    onOpen(id, true);
  };
  const toggle = (s: CatSection) => (isOpen(s) ? onOpen(s.id, false) : open(s.id));
  useLayoutEffect(() => {
    const o = opening.current;
    if (!o || o.id !== openId) return;
    opening.current = null;
    const el = headOf(o.id);
    if (!el) return;
    // The one above closed at once: the head is put back where it was (unseen), then it moves once.
    const box = scrollerOf(el);
    const shift = el.getBoundingClientRect().top - o.top;
    if (shift) box.scrollTop += shift;
    if (!o.goTo) bringUp(el);
  }, [openId]);

  /** A category opened on one of its intents (F5, the hero's "Sıradaki"): its box comes into view with a flash. */
  const goTo = (section: SectionId, key: string | null) => {
    const c = collectionOf(section);
    const vm = key ? c?.intents.find((i) => i.key === key) : null;
    if (!openId || openId !== section) open(section, true);
    setTimeout(() => {
      const el = (key && intentEl(key)) || (vm?.domKeys[0] ? document.getElementById(entryDomId(vm.domKeys[0])) : null) || headOf(section);
      show(el);
    }, openId === section ? 0 : 320);
  };
  const v82Env: V82Env = {
    byId: new Map(items.map((i) => [i.id, i])),
    addSuggestion: suggestions?.add ?? null,
    dismissSuggestion: suggestions?.dismiss ?? null,
    selfAt: { countries: empty.esimCountries, countryNames: countryNames(empty.esimCountries), adults: empty.group?.adults ?? empty.travellers, children: empty.group?.children ?? null, rooms: empty.group?.rooms ?? null },
    goTo,
  };
  const first = firstDecision(collections);
  const collectEnv = useMemo(() => ({ plan }), [plan]);

  const rowOf = (s: CatSection): RowView => {
    const meta = SECTION_META[s.id];
    const c = collectionOf(s.id);
    const settled = !isIdeaSection(s.id) && (s.entries.length || s.hidden.length) ? { settled: s.settled, total: sectionProgress(s).total } : null;
    const ready = c?.summary.ready;
    if (s.id === "prep" && c && ready) {
      // K0: "Gezi öncesi 6 iş · sıradaki: …" and "2/6 hazır", the bar in one green; nothing to count, no bar and no count.
      const parts = ready.total ? [{ text: L(`${ready.done}/${ready.total} hazır`, `${ready.done}/${ready.total} ready`), decide: false }] : [];
      return { id: s.id, name: meta.label(), line: c.summary.line, thumbs: [], more: 0, bar: ready.total ? c.summary.bar : null, parts, spent: null, allot: null, settled: ready.total ? { settled: ready.done, total: ready.total } : null };
    }
    if (!c) {
      const line = s.ideas && (s.entries.length || s.hidden.length) ? ideaCount(s.id, s.ideas, s.entries, suggested(s).length) : "";
      return { id: s.id, name: meta.label(), line, thumbs: [], more: 0, bar: null, parts: [], spent: null, allot: null, settled };
    }
    const { thumbs, more } = rowThumbs(c.intents);
    const sum = c.summary;
    // Yapılacaklar' things done are said apart ("1 yapıldı"); a ticket is never "done" (H1: a ski pass isn't here).
    const done = s.id === "todo" ? doneCount(c.intents, v82Env.byId) : 0;
    return {
      id: s.id,
      name: sum.name,
      line: sum.line,
      thumbs,
      more,
      bar: c.intents.length ? sum.bar : null,
      parts: c.intents.length ? [...countParts(sum.counts, c.intents.some((i) => i.frame === "collection")), ...(done ? [{ text: L(`${done} yapıldı`, `${done} done`), decide: false }] : [])] : [],
      spent: sum.spent ? formatPrice(sum.spent.amount, sum.spent.currency) : null,
      allot: sum.allotted ? formatPrice(sum.allotted.amount, sum.allotted.currency) : null,
      settled,
    };
  };

  return (
    <V82EnvContext.Provider value={v82Env}>
      <CollectEnvContext.Provider value={collectEnv}>
      <div className="section trip-plan cat-plan q-plan" data-pit-children>
        <PlanHeader decide={decide ?? decideCount(collections)} onDecide={() => first && goTo(first.section, first.intent.key)} order={order} title={n.total > 0 ? nightsSummary(n) : undefined} />
        {plan.notices.map((x) => (
          <div key={x.text} className="notice">
            ⚠ {x.text}
          </div>
        ))}
        {pending?.lead && <div className="ar-lead">{pending.lead}</div>}
        {shown.length > 0 && (
          <div className="q-sheet" ref={sheet} data-pit-children>
            {shown.map((s) => {
              const opened = isOpen(s);
              const c = collectionOf(s.id);
              const own = s.entries.length > 0 || s.hidden.length > 0;
              const slice = SLICE[s.id];
              const allotNum = allot && slice && allot.by[slice] > 0 ? { amount: allot.by[slice], currency: allot.currency } : null;
              const firstHere = c ? firstDecision([c]) : null;
              return (
                <Section key={s.id} section={s} row={rowOf(s)} v82={v82(s)} open={opened} instant={!opened && lastOpened != null && lastOpened !== s.id}
                  onToggle={() => toggle(s)} onAdd={() => onAdd(s.id, null)}
                  onDecide={() => (firstHere ? goTo(s.id, firstHere.intent.key) : open(s.id))} decideTip={c ? decisionNames(c.intents) : []}
                  allotNum={allotNum} suggestions={cardSuggestions(s).filter((x) => x.kind === "add").length}>
                  {v82(s) ? (
                    <TimelineRail
                      info={info[s.id]}
                      lead={
                        <>
                          {pending?.bySection[s.id]}
                          {suggestions && <SuggestionCards list={cardSuggestions(s)} onAdd={suggestions.add} onDismiss={suggestions.dismiss} notes={suggestions.notes} />}
                          {visaLine(s) && <VisaRow visa={visa} done={visaDone} onDone={(d) => onVisaDone?.(d)} />}
                        </>
                      }
                      hidden={<Hidden section={s} live={items.filter((i) => i.status !== "dismissed" && planSectionOfItem(i) === s.id)} suggestions={dismissed} art={(kind) => artOf(kind)} />}
                    >
                      {(c?.intents ?? []).filter((i) => i.status !== "skipped").map((vm) =>
                        // Etkinlik and Yapılacaklar: a city's row of cards (aşama 4); a part of the trip's shape among them (a ski pass) is one choice.
                        vm.frame === "collection" ? (
                          <CollectionBox key={vm.key} vm={vm} color={SECTION_META[s.id].color} />
                        ) : (
                          <IntentBox key={vm.key} vm={vm} color={SECTION_META[s.id].color} onHere={s.id === "stay" ? (at) => onAdd(s.id, at) : null} />
                        ),
                      )}
                      {s.id === "activity" && <CityGaps gaps={gaps.filter((g) => !(c?.intents ?? []).some((i) => i.frame === "collection" && i.head.city != null && sameCity(i.head.city, g.city)))} section="activity" />}
                    </TimelineRail>
                  ) : (
                    <SectionSuggestContext.Provider value={suggestions && TILED.includes(s.id) ? { list: suggested(s), add: suggestions.add, dismiss: suggestions.dismiss, notes: suggestions.notes } : null}>
                      {/* Etkinlik ve turlar and Yapılacak şeyler show their suggestions among their ideas, as tiles (sectionSuggest). */}
                      {suggestions && !TILED.includes(s.id) && <SuggestionCards list={suggested(s)} onAdd={suggestions.add} onDismiss={suggestions.dismiss} notes={suggestions.notes} />}
                      {pending?.bySection[s.id]}
                      {/* Hazırlık on every trip, a chore saved or not: the check-in and the visa worked out from the trip, Bilmen gerekenler, the Bavul. */}
                      {s.id === "prep" && <PrepList entries={s.prep} />}
                      {own && s.id !== "prep" && <SectionTimeline section={s} plan={plan} tripId={tripId} cities={cities} cards={cards} onAdd={(at) => onAdd(s.id, at)} onIdea={(item) => onOpen(planSectionOfItem(item), true)} today={today} items={items} journey={shape} />}
                    </SectionSuggestContext.Provider>
                  )}
                </Section>
              );
            })}
          </div>
        )}
        <button type="button" className="q-add q-addall" onClick={() => onAdd(null, null)}>
          + {L("Yeni ihtiyaç ekle", "Add a new need")}
        </button>
      </div>
      </CollectEnvContext.Provider>
    </V82EnvContext.Provider>
  );
}
