// A booked flight's boxes on its Plan card (0.36.18, docs/mockups/2026-10-06-ucus-karti-v6.png): only what's
// known where the flight is (its day: expected departure, check-in desks, gate; in the air: took off, expected
// landing; landed: landed, belt, terminal), each with its icon, a label and one value that never wraps.
import type { FlightTile, TileIcon } from "../../lib/flightData";

const PATHS: Record<TileIcon, string> = {
  up: "M3 17h18M5.5 13.5l13-5.5c.9-.4 1.8.6 1.2 1.4l-3.2 3.6-4.2.6-2.6 2.4H7.5z",
  down: "M3 20h18M4.5 9.5l13.2 4.6c.9.3.9 1.6-.1 1.8l-4.7.6-3.6-1.7-3.3-1.2-1.8-3.6z",
  desk: "M3 10h18v3H3zM5 13v7M19 13v7M8 6h8v4H8z",
  gate: "M5 20V5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5V20M3 20h18M14.5 12.5h.01",
  belt: "M8 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9.5 7V5h5v2M3 20h18M7 17v3M17 17v3",
  term: "M4 20V9l8-5 8 5v11M4 20h16M9 20v-5h6v5",
  alert: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 8v5M12 16h.01",
};

export function FlightTiles({ tiles }: { tiles: FlightTile[] }) {
  if (!tiles.length) return null;
  return (
    <div className="pk-live">
      {tiles.map((t) => (
        <div key={t.label} className={`pk-lv${t.tone ? ` ${t.tone}` : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={PATHS[t.icon]} />
          </svg>
          <span>
            <small title={t.label}>{t.label}</small>
            <b>
              {t.value}
              {t.note && <i>{t.note}</i>}
            </b>
          </span>
        </div>
      ))}
    </div>
  );
}
