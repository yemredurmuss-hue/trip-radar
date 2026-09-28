// Toolbar popup: opening it IS the save action (activeTab is granted by that click).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { downscale, openBoard, requestProcessing } from "./lib/browser";
import { db, hasActiveKey, onChanged } from "./lib/db";
import { CATEGORY_LABELS } from "./lib/items";
import { collectPage } from "./lib/pagecapture";
import { saveSnapshot } from "./lib/process";

type State =
  | { step: "saving" }
  | { step: "working"; captureId: string }
  | { step: "done"; text: string }
  | { step: "error"; text: string };

async function captureActiveTab(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null || !tab.url || !/^https?:/.test(tab.url)) {
    throw new Error("Bu sayfa kaydedilemiyor. Bir otel, uçuş veya etkinlik sayfasındayken dene.");
  }
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPage });
  if (!result?.result) throw new Error("Sayfa okunamadı.");
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
      .catch((error: unknown) => setState({ step: "error", text: error instanceof Error ? error.message : String(error) }));
  }, []);

  useEffect(() => {
    if (state.step !== "working") return;
    const check = async () => {
      const d = await db();
      const capture = await d.get("captures", state.captureId);
      if (capture?.status === "error") setState({ step: "error", text: capture.error ?? "İşlenemedi." });
      if (capture?.status === "done" && capture.itemId) {
        const item = await d.get("items", capture.itemId);
        const trip = item ? await d.get("trips", item.tripId) : undefined;
        if (item) {
          const where = [trip?.title, CATEGORY_LABELS[item.category], item.city].filter(Boolean).join(" · ");
          setState({ step: "done", text: `${item.name} → ${where}` });
        }
      }
    };
    void check();
    return onChanged(() => void check());
  }, [state]);

  return (
    <div className="popup-card">
      <div className="popup-title">Trip Radar</div>
      {state.step === "saving" && <p>Sayfa kaydediliyor…</p>}
      {state.step === "working" && (
        <p>
          ✓ Kaydedildi. AI inceliyor…
          <br />
          <span className="muted">Pencereyi kapatabilirsin; arkada devam eder.</span>
        </p>
      )}
      {state.step === "done" && <p>✓ {state.text}</p>}
      {state.step === "error" && <p className="error">{state.text}</p>}
      {!hasKey && <p className="warning">Kayıt duruyor. AI'ın işlemesi için ücretsiz Gemini anahtarını bir kez bağla.</p>}
      <button className="primary" onClick={() => void openBoard(hasKey ? "" : "#settings")}>
        {hasKey ? "Panoyu aç" : "1 dakikalık kurulum"}
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
