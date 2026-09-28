import { useEffect, useState } from "react";
import { requestProcessing } from "../lib/browser";
import { DEFAULT_GEMINI_MODEL, DEFAULT_MODEL, exportAll, getSettings, saveSettings } from "../lib/db";
import { describeError } from "../lib/llm";
import { listGeminiModels } from "../lib/llm/gemini";
import { retryAllFailed } from "../lib/process";
import type { Settings as SettingsShape } from "../lib/types";

const CLAUDE_MODELS = [
  { id: DEFAULT_MODEL, label: "Claude Opus 5 — en iyi sonuç" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — daha ucuz" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — en ucuz" },
];

const GEMINI_KEY = /^AIza[0-9A-Za-z_-]{30,}$/;

export function Settings({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<SettingsShape | null>(null);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [modelStatus, setModelStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setS);
  }, []);

  if (!s) return null;
  const update = (patch: Partial<SettingsShape>) => setS((prev) => (prev ? { ...prev, ...patch } : prev));

  /** Pasting a key is all it takes: validate it, pick the best free model, save, close. */
  async function connectGemini(key: string) {
    setModelStatus("Anahtar kontrol ediliyor…");
    try {
      const ids = await listGeminiModels(key);
      if (!ids.length) {
        setModelStatus("Bu anahtarla kullanılabilir model bulunamadı.");
        return;
      }
      const geminiModel = ids.includes(s!.geminiModel) ? s!.geminiModel : ids[0];
      setGeminiModels(ids);
      update({ provider: "gemini", geminiKey: key, geminiModel });
      await persist({ ...s!, provider: "gemini", geminiKey: key, geminiModel });
      setModelStatus(`✓ Bağlandı (${geminiModel}). Hazırsın.`);
      setTimeout(onClose, 1200);
    } catch (error) {
      setModelStatus(describeError(error));
    }
  }

  async function persist(next: SettingsShape) {
    await saveSettings({ ...next, apiKey: next.apiKey.trim(), geminiKey: next.geminiKey.trim() });
    await retryAllFailed(); // captures that failed without a key (or on quota) get another go
    requestProcessing();
  }

  async function fetchModels() {
    if (!s?.geminiKey.trim()) return;
    setModelStatus("Modeller getiriliyor…");
    try {
      const ids = await listGeminiModels(s.geminiKey.trim());
      setGeminiModels(ids);
      setModelStatus(ids.length ? null : "Bu anahtarla kullanılabilir model bulunamadı.");
      if (ids.length && !ids.includes(s.geminiModel)) update({ geminiModel: ids[0] });
    } catch (error) {
      setModelStatus(describeError(error));
    }
  }

  async function save() {
    if (!s) return;
    await persist(s);
    onClose();
  }

  async function download() {
    const blob = new Blob([await exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trip-radar-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const geminiOptions = geminiModels.length ? geminiModels : [s.geminiModel || DEFAULT_GEMINI_MODEL];

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Ayarlar</h2>

        <div className="segmented" role="radiogroup" aria-label="AI sağlayıcı">
          <button role="radio" aria-checked={s.provider === "gemini"} className={s.provider === "gemini" ? "on" : ""} onClick={() => update({ provider: "gemini" })}>
            Gemini · ücretsiz
          </button>
          <button role="radio" aria-checked={s.provider === "anthropic"} className={s.provider === "anthropic" ? "on" : ""} onClick={() => update({ provider: "anthropic" })}>
            Claude · ücretli
          </button>
        </div>

        {s.provider === "gemini" ? (
          <>
            <ol className="setup">
              <li>
                <a className="btn-primary setup-btn" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  Google'dan ücretsiz anahtar al ↗
                </a>
              </li>
              <li>Açılan sayfada <b>Create API key</b>'e bas, anahtarı kopyala. Kart istemez.</li>
              <li>Bu sekmeye dön, aşağıya yapıştır. Gerisini eklenti halleder.</li>
            </ol>
            <label className="field">
              Gemini API anahtarı
              <input
                type="password"
                value={s.geminiKey}
                placeholder="AIza… (yapıştır)"
                onChange={(e) => {
                  update({ geminiKey: e.target.value });
                  if (GEMINI_KEY.test(e.target.value.trim())) void connectGemini(e.target.value.trim());
                }}
                autoFocus
              />
            </label>
            <label className="field">
              Model
              <span className="row-inline">
                <select value={s.geminiModel} onChange={(e) => update({ geminiModel: e.target.value })}>
                  {geminiOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <button className="small-btn" onClick={() => void fetchModels()} disabled={!s.geminiKey.trim()}>
                  Modelleri getir
                </button>
              </span>
            </label>
            {modelStatus && <p className="muted small">{modelStatus}</p>}
            <p className="note small">
              Ücretsiz katmanda Google, gönderilen içeriği (kaydettiğin sayfalar, ekran görüntüleri, sohbet) ürünlerini
              geliştirmek için kullanabilir ve insanlar okuyabilir. Günlük istek sınırı da var; dolunca kayıtlar
              "Tekrar dene" ile sonra işlenir.
            </p>
          </>
        ) : (
          <>
            <label className="field">
              Claude API anahtarı
              <input type="password" value={s.apiKey} placeholder="sk-ant-…" onChange={(e) => update({ apiKey: e.target.value })} autoFocus />
            </label>
            <p className="muted small">console.anthropic.com → API Keys. Kullandıkça ücretlendirilir.</p>
            <label className="field">
              Model
              <select value={s.model} onChange={(e) => update({ model: e.target.value })}>
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <p className="muted small">Anahtarlar yalnız bu tarayıcıda saklanır.</p>
        <div className="modal-actions">
          <button className="btn-link" style={{ fontSize: 14 }} onClick={() => void download()}>
            Verileri dışa aktar (JSON)
          </button>
          <button className="btn-primary" onClick={() => void save()}>
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
