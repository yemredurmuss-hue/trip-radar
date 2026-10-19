// The hero's line icons, as the approved v83 drawing has them (plan-v83-turler/kaynak/hero83.py): one stroke, round ends.
const PATHS = {
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  users: "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13.5h.01",
  arrow: "M5 12h14M13 6l6 6-6 6",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9.5a3 3 0 1 0 0 5M8 11h5M8 13h5",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  chat: "M4 5h16v11H9l-5 4z",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: "M12 3l9.5 17h-19zM12 10v4M12 17h.01",
  chev: "M6 9l6 6 6-6",
  up: "M6 15l6-6 6 6",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  x: "M6 6l12 12M18 6L6 18",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6",
  share: "M12 4v11M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5",
  pdf: "M7 3h7l4 4v14H7zM14 3v4h4M9 17v-4h1.5a1.5 1.5 0 0 1 0 3H9",
  map: "M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13",
  hist: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2",
  newchat: "M4 5h16v11H9l-5 4zM12 8v5M9.5 10.5h5",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1-2 3.4-1.8-.6a7 7 0 0 1-2.2 1.3L14.6 21h-4l-.4-2.4a7 7 0 0 1-2.2-1.3l-1.8.6-2-3.4 1.6-1a7 7 0 0 1 0-2.6l-1.6-1 2-3.4 1.8.6A7 7 0 0 1 10.2 5.4L10.6 3h4l.4 2.4a7 7 0 0 1 2.2 1.3l1.8-.6 2 3.4-1.6 1a7 7 0 0 1 0 2.6z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  image: "M4 5h16v14H4zM4 15l4.5-4.5L13 15l2.5-2.5L20 17M15.5 9.5h.01",
} as const;

export type XIconName = keyof typeof PATHS;

export function XIcon({ name, size = 16, stroke = 2 }: { name: XIconName; size?: number; stroke?: number }) {
  return (
    <svg className="i" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
