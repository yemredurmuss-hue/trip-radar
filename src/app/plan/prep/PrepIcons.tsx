// Hazırlık's small pictures (v82, the prototype's z83_prep.py set): lines on a 24 px grid in the text's colour.
import type { KnowIcon } from "../../../lib/prepKnow";

const PATHS: Record<KnowIcon | "bag" | "check" | "x" | "chev" | "spark" | "phone", string> = {
  alert: "M12 3l9.5 17h-19zM12 10v4M12 17h.01",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v.01M18 14v.01",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  hand: "M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 14",
  shoe: "M3 16h18v3H3zM3 16V9l4 1 3 3 5 1 6 2",
  train: "M6 3h12v12H6zM6 10h12M9 18l-2 3M15 18l2 3M9 13h.01M15 13h.01",
  card: "M3 6h18v12H3zM3 10h18",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M7 7l10 10M17 7 7 17",
  chev: "M9 6l6 6-6 6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  phone: "M8 2h8a1.5 1.5 0 0 1 1.5 1.5v17A1.5 1.5 0 0 1 16 22H8a1.5 1.5 0 0 1-1.5-1.5v-17A1.5 1.5 0 0 1 8 2zM11 18.5h2",
};

export function PrepIcon({ name, size = 16, stroke = 2 }: { name: keyof typeof PATHS; size?: number; stroke?: number }) {
  return (
    <svg className="i" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
