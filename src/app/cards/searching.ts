// "Aranıyor": a flight card whose "Seçenek ara" went to the chat looks like searching for up to a minute, or until
// options arrive (the card is then another card, or its key changes with the number of options). Kept in memory only.
import { useEffect, useState } from "react";

const WINDOW_MS = 60_000;
const until = new Map<string, number>();

export function useSearching(key: string): [boolean, () => void] {
  const [, redraw] = useState(0);
  const left = (until.get(key) ?? 0) - Date.now();
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => redraw((n) => n + 1), left + 20);
    return () => clearTimeout(t);
  }, [key, left > 0]);
  return [left > 0, () => (until.set(key, Date.now() + WINDOW_MS), redraw((n) => n + 1))];
}
