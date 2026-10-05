import { useEffect, useMemo, useState } from "react";
import { resetConversation } from "../lib/assistant";
import { db, notifyChanged } from "../lib/db";
import { loadDemoTrip } from "../lib/demo";
import { deleteTripDocs } from "../lib/docs";
import { L } from "../lib/i18n";
import { routeUrl } from "../lib/items";
import { buildPlan, groupKeyOf, liveGroups } from "../lib/plan";
import { isDemoTrip } from "../lib/trips";
import type { Item } from "../lib/types";
import { Chat } from "./Chat";
import { CompareView } from "./CompareView";
import { HeroIcon } from "./Icons";
import { ItemDrawer } from "./ItemDrawer";
import { Settings } from "./Settings";
import { ShareDialog, ShareProvider } from "./Share";
import { TripPanel } from "./TripPanel";
import { TripsHome } from "./TripsHome";
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
  const decisions = useDecisions(board.trip, board.items);

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

  async function deleteTrip() {
    if (!trip || !confirm(L(`"${trip.title}" ve içindeki her şey silinsin mi?`, `Delete "${trip.title}" and everything in it?`))) return;
    const d = await db();
    for (const i of board.items) await d.delete("items", i.id);
    for (const m of board.messages) await d.delete("messages", m.id);
    await deleteTripDocs(trip.id);
    await d.delete("trips", trip.id);
    board.selectTrip(null);
    notifyChanged();
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
            </>
          )}
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
          <Chat trip={trip} messages={board.messages} onBack={() => board.selectTrip(null)} />
          <main className="panel">
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
            />
          </main>
        </div>
      ) : (
        board.loaded && (
          <TripsHome
            trips={board.trips}
            items={board.allItems}
            openCaptures={board.openCaptures}
            onOpen={board.selectTrip}
            onDemo={() => void loadDemoTrip().then(board.selectTrip)}
            onSettings={() => setSettingsOpen(true)}
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
