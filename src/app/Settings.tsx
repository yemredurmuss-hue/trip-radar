import { useEffect, useState } from "react";
import { requestProcessing } from "../lib/browser";
import { DEFAULT_MODEL, exportAll, getSettings, saveSettings } from "../lib/db";

const MODELS = [
  { id: DEFAULT_MODEL, label: "Claude Opus 5 — en iyi sonuç (varsayılan)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — daha ucuz" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — en ucuz" },
];

export function Settings({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);

  useEffect(() => {
    void getSettings().then((s) => {
      setApiKey(s.apiKey);
      setModel(s.model);
    });
  }, []);

  async function save() {
    await saveSettings({ apiKey: apiKey.trim(), model });
    requestProcessing(); // captures that waited for a key can run now
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

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Ayarlar</h2>
        <label className="field">
          Claude API anahtarı
          <input type="password" value={apiKey} placeholder="sk-ant-…" onChange={(e) => setApiKey(e.target.value)} autoFocus />
        </label>
        <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          Anahtar yalnız bu tarayıcıda saklanır. console.anthropic.com → API Keys'ten alabilirsin.
        </p>
        <label className="field">
          Model
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
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
