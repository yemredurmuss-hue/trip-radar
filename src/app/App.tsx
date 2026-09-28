import { useEffect, useState } from "react";
import { resetConversation } from "../lib/assistant";
import { db, notifyChanged } from "../lib/db";
import { loadDemoTrip } from "../lib/demo";
import { groupTitle } from "../lib/items";
import type { Item } from "../lib/types";
import { Chat } from "./Chat";
import { CompareView } from "./CompareView";
import { ItemDrawer } from "./ItemDrawer";
import { Settings } from "./Settings";
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

  const trip = board.trip;
  const openItem = board.items.find((i) => i.id === openItemId) ?? null;
  const compared = compareKey ? decisions?.byNeed.get(compareKey) : undefined;
  const comparedTitle = compared ? groupTitle(compared.category, board.items.filter((i) => i.needKey === compared.needKey && i.status !== "dismissed")) : null;

  // A capture landed in a different trip than the one on screen: say where, offer to go there.
  const arrival = board.arrivals[0];
  const arrivalTrip = arrival ? board.trips.find((t) => t.id === arrival.tripId) : undefined;
  const showArrival = arrival && arrivalTrip && trip && arrival.tripId !== trip.id && arrival.id !== seenArrival;

  async function deleteTrip() {
    if (!trip || !confirm(`"${trip.title}" ve içindeki her şey silinsin mi?`)) return;
    const d = await db();
    for (const i of board.items) await d.delete("items", i.id);
    for (const m of board.messages) await d.delete("messages", m.id);
    await d.delete("trips", trip.id);
    board.selectTrip(null);
    notifyChanged();
  }

  const menu = (
    <>
      <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü">
        •••
      </button>
      {menuOpen && (
        <div className="menu" onClick={() => setMenuOpen(false)}>
          <button onClick={() => setSettingsOpen(true)}>Ayarlar</button>
          {trip && <button onClick={() => void resetConversation(trip.id)}>Bu gezide yeni sohbet başlat</button>}
          {!board.trips.some((t) => t.demo) && (
            <button onClick={() => void loadDemoTrip().then(board.selectTrip)}>Örnek geziyi yükle</button>
          )}
          {trip && <button onClick={() => void deleteTrip()}>Bu geziyi sil</button>}
        </div>
      )}
    </>
  );

  return (
    <>
      <UpdateBanner />
      {trip ? (
        <div className="board">
          <Chat trip={trip} messages={board.messages} onBack={() => board.selectTrip(null)} />
          <main className="panel">
            <TripPanel
              trip={trip}
              items={board.items}
              openCaptures={board.openCaptures}
              decisions={decisions}
              onOpenItem={(i: Item) => setOpenItemId(i.id)}
              onCompare={setCompareKey}
              menu={menu}
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
            Aç
          </button>
          <button className="toast-close" aria-label="Kapat" onClick={() => setSeenArrival(arrival.id)}>
            ×
          </button>
        </div>
      )}
      {openItem && (
        <ItemDrawer
          item={openItem}
          group={board.items.filter((i) => i.needKey === openItem.needKey)}
          trips={board.trips}
          decision={decisions?.byNeed.get(openItem.needKey)}
          onClose={() => setOpenItemId(null)}
          onMoved={board.selectTrip}
          onCompare={() => {
            setOpenItemId(null);
            setCompareKey(openItem.needKey);
          }}
        />
      )}
      {trip && compared && !openItem && (
        <CompareView
          trip={trip}
          decision={compared}
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
    </>
  );
}
