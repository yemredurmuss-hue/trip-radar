// 0.39.4 (Emre: the visa line asked "Pasaportun hangi ülke?" while Settings showed Türkiye): the passport field shows the
// passport the visa rules use, so one never chosen reads "Seçilmedi"; it lives in Profilim, and the visa line asks the same list.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PASSPORTS, PassportSelect } from "../src/app/PassportField";
import { ProfileSettings } from "../src/app/Profile";
import { VisaRow } from "../src/app/plan/VisaRow";
import { loadHome, savePassport } from "../src/lib/passport";
import { visaFor } from "../src/lib/visa";

function fakeChrome(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    store,
    chrome: { storage: { local: { get: async (key: string) => (key in store ? { [key]: store[key] } : {}), set: async (v: Record<string, unknown>) => void Object.assign(store, v) } } },
  };
}
afterEach(() => vi.unstubAllGlobals());

const selected = (html: string) => html.match(/<option[^>]*selected[^>]*>([^<]*)</)?.[1] ?? null;

describe("the passport shown is the passport used", () => {
  it("none saved: the visa rules know none and the field says Seçilmedi, not Türkiye", async () => {
    vi.stubGlobal("chrome", fakeChrome().chrome);
    const home = await loadHome();
    expect(home).toBeNull();
    expect(visaFor(home, "IN").ask).toBe(true);
    expect(selected(renderToStaticMarkup(<PassportSelect value={home} onPick={() => {}} />))).toBe("Seçilmedi");
  });
  it("chosen once (in Profilim or the visa line): the field and the visa rules both have it", async () => {
    const fake = fakeChrome();
    vi.stubGlobal("chrome", fake.chrome);
    await savePassport("tr");
    const home = await loadHome();
    expect(home).toBe("TR");
    expect(visaFor(home, "IN").ask).toBeUndefined();
    expect(selected(renderToStaticMarkup(<PassportSelect value={home} onPick={() => {}} />))).toBe("Türkiye");
  });
  it("Profilim has the passport field; the visa line's question lists the same passports", () => {
    expect(renderToStaticMarkup(<ProfileSettings />)).toContain("Pasaport");
    const html = renderToStaticMarkup(<VisaRow visa={visaFor(null, "IN")} done={false} onDone={() => {}} />);
    for (const [, name] of PASSPORTS) expect(html).toContain(`>${name()}<`);
  });
});
