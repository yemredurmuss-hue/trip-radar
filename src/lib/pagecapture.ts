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

  return {
    url: location.href,
    title: document.title,
    pageText: (document.body?.innerText ?? "").slice(0, 200000),
    viewportText: parts.join("\n"),
    selection: String(window.getSelection() ?? "").slice(0, 5000),
    jsonLd,
    meta,
  };
}
