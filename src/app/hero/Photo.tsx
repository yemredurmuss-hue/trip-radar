// A hero photo at the size it's drawn, from its address: the browser keeps it (lib/photoCache.ts), and one drawn this
// visit is held decoded, so it paints at once (decoding "sync": no blank frame). A photo that won't load says so (onError).
import { useEffect } from "react";
import { heldPhoto, holdPhoto, sizedPhoto } from "../../lib/photoCache";

export function Photo({ src, width, onError, priority = false }: { src: string; width: number; onError: () => void; priority?: boolean }) {
  const url = sizedPhoto(src, width);
  const ready = heldPhoto(url);
  useEffect(() => holdPhoto(url), [url]);
  return (
    <img
      src={url}
      alt=""
      decoding={ready ? "sync" : "async"}
      loading={priority || ready ? "eager" : "lazy"}
      {...{ fetchpriority: priority ? "high" : "auto" }}
      onError={onError}
    />
  );
}
