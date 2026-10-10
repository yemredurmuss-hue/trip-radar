// A money figure that counts to its new value over 0.6 s when it changes (sayaç, motion.ts); the figure is drawn by the caller's own
// formatter, so it reads exactly as before when it stands still. The digits go tabular only while counting, so nothing shifts.
import { useCountUp } from "./motion";

export function Counted({ value, format }: { value: number; format: (n: number) => string }) {
  const { value: shown, counting } = useCountUp(value);
  return <span className={counting ? "counting" : undefined}>{format(Math.round(shown))}</span>;
}
