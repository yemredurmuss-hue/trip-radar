// A transfer card's open state, handed from its empty card to its full card: picking a way on an opened empty
// transfer swaps it for LegCard in the same render, and the new card starts open. Nothing else is remembered: a card
// mounted later (another view, a reload) starts closed as before.
import { useEffect, useState } from "react";

/** The transfers whose card is open on screen right now, by the transfer's key. */
const openNow = new Set<string>();

export function useLegOpen(key: string): [boolean, (value: boolean) => void] {
  // Read while rendering: the card it replaces is still mounted then, so its key is still here.
  const [open, setOpen] = useState(() => openNow.has(key));
  useEffect(() => {
    if (open) openNow.add(key);
    else openNow.delete(key);
    return () => void openNow.delete(key);
  }, [key, open]);
  return [open, setOpen];
}
