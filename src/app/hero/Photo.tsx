// A hero photo drawn from the disk when it's kept (lib/photoCache.ts), else fetched once, kept, and drawn from that copy
// (from its address when it can't be read); asked for at the size it's drawn. A photo that won't load says so (onError), as a plain <img> did.
import { useEffect, useState } from "react";
import { keepPhoto, keptPhoto, seenPhoto, sizedPhoto } from "../../lib/photoCache";

export function Photo({ src, width, onError, priority = false }: { src: string; width: number; onError: () => void; priority?: boolean }) {
  const url = sizedPhoto(src, width);
  const [shown, setShown] = useState<string | null>(() => seenPhoto(url));
  useEffect(() => {
    let live = true;
    const now = seenPhoto(url);
    if (now) return setShown(now);
    setShown(null);
    void keptPhoto(url).then((kept) => {
      if (!live) return;
      if (kept) return setShown(kept);
      // (not kept yet: fetched once and kept, drawn from the disk's copy; one that can't be read, from its address)
      void keepPhoto(url).then(() => live && setShown(seenPhoto(url) ?? url));
    });
    return () => {
      live = false;
    };
  }, [url]);
  if (!shown) return null;
  return <img src={shown} alt="" decoding="async" loading={priority ? "eager" : "lazy"} {...{ fetchpriority: priority ? "high" : "auto" }} onError={onError} />;
}
