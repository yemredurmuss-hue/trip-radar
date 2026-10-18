// Profilim (0.36): your name (the one the others see you by, the sharing name) and a photo if you like; no
// account. The photo is made small here (lib/profile) and goes only to the shared trips you're on.
import { useEffect, useRef, useState } from "react";
import { L } from "../lib/i18n";
import { getPeoplePhotos, getPhoto, personKey, photoFromFile, savePhoto, setPersonPhoto } from "../lib/profile";
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

/** My name (the profile's, the sharing name), kept fresh when it changes: "Ben (Emre)" in the hero's people box. */
export function useMyName(): string {
  const [name, setName] = useState("");
  useEffect(() => {
    const load = () => void getShareConfig().then((c) => setName(c.name), () => setName(""));
    load();
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const handler = (changes: Record<string, unknown>, area: string) => area === "local" && "shareName" in changes && load();
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  return name;
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

/** The photos I gave the people I travel with (by name), kept fresh. */
export function usePeoplePhotos(): (name: string | undefined) => string | null {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    const load = () => void getPeoplePhotos().then(setPhotos);
    load();
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const handler = (changes: Record<string, unknown>, area: string) => area === "local" && "peoplePhotos" in changes && load();
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  return (name) => (name ? (photos[personKey(name)] ?? null) : null);
}

/**
 * A person's circle in "Kimler gidiyor?" (0.37): their photo (or initial); a tap picks a photo for them, kept
 * only on this computer. `own`: the photo they share themselves (it shows, and isn't replaced); `me`: my own
 * profile photo is the one picked.
 */
export function PersonPhoto({ name, photo, own = null, me = false }: { name: string; photo: string | null; own?: string | null; me?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const shown = own ?? photo;
  const pick = async (file: File) => {
    try {
      const made = await photoFromFile(file);
      await (me ? savePhoto(made) : setPersonPhoto(name, made));
    } catch {
      // a picture that can't be read: the circle stays as it was
    }
  };
  return (
    <span className="who-photo">
      <button type="button" className={`who-av${shown ? " has" : ""}`} disabled={!!own}
        title={own ? L(`${name} kendi fotoğrafını paylaşıyor`, `${name} shares their own photo`) : L("Fotoğraf seç", "Pick a photo")}
        aria-label={L(`${name}: fotoğraf seç`, `${name}: pick a photo`)} onClick={() => input.current?.click()}
        data-initial={(name.trim()[0] ?? "?").toLocaleUpperCase("tr")}>
        {shown && <img src={shown} alt="" />}
      </button>
      {photo && !own && (
        <button type="button" className="who-av-x" title={L("Fotoğrafı kaldır", "Remove the photo")} aria-label={L(`${name}: fotoğrafı kaldır`, `${name}: remove the photo`)}
          onClick={() => void (me ? savePhoto(null) : setPersonPhoto(name, null))}>
          ×
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }} />
    </span>
  );
}
