// 0.39.1 (Emre, Bali on a Turkish passport): Belgeler's visa line says the answer instead of "Check the official source",
// with the official page small beside it and "Var" / "Yok" to mark it; "Var" turns it green "Vize tamam".
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VisaRow } from "../src/app/plan/VisaRow";
import { visaFor } from "../src/lib/visa";

vi.mock("../src/lib/passport", () => ({ savePassport: vi.fn() }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("the visa line", () => {
  it("TR passport to Indonesia: the answer, the source, Var / Yok (Yok chosen)", () => {
    const html = renderToStaticMarkup(<VisaRow visa={visaFor("TR", "ID")} done={false} onDone={() => {}} />);
    expect(text(html)).toBe("! Varışta vize ya da e-VOA 30 güne kadar · ücretli Resmî kaynak ↗ Var Yok");
    expect(html).toContain('class="z-visa need"');
    expect(html).toContain('href="https://evisa.imigrasi.go.id/"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>Var/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Yok/);
  });
  it("marked: green 'Vize tamam', Var chosen", () => {
    const html = renderToStaticMarkup(<VisaRow visa={visaFor("TR", "ID")} done onDone={() => {}} />);
    expect(text(html)).toBe("Vize tamam Varışta vize ya da e-VOA Resmî kaynak ↗ Var Yok");
    expect(html).toContain('class="z-visa ok"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Var/);
  });
  it("a pair the table doesn't know: the official source line stays, still markable", () => {
    expect(text(renderToStaticMarkup(<VisaRow visa={visaFor("TR", "ZZ")} done={false} onDone={() => {}} />))).toBe("! Vize Resmi kaynağa bak Resmî kaynak ↗ Var Yok");
  });
  it("no passport known: asks which", () => {
    const html = renderToStaticMarkup(<VisaRow visa={visaFor(null, "ID")} done={false} onDone={() => {}} />);
    expect(html).toContain("Pasaportun hangi ülke?");
    expect(html).toContain('<select class="z-vpass"');
  });
  it("at home: no line", () => {
    expect(renderToStaticMarkup(<VisaRow visa={visaFor("TR", "TR")} done={false} onDone={() => {}} />)).toBe("");
  });
});
