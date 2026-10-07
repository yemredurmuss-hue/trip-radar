// A PDF file made of page pictures (the printed plan, PrintPlan.tsx): each page one JPEG laid over a whole A4 page.
// Small on purpose, no library: a catalog, the page tree, and per page its picture and the one line that draws it.
// Pure: the pictures in, the file's bytes out.

export interface PdfPage {
  /** The page's picture, a JPEG file's bytes. */
  jpeg: Uint8Array;
  /** Its size in pixels. */
  width: number;
  height: number;
}

/** A4 in PDF points (1/72 inch). */
export const A4 = { width: 595.28, height: 841.89 };

const encoder = new TextEncoder();

/** The PDF: every page's picture filling an A4 page, in order. */
export function jpegPagesToPdf(pages: PdfPage[], size = A4): Uint8Array {
  if (!pages.length) throw new Error("no pages");
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  // Object numbers: 1 catalog, 2 pages, then per page: page, its drawing, its picture.
  const pageObj = (i: number) => 3 + i * 3;
  const object = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };
  push("%PDF-1.4\n%âãÏÓ\n");
  object(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  const w = size.width.toFixed(2);
  const h = size.height.toFixed(2);
  pages.forEach((page, i) => {
    const n = pageObj(i);
    object(n, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /P${i} ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`));
    const draw = `q ${w} 0 0 ${h} 0 0 cm /P${i} Do Q`;
    object(n + 1, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    object(n + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
      push(page.jpeg);
      push("\nendstream");
    });
  });
  const count = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/**
 * Where the pages break: from the blocks' tops and bottoms (a day, a booking's row, the hero), each page as much as
 * fits; a block is never cut unless it alone is taller than a page. In the same units as the heights.
 */
export function pageBreaks(blocks: { top: number; bottom: number }[], total: number, pageHeight: number): { start: number; end: number }[] {
  const sorted = [...blocks].sort((a, b) => a.top - b.top);
  const pages: { start: number; end: number }[] = [];
  let start = 0;
  while (start < total - 0.5) {
    const limit = start + pageHeight;
    if (limit >= total) {
      pages.push({ start, end: total });
      break;
    }
    // The last block boundary that fits: the bottom of a block ending in the page, or the top of the first that doesn't.
    let end = start;
    for (const b of sorted) {
      if (b.bottom <= limit && b.bottom > end) end = b.bottom;
      if (b.top > start && b.top <= limit && b.bottom > limit && b.top > end) end = b.top;
    }
    if (end <= start) end = limit;
    pages.push({ start, end });
    start = end;
  }
  return pages;
}
