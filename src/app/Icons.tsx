import type { Category } from "../lib/types";

const paths: Record<Category, string> = {
  flight: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  stay: "M3 18v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6M3 18h18M3 18v2m18-2v2M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3",
  transport: "M5 17h14M6 17l1-9h10l1 9M8 20h.01M16 20h.01M7 12h10",
  activity: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 7v10",
  food: "M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 0-3 3-3 7h3v11",
  esim: "M7 3h7l5 5v13H7zM10 12h6v6h-6zM13 12v6M10 15h6",
  other: "M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

export function CategoryIcon({ category, size = 26 }: { category: Category; size?: number }) {
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
