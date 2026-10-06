// MapLibre GL, loaded only when a map opens (about 1 MB that the rest of the board never needs). The extension's
// pages forbid scripts and workers made from blobs (MV3's CSP), so it is MapLibre's CSP build: the library and its
// worker are files the build copies into dist/maplibre/ (scripts/build.mjs), the worker pointed at by its extension
// URL. Its stylesheet comes along from the same folder. Types only from the package: nothing of it is bundled.
import type * as MapLibre from "maplibre-gl";

export type MapLibreGL = typeof MapLibre;

/** The map's style: OpenFreeMap (no key, no limits; its attribution shows on the map). */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/** An extension file's URL (the page's own relative path outside an extension, e.g. in a test page). */
const fileUrl = (path: string): string => (typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path);

let loading: Promise<MapLibreGL> | null = null;

/** The library, read once (a failed load is tried again next time). */
export function loadMapLibre(): Promise<MapLibreGL> {
  loading ??= new Promise<MapLibreGL>((resolve, reject) => {
    const have = (globalThis as unknown as { maplibregl?: MapLibreGL }).maplibregl;
    if (have) return resolve(have);
    if (!document.querySelector("link[data-maplibre]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = fileUrl("maplibre/maplibre-gl.css");
      css.dataset.maplibre = "";
      document.head.append(css);
    }
    const script = document.createElement("script");
    script.src = fileUrl("maplibre/maplibre-gl-csp.js");
    script.async = true;
    script.onload = () => {
      const lib = (globalThis as unknown as { maplibregl?: MapLibreGL }).maplibregl;
      if (!lib) return reject(new Error("maplibre-gl did not load"));
      lib.setWorkerUrl(fileUrl("maplibre/maplibre-gl-csp-worker.js"));
      resolve(lib);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("maplibre-gl did not load"));
    };
    document.head.append(script);
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Whether this browser can draw the map at all (MapLibre 5 needs WebGL 2). */
export function canDrawMap(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Offline: the tiles can't come (the bundled map stands in where there is one). */
export const offline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;
