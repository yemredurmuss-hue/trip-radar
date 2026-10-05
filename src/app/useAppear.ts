// The hero's blocks fill in as information arrives (hero v9): a block that was empty when the hero mounted
// and has its information now fades in once (`hx-appear` in app.css; none under reduced motion). The filled
// node is keyed apart from the empty one, so it mounts fresh and the animation plays.
import { useRef } from "react";

export function useAppear(filled: boolean): string {
  const startedEmpty = useRef(!filled).current;
  return filled && startedEmpty ? " hx-appear" : "";
}
