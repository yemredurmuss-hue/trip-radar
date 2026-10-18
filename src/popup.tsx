// Toolbar popup: opening it IS the save action (activeTab is granted by that click).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { downscale, openBoard, requestProcessing } from "./lib/browser";
import { db, hasActiveKey, onChanged } from "./lib/db";
import { L, lang, loadLang } from "./lib/i18n";
import { CATEGORY_LABELS } from "./lib/items";
import { collectPage } from "./lib/pagecapture";
import { saveSnapshot } from "./lib/process";
import { answerHeld } from "./lib/routing";
import { reloadIfStale } from "./lib/update";

type State =
  | { step: "saving" }
  | { step: "working"; captureId: string }
  | { step: "done"; text: string; tripId: string }
  /** Read, not added (placeCheck.ts): the same question the trip's chat asks. */
  | { step: "held"; captureId: string; text: string; reason: "place" | "travel"; newTitle: string; tripTitle: string | null }
  | { step: "skipped" }
  | { step: "error"; text: string }
  | { step: "hint"; text: string };

class HintError extends Error {}

async function captureActiveTab(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Our own pages (board, popup-in-a-tab) are extension contexts; their URL is not always visible here.
  const ownTabs = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
  if (ownTabs.some((c) => c.tabId === tab?.id) || tab?.url?.startsWith(chrome.runtime.getURL(""))) {
    throw new HintError(
      L(
        "Burası pano. Bir otel, uçuş, etkinlik veya eSIM sayfası açıp orada simgeye bas; o sayfa buraya eklenir.",
        "This is the board. Open a hotel, flight, activity or eSIM page and click the icon there; that page gets added here.",
      ),
    );
  }
  if (tab?.id == null || !tab.url || !/^https?:/.test(tab.url)) {
    throw new Error(L("Bu sayfa kaydedilemiyor. Bir otel, uçuş veya etkinlik sayfasındayken dene.", "This page can't be saved. Try on a hotel, flight or activity page."));
  }
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPage });
  if (!result?.result) throw new Error(L("Sayfa okunamadı.", "Couldn't read the page."));
  let screenshot: string | null = null;
  try {
    screenshot = await downscale(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 }));
  } catch {
    // Some pages block capture; the page text is still enough.
  }
  const capture = await saveSnapshot(result.result, screenshot);
  requestProcessing();
  return capture.id;
}

function Popup() {
  const [state, setState] = useState<State>({ step: "saving" });
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    void hasActiveKey().then(setHasKey);
    captureActiveTab()
      .then((captureId) => setState({ step: "working", captureId }))
      .catch((error: unknown) =>
        setState(
          error instanceof HintError
            ? { step: "hint", text: error.message }
            : { step: "error", text: error instanceof Error ? error.message : String(error) },
        ),
      );
  }, []);

  useEffect(() => {
    if (state.step !== "working") return;
    const check = async () => {
      const d = await db();
      const capture = await d.get("captures", state.captureId);
      if (capture?.status === "error") setState({ step: "error", text: capture.error ?? L("İşlenemedi.", "Couldn't process it.") });
      const held = capture?.held;
      // Asked (a record already saved stays on its trip while asked, so it has an itemId too).
      if (capture?.status === "done" && held && !held.answer) {
        const trip = held.tripId ? await d.get("trips", held.tripId) : undefined;
        setState({ step: "held", captureId: capture.id, text: held.question ?? held.item.name, reason: held.reason, newTitle: held.newTitle, tripTitle: trip?.title ?? null });
      } else if (capture?.status === "done" && capture.itemId) {
        const item = await d.get("items", capture.itemId);
        const trip = item ? await d.get("trips", item.tripId) : undefined;
        if (item) {
          const where = [trip?.title, CATEGORY_LABELS[item.category], item.city].filter(Boolean).join(" · ");
          setState({ step: "done", text: `${item.name} → ${where}`, tripId: item.tripId });
        }
      }
    };
    void check();
    return onChanged(() => void check());
  }, [state]);

  return (
    <div className="popup-card">
      <div className="popup-title">Trip Radar</div>
      {state.step === "saving" && <p>{L("Sayfa kaydediliyor…", "Saving the page…")}</p>}
      {state.step === "working" && (
        <p>
          {L("✓ Kaydedildi. AI inceliyor…", "✓ Saved. AI is reading it…")}
          <br />
          <span className="muted">{L("Pencereyi kapatabilirsin; arkada devam eder.", "You can close this; it keeps going in the background.")}</span>
        </p>
      )}
      {state.step === "done" && <p>✓ {state.text}</p>}
      {state.step === "held" && <HeldQuestion state={state} onDone={setState} />}
      {state.step === "skipped" && <p>{L("Eklenmedi.", "Not added.")}</p>}
      {state.step === "error" && <p className="error">{state.text}</p>}
      {state.step === "hint" && <p>{state.text}</p>}
      {/* Only once something was saved: on the board, an error or "Eklenmedi" nothing is waiting. */}
      {!hasKey && (state.step === "working" || state.step === "done") && <p className="warning">{L("Kayıt duruyor. AI'ın işlemesi için ücretsiz Gemini anahtarını bir kez bağla.", "Saved, but waiting. Connect a free Gemini key once so the AI can read it.")}</p>}
      <button
        className="primary"
        onClick={() => void openBoard(!hasKey ? "#settings" : state.step === "done" ? `#trip=${state.tripId}` : "")}
      >
        {!hasKey ? L("1 dakikalık kurulum", "1-minute setup") : state.step === "done" ? L("Geziyi aç", "Open trip") : L("Panoyu aç", "Open board")}
      </button>
    </div>
  );
}

/** The question the trip's chat asks too; answered here, it's answered there. */
function HeldQuestion({ state, onDone }: { state: Extract<State, { step: "held" }>; onDone: (next: State) => void }) {
  const [busy, setBusy] = useState(false);
  async function answer(a: "here" | "new" | "skip") {
    setBusy(true);
    try {
      const tripId = await answerHeld(state.captureId, a);
      if (!tripId) return onDone({ step: "skipped" });
      const d = await db();
      const trip = await d.get("trips", tripId);
      onDone({ step: "done", text: `${trip?.title ?? ""}`, tripId });
    } catch (error) {
      onDone({ step: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }
  // With no trip to ask in, "here" makes the new trip too: only one way to add it.
  const here = state.tripTitle ? (state.reason === "place" ? L(`${state.tripTitle}: yine de ekle`, `${state.tripTitle}: add anyway`) : L("Yine de ekle", "Add it anyway")) : null;
  return (
    <div className="popup-held">
      <p>{state.text}</p>
      <div className="popup-held-actions">
        {here && <button className="small-btn" disabled={busy} onClick={() => void answer("here")}>{here}</button>}
        {(state.reason === "place" || !here) && (
          <button className="small-btn" disabled={busy} onClick={() => void answer("new")}>
            {L(`Yeni gezi: ${state.newTitle}`, `New trip: ${state.newTitle}`)}
          </button>
        )}
        <button className="small-btn" disabled={busy} onClick={() => void answer("skip")}>{L("Ekleme", "Don't add")}</button>
      </div>
    </div>
  );
}

// The language first, so the popup never flashes the wrong one. Files newer than the loaded extension
// (the updater just swapped them) reload it instead of saving: the old version holds the database.
void Promise.all([loadLang(), reloadIfStale(null)]).then(([, updating]) => {
  document.documentElement.lang = lang();
  createRoot(document.getElementById("root")!).render(
    updating ? (
      <div className="popup-card">
        <div className="popup-title">Trip Radar</div>
        <p>{L("Güncelleniyor… Birkaç saniye sonra tekrar dene.", "Updating… Try again in a few seconds.")}</p>
      </div>
    ) : (
      <Popup />
    ),
  );
});
