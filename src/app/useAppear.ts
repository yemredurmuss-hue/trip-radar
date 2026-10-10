// The hero's blocks fill in as information arrives (hero v9): a block that was empty when its data was first
// ready, and has its information now, fades in once (`hx-appear` in app.css; none under reduced motion). While
// the data is still loading (`ready` false) the block shows a quiet placeholder, not its empty state, and that
// doesn't count as "empty". The filled node is keyed apart from the empty one, so it mounts fresh and plays.
import { useRef } from "react";

export function useAppear(filled: boolean, ready = true): string {
  const startedEmpty = useRef<boolean | null>(null);
  if (startedEmpty.current === null && ready) startedEmpty.current = !filled;
  return filled && startedEmpty.current ? " hx-appear" : "";
}
