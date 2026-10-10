import type { ReactNode } from "react";

// Where a plan stands, the same way on every card: booked (green, ✓), planned but not bought (amber),
// or open. It sits on top of the card so it reads before anything else.
export type Standing = "booked" | "planned" | "open";

const MARK: Record<Standing, string> = { booked: "✓", planned: "◷", open: "○" };

export function StatusBar({ standing, text, sub, ring }: { standing: Standing; text: string; sub?: string | null; ring?: ReactNode }) {
  return (
    <div className={`status-bar st-${standing}`}>
      {ring ?? (
        <span className="status-mark" aria-hidden>
          {MARK[standing]}
        </span>
      )}
      <b>{text}</b>
      {sub && <span className="status-sub">{sub}</span>}
    </div>
  );
}
