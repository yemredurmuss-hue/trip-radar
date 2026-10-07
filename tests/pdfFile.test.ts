// The plan's PDF file (pdfFile.ts): page pictures into a valid PDF, and pages broken between blocks, never inside one.
import { describe, expect, it } from "vitest";
import { jpegPagesToPdf, pageBreaks } from "../src/lib/pdfFile";

const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("jpegPagesToPdf", () => {
  it("one picture per A4 page, with a cross-reference table that points at each object", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const pdf = jpegPagesToPdf([
      { jpeg, width: 10, height: 14 },
      { jpeg, width: 10, height: 14 },
    ]);
    const s = text(pdf);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Type /Pages /Kids [3 0 R 6 0 R] /Count 2");
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(2);
    // Every object's offset in the table is where it starts.
    const xrefAt = Number(s.match(/startxref\n(\d+)/)![1]);
    const rows = s.slice(xrefAt).split("\n").slice(3, 3 + 8);
    rows.forEach((row, i) => expect(s.slice(Number(row.slice(0, 10)), Number(row.slice(0, 10)) + 8)).toBe(`${i + 1} 0 obj\n`));
  });

  it("refuses no pages", () => {
    expect(() => jpegPagesToPdf([])).toThrow();
  });
});

describe("pageBreaks", () => {
  it("breaks between blocks; a block taller than a page is cut", () => {
    const blocks = [
      { top: 0, bottom: 400 }, // the hero
      { top: 420, bottom: 700 }, // day 1
      { top: 720, bottom: 1100 }, // day 2: doesn't fit on page 1
      { top: 1120, bottom: 3400 }, // a day taller than a page
    ];
    // A page ends where the next block starts, so the next page never begins with blank space.
    expect(pageBreaks(blocks, 3400, 1000)).toEqual([
      { start: 0, end: 720 },
      { start: 720, end: 1120 },
      { start: 1120, end: 2120 },
      { start: 2120, end: 3120 },
      { start: 3120, end: 3400 },
    ]);
    expect(pageBreaks([{ top: 0, bottom: 300 }], 300, 1000)).toEqual([{ start: 0, end: 300 }]);
  });
});
