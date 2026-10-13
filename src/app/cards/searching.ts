// "Aranıyor": a flight card whose "Seçenek ara" went to the chat looks like searching for up to a minute, or until
// options arrive (the card is then another card, or its key changes with the number of options). Kept in memory only.
import { useEffect, useState } from "react";

const WINDOW_MS = 60_000;
const until = new Map<string, number>();
const asked = new Set<string>();
/** True once a search was started for this key (this session, in memory): only then "nothing fitting found" may be said. */
export const markSearched = (key: string) => void asked.add(key);
export const hasSearched = (key: string) => asked.has(key);
/** Test hook. */
export const resetSearched = () => (asked.clear(), until.clear());

export function useSearching(key: string): [boolean, () => void] {
  const [, redraw] = useState(0);
  const left = (until.get(key) ?? 0) - Date.now();
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => redraw((n) => n + 1), left + 20);
    return () => clearTimeout(t);
  }, [key, left > 0]);
  return [left > 0, () => (markSearched(key), until.set(key, Date.now() + WINDOW_MS), redraw((n) => n + 1))];
}
