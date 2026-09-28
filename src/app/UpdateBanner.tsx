import { useEffect, useState } from "react";
import { updateWaiting } from "../lib/update";

/** When the updater has put a newer version on disk, offer a one-click reload. */
export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const check = () => void updateWaiting().then(setVersion);
    check();
    const timer = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!version) return null;
  return (
    <div className="update-banner">
      Yeni sürüm hazır ({version}).
      <button className="small-btn" onClick={() => void chrome.runtime.sendMessage({ type: "apply-update" })}>
        Şimdi güncelle
      </button>
    </div>
  );
}
