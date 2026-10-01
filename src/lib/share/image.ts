// A capture's screenshot made small enough to share (the full one stays on this computer).

/** Roughly how many bytes a base64 data URL holds. */
export const dataUrlBytes = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

const STEPS: [maxEdge: number, quality: number][] = [
  [1280, 0.7],
  [1024, 0.62],
  [800, 0.55],
  [640, 0.5],
];

/** The screenshot as a JPEG data URL of at most `maxBytes`, or null when it can't be made that small here. */
export async function shrinkScreenshot(dataUrl: string, maxBytes = 150_000): Promise<string | null> {
  if (!dataUrl.startsWith("data:image/")) return null;
  if (dataUrl.startsWith("data:image/jpeg") && dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
    for (const [maxEdge, quality] of STEPS) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (blob.size > maxBytes) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return `data:image/jpeg;base64,${btoa(binary)}`;
    }
  } catch {
    // unreadable image: shared without it
  }
  return null;
}
