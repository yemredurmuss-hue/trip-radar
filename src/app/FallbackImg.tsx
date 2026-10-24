import { useState, type ReactNode } from "react";
import { CARD_W, sizedPhoto } from "../lib/photoCache";

/**
 * Shows the fallback when there is no image or it fails to load (blocked, moved, offline). A photo from Unsplash, Pexels
 * or Wikimedia is asked for at `width` (a card's unless told), not at the 2400 px the proxy stores; others as they are.
 */
export function FallbackImg({ src, className, fallback, title, width = CARD_W }: { src: string | null; className: string; fallback: ReactNode; title?: string; width?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  // (hareket dili) "loaded" once the picture is in: a trip card's photo then comes out of a blur (app.css).
  return <img className={className} src={sizedPhoto(src, width)} alt="" title={title} loading="lazy" onError={() => setFailed(src)} onLoad={(e) => e.currentTarget.classList.add("loaded")} />;
}
