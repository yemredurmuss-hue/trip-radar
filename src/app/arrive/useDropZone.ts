// A drop target that knows when files or links are over it (for the calm overlay), without the flicker of
// dragleave firing on every child: entered and left are counted. A drag that started on the page itself (a
// card's link) isn't an arrival and is ignored.
import { useEffect, useRef, useState, type DragEvent } from "react";

let inner = false;
let listening = false;
function watchInnerDrags() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("dragstart", () => (inner = true), true);
  // After the drop's own handlers have run (they still need to know it came from the page).
  const done = () => setTimeout(() => (inner = false));
  window.addEventListener("dragend", done, true);
  window.addEventListener("drop", done, true);
}

/** Files, or a link dragged from another tab or the address bar. */
export const carriesArrival = (dt: DataTransfer | null): boolean => !!dt && !inner && (dt.types.includes("Files") || dt.types.includes("text/uri-list"));

/** The links a drop carries (text/uri-list: one per line, "#" lines are comments). */
export function droppedLinks(dt: DataTransfer): string {
  return dt
    .getData("text/uri-list")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .join(" ");
}

export interface DropRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useDropZone<T extends HTMLElement>(onArrive: (dt: DataTransfer) => void) {
  const depth = useRef(0);
  const [rect, setRect] = useState<DropRect | null>(null);
  useEffect(() => {
    watchInnerDrags();
    // A drag that ends anywhere (Esc, outside the window) takes the overlay away.
    const reset = () => {
      depth.current = 0;
      setRect(null);
    };
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, []);
  const handlers = {
    onDragEnter: (e: DragEvent<T>) => {
      if (!carriesArrival(e.dataTransfer)) return;
      e.preventDefault();
      depth.current++;
      if (depth.current === 1) {
        const r = e.currentTarget.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    },
    onDragOver: (e: DragEvent<T>) => {
      if (!carriesArrival(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent<T>) => {
      if (!carriesArrival(e.dataTransfer)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setRect(null);
    },
    onDrop: (e: DragEvent<T>) => {
      const take = carriesArrival(e.dataTransfer);
      depth.current = 0;
      setRect(null);
      if (!take) return;
      e.preventDefault();
      e.stopPropagation();
      onArrive(e.dataTransfer);
    },
  };
  return { rect, handlers };
}
