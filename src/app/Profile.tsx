// Profilim (0.36): your name (the one the others see you by, the sharing name) and a photo if you like; no
// account. The photo is made small here (lib/profile) and goes only to the shared trips you're on.
import { useEffect, useRef, useState } from "react";
import { L } from "../lib/i18n";
import { getPhoto, photoFromFile, savePhoto } from "../lib/profile";
import { getShareConfig, saveShareConfig } from "../lib/share/store";

/** My photo, kept fresh when it changes (the hero's first circle on a trip of my own). */
export function useMyPhoto(): string | null {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    const load = () => void getPhoto().then(setPhoto);
    load();
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const handler = (changes: Record<string, unknown>, area: string) => area === "local" && "sharePhoto" in changes && load();
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  return photo;
}

export function ProfileSettings() {
  const photo = useMyPhoto();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void getShareConfig().then((c) => setName(c.name));
  }, []);
  return (
    <section className="profile-set" aria-label={L("Profilim", "My profile")}>
      <h3>{L("Profilim", "My profile")}</h3>
      <div className="profile-row">
        <button type="button" className="profile-photo" onClick={() => input.current?.click()} title={L("Fotoğraf seç", "Pick a photo")} aria-label={L("Profil fotoğrafı seç", "Pick a profile photo")}>
          {photo ? <img src={photo} alt="" /> : <span>{(name.trim()[0] ?? "+").toLocaleUpperCase()}</span>}
        </button>
        <label className="field profile-name">
          {L("Adın (gezi arkadaşların seni böyle görür)", "Your name (how your travel friends see you)")}
          <input value={name} maxLength={40} placeholder={L("ör. Emre", "e.g. Emre")} onChange={(e) => setName(e.target.value)} onBlur={() => void saveShareConfig({ name })} />
        </label>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            await savePhoto(await photoFromFile(file));
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }} />
      <p className="muted small">
        {photo ? (
          <button type="button" className="link-btn quiet" onClick={() => void savePhoto(null)}>
            {L("Fotoğrafı kaldır", "Remove the photo")}
          </button>
        ) : (
          L("Fotoğraf isteğe bağlı; yalnız paylaştığın gezilerin üyeleri görür.", "A photo is optional; only the people on the trips you share see it.")
        )}
      </p>
      {error && <p className="err small">{error}</p>}
    </section>
  );
}
