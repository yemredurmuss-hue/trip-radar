// One intent (plan v82 "niyet kutusu standardı"): its head (IntentHead) and one fixed frame under it, the same size in every
// state, its ground and its dot on the category's rail the state's colour. The frame is the family's (FrameCard: a stay, an
// eSIM, insurance; FrameTicket: a flight, a train, any way of travel; CollectionRow comes with phase 4); with options to
// pick from it is three cards (OptionCompact) or, for a ticket, three rows (OptionRow), and "Değiştir" turns the chosen
// one back to them in place. A change of city or a transfer with no record of its own says "Gerek yok", "Ben hallettim"
// and its way (C15) on the leg itself (Trip.hidden, Trip.legs). Ayrıntı opens over the frame (DetailLayer);
// "Gerek yok" folds the body (E7) and the box goes under the category's "Gizlenenler · n" (F3). A record's days, name and
// price edit where they stand (C2); a thin "+ Buraya ekle" under a stay adds on its last night, in its city (C3).
import { removeEntries } from "./removeEntries";
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isCampStay } from "../../../lib/campStay";
import { fromName, L } from "../../../lib/i18n";
import { areaSearch, changeList, currentOption, frameForm, headName, offerNeed, otherOptions, placeholderOf, railState, SHOWN_OPTIONS, statusChip, unlessEmpty } from "../../../lib/intentFrame";
import { offersLooking } from "../../../lib/looking";
import { othersLabel, othersOpen, rememberOthers } from "../../../lib/othersFold";
import { queryOf, type StayCandidate } from "../../../lib/offerSources";
import { MAX_OFFERS, validOffers, type Offer } from "../../../lib/offerSource";
import { typicalNight } from "../../../lib/stayPicks";
import type { IntentStatus, IntentVM, OptionVM } from "../../../lib/intents";
import { addDays } from "../../../lib/plan";
import { bookingReplaced, replaceAsk } from "../../../lib/replaceBooking";
import { regionHints, type RegionHint } from "../../../lib/regionHints";
import { waySearches, wayDirections } from "../../../lib/ticketFrame";
import type { InsertAt } from "../../../lib/templates";
import type { Item, LegChoice, Trip } from "../../../lib/types";
import { entryDomId } from "../../../lib/progress";
import { withLegChoice } from "../../../lib/legs";
import { agreeRoute } from "../../../lib/startTrip";
import { candidateOffer, pickList, pickThree, picksContext, savedAlready } from "../../../lib/stayPicks";
import { shapeOf } from "../../../lib/playbooks/shape";
import { autoSearchBlock, restoredOwnStay } from "../../../lib/autoSearch";
import { addOffer, fillOffer, putItem, setHidden, setInstalled, setItemStatus, cancelBooking, markBooked, updateTrip } from "../../actions";
import { ProofAsk } from "./ProofAsk";
import type { MenuEntry } from "../../cards/CardShell";
import { openDoc, useDocPick } from "../../cards/DocAccess";
import { useEmptyEnv } from "../../cards/emptyEnv";
import { illusOf, stayArtOf } from "../../cards/MediaCard";
import { OfferRow } from "../../cards/OfferRow";
import { InlineEdit } from "../../cards/InlineEdit";
import { datedLink } from "../../cards/parts";
import { useCardEnv } from "../../cards/PlanCard";
import { hasSearched } from "../../cards/searching";
import { AskWindow, useStageMenu, type Ask } from "../../cards/stageMenu";
import { useWhoMenu } from "../../cards/whoMenu";
import { FOLD_MS, reducedMotion } from "../../motion";
import { CollectionRow } from "./CollectionRow";
import { Deck } from "./Deck";
import { IntentDrawer } from "./IntentDrawer";
import { isRouteNote, RouteNote, YerindeRow } from "./RouteNote";
import { whoGoes } from "../../../lib/tripSettings";
import { peopleOf } from "../../../lib/whose";
import { decisionOf, DetailLayer, focusNear } from "./DetailLayer";
import { FrameCard } from "./FrameCard";
import { FrameTicket } from "./FrameTicket";
import { IntentHead } from "./IntentHead";
import { IntentMenu } from "./IntentMenu";
import type { Typical } from "./OptionCompact";
import { useLooking } from "./Searching";
import { useCrossfade, type Entry } from "./useCrossfade";
import { useIntentActions } from "./useIntentActions";
import { useV82Env } from "./v82Env";
import { emptyNightText, isDatedSection, overlapText, railDate, type Overlap } from "../../../lib/railDates";
import { timingAsk, type StayTiming } from "../../../lib/stayTiming";
import { freeCancelText, guestGap, guestGapText } from "../../../lib/drawerCard";
import { bookingIcs, icsName } from "../../../lib/ics";
import { isDeskRow, rowView, whileSearching } from "../../../lib/rowView";
import { EmptyNight, OverlapRow, RowOpenContext, StayCard, TicketRow, type Brought, type SlotOn } from "./IntentRow";
import { arrivedOption, bringKey, deckVerdict } from "../../../lib/bring";
import { ASK_BOUGHT, type AskBought } from "../../../lib/candidateTabs";
import { siteOf } from "../../../lib/arrive";
import { Ic } from "./icons";
import { addLinks, addTripFiles } from "../../capture";
import { addEvent, notifyChanged } from "../../../lib/db";

/** A kind's drawing (static/illus), for a frame or an option with no photo. */
export function artOf(kind: IntentVM["kind"], item: Item | null = null, sleep: string | null = null): string {
  if (kind === "stay") {
    // (no record to say it: the trip's own nights, the van's or the camp's, drawn as such, never a hotel)
    if (!item?.metrics?.stayKind && (sleep === "vehicle" || sleep === "camp")) return sleep === "camp" ? "illus/cadir.svg" : "illus/karavan.png";
    const art = stayArtOf(item);
    return art === "tent" ? "illus/cadir.svg" : `illus/${art}.png`;
  }
  // A flight's plane, a way of travel nobody named the taxi's (the ticket's own drawings, ticketView.ts).
  if (kind === "flight") return "illus/ucus.png";
  if (kind === "transport") return "illus/taksi-transfer.png";
  return `illus/${illusOf(kind) ?? "not"}.png`;
}

/** How far along a state is: the chip springs once on a step forward, never back (hareket dili, kural 4). */
const TAKEOFF: readonly IntentStatus[] = ["chosen", "booked"];
const STEP: Readonly<Record<IntentStatus, number>> = { skipped: -1, searching: 0, deciding: 1, suggested: 2, chosen: 3, arranged: 4, included: 4, booked: 5 };

function useStepPop(status: IntentStatus, ms = 520, to?: readonly IntentStatus[]): boolean {
  const [pop, setPop] = useState(false);
  const was = useRef(status);
  useEffect(() => {
    const forward = STEP[status] > STEP[was.current] && (!to || to.includes(status));
    was.current = status;
    if (!forward || reducedMotion()) return;
    setPop(true);
    const t = setTimeout(() => setPop(false), ms);
    return () => clearTimeout(t);
  }, [status]);
  return pop;
}

/**
 * "Aranıyor" (karar 3: hepsi kendiliğinden aranır): a need with nothing saved for it (a flight, a stay, a way between two
 * cities, an eSIM) is looked for by itself once the source can ask it: the source is asked (the row says it looks while it
 * does, offersLooking) and the best three it finds join the row as options (addOffer; a stay's placeholder from the start
 * takes the first in place, fillOffer), once per need (remembered, so what the traveller took away doesn't come back).
 * Nothing without a source; a need the source can't ask stays to "Kendin ara" and "AI ara".
 */
const AUTO_KEY = (tripId: string, need: string) => `trip-radar:auto-searched:${tripId}:${need}`;
/** The needs being looked for by themselves now (one search a need, however many boxes draw it). */
const autoGoing = new Set<string>();
const autoDone = (key: string): boolean => {
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
};
function useAutoSearch(vm: IntentVM, tripId: string, on: boolean, placeholder: Item | null): void {
  const { offers: source, trip, items } = useEmptyEnv();
  const at = useRef({ trip, items });
  at.current = { trip, items };
  const { selfAt } = useV82Env();
  const need = on ? offerNeed(vm, selfAt) : null;
  const hold = useRef(placeholder);
  hold.current = placeholder;
  useEffect(() => {
    if (!need || !source.available()) return;
    const key = AUTO_KEY(tripId, need.key);
    if (autoGoing.has(key) || autoDone(key)) return;
    autoGoing.add(key);
    // (a stay: the drawer's own three, "Sana en uygun · Daha ekonomik · Daha konforlu", priced for these nights; the
    // source's row of offers when it has no candidates)
    // (the picks are ours, built from the source's candidates whole: their reviews and usual range kept, not re-read)
    let own: Offer[] | null = null;
    const stayPicks = async (): Promise<unknown> => {
      const cands = need.kind === "stay" && source.candidates ? await source.candidates(need).catch(() => []) : [];
      const list = Array.isArray(cands) ? cands : [];
      const mine = at.current.items ?? [];
      const picks = pickList(pickThree(list.filter((c) => !savedAlready(c, mine)), picksContext(need, at.current.trip, mine)));
      if (!picks.length) return source.offers(need);
      own = picks.map(({ kind, pick }) => candidateOffer(pick.cand, kind, pick.why));
      return own;
    };
    void offersLooking
      .track(need.key, need.kind === "stay" ? stayPicks() : source.offers(need))
      .then(
        async (list) => {
          const found = (own ?? validOffers(list, need)).slice(0, MAX_OFFERS);
          // (nothing found: asked again next time it's drawn, the source keeps its answer for hours)
          if (!found.length) return;
          try {
            localStorage.setItem(key, String(found.length));
          } catch {
            // (no storage: asked again next time)
          }
          let spot = hold.current;
          for (const o of found) {
            if (spot) await fillOffer(spot, o, need);
            else await addOffer(tripId, o, need);
            spot = null;
          }
        },
        () => undefined,
      )
      .finally(() => autoGoing.delete(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per need
  }, [need?.key, source, tripId]);
}

/** The areas the offers source's candidates are in, for an empty stay (regionHints); nothing without a source. */
function useRegionHints(vm: IntentVM, ask: boolean): RegionHint[] {
  const { offers: source } = useEmptyEnv();
  const { selfAt } = useV82Env();
  const need = ask ? offerNeed(vm, selfAt) : null;
  const [hints, setHints] = useState<{ key: string; list: RegionHint[] } | null>(null);
  useEffect(() => {
    if (!need || need.kind !== "stay" || !source.candidates || !source.available()) return;
    let alive = true;
    source.candidates(need).then(
      (list) => alive && setHints({ key: need.key, list: regionHints(list) }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [need?.key, source]);
  return need && hints?.key === need.key ? hints.list : [];
}

/**
 * A stay's options with no price: the source's usual range by the night for the same hotel (its page), as the picks under
 * the box show it (0.38.6); asked only while its option cards are drawn, the source keeps the answer for hours.
 */
function useTypical(vm: IntentVM, ask: boolean): Typical | null {
  const { offers: source } = useEmptyEnv();
  const { selfAt } = useV82Env();
  const need = ask && vm.kind === "stay" && vm.options.some((o) => !o.price) ? offerNeed(vm, selfAt) : null;
  const [got, setGot] = useState<{ key: string; byUrl: Map<string, StayCandidate["priceRange"]> } | null>(null);
  useEffect(() => {
    if (!need || !source.candidates || !source.available()) return;
    let alive = true;
    source.candidates(need).then(
      (list) => alive && setGot({ key: need.key, byUrl: new Map((Array.isArray(list) ? list : []).filter((c) => c.priceRange).map((c) => [c.url, c.priceRange])) }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [need?.key, source]);
  if (!need || got?.key !== need.key) return null;
  const byUrl = got.byUrl;
  return (o) => (o.item.url ? typicalNight(byUrl.get(o.item.url)) : null);
}

/** The fields a box draws (its head's days, its card's name and price): Tab never opens one that isn't there. */
const DRAWN = ["name", "date", "end", "price"] as const;
/** A ticket's: its ends and its hour where they stand, its day, its price (a rental's place and return day). */
const TICKET_DRAWN = ["from", "to", "city", "date", "end", "time", "price"] as const;

const NONE: Item[] = [];

/** "Takvime ekle": the booking as a calendar file (lib/ics.ts) the traveller's calendar opens. */
function saveIcs(item: Item) {
  const ics = bookingIcs(item);
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = icsName(item);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** How many go, as the hero says it (the count said, else the names): never fewer than one. */
const tripPeople = (trip: Trip): number => Math.max(1, whoGoes({ travellers: trip.travellers }).count || peopleOf(trip).length);

export function IntentBox({ vm: given, color, onHere = null, gap = null, dropped = NONE, overlap = null, timing = null }: {
  vm: IntentVM;
  color: string;
  /** C3: "+ Buraya ekle" under the box opens the add window at this place (null: none). */
  onHere?: ((at: InsertAt) => void) | null;
  /** An empty night between two stays (railDates.emptyNights): the stays before and after it, for its line. */
  gap?: { before: IntentVM | null; after: IntentVM | null } | null;
  /** Elenen in its drawer: this need's options that were ruled out. */
  dropped?: Item[];
  /** Another stay holds some of its nights (railDates.overlapNights): the red row over it. */
  overlap?: Overlap | null;
  /** Its hours against the flight either side (stayTiming.ts): the amber strip under a stay. */
  timing?: StayTiming | null;
}) {
  const env = useCardEnv();
  const { byId } = useV82Env();
  const records = given.itemIds.map((id) => byId.get(id)).filter((i): i is Item => i != null);
  const vm = unlessEmpty(given, env.trip, records, (id) => env.docsFor(id).length);
  const record = vm.chosen?.item ?? null;
  // Still to find with a bare record in it (one tap's "Otel", the chat's "eSIM de alalım"): its ⋯ is the record's, and its
  // name the title's, to type where it stands.
  const held = record ? null : (given.chosen?.item ?? records.find((i) => i.status === "chosen") ?? null);
  const own = record ?? held;
  if (own) {
    return (
      <InlineEdit item={own} only={vm.frame === "ticket" ? [...TICKET_DRAWN] : record ? [...DRAWN] : ["name"]}>
        <RecordBox vm={vm} color={color} record={own} onHere={onHere} gap={gap} dropped={dropped} overlap={overlap} timing={timing} />
      </InlineEdit>
    );
  }
  // Nothing chosen yet: a candidate saved in it can be taken off alone ("Kaldır"), not only the whole need ("Gerek yok").
  const removals = removeEntries([...vm.options, ...(vm.more ?? [])], byId, env.remove);
  return <Box vm={vm} color={color} extra={removals} field={null} pickDoc={null} cancel={null} onHere={onHere} itemId={null} gap={gap} dropped={dropped} overlap={overlap} timing={timing} />;
}

/**
 * A chosen or booked box's other options under it (0.38.5), folded to one line (0.38.9): "Diğer seçenekler (n) ▾",
 * a real button that says whether it is open; its options drawn only while it is.
 */
export function OthersFold({ count, open, onToggle, children }: { count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  const listId = useId();
  return (
    <div className={`q-offers q-others${open ? " open" : ""}`}>
      <button type="button" className="q-ofold" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={onToggle}>
        <span>{othersLabel(count)}</span>
        <span className="q-ofold-chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && <div id={listId}>{children}</div>}
    </div>
  );
}

/** A stay's place for "+ Buraya ekle": its city and its last night (templates.insertAt); none without its days. */
function hereOf(vm: IntentVM): InsertAt | null {
  if (vm.kind !== "stay" || !vm.head.date || vm.head.nights < 1) return null;
  return { city: vm.head.city, date: null, night: addDays(vm.head.date, vm.head.nights - 1) };
}

/** A box with a record to show (our pick, the chosen one, the booking): its card's ••• entries and its file picker. */
function RecordBox({ vm, color, record, onHere, gap, dropped, overlap, timing }: { vm: IntentVM; color: string; record: Item; onHere: ((at: InsertAt) => void) | null; gap: { before: IntentVM | null; after: IntentVM | null } | null; dropped: Item[]; overlap: Overlap | null; timing: StayTiming | null }) {
  const env = useCardEnv();
  const stage = useStageMenu(record);
  const who = useWhoMenu(record);
  // (a booking's confirmation added here is read: its number, what was paid, the check-in)
  const doc = useDocPick(record, { read: record.status === "booked" || record.status === "chosen" });
  const booked = record.status === "booked";
  // C21: what the old card's ••• did for it, beside Ayrıntı and Gerek yok.
  const extra: MenuEntry[] = [
    ...(record.status === "chosen" && record.origin !== "chat" && !record.arranged ? [{ label: L("Seçimi geri al", "Undo choice"), run: () => void setItemStatus(record, "saved") }] : []),
    ...(booked ? [{ label: L("Rezervasyonu geri al", "Mark as not booked"), run: () => void setItemStatus(record, "chosen") }] : []),
    // An eSIM put on the phone ("Kurdum") is done, bought through the box or not (lifecycle: chosen and installed).
    ...((booked || record.status === "chosen") && vm.kind === "esim" ? [record.installedAt ? { label: L("Kurulmadı", "Not installed"), run: () => void setInstalled(record, false) } : { label: L("Kurdum", "Installed it"), run: () => void setInstalled(record, true) }] : []),
    ...stage.menu.filter((m) => m.id !== "change" && m.id !== "addDoc"),
    { label: L("Belge ekle", "Add a document"), run: doc.pick },
    ...who.map((e, i) => ({ ...e, sep: i === 0 })),
  ];
  const cancel = booked ? () => cancelBooking(record).then(env.offer) : null;
  return (
    <Box vm={vm} color={color} extra={extra} field={<>{stage.field}{doc.field}</>} pickDoc={doc.pick} dropDoc={doc.drop} cancel={cancel} askedHide={booked ? stage.hide : null} onHere={onHere} itemId={record.id} gap={gap} dropped={dropped} overlap={overlap} timing={timing} />
  );
}

function Box({ vm, color, extra, field, pickDoc, dropDoc = null, cancel, askedHide = null, onHere, itemId, gap = null, dropped = NONE, overlap = null, timing = null }: {
  vm: IntentVM;
  color: string;
  extra: MenuEntry[];
  field: ReactNode;
  pickDoc: (() => void) | null;
  dropDoc?: ((files: File[]) => void) | null;
  /** "İptal ettim" on a booking (it's kept as cancelled, its need to find again). */
  cancel: (() => Promise<void>) | null;
  /** A booking's "Gerek yok" asks first whether it was cancelled (stageMenu.hide). */
  askedHide?: (() => void) | null;
  onHere: ((at: InsertAt) => void) | null;
  /** The record the box stands for (the one shown, or the bare one still to find): to-dos and arrivals find it by it. */
  itemId: string | null;
  gap?: { before: IntentVM | null; after: IntentVM | null } | null;
  /** Elenen in its drawer: this need's options that were ruled out. */
  dropped?: Item[];
  /** Another stay holds some of its nights (railDates.overlapNights): the red row over it. */
  overlap?: Overlap | null;
  /** Its hours against the flight either side (stayTiming.ts): the amber strip under a stay. */
  timing?: StayTiming | null;
}) {
  const env = useCardEnv();
  const v82 = useV82Env();
  const { offers } = useEmptyEnv();
  const a = useIntentActions(vm);
  const [changing, setChanging] = useState(false);
  const [detail, setDetail] = useState(false);
  // "Aldım"'s box (onay paketi 2026-10-22): opened by Aldım ("got") or after the site's Satın al ↗ ("asked").
  const [proofAsk, setProofAsk] = useState<null | "got" | "asked">(null);
  const [folding, setFolding] = useState(false);
  // K82: a need's options open beside the plan, never inside the card.
  const [drawer, setDrawer] = useState(false);
  // Karar Masası, getirme anları: what was brought to this row (the deck as it was then), until it is read and said.
  const [bringing, setBringing] = useState<{ before: ReadonlySet<string>; at: number; what: string } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openDrawer = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDrawer(true);
  };
  const closeDrawer = () => {
    setDrawer(false);
  };
  // D5: an intent of the AI's route nobody agreed yet is Önerimiz with nothing chosen: it is looked for as before.
  const form = vm.routeDraft ? "searching" : frameForm(vm);
  const showOptions = form === "options";
  const chosenId = vm.chosen?.id ?? null;
  // A new pick, a booking, another state: the card is itself again (Değiştir and Ayrıntı close).
  // (The drawer stays while options merely arrive, searching → deciding: the traveller may be reading it.)
  useEffect(() => {
    setChanging(false);
    setDetail(false);
    if (vm.status !== "searching" && vm.status !== "deciding" && vm.status !== "suggested") setDrawer(false);
  }, [vm.status, chosenId]);
  // However the drawer closed (×, Escape, Seç, Büyük Pano, a source's pick, a new state), the focus comes back to where it
  // was opened from, else to the box's ⋯: never left on the page's body (review).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (drawer) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    requestAnimationFrame(() => {
      // (not when another window took it: a record opened from the drawer keeps its own focus)
      const now = document.activeElement;
      if (now && now !== document.body && now.isConnected) return;
      const back = opener.current?.isConnected ? opener.current : boxRef.current?.querySelector<HTMLElement>(".z-h .z-mb");
      back?.focus?.();
    });
  }, [drawer]);
  const boxRef = useRef<HTMLElement>(null);
  const pop = useStepPop(vm.status);
  // K29 on a ticket (hareket dili §2.3, §2.5): a step forward to Seçildi or Alındı takes its plane off (1.1 s, after the
  // frame's 120 ms crossfade); no glow.
  const takeoff = useStepPop(vm.status, 1300, TAKEOFF);
  const chipId = useId();
  const name = headName(vm);
  const entry = useRef<Entry>("in");
  const shape = shapeOf(env.trip);
  // (a stop of a route not agreed yet has its own record, the van's night, but nothing chosen: drawn from it)
  const own = vm.itemIds.map((id) => v82.byId.get(id)).find((i): i is Item => i != null) ?? null;
  const art = artOf(vm.kind, vm.chosen?.item ?? vm.options[0]?.item ?? own, shape.sleep);
  // C15: a way nobody planned is looked for on the sites that compare every way, a transfer on Uber and the map's directions.
  const links = waySearches(vm, v82.selfAt, itemId ? (v82.byId.get(itemId) ?? null) : null);
  const searchingNow = form === "searching" && a.searching;
  const hints = useRegionHints(vm, form === "searching");
  // Chosen or booked, it stands big; the need's other options wait under it (0.38.5), not while it turns back to them.
  // (Turning back to them, the box holds three; those past it stay under it, 0.39.0.)
  // Every option of the need, the one chosen first: the drawer lists them all (K82; the old "Diğer seçenekler" fold is it now).
  const all: OptionVM[] = [];
  for (const o of [...(vm.chosen ? [vm.chosen] : []), ...vm.options, ...(vm.more ?? [])]) if (!all.some((x) => x.id === o.id)) all.push(o);
  const others = changing ? (vm.more ?? []).filter((o) => o.id !== vm.chosen?.id) : otherOptions(vm);
  // (getirme anları: a link or a screenshot brought to a flight's row or its drawer is that need's option, Capture.forNeed)
  const bindKey = isDeskRow(vm) ? bringKey(vm) : null;
  const bring = bindKey
    ? (got: Brought) => {
        setBringing({ before: new Set(all.map((o) => o.id)), at: Date.now(), what: got.files.length ? L("Ekran görüntüsü", "The screenshot") : L(`${siteOf(got.links.split(/\s+/)[0]) ?? "Bağlantı"} bağlantısı`, `The ${siteOf(got.links.split(/\s+/)[0]) ?? ""} link`) });
        if (got.files.length)
          void addTripFiles(env.tripId, got.files, "board", bindKey).then((problems) => {
            const fresh = problems.filter((p) => !p.logged).map((p) => p.text);
            if (fresh.length) void addEvent(env.tripId, `⚠ ${fresh.join(" ")}`).then(notifyChanged);
          });
        else void addLinks(got.links, { tripId: env.tripId, source: "board", forNeed: bindKey });
      }
    : null;
  const arrived = bringing ? arrivedOption(bringing.before, all) : null;
  // (read and not landed here within two minutes: it went elsewhere, said by the board's own arrival; the line goes)
  useEffect(() => {
    if (!bringing || arrived) return;
    const t = setTimeout(() => setBringing(null), Math.max(0, bringing.at + 120_000 - Date.now()));
    return () => clearTimeout(t);
  }, [bringing, arrived]);
  // 0.38.9: folded to "Diğer seçenekler (n)" once something is chosen; a new pick (from here, the chat, the Pano) folds them.
  const foldKey = `${env.tripId}:${vm.key}`;
  const [othersShown, setOthersShown] = useState(() => othersOpen(foldKey, true));
  const showOthers = (open: boolean) => {
    rememberOthers(foldKey, open);
    setOthersShown(open);
  };
  const pickedWas = useRef(chosenId);
  useEffect(() => {
    if (pickedWas.current === chosenId) return;
    pickedWas.current = chosenId;
    showOthers(false);
  }, [chosenId]);
  const typical = useTypical(vm, drawer || (others.length > 0 && othersShown));
  const record = vm.chosen?.item ?? null;
  const decision = record ? decisionOf(env.decisions?.byGroup, record) : undefined;
  const page = record ? (datedLink(record, decision).url ?? record.url) : null;
  const docs = record ? env.docsFor(record.id) : [];

  // A leg with no record of its own (an empty transfer, a change of city): what's said is said on the leg.
  const leg = vm.legKey != null && vm.itemIds.length === 0 ? vm.legKey : null;
  const onLeg = (patch: Partial<Omit<LegChoice, "updatedAt">> | null): Promise<void> => (leg ? updateTrip(env.tripId, (t) => withLegChoice(t, leg, patch)) : Promise.resolve());
  const skipNow = () => (leg ? void setHidden(env.tripId, `leg:${leg}`, true, name) : a.skip());
  const skip = () => {
    if (askedHide) return askedHide();
    if (reducedMotion()) return skipNow();
    setFolding(true);
    setTimeout(skipNow, FOLD_MS);
  };
  // A booking in the box: another option is a switch, asked first (replaceBooking.ts); Vazgeç leaves everything as it was.
  const booking = vm.frame !== "collection" && record?.status === "booked" ? record : null;
  const [asking, setAsking] = useState<Ask | null>(null);
  const rows = useContext(RowOpenContext);
  // (benle gezen eklenti: bought in a candidate's tab and the tab closed, the plan asks "Aldın mı?" under the row, open)
  useEffect(() => {
    if (!record || record.status !== "chosen" || typeof chrome === "undefined" || !chrome.storage?.local) return;
    const check = (v: AskBought | undefined) => {
      if (v?.itemId !== record.id) return;
      setProofAsk("asked");
      rows?.set(record.id);
      void chrome.storage.local.remove(ASK_BOUGHT);
    };
    void chrome.storage.local.get(ASK_BOUGHT).then((got) => check(got[ASK_BOUGHT] as AskBought | undefined));
    const changed = (ch: Record<string, chrome.storage.StorageChange>, area: string) => area === "local" && ch[ASK_BOUGHT] && check(ch[ASK_BOUGHT].newValue as AskBought | undefined);
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per record and its state
  }, [record?.id, record?.status]);
  const pick = (o: OptionVM, then?: () => void) => {
    entry.current = "morph";
    setDrawer(false);
    // (our pick waiting for a yes is not chosen yet: its Seç in the deck's drawer chooses it)
    if (o.id === chosenId && vm.status !== "suggested") return setChanging(false);
    if (booking && bookingReplaced([booking], o.item)) {
      return setAsking({ ...replaceAsk(booking, o.item), run: () => (then?.(), a.replace(o.item, booking)) });
    }
    then?.();
    // "X yerine Y seçildi · Geri al" (K82): back to the one chosen before, or to nothing chosen.
    const prev = vm.status === "chosen" && record?.status === "chosen" ? record : null;
    a.choose(o.item);
    // (Karar Masası: chosen, the drawer closes and its row opens as the ticket, "Satın al ↗" on its right; switched, nothing
    // comes up under it: the new one is on the deck, the one given up back among the options)
    if (isDeskRow(vm)) rows?.set(o.item.id);
    if (!(isDeskRow(vm) && prev)) env.offer({ kind: "picked", item: o.item, prev });
  };
  const change = openDrawer;
  const cancelChange = () => {
    entry.current = "back";
    setChanging(false);
  };
  // Escape turns a card back from its options (Vazgeç), as it did from the old card's back.
  useEffect(() => {
    if (!changing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && focusNear(boxRef.current) && cancelChange();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [changing]);

  const desk = isDeskRow(vm);
  const menu: MenuEntry[] = [
    // (mockup v13's ⋯: "Değiştir" once something is chosen; before that the options are what there is to see)
    ...(all.length ? [{ label: vm.status === "chosen" || vm.status === "booked" ? L("Değiştir", "Change") : L(`Seçenekleri gör (${Math.max(vm.optionCount, all.length)})`, `See the options (${Math.max(vm.optionCount, all.length)})`), run: openDrawer }] : []),
    ...(record && form !== "searching" ? [{ label: L("Ayrıntı", "Details"), run: () => setDetail(true) }] : []),
    ...(a.pano && vm.optionCount ? [{ label: L(`Pano'da aç (${vm.optionCount})`, `Open on the Board (${vm.optionCount})`), run: a.pano }] : []),
    // A booking's map and its host (the old booked card's "Haritada aç ↗" and "Otele yaz ↗", kept: review).
    ...(vm.status === "booked" && vm.access?.links.map ? [{ label: L("Haritada aç ↗", "Open the map ↗"), run: () => void window.open(vm.access!.links.map!, "_blank", "noopener") }] : []),
    ...(vm.status === "booked" && vm.access?.links.host ? [{ label: vm.kind === "stay" ? L("Otele yaz ↗", "Write to the hotel ↗") : L("Yaz ↗", "Write ↗"), run: () => void window.open(vm.access!.links.host!, "_blank", "noopener") }] : []),
    ...(a.addSuggestion ? [{ label: L("Plana koy", "Add to plan"), run: a.addSuggestion }] : []),
    // (Karar Masası: the row's "Ara" became "Kendin ara ↗"; asking the AI stays one tap away)
    ...(desk && a.ask && (form === "searching" || form === "options") ? [{ label: L("AI arasın", "Ask the AI"), run: a.ask }] : []),
    ...(vm.status === "arranged" && (record || leg)
      ? [{ label: L("Ayarlandı: geri al", "Arranged: take back"), run: () => (record ? a.unarrange(record) : void onLeg(null)) }]
      : vm.status !== "booked" && vm.status !== "included"
        ? [{ label: L("Ben hallettim", "I've got it"), run: leg ? () => void onLeg({ booked: true }) : a.arranged }]
        : []),
    { label: L("Gerek yok", "Not needed"), run: skip, danger: true },
    ...extra.map((m, i) => (i === 0 ? { ...m, sep: true } : m)),
  ];

  const detailNode =
    record && vm.chosen ? (
      <DetailLayer
        vm={vm}
        option={vm.chosen}
        booked={vm.status === "booked"}
        onClose={() => setDetail(false)}
        onAddDoc={pickDoc ?? (() => undefined)}
        footer={
          <>
            {cancel && (
              <>
                <button type="button" className="q-dact" onClick={() => void cancel()}>{L("İptal ettim, değiştir", "I cancelled it, change")}</button>
                <button type="button" className="q-dact bad" onClick={() => void cancel().then(() => a.skip([record.id]))}>{L("İptal ettim, kaldır", "I cancelled it, take it off")}</button>
              </>
            )}
            <button type="button" className="q-dact" onClick={() => env.edit(record)}>{L("Düzenle", "Edit")}</button>
          </>
        }
      />
    ) : null;

  const needNow = form === "searching" ? offerNeed(vm, v82.selfAt) : null;
  const camp0 = record != null && vm.kind === "stay" && isCampStay(record);
  let body: ReactNode = null;
  if (searchingNow) {
    body = (
      <div className="z-skel" role="status">
        <div className="q-oh">
          <span className="z-pulse" aria-hidden />
          <b className="q-ot">{L(`AI ${name} için arıyor`, `The AI is looking for ${name}`)}</b>
          <small className="q-oc">{L("seçenekler gelince burada", "options land here")}</small>
        </div>
        {vm.frame === "ticket" ? (
          <div className="z-rows z-skr" aria-hidden>
            {[0, 1, 2].map((n) => (
              <div key={n} className="z-sk"><i /><span><i /><i /><i /></span></div>
            ))}
          </div>
        ) : (
          <div className="z-ocs" aria-hidden>
            {[0, 1, 2].map((n) => (
              <div key={n} className="z-sk"><i /><span><i /><i /><i /></span></div>
            ))}
          </div>
        )}
      </div>
    );
  } else if (showOptions) {
    body = <Deck vm={vm} all={all} art={art} people={vm.people ?? tripPeople(env.trip)} onOpen={openDrawer} />;
  }
  // (the frame's own forms: a deck of options is drawn by Deck, or by the row's Birikenler)
  const frameForm0 = form && form !== "options" ? form : null;
  const props = frameForm0
    ? {
      vm,
      form: frameForm0,
      art,
      page,
      links,
      hints: hints.map((h) => ({ ...h, url: areaSearch(vm, v82.selfAt, h.area)?.url ?? links[0]?.url ?? null })),
      info: record && form !== "searching" ? { open: detail, toggle: () => setDetail(!detail) } : null,
      onOpen: all.length ? openDrawer : null,
      onAgree: vm.routeDraft ? () => void updateTrip(env.tripId, agreeRoute) : null,
      detail: detailNode,
      quiet: form === "searching" && hasSearched(`intent:${vm.key}`) && !a.searching,
      on: {
        take: () => {
          entry.current = "morph";
          if (record) a.choose(record);
        },
        // (on a dated category's row "Aldım" asks for what backs it, ProofAsk under the row)
        got: () => record && (isDatedSection(vm.section) && vm.frame !== "collection" ? setProofAsk("got") : a.got(record)),
        change: vm.optionCount > 0 || vm.options.length > 0 ? change : null,
        openDoc: docs.length ? () => void openDoc(docs[0].id) : null,
        addDoc: pickDoc ?? (() => undefined),
        dropDoc,
        ask: needNow && offers.available() && !camp0 ? openDrawer : a.ask,
        edit: () => record && env.edit(record),
        // A leg's own plan taken back: its ways again (whatever was said: "Ben hallettim", metro).
        unarrange: vm.status === "arranged" ? (record ? () => a.unarrange(record) : leg ? () => void onLeg(null) : null) : null,
        // K87: an eSIM bought and not on the phone yet says "Kurdum" in its foot.
        installed: vm.kind === "esim" && record && record.installedAt == null && (record.status === "booked" || record.status === "chosen") ? () => void setInstalled(record, true) : null,
      },
    }
    : null;
  const cover = vm.cover;
  const onCover = cover?.key && cover.section ? () => v82.goTo(cover.section!, cover.key) : null;
  const ticketProps = props && vm.frame === "ticket"
    ? {
        ...props,
        onCover,
        // By plane a change of city is a flight: it goes to Uçuş, and the plan follows it there with a flash.
        ways: leg && vm.modes.length ? { pick: (mode: LegChoice["mode"]) => void onLeg({ mode }).then(() => mode === "flight" && v82.goTo("flight", vm.key)), own: () => void onLeg({ booked: true }) } : null,
        // A way said on a change of city (C15) goes back to the choice.
        onReset: leg && (vm.status === "chosen" || vm.status === "booked") ? () => void onLeg(null) : null,
        onLegGot: leg && vm.status === "chosen" ? () => void onLeg({ booked: true }) : null,
      }
    : null;
  if (!searchingNow && !showOptions && props) {
    body = ticketProps ? <FrameTicket {...ticketProps} /> : <FrameCard {...props} onCover={onCover} />;
  }
  if (vm.frame === "collection") body = <CollectionRow vm={vm} art={art} onPut={(o) => a.choose(o.item)} onTakeOff={(o) => void setItemStatus(o.item, "saved")} />;
  const key = searchingNow ? "skel" : showOptions ? `opts:${changing ? "chg" : ""}` : `${form}:${chosenId ?? ""}`;
  const xf = useCrossfade(key, body, entry.current);
  useEffect(() => {
    entry.current = "in";
  }, [key]);

  const need = form === "searching" || form === "options" ? offerNeed(vm, v82.selfAt) : null;
  // "Aranıyor" only while something looks or has looked: the source asked by itself (OfferRow), or the chat (0.38.5).
  const looking = a.searching || hasSearched(`intent:${vm.key}`) || (need != null && offers.available() && queryOf(need) != null);
  const chip = statusChip(vm, looking);
  // Its "Aranıyor" moves (three small dots) only while a search is out now: the chat's, or the source's (0.38.8).
  const lookingNow = useLooking(offersLooking, need?.key);
  const busy = vm.status === "searching" && looking && (a.searching || lookingNow);
  const placeholder = need?.kind === "stay" ? placeholderOf(vm.itemIds.map((id) => v82.byId.get(id)).filter((i): i is Item => i != null), env.trip, "stay") : null;
  // (never against what the trip already says: the van's nights, a day trip, the car's drives, a route still to agree: 0.40.3)
  const ownStay = vm.kind === "stay" && vm.itemIds.some((id) => isCampStay(v82.byId.get(id)));
  const autoBlock = need ? autoSearchBlock(need, shape, { ownStay, covered: vm.cover != null }) : "covered";
  // (0.40.5: a stop of a proposed route too, it has its own nights: found, its row is a deck, "Seç 3")
  useAutoSearch(vm, env.tripId, form === "searching" && autoBlock == null && (vm.options.length === 0 || placeholder != null) && !(vm.more?.length), placeholder);
  // (0.40.3: a hotel 0.40.1's search put in the van's place goes back to being the van's night, once)
  useEffect(() => {
    if (vm.kind !== "stay" || shape.sleep === "hotel") return;
    for (const id of vm.itemIds) {
      const it = v82.byId.get(id);
      const back = it ? restoredOwnStay(it, env.trip, shape.sleep) : null;
      if (back) void putItem(back, L(`${it!.name} yerine yine ${back.name}`, `${back.name} again instead of ${it!.name}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per record set
  }, [vm.itemIds.join(","), shape.sleep]);
  const headArt = vm.head.image ? { src: vm.head.image, photo: true } : { src: art, photo: false };
  const camp = record != null && vm.kind === "stay" && isCampStay(record);
  const here = onHere ? hereOf(vm) : null;
  const people = vm.people ?? tripPeople(env.trip);
  const drawerNode = drawer ? (
    <IntentDrawer
      vm={vm}
      options={all}
      dropped={dropped}
      chosenId={vm.status === "chosen" || vm.status === "booked" ? chosenId : null}
      art={art}
      links={links}
      typical={typical}
      need={need && !camp ? need : null}
      placeholder={placeholder}
      people={people}
      onPick={(o) => pick(o)}
      onClose={closeDrawer}
      onPano={a.pano ? () => (setDrawer(false), a.pano?.()) : null}
      onAsk={a.ask}
      onOffer={(item) => (setDrawer(false), a.choose(item))}
      onBring={bring}
    />
  ) : null;
  // K85: a way said with nothing to book is a line under the category's cards, its way one tap away.
  if (leg && isRouteNote(vm) && isDatedSection(vm.section)) {
    // Yerinde (plan v14): the same note as a quiet row on the date rail, its ways under it.
    return (
      <>
        <section className="q-int z-int q-rowi" id={vm.domKeys[0] ? entryDomId(vm.domKeys[0]) : undefined} data-intent={vm.key} data-st={railState(vm.status)} data-stage="planned" data-kind={vm.kind} data-face="yer" style={{ "--k": color } as React.CSSProperties} aria-label={name}>
          <YerindeRow vm={vm} date={railDate(vm)} menu={<IntentMenu entries={menu} name={name} />} onPick={(mode) => void onLeg({ mode })} onOwn={() => void onLeg({ booked: true })} map={wayDirections(vm)?.url ?? null} />
        </section>
        {asking && <AskWindow ask={asking} onClose={() => setAsking(null)} />}
      </>
    );
  }
  if (leg && isRouteNote(vm)) {
    return (
      <>
        <RouteNote vm={vm} domId={vm.domKeys[0] ? entryDomId(vm.domKeys[0]) : undefined} menu={<IntentMenu entries={menu} name={name} />} onPick={(mode) => void onLeg({ mode })} onOwn={() => void onLeg({ booked: true })} />
        {asking && <AskWindow ask={asking} onClose={() => setAsking(null)} />}
      </>
    );
  }
  // Plan v14 (onay paketi 2026-10-21): a dated category's intent is a row on its date rail, its frame under it or beside it.
  if (isDatedSection(vm.section) && vm.frame !== "collection") {
    const view0 = rowView(vm);
    // (Karar Masası: the ring turns while the chat or the source looks now, as the old card's three dots did)
    const view = whileSearching(view0, vm.status, view0.desk ? a.searching || busy : a.searching);
    const date = railDate(vm);
    const editable = itemId != null;
    const askNow = needNow && offers.available() && !camp0 ? openDrawer : a.ask;
    // A stay's card with no source to ask still opens its drawer when there are sites to look on (its Yeni bul: the sites, the AI).
    const askCard = view.face === "card" && askNow !== openDrawer && links.length ? openDrawer : askNow;
    const slotOn: SlotOn = {
      ask: askCard,
      pick: openDrawer,
      take: () => {
        entry.current = "morph";
        if (record) a.choose(record);
        if (record && view.desk) rows?.set(record.id);
      },
      // (a way said for a leg, no record yet: "Aldım" books the leg itself, as its ticket's own Aldım does; a record asks for
      // what backs it first, ProofAsk)
      got: () => (record ? setProofAsk("got") : leg && vm.status === "chosen" ? void onLeg({ booked: true }) : undefined),
      asked: record ? () => setProofAsk("asked") : null,
      page,
      brand: vm.chosen?.brand?.label ?? null,
      date: itemId ? () => env.setFocus({ id: itemId, field: "date", scroll: false }) : a.ask,
      proof: record && pickDoc ? pickDoc : null,
      // (Karar Masası: "Kendin ara ↗" is the first site; the "+" opens the drawer, its "+ Seninkini ekle" and the source)
      self: links[0] ?? null,
      add: view.desk ? openDrawer : null,
      // (an empty box's two searches side by side: the drawer or a site yourself, or the AI)
      ai: a.ask,
      aiBusy: a.searching,
    };
    const menuNode = <IntentMenu entries={menu} name={name} />;
    // (Karar Masası: bought, the row opens with its stamp pressed on and the last step under the ticket)
    const booked0 = (ref: string | null) => record && (setProofAsk(null), view.desk && rows?.set(record.id), markBooked(record, ref));
    const askNode =
      proofAsk && record && (vm.status === "chosen" || vm.status === "suggested" || vm.status === "arranged") ? (
        <ProofAsk
          booking={vm.kind === "stay" || vm.ticket?.mode === "car" || vm.ticket?.rental != null}
          asked={proofAsk === "asked"}
          onRef={(code) => void booked0(code)}
          onFiles={dropDoc ? (files) => void Promise.resolve(booked0(null)).then(() => dropDoc(files)) : null}
          onJust={() => void booked0(null)}
          onCancel={() => setProofAsk(null)}
        />
      ) : null;
    const sectionProps = {
      ref: boxRef,
      className: `q-int z-int q-rowi${folding ? " folding" : ""}${takeoff && vm.frame === "ticket" ? " z-go" : ""}${pop ? " pop" : ""}`,
      id: vm.domKeys[0] ? entryDomId(vm.domKeys[0]) : undefined,
      "data-intent": vm.key,
      "data-st": railState(vm.status),
      "data-stage": view.stage,
      "data-desk": view.desk ? "" : undefined,
      // (a stay's city, said on the rail where it changes: its row carries it once something is picked for it)
      "data-city": vm.kind === "stay" && vm.chosen ? (vm.head.city ?? undefined) : undefined,
      "data-kind": vm.kind,
      "data-face": view.face,
      "data-item-id": itemId ?? undefined,
      "data-option-ids": vm.itemIds.join(" ") || undefined,
      style: { "--k": color } as React.CSSProperties,
      "aria-label": name,
      "aria-describedby": chipId,
      "data-new": L("Yeni", "New"),
    };
    const tail = (
      <>
        {field}
        {vm.domKeys.slice(1).map((k) => (
          <i key={k} className="q-anchor" id={entryDomId(k)} aria-hidden />
        ))}
        {here && onHere && (
          <div className="q-here">
            <button type="button" title={L("Buraya ekle", "Add here")} onClick={() => onHere(here)}>
              + {L("Buraya ekle", "Add here")}
            </button>
          </div>
        )}
      </>
    );
    let inner: ReactNode;
    if (gap && vm.kind === "stay") {
      const t = emptyNightText(vm, gap.before, gap.after);
      inner = <EmptyNight date={date} title={t.title} line={t.line} onAsk={askNow} menu={menuNode} />;
    } else if (view.face === "ticket") {
      const shown = vm.chosen;
      const many = Math.max(vm.optionCount, all.length);
      // (Karar Masası: under the opened ticket only links, one line: "Skyscanner'dan · Değiştir 7 · ✓ Aldım"; the one button
      // stays on the row's right)
      const acts = view.desk ? (
        <>
          {shown?.brand?.label && (vm.status === "chosen" || vm.status === "suggested") && <span className="q-rsrc">{fromName(shown.brand.label)}</span>}
          {/* (a chosen record can always be changed: its drawer, the other options and "+ Seninkini ekle"; a leg's way has its own) */}
          {(all.length > 1 || (vm.status === "chosen" && record != null)) && (vm.status === "chosen" || vm.status === "suggested" || vm.status === "booked") && (
            <button type="button" className="q-chg q-lnk" onClick={openDrawer}>
              {vm.status === "suggested" ? L("Seçenekler", "Options") : L("Değiştir", "Change")}
              {many > 1 && <b>{many}</b>}
            </button>
          )}
          <span className="q-rsp" />
          {vm.status === "booked" && record && (
            <button type="button" className="q-chg q-lnk" onClick={() => saveIcs(record)}>
              {L("Takvime ekle", "Add to calendar")}
            </button>
          )}
          {vm.status === "chosen" && page && (
            <button type="button" className="q-got q-lnk" onClick={() => record && setProofAsk("got")}>
              ✓ {L("Aldım", "Got it")}
            </button>
          )}
        </>
      ) : (
        <>
          {shown?.brand?.label && (vm.status === "chosen" || vm.status === "suggested") && <span className="q-rsrc">{L(`${shown.brand.label}'dan`, `from ${shown.brand.label}`)}</span>}
          <span className="q-rsp" />
          {vm.status === "booked" && record && (
            <button type="button" className="q-chg" onClick={() => saveIcs(record)}>
              {L("Takvime ekle", "Add to calendar")}
            </button>
          )}
          {vm.status === "chosen" && page && (
            <button type="button" className="q-got" onClick={() => record && setProofAsk("got")}>
              ✓ {L("Aldım", "Got it")}
            </button>
          )}
          {all.length > 1 && (vm.status === "chosen" || vm.status === "suggested" || vm.status === "booked") && (
            <button type="button" className="q-chg" onClick={openDrawer}>
              {vm.status === "suggested" ? L(`Seçenekler (${Math.max(vm.optionCount, all.length)})`, `Options (${Math.max(vm.optionCount, all.length)})`) : L("Değiştir", "Change")}
            </button>
          )}
        </>
      );
      const ticket = searchingNow ? (
        <div className="z-skel" role="status">
          <div className="q-oh">
            <span className="z-pulse" aria-hidden />
            <b className="q-ot">{L(`AI ${name} için arıyor`, `The AI is looking for ${name}`)}</b>
            <small className="q-oc">{L("seçenekler gelince burada", "options land here")}</small>
          </div>
        </div>
      ) : ticketProps ? (
        // (the row draws its details under itself, ⋯ Ayrıntı: the ticket inside it doesn't draw them again)
        <FrameTicket {...ticketProps} detail={null} inRow />
      ) : null;
      // (getirme anları: being read, then where it stands and what we think of it, with Karşılaştır and Geri al)
      const broughtNode = bringing ? (
        <div className="q-brought" role="status">
          {arrived ? (
            <>
              <span className="q-bri" aria-hidden>
                <Ic name="spark" size={14} />
              </span>
              <span className="q-brt">
                <b>{L(`${bringing.what} okundu · ${arrived.place}. aday oldu`, `${bringing.what} read · now option ${arrived.place}`)}</b>
                {deckVerdict(arrived, all) && <small>{deckVerdict(arrived, all)}</small>}
              </span>
              <button type="button" className="q-lnk" onClick={() => (setBringing(null), openDrawer())}>
                {L("Karşılaştır", "Compare")} <b>{many}</b>
              </button>
              <button type="button" className="q-lnk" onClick={() => (setBringing(null), void setItemStatus(arrived.item, "dismissed"))}>
                {L("Geri al", "Undo")}
              </button>
              <button type="button" className="q-brx" aria-label={L("Kapat", "Close")} onClick={() => setBringing(null)}>
                <Ic name="x" size={14} />
              </button>
            </>
          ) : (
            <span className="q-look q-lookrow">
              <span className="q-lookd" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="q-lookt">{L(`${bringing.what} okunuyor; bu satıra koyacağım`, `Reading ${bringing.what.toLocaleLowerCase("en")}; it goes on this row`)}</span>
            </span>
          )}
        </div>
      ) : null;
      inner = <TicketRow vm={vm} view={view} art={art} date={date} on={slotOn} ticket={ticket} links={links} onDrawer={all.length || need ? openDrawer : null} menu={menuNode} acts={acts} chipId={chipId} editable={editable} under={detail ? <div className="q-rdet">{detailNode}</div> : null} focused={itemId != null && env.focus?.id === itemId && env.focus.field != null} openKey={itemId ?? undefined} ask={askNode} bring={bring} brought={broughtNode} />;
    } else {
      // A stay, a rental: pressed, its options beside the plan (Değiştir once chosen); a booking its details under it.
      const onPress = vm.status === "booked" && record ? () => setDetail(!detail) : all.length ? openDrawer : askCard;
      const a0 = vm.access;
      const warn = vm.ticket?.chips.filter((c) => c.kind === "warn" || c.kind === "night") ?? [];
      const doc = vm.kind === "stay" ? { open: L("Onayı aç", "Open the confirmation"), add: L("Onayı ekle", "Add the confirmation") } : { open: L("Belgeyi aç", "Open the document"), add: L("Belgeyi ekle", "Add the document") };
      const foot =
        vm.status === "booked" ? (
          <div className="q-rft ok">
            {a0?.checkIn && <span>{L(`Giriş ${a0.checkIn}`, `Check-in ${a0.checkIn}`)}</span>}
            {record && freeCancelText(record, env.today) && <span>{freeCancelText(record, env.today)}</span>}
            {record && (
              <button type="button" className="q-chg ok" onClick={() => saveIcs(record)}>
                {L("Takvime ekle", "Add to calendar")}
              </button>
            )}
            {vm.paid && view.figure?.code && view.slot.kind !== "none" && <span className="z-paid">{vm.paid}</span>}
            {/* (soon and still no file: trouble, said in amber even beside "Onayı ekle") */}
            {a0?.docMissing && (
              <button type="button" className="z-docw" onClick={() => pickDoc?.()}>
                ⚠ {L(`${doc.add} · eksik`, `${doc.add} · missing`)}
              </button>
            )}
            <span className="q-rsp" />
            {docs.length > 0 ? (
              <button type="button" className="q-chg ok" onClick={() => void openDoc(docs[0].id)}>
                {doc.open}
              </button>
            ) : (
              !a0?.docMissing && pickDoc && view.slot.kind !== "proof" && (
                <button type="button" className="q-chg ok" onClick={pickDoc}>
                  {doc.add}
                </button>
              )
            )}
            {(a0?.links.page ?? page) && (
              <a className="q-chg ok" href={(a0?.links.page ?? page)!} target="_blank" rel="noreferrer">
                {L("Rezervasyonu aç ↗", "Open the booking ↗")}
              </a>
            )}
          </div>
        ) : vm.status === "included" && vm.cover ? (
          <div className="q-rft">
            <span>{vm.cover.by}</span>
            <span className="q-rsp" />
            {onCover && (
              <button type="button" className="q-chg" onClick={onCover}>
                {vm.cover.open} ›
              </button>
            )}
          </div>
        ) : vm.status === "arranged" && vm.note ? (
          <div className="q-rft">
            <span>{vm.note}</span>
          </div>
        ) : null;
      // Kaçırdıklarımız 2: its hours against the flight either side, one amber strip with its one thing to do.
      const hours =
        timing && (vm.status === "chosen" || vm.status === "suggested" || vm.status === "booked") ? (
          <div className="q-rft warn">
            <span>{timing.text}</span>
            <span className="q-rsp" />
            {env.ask && (
              <button type="button" className="q-chg warn" onClick={() => env.ask?.(timingAsk(timing, vm.chosen?.title ?? name))}>
                {timing.act}
              </button>
            )}
          </div>
        ) : null;
      // A stop of a route the AI proposed: still looked for as any stay, "Rotayı onayla" under it until the route is agreed.
      const agree = vm.routeDraft ? (
        <div className="q-rft ai">
          <span>{L("Önerilen rotanın bir durağı", "A stop on the proposed route")}</span>
          <span className="q-rsp" />
          <button type="button" className="q-chg q-agree" onClick={() => void updateTrip(env.tripId, agreeRoute)}>
            {L("Rotayı onayla", "Agree the route")}
          </button>
        </div>
      ) : null;
      // Kaçırdıklarımız (kişi ya da oda değişince): the chosen room was priced for fewer or more than go now.
      const gapNow = vm.kind === "stay" && (vm.status === "chosen" || vm.status === "suggested") && record ? guestGap(record, people) : null;
      const party = gapNow ? (
        <div className="q-rft warn">
          <span>{guestGapText(gapNow, true)}</span>
          <span className="q-rsp" />
          {all.length > 0 && (
            <button type="button" className="q-chg warn" onClick={openDrawer}>
              {L("Seçenekler", "Options")}
            </button>
          )}
        </div>
      ) : null;
      const warnStrip =
        warn.length && vm.status !== "booked" && !(vm.status === "included" && vm.cover) ? (
          <div className="q-rft warn">
            {warn.map((c) => (
              <span key={c.text}>{c.text}</span>
            ))}
          </div>
        ) : null;
      // (0.44.2, Emre: "kart açılmadan çok göze batıyor"): closed, the notes are one small line in the card ("⏱ Giriş saati");
      // pressed, the card opens and each says its whole sentence with its one thing to do.
      const notes = [hours, party, warnStrip].filter(Boolean);
      const canOpen = Boolean(record && form !== "searching");
      const folded = canOpen && !detail && notes.length > 0;
      const noteWord = hours && timing ? (timing.end === "in" ? L("Giriş saati", "Check-in time") : L("Çıkış saati", "Check-out time")) : party ? L("Kişi sayısı", "Party size") : L("Bir not", "A note");
      const hint = folded ? (
        <button type="button" className="q-hint" onClick={(e) => (e.stopPropagation(), setDetail(true))} onKeyDown={(e) => e.stopPropagation()}>
          <span aria-hidden>⏱</span> {noteWord}
          {notes.length > 1 ? ` · +${notes.length - 1}` : ""}
        </button>
      ) : null;
      const shown = folded ? null : notes;
      inner = <StayCard vm={vm} view={view} art={art} date={date} on={slotOn} onPress={onPress} menu={menuNode} foot={agree || shown?.length ? <>{foot}{agree}{shown}</> : foot} hint={hint} under={detail ? <div className="q-rdet">{detailNode}</div> : null} chipId={chipId} editable={editable} ask={askNode} />;
    }
    return (
      <>
        <section {...sectionProps}>
          {overlap && <OverlapRow title={overlapText(overlap).title} line={overlapText(overlap).line} night={overlap.night} onFix={record ? () => env.edit(record) : null} />}
          {inner}
          {tail}
        </section>
        {drawerNode}
        {asking && <AskWindow ask={asking} onClose={() => setAsking(null)} />}
      </>
    );
  }
  return (
    <>
      <section
        ref={boxRef}
        className={`q-int z-int${folding ? " folding" : ""}${takeoff && vm.frame === "ticket" ? " z-go" : ""}`}
        id={vm.domKeys[0] ? entryDomId(vm.domKeys[0]) : undefined}
        data-intent={vm.key}
        data-st={railState(vm.status)}
        data-kind={vm.kind}
        data-item-id={itemId ?? undefined}
        data-option-ids={vm.itemIds.join(" ") || undefined}
        style={{ "--k": color } as React.CSSProperties}
        aria-label={name}
        aria-describedby={chipId}
        // What just arrived wears "Yeni" while it rings (arrive/useArrivals pulses .ar-new on it, C10/C35).
        data-new={L("Yeni", "New")}
      >
        <IntentHead vm={vm} art={headArt} chip={chip} busy={busy} chipId={chipId} pop={pop} onPano={a.pano} menu={<IntentMenu entries={menu} name={name} />} />
        <div className="q-bwrap">
          <div className="q-body">
            <div key={xf.key} className={xf.cls}>
              {xf.node}
            </div>
          </div>
        </div>
        {field}
        {/* The need's other blocks (its nights said apart): a to-do or a link to one of them finds this box (and flashes it). */}
        {vm.domKeys.slice(1).map((k) => (
          <i key={k} className="q-anchor" id={entryDomId(k)} aria-hidden />
        ))}
        {here && onHere && (
          <div className="q-here">
            <button type="button" title={L("Buraya ekle", "Add here")} onClick={() => onHere(here)}>
              + {L("Buraya ekle", "Add here")}
            </button>
          </div>
        )}
      </section>
      {drawerNode}
      {asking && <AskWindow ask={asking} onClose={() => setAsking(null)} />}
    </>
  );
}
