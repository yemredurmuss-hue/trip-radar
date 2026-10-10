import type { Category } from "../lib/types";

/** A category's icon, or a car for a rented car (a "transport" that isn't a trip). */
export type IconName = Category | "car";

const paths: Record<IconName, string> = {
  car: "M5 17H3.8a.8.8 0 0 1-.8-.8V13l1.9-4.6A2 2 0 0 1 6.8 7h10.4a2 2 0 0 1 1.9 1.4L21 13v3.2a.8.8 0 0 1-.8.8H19M3 13h18M9 17h6M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  flight: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  stay: "M3 18v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6M3 18h18M3 18v2m18-2v2M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3",
  transport: "M5 17h14M6 17l1-9h10l1 9M8 20h.01M16 20h.01M7 12h10",
  activity: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 7v10",
  food: "M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11",
  esim: "M7 3h7l5 5v13H7zM10 12h6v6h-6zM13 12v6M10 15h6",
  other: "M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

export function CategoryIcon({ category, size = 26 }: { category: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[category]} />
    </svg>
  );
}

export const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const Back = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const ArrowUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const Plus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** The hero's icons (from the approved v8 mockup): filled category marks, line icons for the facts column, small UI marks. */
const HERO_ICONS = {
  plane: <path fill="currentColor" d="M21 15.5v-1.8l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.1L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z" />,
  bed: (
    <g fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6.5A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5V18M3 15h18M3 18v2M21 18v2" />
      <path d="M5 9V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V9" />
    </g>
  ),
  car: (
    <g fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16v-3.5l2-5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5l2 5V16" />
      <rect x="3" y="12.5" width="18" height="5" rx="1.5" />
      <path d="M5 17.5V19M19 17.5V19" />
    </g>
  ),
  ticket: (
    <g fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 9.5v-2a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5z" />
      <path d="M14.5 7.5v2M14.5 11.5v1M14.5 14.5v2" />
    </g>
  ),
  pin: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 21.5s-7-6-7-11.5a7 7 0 0 1 14 0c0 5.5-7 11.5-7 11.5z" />
      <circle cx="12" cy="10" r="2.6" />
    </g>
  ),
  cal: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </g>
  ),
  users: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20c.6-3.6 3-5.6 6.2-5.6s5.6 2 6.2 5.6" />
      <circle cx="17" cy="9" r="2.7" />
      <path d="M16.6 14.6c2.5.2 4.2 1.9 4.7 5" />
    </g>
  ),
  passport: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <rect x="4.5" y="2.5" width="15" height="19" rx="2.5" />
      <circle cx="12" cy="10.5" r="3.4" />
      <path d="M8.5 17.5h7" />
    </g>
  ),
  globe: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </g>
  ),
  wallet: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M4 7.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11.5" />
      <path d="M16.5 12.5H21v4h-4.5a2 2 0 0 1 0-4z" />
    </g>
  ),
  clock: (
    <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </g>
  ),
  hourglass: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3h11M6.5 21h11M7.5 3v3.5L12 12l4.5-5.5V3M7.5 21v-3.5L12 12l4.5 5.5V21" />
    </g>
  ),
  star: <path fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.35 2.85 1-6L3.3 9.6l6-.9z" />,
  user: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <circle cx="12" cy="9" r="3.6" />
      <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
    </g>
  ),
  plug: (
    <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4" />
    </g>
  ),
  coin: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.2 8.6a4 4 0 1 0 0 6.8M7.5 11h6M7.5 13.2h6" />
    </g>
  ),
  lang: (
    <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5h16v10H11l-4.5 4v-4H4z" />
      <path d="M8.5 9.5h7M8.5 12h4.5" />
    </g>
  ),
  sun: (
    <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </g>
  ),
  partly: (
    <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 3v1.5M3.8 5l1 1M2.5 9.5H4M13.2 5l-1 1" />
      <path d="M5.7 12.3A3.8 3.8 0 1 1 12.4 9" />
      <path d="M8.5 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A2.9 2.9 0 0 0 8.5 20z" />
    </g>
  ),
  cloud: <path fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" d="M7 19h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 19z" />,
  rain: (
    <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 15.5z" />
      <path d="M8.5 18.5 7.5 21M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" />
    </g>
  ),
  spark: <path fill="currentColor" d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5zM19 15c.25 2 1.1 2.75 3 3-1.9.25-2.75 1-3 3-.25-2-1.1-2.75-3-3 1.9-.25 2.75-1 3-3z" />,
  chevDown: <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,
  dots: (
    <g fill="currentColor">
      <circle cx="5.5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
    </g>
  ),
  chevRight: <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,
  /** The photo's place before a city (and its photo) is known. */
  landscape: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="m3.5 16.5 5-5 4.5 4.5 2.5-2.5 5 4.5" />
      <circle cx="15.5" cy="9" r="1.6" />
    </g>
  ),
  // The style chips (hero v9): one line icon per style.
  mountain: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 19.5 9.5 6.5l4.3 7.6 2.2-3.4 5.5 8.8z" />
      <path d="m7.4 10.5 2.1 1.6 1.8-1.4" />
    </g>
  ),
  sparkle: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 5c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />
      <path d="M18.5 2.5v4M16.5 4.5h4" />
    </g>
  ),
  heart: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinejoin="round"
      d="M12 20s-8-4.7-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6C20 15.3 12 20 12 20z"
    />
  ),
  leaf: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19.5C4.5 11 9.5 5 19.5 4.5 20 14 14.5 19.5 6.5 19.5z" />
      <path d="m5 19.5 8.5-8.5" />
    </g>
  ),
  columns: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 20.5 8h-17zM4.5 11h15M6.5 11v6.5M10 11v6.5M14 11v6.5M17.5 11v6.5M4 17.5h16M3 20.5h18" />
    </g>
  ),
  tree: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 6.5 10.5h3l-4 6h13l-4-6h3z" />
      <path d="M12 16.5v4.5" />
    </g>
  ),
  fork: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v5.5a2.5 2.5 0 0 0 5 0V3M8.5 3v18" />
      <path d="M17.5 21V3c-2.2 1.2-3.5 4.3-3.5 8.5h3.5" />
    </g>
  ),
  wave: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      d="M2.5 8.5c2.4 0 2.4-2 4.75-2S9.6 8.5 12 8.5s2.4-2 4.75-2 2.35 2 4.75 2M2.5 13c2.4 0 2.4-2 4.75-2S9.6 13 12 13s2.4-2 4.75-2 2.35 2 4.75 2M2.5 17.5c2.4 0 2.4-2 4.75-2s2.35 2 4.75 2 2.4-2 4.75-2 2.35 2 4.75 2"
    />
  ),
  buildings: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 20.5h19M4 20.5V9l5.5-2.5v14M9.5 20.5V3.5h7v17M16.5 9.5h4v11" />
      <path d="M12.2 7.5h1.6M12.2 11h1.6M12.2 14.5h1.6M6.2 11.5h1M6.2 15h1" />
    </g>
  ),
  family: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="6" r="2.4" />
      <circle cx="16.5" cy="6" r="2.4" />
      <circle cx="12" cy="13" r="1.8" />
      <path d="M3 19.5c.2-4.6 1.9-7 4.5-7 1.2 0 2.2.5 2.9 1.4M21 19.5c-.2-4.6-1.9-7-4.5-7-1.2 0-2.2.5-2.9 1.4M9 20.5c.3-2.5 1.4-3.8 3-3.8s2.7 1.3 3 3.8" />
    </g>
  ),
  note: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5.5l11-2V16M9 9.5l11-2" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </g>
  ),
  run: (
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="15" cy="4.5" r="1.9" />
      <path d="m6 11 3.5-3h4.5l2 3.5 3 1M13.5 8l-3.5 7.5 3.5 2.5v3.5M10 15.5 7.5 20.5M4 15.5h3.5" />
    </g>
  ),
} as const;

export type HeroIconName = keyof typeof HERO_ICONS;

export function HeroIcon({ name, size = 24, className }: { name: HeroIconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {HERO_ICONS[name]}
    </svg>
  );
}
