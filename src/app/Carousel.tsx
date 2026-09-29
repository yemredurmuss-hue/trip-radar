import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Cards side by side that swipe (touch, trackpad, or the ‹ › buttons and arrow keys). The next card
 * peeks in from the edge, so it's clear there's more; "2 / 4" says where you are.
 */
export function Carousel({ head, label, children }: { head?: ReactNode; label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const count = Children.count(children);
  const [at, setAt] = useState({ index: 0, start: true, end: count <= 1 });

  // Keys in order: when the ranking changes the order, start again from the first card (the browser
  // would otherwise follow the card it was snapped to, wherever it moved).
  const order = Children.toArray(children)
    .map((c) => (typeof c === "object" && c && "key" in c ? String(c.key) : ""))
    .join("|");

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    const left = el.scrollLeft;
    const end = left + el.clientWidth >= el.scrollWidth - 4;
    let index = 0;
    cards.forEach((c, i) => {
      if (c.offsetLeft <= left + 10) index = i; // the track is the cards' offset parent
    });
    setAt({ index: end && cards.length > 1 ? cards.length - 1 : index, start: left <= 4, end });
  }, []);

  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    measure();
  }, [order, measure]);

  useEffect(() => {
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  /** One card on or back, from where the track actually is (the last cards may never reach the left edge). */
  const go = (step: number) => {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    const left = el.scrollLeft;
    const target = step > 0 ? cards.find((c) => c.offsetLeft > left + 10) : [...cards].reverse().find((c) => c.offsetLeft < left - 10);
    el.scrollTo({ left: target ? Math.max(0, target.offsetLeft - 2) : step > 0 ? el.scrollWidth : 0, behavior: "smooth" });
  };

  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      {(head || count > 1) && (
        <div className="carousel-head">
          <div className="carousel-title">{head}</div>
          {count > 1 && !(at.start && at.end) && (
            <div className="carousel-nav">
              <span className="muted">
                {at.index + 1} / {count}
              </span>
              <button className="nav-btn" aria-label="Önceki" disabled={at.start} onClick={() => go(-1)}>
                ‹
              </button>
              <button className="nav-btn" aria-label="Sonraki" disabled={at.end} onClick={() => go(1)}>
                ›
              </button>
            </div>
          )}
        </div>
      )}
      <div
        className="carousel-track"
        ref={track}
        tabIndex={0}
        onScroll={measure}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {children}
      </div>
    </div>
  );
}
