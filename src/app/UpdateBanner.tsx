import { useEffect, useState } from "react";
import { L } from "../lib/i18n";
import { updateWaiting } from "../lib/update";

const CHECK_MS = 15_000;
const COUNTDOWN_MS = 3_000;

/**
 * What holds a reload back: a dialog, a drawer, the comparison, a reply on its way, anything opened (a menu, a card's
 * details). A Plan category open is no such thing (plan v82: one is always open, B8), so its row's button doesn't count;
 * nor does the hero's "Özeti küçült" / "Özeti aç" (an open summary holds nothing either).
 */
export const RELOAD_BLOCKERS =
  '.drawer:not(.mv-leaving), .compare-modal:not(.mv-leaving), .modal:not(.mv-leaving), .thinking, [aria-expanded="true"]:not(.q-tt):not(.x-fold):not(.x-unfold)';

/** Nothing would be lost by reloading now: no typed text, no reply on its way, no dialog, drawer or opened card. */
function safeToReload(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea",
  );
  // (a window that just closed leaves a still copy for its exit, .mv-leaving: exitMotion.ts; it is not open and holds nothing typed)
  const typed = [...fields].some((el) => !el.closest(".mv-leaving") && el.value.trim() !== "");
  return !typed && !document.querySelector(RELOAD_BLOCKERS);
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
        {L(`Yeni sürüm (${version}) yükleniyor…`, `Installing new version (${version})…`)}
        <button className="small-btn" onClick={() => setSnoozed(version)}>
          {L("Şimdi değil", "Not now")}
        </button>
      </div>
    );
  }
  return (
    <div className="update-banner">
      {L(`Yeni sürüm hazır (${version}).`, `New version ready (${version}).`)}
      <button className="small-btn" onClick={apply}>
        {L("Şimdi güncelle", "Update now")}
      </button>
    </div>
  );
}
