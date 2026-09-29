import { useEffect, useState } from "react";
import { updateWaiting } from "../lib/update";

const CHECK_MS = 15_000;
const COUNTDOWN_MS = 3_000;

/** Nothing would be lost by reloading now: no typed text, no reply on its way, no dialog, drawer or opened card. */
function safeToReload(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea",
  );
  const typed = [...fields].some((el) => el.value.trim() !== "");
  return !typed && !document.querySelector('.drawer, .compare-modal, .modal, .thinking, [aria-expanded="true"]');
}

const apply = () => void chrome.runtime.sendMessage({ type: "apply-update", reopen: location.hash });

/**
 * When the updater has put a newer version on disk, the board updates itself right away (and comes
 * back where it was) unless something typed or an open dialog would be lost; then it offers a button.
 */
export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [snoozed, setSnoozed] = useState<string | null>(null);

  useEffect(() => {
    const check = () =>
      void updateWaiting().then((v) => {
        setVersion(v);
        setAuto(Boolean(v) && safeToReload());
      });
    check();
    const timer = setInterval(check, CHECK_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  const automatic = auto && version !== snoozed;
  useEffect(() => {
    if (!automatic) return;
    const timer = setTimeout(() => (safeToReload() ? apply() : setAuto(false)), COUNTDOWN_MS);
    return () => clearTimeout(timer);
  }, [automatic]);

  if (!version) return null;
  if (automatic) {
    return (
      <div className="update-banner">
        Yeni sürüm ({version}) yükleniyor…
        <button className="small-btn" onClick={() => setSnoozed(version)}>
          Şimdi değil
        </button>
      </div>
    );
  }
  return (
    <div className="update-banner">
      Yeni sürüm hazır ({version}).
      <button className="small-btn" onClick={apply}>
        Şimdi güncelle
      </button>
    </div>
  );
}
