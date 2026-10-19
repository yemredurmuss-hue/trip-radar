// The v82 Plan's line icons (the prototype's `ic`, docs/mockups/plan-v83-turler/kaynak/gen82.py): one stroke, round ends,
// drawn here so nothing is fetched. The kinds' own icons stay cards/Silhouettes' KindIcon.
const PATHS = {
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  users: "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  check: "M5 12.5l4.5 4.5L19 7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  clip: "M21 11.5 12.4 20a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.5a1.7 1.7 0 0 1-2.3-2.3l7.9-7.8",
  board: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  x: "M7 7l10 10M17 7 7 17",
  plus: "M12 5v14M5 12h14",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  plane: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  chev: "M9 6l6 6-6 6",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z",
  copy: "M8 8h11v11H8zM5 16V5h11",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Ic({ name, size = 15, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg className="i" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "dots" ? 3.2 : stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The info line's icon for a part of it: nights, a route, people, else a day. */
export const partIcon = (part: string): IconName => (/→/.test(part) ? "plane" : /gece|night|gün|day/i.test(part) ? "moon" : /kişi|person|people/i.test(part) ? "users" : "cal");

/** A site's mark: its letter on its colour (drawn here, never fetched). */
export function Mark({ color, letter, small = false }: { color: string; letter: string; small?: boolean }) {
  return (
    <span className={`q-logo${small ? " sm" : ""}`} style={{ "--bl": color } as React.CSSProperties} aria-hidden>
      {letter}
    </span>
  );
}
