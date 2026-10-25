import { useEffect, useMemo, useRef, useState } from "react";
import { loadDemoTrip } from "../lib/demo";
import { L } from "../lib/i18n";
import { planTarget } from "../lib/chatCards";
import { buildPlan, groupKeyOf } from "../lib/plan";
import { purgeTrash, restoreTrash, trashTrip } from "../lib/trash";
import { checkStraysOnce } from "../lib/strays";
import { HOME_HASH, openingTrip } from "../lib/openingTrip";
import { isDemoTrip } from "../lib/trips";
import type { Item, TrashEntry } from "../lib/types";
import { undoSlot } from "../lib/undo";
import { HistoryDialog } from "./HistoryDialog";
import { DeleteSharedTripDialog } from "./ShareSafety";
import { DropOverlay } from "./arrive/ArriveViews";
import { useBoardIntake } from "./arrive/useBoardIntake";
import { Chat } from "./Chat";
import type { PlanLink } from "./chat/planLink";
import { ItemDrawer } from "./ItemDrawer";
import { Settings } from "./Settings";
import { ShareDialog, ShareProvider } from "./Share";
import { TripPanel } from "./TripPanel";
import { UndoRing } from "./cards/UndoToast";
import { TripsHome, type StartLaunch } from "./TripsHome";
import { StartChat } from "./start/StartChat";
import { withTransition, withTripPhoto } from "./viewTransition";
import { newId } from "../lib/db";
import { loadPassport } from "../lib/passport";
import { useMyName } from "./Profile";
import { guessOrigin, originFromTrips, newStart, type StartCtx } from "../lib/startTrip";
import { OfflineNotice } from "./OfflineNotice";
import { UpdateBanner } from "./UpdateBanner";
import { clearPriceBadge, priceBadge } from "../lib/priceBadge";
import { readSelectedTrip, useBoard } from "./useBoard";
import { useDecisions } from "./useDecisions";

/** "#trip=<id>" (from the popup) opens that trip. */
const tripFromHash = (): string | null => openingTrip(location.hash, null);

export function App() {
  const board = useBoard(openingTrip(location.hash, readSelectedTrip()));
  // "#home" (the home's own reload) has done its part once the home is open.
  useEffect(() => {
    if (location.hash === HOME_HASH) history.replaceState(null, "", location.pathname);
  }, []);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(location.hash === "#settings");
  const [seenArrival, setSeenArrival] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const tripUndo = useMemo(() => undoSlot<TrashEntry>(), []);
  const [deletedTrip, setDeletedTrip] = useState<TrashEntry | null>(null);
  useEffect(() => tripUndo.subscribe(setDeletedTrip), [tripUndo]);
  /** A word about deleting or bringing back a trip (a failure, a copy apart from the sharing), until closed. */
  const [safetyNote, setSafetyNote] = useState<string | null>(null);
  const decisions = useDecisions(board.trip, board.items);
  // Fiyat izleme's badge (lib/priceBadge.ts): the trip it was for opened, it goes.
  const shownTripId = board.trip?.id ?? null;
  useEffect(() => {
    if (shownTripId) void priceBadge().then((b) => (b?.tripId === shownTripId ? clearPriceBadge() : undefined));
  }, [shownTripId]);
  // C34: the Plan's boxes and its "Planda göster" / "Bunu seç", handed up by the Plan for the chat beside it.
  const [planLink, setPlanLink] = useState<PlanLink | null>(null);
  const intake = useBoardIntake(board.trip?.id ?? null);
  // The start chat (spec 2026-10-06 §2), over the overview while it's open; `key` starts a fresh one each time.
  const [start, setStart] = useState<(StartLaunch & { key: string }) | null>(null);
  const startKey = useRef<string | null>(null);
  startKey.current = board.trip ? null : (start?.key ?? null);
  // The profile's name (the sharing name): "Merhaba Emre", and "Emre & Sabine" in the checklist.
  const myName = useMyName().trim() || null;
  const [passport, setPassport] = useState<string | null>(null);
  useEffect(() => {
    void loadPassport().then(setPassport);
  }, []);
  const startCtx: StartCtx = useMemo(
    () => ({ myName, fromGuess: guessOrigin(board.trips, board.allItems, passport), fromTrips: originFromTrips(board.trips, board.allItems), today: new Date().toISOString().slice(0, 10) }),
    [myName, passport, board.trips, board.allItems],
  );

  /**
   * "Porto'da bir otel daha", said on the home for a trip there is: that trip opens and its chat sends the line as if
   * typed there (busy, "Düşünüyor…", an error on screen, the language reload): never a send outside the chat.
   */
  const [pendingChat, setPendingChat] = useState<{ id: string; tripId: string; text: string } | null>(null);
  function addToTrip(tripId: string, text: string) {
    setPendingChat({ id: newId(), tripId, text });
    board.selectTrip(tripId);
  }
  // A trip on screen (a link, the arrival toast, the history): the start screen gives way; its draft stays.
  useEffect(() => {
    if (board.trip) setStart(null);
  }, [board.trip?.id]);

  // Çöp kutusu: what is older than 30 days goes when the board opens (and whenever the trash is read).
  useEffect(() => void purgeTrash().catch(() => 0), []);
  // Once per trip on this computer: records that look like another trip's are asked about in its chat (strays.ts).
  useEffect(() => void checkStraysOnce().catch(() => 0), []);
  // Another trip on screen: the dialogs of the one before close.
  useEffect(() => {
    setHistoryOpen(false);
    setDeleteAsk(false);
  }, [board.trip?.id]);

  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#settings") setSettingsOpen(true);
      const tripId = tripFromHash();
      if (tripId) {
        setStart(null);
        board.selectTrip(tripId);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [board.selectTrip]);

  const trip = board.trip;
  const openItem = board.items.find((i) => i.id === openItemId) ?? null;
  /** The comparison an item is in (a stay saved without dates can be in its city's group). */
  const decisionOf = (item: Item) =>
    [...(decisions?.byGroup.values() ?? [])].find((d) => d.options.some((o) => o.item.id === item.id)) ??
    decisions?.byGroup.get(groupKeyOf(item));
  const plan = useMemo(() => (trip ? buildPlan(trip, board.items) : null), [trip, board.items]);

  // A capture landed in a different trip than the one on screen: say where, offer to go there.
  const arrival = board.arrivals[0];
  const arrivalTrip = arrival ? board.trips.find((t) => t.id === arrival.tripId) : undefined;
  const showArrival = arrival && arrivalTrip && trip && arrival.tripId !== trip.id && arrival.id !== seenArrival;

  // "Bu geziyi sil" (0.37): the trip and everything only its own go to the trash for 30 days. A shared trip asks
  // first in its own dialog (only this computer, the others' copy stays); "Geri al" for 8 seconds on the overview.
  async function deleteTrip() {
    if (!trip) return;
    if (trip.shareId) return setDeleteAsk(true);
    if (!confirm(L(`"${trip.title}" ve içindeki her şey silinsin mi? 30 gün Çöp kutusu'nda durur.`, `Delete "${trip.title}" and everything in it? It stays in the trash for 30 days.`))) return;
    await moveTripToTrash(trip.id);
  }

  const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

  async function moveTripToTrash(tripId: string) {
    setDeleteAsk(false);
    try {
      const entry = await trashTrip(tripId);
      board.selectTrip(null);
      if (entry) tripUndo.show(entry);
    } catch (error) {
      setSafetyNote(L(`Gezi silinemedi, hiçbir şey değişmedi: ${why(error)}`, `The trip couldn't be deleted; nothing changed: ${why(error)}`));
    }
  }

  async function restoreTrip(entry: TrashEntry) {
    try {
      const result = await restoreTrash(entry.id);
      if (result.entry) board.selectTrip(result.entry.tripId);
      if (result.detached) setSafetyNote(L("Paylaşımdan ayrı bir kopya olarak geri geldi (aynı paylaşım bu bilgisayarda yine açık).", "It came back as a copy apart from the sharing (the same share is open on this computer again)."));
    } catch (error) {
      setSafetyNote(L(`Geri getirilemedi; gezi Çöp kutusu'nda duruyor: ${why(error)}`, `Couldn't bring it back; the trip is still in the trash: ${why(error)}`));
    }
  }

  // The trip's ⋯ menu is the hero's own (v83 C1, hero/TripMenu.tsx); what only the board opens is handed down to it.
  const sharable = trip && !isDemoTrip(trip);
  return (
    <ShareProvider trip={trip}>
      <UpdateBanner />
      {trip ? (
        <div className="board">
          {/* (one chat a trip: what is queued, busy or wrong in one never goes on with another, 2026-10-25) */}
          <Chat
            key={trip.id}
            trip={trip}
            messages={board.messages}
            onBack={() => withTripPhoto(() => board.selectTrip(null), trip.id, false)}
            items={board.allItems}
            trips={board.trips}
            openCaptures={board.openCaptures}
            pending={pendingChat?.tripId === trip.id ? pendingChat : null}
            onPendingTaken={(id) => setPendingChat((p) => (p?.id === id ? null : p))}
            plan={planLink}
          />
          {/* Files and links dropped (or pasted) on the board: read and put in their place (arrive/useBoardIntake). */}
          <main className="panel" {...intake.handlers}>
            {intake.rect && <DropOverlay rect={intake.rect} />}
            <TripPanel
              trip={trip}
              items={board.items}
              plan={plan!}
              openCaptures={board.openCaptures}
              decisions={decisions}
              onOpenItem={(i: Item) => setOpenItemId(i.id)}
              onShare={sharable ? () => setShareOpen(true) : undefined}
              onHistory={() => setHistoryOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              onDeleteTrip={() => void deleteTrip()}
              historyOpen={historyOpen}
              onHistoryClose={() => setHistoryOpen(false)}
              onAsk={(text) => addToTrip(trip.id, text)}
              onPlanLink={setPlanLink}
            />
          </main>
        </div>
      ) : start ? (
        <StartChat
          key={start.key}
          initial={start.draft ?? newStart(newId(), start.mode, Date.now())}
          firstText={start.draft ? undefined : start.text}
          firstLabel={start.draft ? undefined : start.label}
          firstNote={start.draft ? undefined : start.note}
          ctx={startCtx}
          onClose={() => withTransition(() => setStart(null))}
          onCreated={(tripId) => {
            // A generation left behind (the screen was left, another start opened) doesn't take the board over.
            if (startKey.current !== start.key) return;
            withTransition(() => {
              setStart(null);
              board.selectTrip(tripId);
            });
          }}
        />
      ) : (
        board.loaded && (
          <TripsHome
            trips={board.trips}
            items={board.allItems}
            openCaptures={board.openCaptures}
            onOpen={(id) => withTripPhoto(() => board.selectTrip(id), id, true)}
            onDemo={() => void loadDemoTrip().then(board.selectTrip)}
            onSettings={() => setSettingsOpen(true)}
            onStart={(launch) => withTransition(() => setStart({ ...launch, key: newId() }))}
            onAddToTrip={addToTrip}
            ctx={startCtx}
            onTrash={() => setHistoryOpen(true)}
            onDelete={(id) => void moveTripToTrash(id)}
          />
        )
      )}
      {showArrival && (
        <div className="toast" role="status" aria-live="polite">
          <span>
            {arrival.text.replace(/^✓\s*/, "✓ ").replace(/ → .*$/, "")} → <b>{arrivalTrip.title}</b>
          </span>
          <button
            className="small-btn"
            onClick={() => {
              setSeenArrival(arrival.id);
              board.selectTrip(arrivalTrip.id);
            }}
          >
            {L("Aç", "Open")}
          </button>
          <button className="toast-close" aria-label={L("Kapat", "Close")} onClick={() => setSeenArrival(arrival.id)}>
            ×
          </button>
        </div>
      )}
      {openItem && (
        <ItemDrawer
          item={openItem}
          group={board.items.filter((i) => groupKeyOf(i) === groupKeyOf(openItem))}
          trips={board.trips}
          decision={decisionOf(openItem)}
          decisions={decisions}
          onClose={() => setOpenItemId(null)}
          onMoved={board.selectTrip}
          onCompare={() => {
            setOpenItemId(null);
            // B12: the comparison is the Pano's (the old window is not in this version, C11): it opens at the record's intent, the record lit.
            const at = planLink ? planTarget(openItem, planLink.collections) : null;
            if (at) planLink?.show({ kind: "pano", section: at.section, intentKey: at.kind === "section" ? null : at.intentKey, itemId: openItem.id });
          }}
        />
      )}
      {/* The old comparison window (CompareView, with its priorities) is not in this version (C11): the Pano compares. */}
      {/* "İnternet yok · N sn sonra tekrar deniyorum": a save that couldn't get out is tried again by itself (reconnect.ts). */}
      <OfflineNotice captures={board.openCaptures} />
      {settingsOpen && (
        <Settings
          onClose={() => {
            setSettingsOpen(false);
            if (location.hash) history.replaceState(null, "", location.pathname);
          }}
        />
      )}
      {trip && deleteAsk && trip.shareId && (
        <DeleteSharedTripDialog trip={trip} onCancel={() => setDeleteAsk(false)} onDelete={() => void moveTripToTrash(trip.id)} />
      )}
      {!trip && historyOpen && (
        <HistoryDialog
          trip={null}
          items={[]}
          hidden={[]}
          onClose={() => setHistoryOpen(false)}
          onOpenTrip={(id) => {
            setHistoryOpen(false);
            board.selectTrip(id);
          }}
        />
      )}
      {safetyNote && (
        <div className="toast hs-toast" role="alert">
          <span>{safetyNote}</span>
          <button className="toast-close" aria-label={L("Kapat", "Close")} onClick={() => setSafetyNote(null)}>
            ×
          </button>
        </div>
      )}
      {!trip && deletedTrip && (
        <div className="pk-undo" role="status" aria-live="polite">
          <span>{L(`${deletedTrip.label} silindi`, `${deletedTrip.label} deleted`)}</span>
          <button
            type="button"
            onClick={() => {
              const entry = tripUndo.take();
              if (entry) void restoreTrip(entry);
            }}
          >
            {L("Geri al", "Undo")}
          </button>
          <UndoRing of={deletedTrip} />
        </div>
      )}
      {trip && shareOpen && (
        <ShareDialog
          trip={trip}
          onClose={() => setShareOpen(false)}
          onSettings={() => {
            setShareOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}
    </ShareProvider>
  );
}
