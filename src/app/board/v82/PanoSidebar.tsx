// The Pano's side menu (plan v81 "Pano yeniden", v83 C5; mk83.js sideHtml): five fixed entries with their numbers (Tümü ·
// Biriktirdiklerim · AI önerileri · İlham · Belgeler), then "İhtiyaçlar": each category (its colour, how many) and its intents (a dot
// for where each stands, how many options). E9: the chosen line's highlight slides to the new one. On a phone the fixed entries are
// one row that scrolls sideways; the intents are reached from the groups' own buttons.
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { SectionId } from "../../../lib/categories";
import { L } from "../../../lib/i18n";
import { panoCatName, type PanoBoard, type PanoView } from "../../../lib/panoBoard";
import { reducedMotion } from "../../motion";
import { PANO_COLORS } from "./parts";

const icon = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const TOP: { view: PanoView; label: () => string; icon: ReactNode }[] = [
  { view: "all", label: () => L("Tümü", "All"), icon: icon("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z") },
  { view: "mine", label: () => L("Biriktirdiklerim", "Saved by us"), icon: icon("M6 3h12v18l-6-4-6 4z") },
  { view: "ai", label: () => L("AI önerileri", "AI picks"), icon: icon("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z") },
  { view: "ilham", label: () => L("İlham", "Inspiration"), icon: icon("M8 5v14l11-7z") },
  { view: "docs", label: () => L("Belgeler", "Documents"), icon: icon("M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6") },
];

export interface PanoPlace {
  view: PanoView;
  section: SectionId | null;
  need: string | null;
}

export function PanoSidebar({ board, docs, at, onGo }: {
  board: PanoBoard;
  /** Belgeler's rows (files, and the ones still to come); null while they are read. */
  docs: number | null;
  at: PanoPlace;
  onGo: (place: PanoPlace) => void;
}) {
  const nav = useRef<HTMLElement>(null);
  const ind = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const on = (p: Partial<PanoPlace>) => (p.need ? at.need === p.need : p.section ? at.section === p.section && !at.need : !at.section && !at.need && at.view === p.view);
  // E9: one highlight under the chosen line, moved there (260 ms in the CSS); the first time, and with the motion off, at once.
  useLayoutEffect(() => {
    const box = nav.current;
    const mark = ind.current;
    const line = box?.querySelector<HTMLElement>("[aria-current='true']");
    if (!box || !mark) return;
    if (!line) {
      box.classList.remove("has-ind");
      return;
    }
    const still = !placed.current || reducedMotion();
    if (still) mark.style.transition = "none";
    mark.style.width = `${line.offsetWidth}px`;
    mark.style.height = `${line.offsetHeight}px`;
    mark.style.transform = `translate(${line.offsetLeft}px, ${line.offsetTop}px)`;
    box.classList.add("has-ind");
    if (still) {
      void mark.offsetWidth;
      mark.style.transition = "";
    }
    placed.current = true;
  });
  const count = (n: number | null) => <i>{n ?? ""}</i>;
  return (
    <nav className="q-side" ref={nav} aria-label={L("Pano bölümleri", "Board sections")}>
      <span className="q-sind" ref={ind} aria-hidden />
      <div className="q-stop">
        {TOP.map((t) => (
          <button key={t.view} type="button" className={`q-st1${on({ view: t.view }) ? " on" : ""}`} aria-current={on({ view: t.view })} data-v={t.view}
            onClick={() => onGo({ view: t.view, section: null, need: null })}>
            {t.icon}
            {t.label()}
            {count(t.view === "docs" ? docs : board.counts[t.view])}
          </button>
        ))}
      </div>
      {board.cats.length > 0 && <div className="q-sdiv">{L("İhtiyaçlar", "Needs")}</div>}
      {board.cats.map((c) => (
        <div key={c.section} className="q-sg">
          <button type="button" className={`q-sgh${on({ section: c.section }) ? " on" : ""}`} aria-current={on({ section: c.section })} data-cat={c.section}
            onClick={() => onGo({ view: "all", section: c.section, need: null })}>
            <span className="d" style={{ "--c": PANO_COLORS[c.section] ?? "#888" } as CSSProperties} aria-hidden />
            {panoCatName(c.section)}
            {count(c.count)}
          </button>
          {c.needs.map((n) => (
            <button key={n.key} type="button" className={`q-si${on({ need: n.key }) ? " on" : ""}`} aria-current={on({ need: n.key })} data-need={n.key}
              onClick={() => onGo({ view: "all", section: null, need: n.key })}>
              <span className={`q-sd ${n.dot}`} aria-hidden />
              <span>{n.name}</span>
              {count(n.options.length)}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
