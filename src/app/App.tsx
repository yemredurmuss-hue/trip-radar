import { useEffect, useState } from "react";
import { resetConversation } from "../lib/assistant";
import { requestProcessing } from "../lib/browser";
import { db, notifyChanged } from "../lib/db";
import { loadDemoTrip } from "../lib/demo";
import { retryCapture } from "../lib/process";
import type { Capture, Item } from "../lib/types";
import { Chat } from "./Chat";
import { ItemDrawer } from "./ItemDrawer";
import { Settings } from "./Settings";
import { TripPanel } from "./TripPanel";
import { useBoard } from "./useBoard";

export function App() {
  const board = useBoard();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(location.hash === "#settings");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => location.hash === "#settings" && setSettingsOpen(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openItem = board.items.find((i) => i.id === openItemId) ?? null;
  const trip = board.trip;

  async function deleteTrip() {
    if (!trip || !confirm(`"${trip.title}" ve içindeki her şey silinsin mi?`)) return;
    const d = await db();
    for (const i of board.items) await d.delete("items", i.id);
    for (const m of board.messages) await d.delete("messages", m.id);
    await d.delete("trips", trip.id);
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
          {trip && <button onClick={() => void resetConversation(trip.id)}>Yeni sohbet başlat</button>}
          <button onClick={() => void loadDemoTrip().then(board.selectTrip)}>Örnek geziyi yükle</button>
          {trip && <button onClick={() => void deleteTrip()}>Bu geziyi sil</button>}
        </div>
      )}
    </>
  );

  return (
    <div className="board">
      <Chat trips={board.trips} trip={trip} messages={board.messages} onSelectTrip={board.selectTrip} />
      <main className="panel">
        {trip ? (
          <TripPanel
            trip={trip}
            items={board.items}
            openCaptures={board.openCaptures}
            onOpenItem={(i: Item) => setOpenItemId(i.id)}
            menu={menu}
          />
        ) : (
          board.loaded && (
            <>
              <div className="panel-top">{menu}</div>
              <Empty captures={board.openCaptures} onDemo={() => void loadDemoTrip().then(board.selectTrip)} onSettings={() => setSettingsOpen(true)} />
            </>
          )
        )}
      </main>
      {openItem && (
        <ItemDrawer
          item={openItem}
          group={board.items.filter((i) => i.needKey === openItem.needKey)}
          onClose={() => setOpenItemId(null)}
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
    </div>
  );
}

function Empty({ captures, onDemo, onSettings }: { captures: Capture[]; onDemo: () => void; onSettings: () => void }) {
  const failed = captures.filter((c) => c.status === "error");
  const working = captures.length - failed.length;
  return (
    <div className="empty">
      <h2>İlk seçeneğini kaydet</h2>
      <ol>
        <li>
          <a href="#settings" onClick={onSettings}>
            Ücretsiz Gemini anahtarını bağla
          </a>{" "}
          (1 dakika, kart gerekmez).
        </li>
        <li>Bir otel, uçuş, etkinlik ya da eSIM sayfasındayken araç çubuğundaki Trip Radar simgesine tıkla (veya Alt+Shift+S).</li>
        <li>Ya da soldaki kutuya link yapıştır, ekran görüntüsü sürükle.</li>
      </ol>
      <p className="muted">AI destinasyonu ve tarihleri bulur, geziyi kendisi oluşturur.</p>
      {working > 0 && <p>{working} kayıt işleniyor…</p>}
      {failed.map((c) => (
        <p key={c.id} className="chat-error">
          ⚠ {c.title || c.url || "Ekran görüntüsü"}: {c.error}{" "}
          <button
            className="small-btn"
            onClick={async () => {
              await retryCapture(c.id);
              requestProcessing();
            }}
          >
            Tekrar dene
          </button>
        </p>
      ))}
      <button className="btn-link" style={{ fontSize: 15, marginTop: 12 }} onClick={onDemo}>
        Örnek geziyi yükle →
      </button>
    </div>
  );
}
