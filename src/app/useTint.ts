// The deep tone of a trip's photo (drawing v2, 2026-10-09): the card's scrim takes the photo's own colour, darkened, so
// every card sits in its own mood (Bali green, Porto amber) instead of one grey. Read from the photo's lower half on a
// tiny canvas; a photo that can't be read (no CORS, no picture) leaves the neutral deep violet.
import { useEffect, useState } from "react";

export const NEUTRAL_TINT = "#1c1a33";
const cache = new Map<string, string>();

/** The average of the lower half, darkened to a scrim colour. Exported for the tests. */
export function darken(r: number, g: number, b: number): string {
  const k = 0.38;
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

export function usePhotoTint(src: string | null): string {
  const [tint, setTint] = useState(() => (src && cache.get(src)) || NEUTRAL_TINT);
  useEffect(() => {
    if (!src) return void setTint(NEUTRAL_TINT);
    const hit = cache.get(src);
    if (hit) return void setTint(hit);
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 12;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx || !img.naturalWidth) return;
        ctx.drawImage(img, 0, img.naturalHeight * 0.5, img.naturalWidth, img.naturalHeight * 0.5, 0, 0, size, size);
        const d = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) (r += d[i]), (g += d[i + 1]), (b += d[i + 2]);
        const n = d.length / 4;
        const color = darken(r / n, g / n, b / n);
        cache.set(src, color);
        if (live) setTint(color);
      } catch {
        // tainted canvas: the neutral tone stays
      }
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return tint;
}
