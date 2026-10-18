// The Fikirler icons, copied from docs/mockups/2026-10-05-fikirler-v1.html (24×24 line symbols): a to-do's
// kind (camera, route, sun, book, bag, a fork and knife for food in the same line style; a star for anything
// else), the tick, the plus and the map pin.
import type { ReactNode } from "react";
import type { IdeaIcon } from "../../lib/ideas";

const stroke = (children: ReactNode, width = 1.9, cap: "round" | undefined = undefined) => (
  <g fill="none" stroke="currentColor" strokeWidth={width} strokeLinejoin="round" strokeLinecap={cap}>
    {children}
  </g>
);

const ICONS: Record<IdeaIcon | "check" | "plus" | "pin" | "link" | "search" | "museum" | "tree" | "walker" | "cup" | "cupcake" | "wine" | "ticket", ReactNode> = {
  // The kinds of fikir havuzu v1: culture, nature, a walk, coffee, something sweet, a glass of wine, fun.
  museum: stroke(<path d="M3.5 9 12 4l8.5 5M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8M3.5 20h17M3 17.5h18" />, 1.9, "round"),
  tree: stroke(<path d="M12 21v-6M12 3 6 11h3l-4 5h14l-4-5h3z" />, 1.9, "round"),
  walker: stroke(<><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2.2-6.2L15 17v4M9 11.5l3-3.5 2.5 2.5L17 12M12 8l-1 6.5" /></>, 1.9, "round"),
  cup: stroke(<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c.8.8.8 2.2 0 3M11.5 3.5c.8.8.8 2.2 0 3" />, 1.9, "round"),
  cupcake: stroke(<path d="M6 12h12l-1.5 8h-9zM6 12a6 6 0 0 1 12 0M12 4.5V6M9.5 14.5l.5 3.5M14.5 14.5l-.5 3.5" />, 1.9, "round"),
  wine: stroke(<path d="M7.5 3h9l-.6 5.5a4 4 0 0 1-7.8 0zM12 12.5V20M8.5 20.5h7" />, 1.9, "round"),
  ticket: stroke(<path d="M4 7.5h16v3a1.8 1.8 0 0 0 0 3.6v3H4v-3a1.8 1.8 0 0 0 0-3.6zM14 7.5v10" strokeDasharray="0" />, 1.9, "round"),
  camera: stroke(<><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>),
  route: stroke(<><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>, 1.9, "round"),
  sun: stroke(<path d="M7 17a5 5 0 0 1 10 0M3 17h18M12 7V4M5.6 10.6 3.5 8.5M18.4 10.6l2.1-2.1M4 21h16" />, 1.9, "round"),
  book: stroke(<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />),
  bag: stroke(<><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>, 1.9, "round"),
  food: stroke(<path d="M7 3v7.5M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 10.5V21M18 21V3c-2.3 1.2-3.5 3.8-3.5 7.5V13H18" />, 1.9, "round"),
  star: stroke(<path d="m12 3.6 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.6l-5.1 2.7.98-5.68L3.75 9.6l5.7-.83z" />),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" />,
  link: stroke(<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />, 2, "round"),
  search: stroke(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>, 2, "round"),
  pin: stroke(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>, 2),
};

export function IdeaGlyph({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
