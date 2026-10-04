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

/** Small line icons for the trip summary (days, cities, experiences). */
const SUMMARY_PATHS = {
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  pin: "M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
} as const;

export function SummaryIcon({ name, size = 22 }: { name: keyof typeof SUMMARY_PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={SUMMARY_PATHS[name]} />
    </svg>
  );
}

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
} as const;

export type HeroIconName = keyof typeof HERO_ICONS;

export function HeroIcon({ name, size = 24, className }: { name: HeroIconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {HERO_ICONS[name]}
    </svg>
  );
}
