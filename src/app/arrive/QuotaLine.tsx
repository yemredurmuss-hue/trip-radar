// T1 "Kota dolunca" (docs/arastirma/2026-10-20-ux-duzeltme-plani.html, F33–F34): when another model answered because the
// chosen Gemini model's free requests for today are used up, one quiet line where saves land says so, and nothing else
// changes: "Model değişti · Ücretsiz kotan dolduğu için Gemini 3.8 Flash'la devam ediyorum · Kota yarın 10:00'da yenilenir".
// Claude took over: "Gemini'nin bugünkü hakkı doldu, Claude'la devam ediyorum". Everything spent and no Claude key: the line
// turns red and points to Ayarlar. Gone at the reset (Pacific midnight, on this device's clock) or with ×. The switch itself
// is noted by the model chain (lib/aiQuota.ts, chrome.storage.local "aiSwitch"); this only reads it.
import { useEffect, useState, type ReactNode } from "react";
import { AI_SWITCH_KEY, dismissSwitch, isSwitch, loadSwitch, switchShown, switchText, type AiSwitch } from "../../lib/aiQuota";
import { getSettings } from "../../lib/db";
import { L } from "../../lib/i18n";
import { UiIcon } from "../cards/Silhouettes";

/** The last switch, live (another page or the worker may write it), and whether a Claude key is set now. */
function useAiSwitch(): { s: AiSwitch | null; claudeKey: boolean } {
  const [s, setS] = useState<AiSwitch | null>(null);
  const [claudeKey, setClaudeKey] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadSwitch().then((v) => alive && setS(v));
    void getSettings()
      .then((st) => alive && setClaudeKey(Boolean(st.apiKey)))
      .catch(() => undefined);
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return () => void (alive = false);
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (AI_SWITCH_KEY in changes) {
        const v: unknown = changes[AI_SWITCH_KEY].newValue;
        setS(isSwitch(v) ? v : null);
      }
      if ("apiKey" in changes) setClaudeKey(Boolean(changes.apiKey.newValue));
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, []);
  // Gone at the reset without a reload: one re-render then.
  useEffect(() => {
    if (!s || s.dismissed) return;
    const ms = s.resetAt - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => setTick((n) => n + 1), Math.min(ms + 50, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [s]);
  return { s, claudeKey };
}

/** The line when there is one to show (null otherwise), so the slot around it isn't drawn empty. */
export function useQuotaLine(): ReactNode {
  const { s, claudeKey } = useAiSwitch();
  const now = Date.now();
  if (!switchShown(s, now)) return null;
  // A Claude key was just added: Claude goes on with the next call (and says so), the red line has nothing left to ask.
  if (s.by === "none" && claudeKey) return null;
  return <QuotaLine s={s} now={now} />;
}

export function QuotaLine({ s, now }: { s: AiSwitch; now: number }) {
  const t = switchText(s, now);
  const addKey = L("Ayarlar'dan Claude anahtarı ekle", "Add a Claude key in Settings");
  return (
    <div className={`qt-line qt-${t.tone}`} role="status" aria-label={[t.text, t.reset, t.addKey ? addKey : null].filter(Boolean).join(" · ")} data-ai-switch={s.by}>
      <span className="qt-pill">{t.pill}</span>
      <span className="qt-text">{t.text}</span>
      <span className="qt-sp" aria-hidden />
      {t.reset && <span className="qt-reset">{t.reset}</span>}
      {t.addKey && (
        <button type="button" className="qt-key" onClick={() => void (location.hash = "#settings")}>
          {addKey}
        </button>
      )}
      <button type="button" className="qt-x" aria-label={L("Kapat", "Close")} onClick={() => void dismissSwitch()}>
        <UiIcon name="x" size={14} />
      </button>
    </div>
  );
}
