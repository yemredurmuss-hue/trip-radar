import { AiGateSettings } from "./AiGateSettings";
import { ProfileSettings } from "./Profile";
import { useEffect, useId, useRef, useState } from "react";
import { useDialogKeys } from "./useDialogKeys";
import { requestProcessing } from "../lib/browser";
import { DEFAULT_GEMINI_MODEL, DEFAULT_MODEL, exportAll, exportDiagnostics, getSettings, listTrips, saveSettings } from "../lib/db";
import { forgetRule, loadRules } from "../lib/tripRules";
import { COMPANION_SITES, companionName } from "../lib/companion";
import { countryName } from "../lib/trips";
import { L, lang, saveLang, type Lang } from "../lib/i18n";
import { describeError } from "../lib/llm";
import { checkClaudeKey } from "../lib/llm/anthropic";
import { listGeminiModels } from "../lib/llm/gemini";
import { retryAllFailed } from "../lib/process";
import type { Settings as SettingsShape } from "../lib/types";
import { setStill, stillChosen } from "./motion";
import { setSounds, soundsOn } from "./chime";
import { ShareSettings } from "./Share";

// Sonnet first: near Opus on the start chat's trips (2026-10-09, six real messages) and fast enough for its 25 s reading;
// Opus 5.5 went past it. A model chosen before (no longer listed) stays shown as it is, never silently swapped.
const claudeModels = (current: string) => {
  const list = [
    { id: DEFAULT_MODEL, label: L("Claude Sonnet 5.5 · önerilen, hızlı", "Claude Sonnet 5.5 · recommended, fast") },
    { id: "claude-opus-5-5", label: L("Claude Opus 5.5 · en derin, yavaş", "Claude Opus 5.5 · deepest, slow") },
    { id: "claude-haiku-5-5", label: L("Claude Haiku 5.5 · en ucuz", "Claude Haiku 5.5 · cheapest") },
  ];
  return list.some((m) => m.id === current) ? list : [...list, { id: current, label: current }];
};

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
/** A Claude key as pasted: "sk-ant-…"; tried against Anthropic before it's kept, like Gemini's (2026-10-25). */
const CLAUDE_KEY = /^sk-ant-[A-Za-z0-9_-]{20,300}$/;

export function Settings({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  useDialogKeys(onClose);
  const [s, setS] = useState<SettingsShape | null>(null);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  // How the key check ended: "bad" reddens the box and its line and shakes it once (hareket dili); "ok" greens the line.
  const [keyTone, setKeyTone] = useState<{ tone: "bad" | "ok"; n: number } | null>(null);
  const keyEnded = (tone: "bad" | "ok") => setKeyTone((prev) => ({ tone, n: (prev?.n ?? 0) + 1 }));
  const [claudeStatus, setClaudeStatus] = useState<string | null>(null);
  const [claudeTone, setClaudeTone] = useState<{ tone: "bad" | "ok"; n: number } | null>(null);
  const claudeEnded = (tone: "bad" | "ok") => setClaudeTone((prev) => ({ tone, n: (prev?.n ?? 0) + 1 }));
  // (the last try counts: a key typed on while the one before is still being tried)
  const claudeTry = useRef(0);
  const [still, setStillOn] = useState(stillChosen);
  const [sounds, setSoundsOn] = useState(soundsOn);

  useEffect(() => {
    void getSettings().then(setS);
  }, []);

  if (!s) return null;
  const update = (patch: Partial<SettingsShape>) => setS((prev) => (prev ? { ...prev, ...patch } : prev));

  /** Pasting a key is all it takes: validate it, pick the best free model, save, close. */
  async function connectGemini(key: string) {
    setModelStatus(L("Anahtar kontrol ediliyor…", "Checking the key…"));
    setKeyTone(null);
    try {
      const ids = await listGeminiModels(key);
      if (!ids.length) {
        setModelStatus(L("Bu anahtarla kullanılabilir model bulunamadı.", "No usable model found for this key."));
        keyEnded("bad");
        return;
      }
      const geminiModel = ids.includes(s!.geminiModel) ? s!.geminiModel : ids[0];
      setGeminiModels(ids);
      update({ provider: "gemini", geminiKey: key, geminiModel });
      await persist({ ...s!, provider: "gemini", geminiKey: key, geminiModel });
      setModelStatus(L(`✓ Bağlandı (${geminiModel}). Hazırsın.`, `✓ Connected (${geminiModel}). You're all set.`));
      keyEnded("ok");
      setTimeout(onClose, 1200);
    } catch (error) {
      setModelStatus(describeError(error));
      keyEnded("bad");
    }
  }

  /**
   * A Claude key tried as it's pasted, or again with "Anahtarı dene": kept at once when it works, the provider chosen left
   * as it was, so with Gemini it stands behind Gemini (llm/index.ts withClaudeBackup) and the line says so.
   */
  async function connectClaude(key: string, model: string) {
    const n = ++claudeTry.current;
    setClaudeStatus(L("Anahtar kontrol ediliyor…", "Checking the key…"));
    setClaudeTone(null);
    try {
      const name = await checkClaudeKey(key, model);
      if (n !== claudeTry.current) return;
      const stored = await getSettings();
      await persist({ ...stored, apiKey: key, model });
      setClaudeStatus(
        stored.provider === "gemini"
          ? L(
              `✓ Bağlandı (${name}). Gemini'nin hakkı dolunca ${name} devam eder. Claude'u ana model yapmak için Kaydet'e bas.`,
              `✓ Connected (${name}). When Gemini's requests run out, ${name} goes on. To make Claude the main model, press Save.`,
            )
          : L(`✓ Bağlandı (${name}). Hazırsın.`, `✓ Connected (${name}). You're all set.`),
      );
      claudeEnded("ok");
    } catch (error) {
      if (n !== claudeTry.current) return;
      setClaudeStatus(describeError(error));
      claudeEnded("bad");
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
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <LanguagePicker />
        <h2 id={titleId}>{L("Ayarlar", "Settings")}</h2>
        <ProfileSettings />

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
                key={keyTone?.tone === "bad" ? `bad-${keyTone.n}` : "key"}
                className={keyTone?.tone === "bad" ? "key-bad" : undefined}
                aria-invalid={keyTone?.tone === "bad" || undefined}
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
            {modelStatus && <p className={`muted small${keyTone ? ` key-${keyTone.tone}-line` : ""}`}>{modelStatus}</p>}
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
              <input
                key={claudeTone?.tone === "bad" ? `bad-${claudeTone.n}` : "key"}
                className={claudeTone?.tone === "bad" ? "key-bad" : undefined}
                aria-invalid={claudeTone?.tone === "bad" || undefined}
                type="password"
                value={s.apiKey}
                placeholder="sk-ant-…"
                onChange={(e) => {
                  update({ apiKey: e.target.value });
                  if (CLAUDE_KEY.test(e.target.value.trim())) void connectClaude(e.target.value.trim(), s.model);
                }}
                autoFocus
              />
            </label>
            <p className="muted small">{L("console.anthropic.com → API Keys. Kullandıkça ücretlendirilir.", "console.anthropic.com → API Keys. Billed as you use it.")}</p>
            <label className="field">
              Model
              <span className="row-inline">
                <select
                  value={s.model}
                  onChange={(e) => {
                    update({ model: e.target.value });
                    if (CLAUDE_KEY.test(s.apiKey.trim())) void connectClaude(s.apiKey.trim(), e.target.value);
                  }}
                >
                  {claudeModels(s.model).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button className="small-btn" onClick={() => void connectClaude(s.apiKey.trim(), s.model)} disabled={!s.apiKey.trim()}>
                  {L("Anahtarı dene", "Test the key")}
                </button>
              </span>
            </label>
            {claudeStatus && <p className={`muted small${claudeTone ? ` key-${claudeTone.tone}-line` : ""}`} role="status">{claudeStatus}</p>}
          </>
        )}

        <p className="muted small">{L("Anahtarlar yalnız bu tarayıcıda saklanır.", "Keys are stored only in this browser.")}</p>
        <label className="field row-inline" style={{ alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={still}
            onChange={(e) => {
              setStillOn(e.target.checked);
              setStill(e.target.checked);
            }}
          />
          {L("Hareketi duraklat (animasyonlar kapalı)", "Pause motion (animations off)")}
        </label>
        <label className="field row-inline" style={{ alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={sounds}
            onChange={(e) => {
              setSoundsOn(e.target.checked);
              setSounds(e.target.checked);
            }}
          />
          {L("Küçük sesler (bir bölüm tamamlanınca)", "Small sounds (when a section is complete)")}
        </label>
        <ShareSettings />
        <AlongSettings />
        <TripRulesSettings />
        <p className="muted small">
          <button className="btn-link" style={{ fontSize: "var(--q-fs-info)", padding: 0 }} onClick={() => void download("diagnostics")}>
            {L("Tanı dosyası indir", "Download diagnostics file")}
          </button>{" "}
          {L(
            "· kaydettiğin sayfaları ve okunanları içerir, anahtarlarını ve sohbetini içermez. Bir şey yanlış okunduysa bu dosyayı paylaşabilirsin.",
            "· has your saved pages and what was read from them, not your keys or chat. If something was read wrong, you can share this file.",
          )}
        </p>
        <div className="modal-actions">
          <button className="btn-link" style={{ fontSize: "var(--q-fs-info)" }} onClick={() => void download("backup")}>
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

/** Hangi gezi (lib/tripRules.ts): the trips remembered per country, each forgotten here (the next save asks again). */
function TripRulesSettings() {
  const [rules, setRules] = useState<{ country: string; title: string }[]>([]);
  useEffect(() => {
    void (async () => {
      const list = (await loadRules()) ?? [];
      const trips = await listTrips();
      setRules(list.map((r) => ({ country: r.country, title: trips.find((t) => t.id === r.tripId)?.title ?? "" })).filter((r) => r.title));
    })();
  }, []);
  if (!rules.length) return null;
  return (
    <div className="field">
      {L("Hatırlanan geziler", "Remembered trips")}
      <span className="muted small">{L("Eklentiden kaydettiklerin bu ülkeler için sormadan bu gezilere gider.", "What you save from the extension goes to these trips for these countries without asking.")}</span>
      {rules.map((r) => (
        <span key={r.country} className="row-inline" style={{ alignItems: "center", gap: 8 }}>
          <span>
            {countryName(r.country) ?? r.country} → {r.title}
          </span>
          <button
            className="btn-link"
            style={{ fontSize: "var(--q-fs-info)", padding: 0 }}
            onClick={() => void forgetRule(r.country).then(() => setRules((all) => all.filter((x) => x.country !== r.country)))}
          >
            {L("Unut", "Forget")}
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * "Seyahat sitelerinde + düğmesi" (0.42.0; named so in 0.47.26, Emre: "benle gezen diye bir özellik olmasın"): one switch for
 * the travel sites (Chrome asks once), and the other sites allowed
 * one by one from the toolbar ("Bu sitede de"), each taken back here.
 */
function AlongSettings() {
  const [travel, setTravel] = useState(false);
  const [others, setOthers] = useState<string[]>([]);
  const read = async () => {
    if (!chrome.permissions?.getAll) return;
    const granted = (await chrome.permissions.getAll()).origins ?? [];
    const own = new Set<string>((chrome.runtime.getManifest().host_permissions ?? []) as string[]);
    setTravel(COMPANION_SITES.some((o) => granted.includes(o)));
    setOthers(granted.filter((o) => /^https:\/\/[^*/]+\/\*$/.test(o) && !own.has(o) && !(COMPANION_SITES as readonly string[]).includes(o)));
  };
  useEffect(() => void read(), []);
  async function toggle(on: boolean) {
    if (on) await chrome.permissions.request({ origins: [...COMPANION_SITES] }).catch(() => false);
    else await chrome.permissions.remove({ origins: [...COMPANION_SITES] }).catch(() => false);
    await read();
  }
  return (
    <div className="field">
      <label className="row-inline" style={{ alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={travel} onChange={(e) => void toggle(e.target.checked)} />
        {L("Seyahat sitelerinde + düğmesi", "A + on travel sites")}
      </label>
      <span className="muted small">
        {L(
          "Booking, Airbnb, Skyscanner, GetYourGuide ve 30 kadar seyahat sitesinde sonuçlara + ve bir otelin sayfasına \"Desteye ekle\" koyar; basmadan hiçbir şey okunup gönderilmez.",
          "Puts a + on results and \"Add to the deck\" on a place's page on Booking, Airbnb, Skyscanner, GetYourGuide and some 30 travel sites; nothing is read or sent until you press it.",
        )}
      </span>
      {others.map((o) => (
        <span key={o} className="row-inline" style={{ alignItems: "center", gap: 8 }}>
          <span>{companionName(o)}</span>
          <button className="btn-link" style={{ fontSize: "var(--q-fs-info)", padding: 0 }} onClick={() => void chrome.permissions.remove({ origins: [o] }).then(read)}>
            {L("Kaldır", "Remove")}
          </button>
        </span>
      ))}
    </div>
  );
}
