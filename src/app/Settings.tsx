import { AiGateSettings } from "./AiGateSettings";
import { ProfileSettings } from "./Profile";
import { useEffect, useState } from "react";
import { requestProcessing } from "../lib/browser";
import { DEFAULT_GEMINI_MODEL, DEFAULT_MODEL, exportAll, exportDiagnostics, getSettings, saveSettings } from "../lib/db";
import { L, lang, saveLang, type Lang } from "../lib/i18n";
import { describeError } from "../lib/llm";
import { loadPassport, savePassport } from "../lib/passport";
import { listGeminiModels } from "../lib/llm/gemini";
import { retryAllFailed } from "../lib/process";
import type { Settings as SettingsShape } from "../lib/types";
import { ShareSettings } from "./Share";

const claudeModels = () => [
  { id: DEFAULT_MODEL, label: L("Claude Opus 5 · en iyi sonuç", "Claude Opus 5 · best results") },
  { id: "claude-sonnet-5", label: L("Claude Sonnet 5 · daha ucuz", "Claude Sonnet 5 · cheaper") },
  { id: "claude-haiku-4-5", label: L("Claude Haiku 4.5 · en ucuz", "Claude Haiku 4.5 · cheapest") },
];

/** "Dil / Language": both names written in their own language, so anyone finds theirs. Switching reloads the board. */
export function LanguagePicker() {
  const choose = async (next: Lang) => {
    if (next === lang()) return;
    await saveLang(next);
    // Back to the same place (the setup / settings stays open after the reload).
    if (location.hash !== "#settings") history.replaceState(null, "", `${location.pathname}#settings`);
    location.reload();
  };
  return (
    <div className="lang-picker">
      <span className="muted small">Dil / Language</span>
      <div className="segmented" role="radiogroup" aria-label="Dil / Language">
        <button role="radio" aria-checked={lang() === "tr"} className={lang() === "tr" ? "on" : ""} onClick={() => void choose("tr")}>
          Türkçe
        </button>
        <button role="radio" aria-checked={lang() === "en"} className={lang() === "en" ? "on" : ""} onClick={() => void choose("en")}>
          English
        </button>
      </div>
    </div>
  );
}

/** A Gemini key as pasted: "AIza…" or Google's newer formats; checked against Google before it's kept. */
const GEMINI_KEY = /^[A-Za-z0-9._-]{30,200}$/;

export function Settings({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<SettingsShape | null>(null);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [passport, setPassport] = useState("TR");

  useEffect(() => {
    void getSettings().then(setS);
    void loadPassport().then(setPassport);
  }, []);

  if (!s) return null;
  const update = (patch: Partial<SettingsShape>) => setS((prev) => (prev ? { ...prev, ...patch } : prev));

  /** Pasting a key is all it takes: validate it, pick the best free model, save, close. */
  async function connectGemini(key: string) {
    setModelStatus(L("Anahtar kontrol ediliyor…", "Checking the key…"));
    try {
      const ids = await listGeminiModels(key);
      if (!ids.length) {
        setModelStatus(L("Bu anahtarla kullanılabilir model bulunamadı.", "No usable model found for this key."));
        return;
      }
      const geminiModel = ids.includes(s!.geminiModel) ? s!.geminiModel : ids[0];
      setGeminiModels(ids);
      update({ provider: "gemini", geminiKey: key, geminiModel });
      await persist({ ...s!, provider: "gemini", geminiKey: key, geminiModel });
      setModelStatus(L(`✓ Bağlandı (${geminiModel}). Hazırsın.`, `✓ Connected (${geminiModel}). You're all set.`));
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
    setModelStatus(L("Modeller getiriliyor…", "Loading models…"));
    try {
      const ids = await listGeminiModels(s.geminiKey.trim());
      setGeminiModels(ids);
      setModelStatus(ids.length ? null : L("Bu anahtarla kullanılabilir model bulunamadı.", "No usable model found for this key."));
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

  async function download(kind: "backup" | "diagnostics") {
    const json = kind === "backup" ? await exportAll() : await exportDiagnostics();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trip-radar-${kind === "backup" ? L("yedek", "backup") : L("tani", "diagnostics")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const geminiOptions = geminiModels.length ? geminiModels : [s.geminiModel || DEFAULT_GEMINI_MODEL];

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <LanguagePicker />
        <h2>{L("Ayarlar", "Settings")}</h2>
        <ProfileSettings />
        <label className="field">
          {L("Pasaport", "Passport")}
          <select
            value={passport}
            onChange={(e) => {
              setPassport(e.target.value);
              void savePassport(e.target.value);
            }}
          >
            <option value="TR">{L("Türkiye", "Turkey")}</option>
            <option value="DE">{L("Almanya", "Germany")}</option>
            <option value="GB">{L("Birleşik Krallık", "United Kingdom")}</option>
            <option value="US">{L("ABD", "USA")}</option>
            <option value="XX">{L("Diğer", "Other")}</option>
          </select>
        </label>

        <div className="segmented" role="radiogroup" aria-label={L("AI sağlayıcı", "AI provider")}>
          <button role="radio" aria-checked={s.provider === "gemini"} className={s.provider === "gemini" ? "on" : ""} onClick={() => update({ provider: "gemini" })}>
            {L("Gemini · ücretsiz", "Gemini · free")}
          </button>
          <button role="radio" aria-checked={s.provider === "anthropic"} className={s.provider === "anthropic" ? "on" : ""} onClick={() => update({ provider: "anthropic" })}>
            {L("Claude · ücretli", "Claude · paid")}
          </button>
        </div>

        {s.provider === "gemini" ? (
          <>
            <ol className="setup">
              <li>
                <a className="btn-primary setup-btn" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  {L("Google'dan ücretsiz anahtar al ↗", "Get a free key from Google ↗")}
                </a>
              </li>
              <li>
                {L("Açılan sayfada ", "On the page that opens, click ")}
                <b>Create API key</b>
                {L("'e bas, anahtarı kopyala. Kart istemez.", " and copy the key. No card needed.")}
              </li>
              <li>{L("Bu sekmeye dön, aşağıya yapıştır. Gerisini eklenti halleder.", "Come back to this tab and paste it below. The extension does the rest.")}</li>
            </ol>
            <label className="field">
              {L("Gemini API anahtarı", "Gemini API key")}
              <input
                type="password"
                value={s.geminiKey}
                placeholder={L("AIza… (yapıştır)", "AIza… (paste)")}
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
                  {L("Modelleri getir", "Fetch models")}
                </button>
              </span>
            </label>
            {modelStatus && <p className="muted small">{modelStatus}</p>}
            <p className="note small">
              {L(
                `Ücretsiz katmanda Google, gönderilen içeriği (kaydettiğin sayfalar, ekran görüntüleri, sohbet) ürünlerini geliştirmek için kullanabilir ve insanlar okuyabilir. Günlük istek sınırı da var; dolunca kayıtlar "Tekrar dene" ile sonra işlenir.`,
                `On the free tier Google may use what is sent (your saved pages, screenshots, chat) to improve its products, and people may read it. There is also a daily request limit; when it runs out, saves are processed later with "Try again".`,
              )}
            </p>
            <AiGateSettings ownKey={!!s.geminiKey.trim()} geminiKey={s.geminiKey.trim()} />
          </>
        ) : (
          <>
            <label className="field">
              {L("Claude API anahtarı", "Claude API key")}
              <input type="password" value={s.apiKey} placeholder="sk-ant-…" onChange={(e) => update({ apiKey: e.target.value })} autoFocus />
            </label>
            <p className="muted small">{L("console.anthropic.com → API Keys. Kullandıkça ücretlendirilir.", "console.anthropic.com → API Keys. Billed as you use it.")}</p>
            <label className="field">
              Model
              <select value={s.model} onChange={(e) => update({ model: e.target.value })}>
                {claudeModels().map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <p className="muted small">{L("Anahtarlar yalnız bu tarayıcıda saklanır.", "Keys are stored only in this browser.")}</p>
        <ShareSettings />
        <p className="muted small">
          <button className="btn-link" style={{ fontSize: 13, padding: 0 }} onClick={() => void download("diagnostics")}>
            {L("Tanı dosyası indir", "Download diagnostics file")}
          </button>{" "}
          {L(
            "· kaydettiğin sayfaları ve okunanları içerir, anahtarlarını ve sohbetini içermez. Bir şey yanlış okunduysa bu dosyayı paylaşabilirsin.",
            "· has your saved pages and what was read from them, not your keys or chat. If something was read wrong, you can share this file.",
          )}
        </p>
        <div className="modal-actions">
          <button className="btn-link" style={{ fontSize: 14 }} onClick={() => void download("backup")}>
            {L("Verileri dışa aktar (JSON)", "Export data (JSON)")}
          </button>
          <button className="btn-primary" onClick={() => void save()}>
            {L("Kaydet", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
