// Runs inside the visited page via chrome.scripting.executeScript. Must stay self-contained:
// no imports and no references to outer variables (Chrome serializes only the function body).

export interface PageSnapshot {
  url: string;
  title: string;
  pageText: string;
  viewportText: string;
  selection: string;
  jsonLd: string[];
  meta: Record<string, string>;
  coords: { lat: number; lng: number; source: string }[];
  /** Photos on the page, the ones in view first: the option's own picture is usually among them. */
  images?: { src: string; alt: string; inView: boolean }[];
}

export function collectPage(): PageSnapshot {
  const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent ?? "")
    .filter((t) => t.trim().length > 0)
    .slice(0, 20);

  const meta: Record<string, string> = {};
  document.querySelectorAll("meta[property], meta[name]").forEach((m) => {
    const key = m.getAttribute("property") ?? m.getAttribute("name") ?? "";
    const value = m.getAttribute("content");
    if (value && /^(og:|twitter:|description$)/.test(key)) meta[key] = value.slice(0, 1000);
  });

  // Text the user is looking at (viewport plus half a screen around it): tells the model which
  // room / fare the user meant when a page lists many.
  const margin = window.innerHeight / 2;
  const top = -margin;
  const bottom = window.innerHeight + margin;
  const parts: string[] = [];
  let length = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node && length < 12000; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (!text) continue;
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom < top || rect.top > bottom) continue;
    parts.push(text);
    length += text.length + 1;
  }

  // Coordinates from generic markup (no site-specific code): map links, data attributes, meta tags.
  const coords: { lat: number; lng: number; source: string }[] = [];
  const addCoord = (lat: number, lng: number, source: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    if (lat === 0 && lng === 0) return;
    if (coords.length < 10 && !coords.some((c) => c.lat === lat && c.lng === lng)) coords.push({ lat, lng, source });
  };
  const PAIR = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/;
  const latMeta = document.querySelector('meta[property$="latitude"], meta[name$="latitude"]')?.getAttribute("content");
  const lngMeta = document.querySelector('meta[property$="longitude"], meta[name$="longitude"]')?.getAttribute("content");
  if (latMeta && lngMeta) addCoord(Number(latMeta), Number(lngMeta), "meta");
  for (const attr of ["data-atlas-latlng", "data-latlng", "data-coordinates", "data-location"]) {
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
      const m = el.getAttribute(attr)?.match(PAIR);
      if (m) addCoord(Number(m[1]), Number(m[2]), attr);
    });
  }
  document.querySelectorAll("[data-lat][data-lng], [data-latitude][data-longitude]").forEach((el) => {
    const lat = el.getAttribute("data-lat") ?? el.getAttribute("data-latitude");
    const lng = el.getAttribute("data-lng") ?? el.getAttribute("data-longitude");
    addCoord(Number(lat), Number(lng), "data-lat");
  });
  document.querySelectorAll("a[href*='map'], iframe[src*='map'], img[src*='map']").forEach((el) => {
    const url = el.getAttribute("href") ?? el.getAttribute("src") ?? "";
    const m =
      url.match(/@(-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})/) ??
      url.match(/[?&](?:ll|center|q|query|destination|markers|daddr)=(?:[^&]*?[|:])?(-?\d{1,2}\.\d{3,})(?:,|%2C)(-?\d{1,3}\.\d{3,})/i);
    if (m) addCoord(Number(m[1]), Number(m[2]), "map-link");
  });

  // Photos (not icons, logos or maps), largest in view first: the extractor picks the option's own.
  const images: { src: string; alt: string; inView: boolean; area: number }[] = [];
  document.querySelectorAll("img").forEach((img) => {
    const src = img.currentSrc || img.src;
    if (!/^https?:/.test(src) || /(logo|icon|sprite|avatar|map|pixel|badge)/i.test(src)) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 80 || (img.naturalWidth && img.naturalWidth < 160)) return;
    const inView = rect.bottom > 0 && rect.top < window.innerHeight;
    if (!images.some((x) => x.src === src)) images.push({ src: src.slice(0, 600), alt: (img.alt || "").slice(0, 120), inView, area: rect.width * rect.height });
  });
  images.sort((a, b) => Number(b.inView) - Number(a.inView) || b.area - a.area);

  return {
    coords,
    images: images.slice(0, 8).map(({ src, alt, inView }) => ({ src, alt, inView })),
    url: location.href,
    title: document.title,
    pageText: (document.body?.innerText ?? "").slice(0, 200000),
    viewportText: parts.join("\n"),
    selection: String(window.getSelection() ?? "").slice(0, 5000),
    jsonLd,
    meta,
  };
}
