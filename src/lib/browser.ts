// Helpers for extension pages (popup, board). Not used by the service worker.

/** Scales an image down so its long edge is at most maxEdge px (the model downsizes beyond ~1568 anyway). */
export async function downscale(dataUrl: string, maxEdge = 1568): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && blob.type === "image/jpeg") return dataUrl;
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(out);
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function requestProcessing(): void {
  chrome.runtime.sendMessage({ type: "process" }).catch(() => {
    // Worker is starting up; onStartup/onInstalled will drain the queue.
  });
}

/** Asks the worker to refresh AI reviews of comparisons; `force` retries ones that just failed. */
export function requestAnalysis(force = false): void {
  chrome.runtime.sendMessage({ type: "analyze", force }).catch(() => {
    // Worker is starting up; the next capture or board change asks again.
  });
}

/** Asks the worker to read pages not read yet (`force`: also ones that just failed), then re-judge. */
export function requestReading(force = false): void {
  chrome.runtime.sendMessage({ type: "read", force }).catch(() => {
    // Worker is starting up; its first run reads what is pending.
  });
}

/** Focuses an open board tab or opens a new one. */
export async function openBoard(hash = ""): Promise<void> {
  const base = chrome.runtime.getURL("app.html");
  const [tab] = await chrome.tabs.query({ url: `${base}*` });
  if (tab?.id != null) {
    await chrome.tabs.update(tab.id, { active: true, url: `${base}${hash}` });
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: `${base}${hash}` });
  }
}
