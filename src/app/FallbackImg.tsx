import { useState, type ReactNode } from "react";

/** Shows the fallback when there is no image or it fails to load (blocked, moved, offline). */
export function FallbackImg({ src, className, fallback, title }: { src: string | null; className: string; fallback: ReactNode; title?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return <img className={className} src={src} alt="" title={title} loading="lazy" onError={() => setFailed(src)} />;
}
