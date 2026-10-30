// Rezervasyonu her sitede fark etme (Emre onayladı 2026-10-30; deneme: Chrome 148, declarativeContent uyarısız, kendiliğinden
// açılan pencere sayfayı okuyamıyor): on any site, a tab whose address looks like a booking's confirmation turns the
// toolbar icon green with a ✓. Chrome matches the address itself (CONFIRM_URL, lib/confirm.ts) and tells us nothing: no
// page is read, no address leaves the browser, no permission warning. The traveller's own press on the icon then opens
// the popup, which reads that page (activeTab) and finds the code as it always did.
import { CONFIRM_URL } from "./confirm";

/** The icon with a green ✓ in its corner, at the toolbar's two sizes. */
async function markedIcon(): Promise<Record<string, ImageData>> {
  const out: Record<string, ImageData> = {};
  for (const size of [16, 32]) {
    const bmp = await createImageBitmap(await (await fetch(chrome.runtime.getURL(`icons/icon-${size}.png`))).blob());
    const canvas = new OffscreenCanvas(size, size);
    const c = canvas.getContext("2d")!;
    c.drawImage(bmp, 0, 0, size, size);
    const r = size * 0.3, x = size - r, y = size - r;
    c.fillStyle = "#1f7a45";
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = Math.max(1.5, size / 11);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(x - r * 0.5, y + r * 0.02);
    c.lineTo(x - r * 0.12, y + r * 0.4);
    c.lineTo(x + r * 0.52, y - r * 0.36);
    c.stroke();
    out[String(size)] = c.getImageData(0, 0, size, size);
  }
  return out;
}

/** The rule set once (Chrome keeps it across restarts); made again on each install and update. */
export async function markConfirmPages(): Promise<void> {
  const dc = chrome.declarativeContent;
  if (!dc?.onPageChanged) return;
  const imageData = await markedIcon().catch(() => null);
  if (!imageData) return;
  await new Promise<void>((done) => dc.onPageChanged.removeRules(undefined, () => done()));
  await new Promise<void>((done) =>
    dc.onPageChanged.addRules([{ id: "confirm-page", conditions: [new dc.PageStateMatcher({ pageUrl: { urlMatches: CONFIRM_URL } })], actions: [new dc.SetIcon({ imageData })] }], () => done()),
  );
}
