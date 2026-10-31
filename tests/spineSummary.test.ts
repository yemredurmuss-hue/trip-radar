// tests/spineSummary.test.ts: when the spine is drawn, the chat says it back in a few clear lines (omurga 2026-10-31,
// Emre: "senin için şöyle bir omurga hazırladım, hadi bunu yapalım; tek soruyla bitsin"): a headline, the route with its
// nights, at most two lines of what was assumed (only what the plan really did), and the question that shapes it most.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { applyAnswer, creationOf, newStart, spineSummary, type StartState } from "../src/lib/startTrip";

const japan = (over: Partial<StartState> = {}): StartState => {
  let s = applyAnswer(newStart("jp", "plan", 1, "tr"), { q: "where", place: "Japonya", country: "Japonya", code: "JP" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 9 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2027-04-01", approx: false }, 4);
  return { ...s, route: { stops: [{ city: "Tokyo", nights: 4, code: "JP" }, { city: "Kyoto", nights: 3, code: "JP" }, { city: "Osaka", nights: 2, code: "JP" }], arrive: null, leave: null, confirmed: true, source: "user" }, ...over };
};
const say = (s: StartState) => withLang("tr", () => spineSummary(creationOf(s)!, s));

describe("the spine said back", () => {
  it("headline, the route with its nights, the flights assumed, and the question that shapes it most", () => {
    const text = say(japan());
    const lines = text.split("\n").filter(Boolean);
    expect(lines[0]).toMatch(/^🇯🇵 \*\*.+\*\*$/);
    expect(text).toContain("Tokyo → **4 gece**");
    expect(text).toContain("Kyoto → **3 gece**");
    expect(text).toContain("Osaka → **2 gece**");
    expect(text).toMatch(/[Uu]çuş/);
    expect(lines.at(-1)).toBe("**Nereden yola çıkacaksın?**");
    expect(text).not.toContain("—");
  });

  it("asks for the dates first when they're not known", () => {
    const s = japan({ start: null, duration: null });
    expect(say(s).split("\n").filter(Boolean).at(-1)).toBe("**Hangi tarihlerde gitmek istiyorsun?**");
  });

  it("from known: the next open question", () => {
    expect(say(japan({ from: "İstanbul" })).split("\n").filter(Boolean).at(-1)).toBe("**Kimlerle gidiyorsun?**");
  });

  it("a road trip driven from home says so, and no flight", () => {
    const text = say(japan({ mode: "road", way: "car", from: "İstanbul" }));
    expect(text).toContain("kendi aracınla");
    expect(text).not.toMatch(/[Uu]çuş/);
  });

  it("opens with the first plan, and after the essentials asks the model's own question", () => {
    const s = japan({ from: "İstanbul", who: { kind: "partner", names: [] }, spineQuestion: "Kyoto'da bir gece ryokanda kalmak ister misin?" });
    const lines = say(s).split("\n").filter(Boolean);
    expect(lines[0]).toBe("🇯🇵 **İlk planın hazır: 10 günlük Japonya.**");
    expect(lines.at(-1)).toBe("**Kyoto'da bir gece ryokanda kalmak ister misin?**");
  });

  it("the model's question waits for the dates and where from", () => {
    expect(say(japan({ spineQuestion: "Kyoto'da bir gece ryokanda kalmak ister misin?" })).split("\n").filter(Boolean).at(-1)).toBe("**Nereden yola çıkacaksın?**");
  });

  it("in English too", () => {
    const s = japan();
    const text = withLang("en", () => spineSummary(creationOf(s)!, s));
    expect(text).toContain("Tokyo → **4 nights**");
    expect(text.split("\n").filter(Boolean).at(-1)).toBe("**Where are you leaving from?**");
  });
});
