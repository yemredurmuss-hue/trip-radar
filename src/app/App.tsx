import { useEffect, useMemo, useState } from "react";
import { resetConversation } from "../lib/assistant";
import { loadDemoTrip } from "../lib/demo";
import { L } from "../lib/i18n";
import { routeUrl } from "../lib/items";
import { buildPlan, groupKeyOf, liveGroups } from "../lib/plan";
import { purgeTrash, restoreTrash, trashTrip } from "../lib/trash";
import { isDemoTrip } from "../lib/trips";
import type { Item, TrashEntry } from "../lib/types";
import { undoSlot } from "../lib/undo";
import { HistoryDialog } from "./HistoryDialog";
import { DeleteSharedTripDialog } from "./ShareSafety";
import { DropOverlay } from "./arrive/ArriveViews";
import { useBoardIntake } from "./arrive/useBoardIntake";
import { Chat } from "./Chat";
import { CompareView } from "./CompareView";
import { HeroIcon } from "./Icons";
import { ItemDrawer } from "./ItemDrawer";
import { Settings } from "./Settings";
import { ShareDialog, ShareProvider } from "./Share";
import { TripPanel } from "./TripPanel";
import { TripsHome, type StartLaunch } from "./TripsHome";
import { StartChat } from "./start/StartChat";
import { addEvent, newId, notifyChanged } from "../lib/db";
import { describeError } from "../lib/llm";
import { loadPassport } from "../lib/passport";
import { useMyName } from "./Profile";
import { sendMessage } from "../lib/assistant";
import { guessOrigin, newStart, type StartCtx } from "../lib/startTrip";
import { UpdateBanner } from "./UpdateBanner";
import { readSelectedTrip, useBoard } from "./useBoard";
import { useDecisions } from "./useDecisions";

/** "#trip=<id>" (from the popup) opens that trip; otherwise the last trip viewed, or the overview. */
function tripFromHash(): string | null {
  const match = location.hash.match(/^#trip=([\w-]+)/);
  return match ? match[1] : null;
}

export function App() {
  const board = useBoard(tripFromHash() ?? readSelectedTrip());
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(location.hash === "#settings");
  const [menuOpen, setMenuOpen] = useState(false);
  const [seenArrival, setSeenArrival] = useState<string | null>(null);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const tripUndo = useMemo(() => undoSlot<TrashEntry>(), []);
  const [deletedTrip, setDeletedTrip] = useState<TrashEntry | null>(null);
  useEffect(() => tripUndo.subscribe(setDeletedTrip), [tripUndo]);
  /** A word about deleting or bringing back a trip (a failure, a copy apart from the sharing), until closed. */
  const [safetyNote, setSafetyNote] = useState<string | null>(null);
  const decisions = useDecisions(board.trip, board.items);
  const intake = useBoardIntake(board.trip?.id ?? null);
  // The start chat (spec 2026-10-06 §2), over the overview while it's open; `key` starts a fresh one each time.
  const [start, setStart] = useState<(StartLaunch & { key: string }) | null>(null);
  // The profile's name (the sharing name): "Merhaba Emre", and "Emre & Sabine" in the checklist.
  const myName = useMyName().trim() || null;
  const [passport, setPassport] = useState<string | null>(null);
  useEffect(() => {
    void loadPassport().then(setPassport);
  }, []);
  const startCtx: StartCtx = useMemo(
    () => ({ myName, fromGuess: guessOrigin(board.trips, board.allItems, passport), today: new Date().toISOString().slice(0, 10) }),
    [myName, passport, board.trips, board.allItems],
  );

  /** "Porto'da bir otel daha", said on the home for a trip there is: that trip opens, its chat gets the line. */
  function addToTrip(tripId: string, text: string) {
    board.selectTrip(tripId);
    sendMessage(tripId, text).catch(async (error) => {
      await addEvent(tripId, L(`"${text}" gönderilemedi: ${describeError(error)}`, `"${text}" couldn't be sent: ${describeError(error)}`));
      notifyChanged();
    });
  }

  // Çöp kutusu: what is older than 30 days goes when the board opens (and whenever the trash is read).
  useEffect(() => void purgeTrash().catch(() => 0), []);
  // Another trip on screen: the dialogs of the one before close.
  useEffect(() => {
    setHistoryOpen(false);
    setDeleteAsk(false);
  }, [board.trip?.id]);

  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#settings") setSettingsOpen(true);
      const tripId = tripFromHash();
      if (tripId) board.selectTrip(tripId);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [board.selectTrip]);

  // The menu closes on a click anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const trip = board.trip;
  const openItem = board.items.find((i) => i.id === openItemId) ?? null;
  /** The comparison an item is in (a stay saved without dates can be in its city's group). */
  const decisionOf = (item: Item) =>
    [...(decisions?.byGroup.values() ?? [])].find((d) => d.options.some((o) => o.item.id === item.id)) ??
    decisions?.byGroup.get(groupKeyOf(item));
  const plan = useMemo(() => (trip ? buildPlan(trip, board.items) : null), [trip, board.items]);
  const compared = compareKey ? decisions?.byGroup.get(compareKey) : undefined;
  const comparedTitle = compared && plan ? (liveGroups(plan).find((g) => g.key === compared.key)?.title ?? null) : null;

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

  const mapUrl = trip ? routeUrl(board.items) : null;
  const sharable = trip && !isDemoTrip(trip);
  const menu = (
    <>
      <button
        className="menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        aria-label={L("Gezi menüsü", "Trip menu")}
        aria-expanded={menuOpen}
      >
        <HeroIcon name="dots" size={20} />
      </button>
      {menuOpen && (
        <div className="menu" onClick={() => setMenuOpen(false)}>
          {trip && (
            <>
              <button onClick={() => document.querySelector<HTMLInputElement>('.composer input[type="text"]')?.focus()}>
                {L("Link ya da ekran görüntüsü ekle", "Add a link or screenshot")}
              </button>
              {sharable && <button onClick={() => setShareOpen(true)}>{trip.shareId ? L("Paylaşım kodu", "Share code") : L("Bu geziyi paylaş", "Share this trip")}</button>}
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noreferrer">
                  {L("Rotayı haritada gör", "See the route on a map")}
                </a>
              )}
              <hr />
              <button onClick={() => void resetConversation(trip.id)}>{L("Bu gezide yeni sohbet başlat", "Start a new chat for this trip")}</button>
              <button onClick={() => setHistoryOpen(true)}>{L("Geçmiş ve çöp kutusu", "History and trash")}</button>
            </>
          )}
          {!trip && <button onClick={() => setHistoryOpen(true)}>{L("Çöp kutusu", "Trash")}</button>}
          <button onClick={() => setSettingsOpen(true)}>{L("Ayarlar", "Settings")}</button>
          {!board.trips.some((t) => t.demo) && (
            <button onClick={() => void loadDemoTrip().then(board.selectTrip)}>{L("Örnek geziyi yükle", "Load the sample trip")}</button>
          )}
          {trip && (
            <>
              <hr />
              <button className="danger" onClick={() => void deleteTrip()}>
                {L("Bu geziyi sil", "Delete this trip")}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <ShareProvider trip={trip}>
      <UpdateBanner />
      {trip ? (
        <div className="board">
          <Chat trip={trip} messages={board.messages} onBack={() => board.selectTrip(null)} items={board.allItems} trips={board.trips} openCaptures={board.openCaptures} />
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
              onCompare={setCompareKey}
              menu={menu}
              onShare={sharable ? () => setShareOpen(true) : undefined}
              historyOpen={historyOpen}
              onHistoryClose={() => setHistoryOpen(false)}
            />
          </main>
        </div>
      ) : start ? (
        <StartChat
          key={start.key}
          initial={start.draft ?? newStart(newId(), start.mode, Date.now())}
          firstText={start.draft ? undefined : start.text}
          firstLabel={start.draft ? undefined : start.label}
          ctx={startCtx}
          onClose={() => setStart(null)}
          onCreated={(tripId) => {
            setStart(null);
            board.selectTrip(tripId);
          }}
        />
      ) : (
        board.loaded && (
          <TripsHome
            trips={board.trips}
            items={board.allItems}
            openCaptures={board.openCaptures}
            onOpen={board.selectTrip}
            onDemo={() => void loadDemoTrip().then(board.selectTrip)}
            onSettings={() => setSettingsOpen(true)}
            onStart={(launch) => setStart({ ...launch, key: newId() })}
            onAddToTrip={addToTrip}
            ctx={startCtx}
            menu={menu}
          />
        )
      )}
      {showArrival && (
        <div className="toast">
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
            setCompareKey(decisionOf(openItem)?.key ?? groupKeyOf(openItem));
          }}
        />
      )}
      {trip && compared && !openItem && (
        <CompareView
          trip={trip}
          decision={compared}
          card={decisions?.cards.get(compared.key)}
          inferred={decisions?.ctx.inferred}
          ctx={decisions?.ctx}
          title={comparedTitle}
          onClose={() => setCompareKey(null)}
          onOpenItem={(i) => setOpenItemId(i.id)}
        />
      )}
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
