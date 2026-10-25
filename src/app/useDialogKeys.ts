// A window over the board (Settings, Share): Escape closes it, and the focus goes back to what opened it (2026-10-25:
// a keyboard could leave Settings only by saving, and the focus fell to the page's top).
import { useEffect, useRef } from "react";

export function useDialogKeys(onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      close.current();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
}
