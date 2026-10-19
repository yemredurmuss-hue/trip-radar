// The small "aranıyor" line (0.38.8): where an answer from the background will land (a city's tours, the Bavul's list,
// the AI's suggestions), the chat's three dots (app.css .th-dots) and a short line, "Viator'da turlar aranıyor…". It goes
// when the answer comes. With reduced motion (or "Hareketi duraklat") the dots stand still and the words stay (motion.css).
import { useSyncExternalStore } from "react";
import type { LookStore } from "../../../lib/looking";

/** The three dots alone (a chip that already says "Aranıyor"). */
export function SearchDots() {
  return (
    <span className="th-dots q-lookd" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

export function Searching({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`q-look${className ? ` ${className}` : ""}`} role="status">
      <SearchDots />
      <span className="q-lookt">{text}</span>
    </span>
  );
}

/** Whether `key` is being looked for now in `store`, again on every change. */
export function useLooking(store: LookStore, key: string | null | undefined): boolean {
  const read = () => store.has(key);
  return useSyncExternalStore(store.subscribe, read, read);
}
