// The frame's content changing in place (E3, E4, E5; hareket dili §2.2–2.4): the old content fades out in 120 ms while the
// box keeps its size, then the new one comes in over 260 ms; a pick (E4) turns straight into the chosen card (380 ms), and
// Değiştir's options are turned in (380 ms) and Vazgeç turns the card back (180 ms, E5). Nothing moves at the first drawing,
// with reduced motion or "Hareketi duraklat".
import { useEffect, useRef, useState, type ReactNode } from "react";
import { reducedMotion } from "../../motion";

/** How the next content comes in. */
export type Entry = "in" | "morph" | "flip" | "back";

const OUT_MS = 120;

/**
 * The content to draw for `key`, its class ("z-xf out", "z-xf in"…) and the key to draw it under (a new key is a new
 * element, so its entrance plays); `entry` says how a new key arrives.
 */
export function useCrossfade(key: string, node: ReactNode, entry: Entry = "in"): { key: string; node: ReactNode; cls: string } {
  const [shown, setShown] = useState<{ key: string; node: ReactNode; phase: "still" | "out" | Entry }>({ key, node, phase: "still" });
  const latest = useRef({ key, node, entry });
  latest.current = { key, node, entry };
  useEffect(() => {
    if (key === shown.key) return;
    if (reducedMotion()) return setShown({ key, node: latest.current.node, phase: "still" });
    // A pick turns into its card at once (the shared element moves, E4); anything else fades out first.
    if (entry !== "in") return setShown({ key, node: latest.current.node, phase: entry });
    setShown((s) => ({ ...s, phase: "out" }));
    const t = setTimeout(() => setShown({ key: latest.current.key, node: latest.current.node, phase: latest.current.entry }), OUT_MS);
    return () => clearTimeout(t);
    // `node` changes every render; only a new key starts a change.
  }, [key]);
  // While the key holds, its content is the live one (a price that changed, a file added).
  const live = shown.key === key;
  return { key: shown.key, node: live ? node : shown.node, cls: shown.phase === "still" ? "z-xf" : `z-xf ${shown.phase}` };
}
