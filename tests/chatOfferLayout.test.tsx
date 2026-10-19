// 0.39.1, the chat's find_offers card in a 440 px column: a stay with no price for the dates says its usual range
// ("typically €23–105 / night · no price for your dates"); that long line took the card's whole width, crushing the
// name to "The…", the label "Best for you" to three lines and "Tripadvisor" to one letter a line.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ChatOffersView } from "../src/app/ChatOffers";
import { setLang } from "../src/lib/i18n";
import type { Need, Offer } from "../src/lib/offerSource";

const need: Need = { key: "stay:2026-12-10_2027-01-10:canggu", section: "stay", kind: "stay", city: "Canggu", start: "2026-12-10", end: "2027-01-10", adults: 2 };
const typical: Offer = {
  id: "o1", kind: "stay", title: "The Kayon Valley Resort", rating: 4.1, reviews: 295, price: null, currency: "EUR", url: "https://www.tripadvisor.com/Hotel_Review-g1-d1.html",
  why: "★4.1 · 295 reviews", source: "Tripadvisor", fetchedAt: 0, pick: "best", meta: "typically €23–105 / night · no price for your dates",
};
const priced: Offer = { id: "o2", kind: "stay", title: "New Moroccan vibe 2BR", rating: 4.9, price: 2331, currency: "EUR", nights: 31, url: "https://www.airbnb.com/rooms/1", why: "The cheapest I found, ★4.9", source: "Airbnb", fetchedAt: 0, pick: "cheaper" };

afterEach(() => setLang("tr"));

describe("the chat's offer card keeps its name side", () => {
  it("the usual range sits on the price side, the label and the source on the name side", () => {
    setLang("en");
    const html = renderToStaticMarkup(<ChatOffersView offers={[typical, priced]} need={need} added={["o1"]} onAdd={() => undefined} />);
    const [first] = html.split('data-offer="o2"');
    const [main, deal] = first.split('class="co-deal"');
    expect(main).toContain('class="co-pick">Best for you<');
    expect(main).toContain(">Tripadvisor</a>");
    expect(deal).toContain('class="co-per">typically €23–105 / night · no price for your dates<');
    expect(deal).toContain("Added ✓");
  });

  it("the price side is at most 40% of the card and wraps; the label and the source stay on one line", () => {
    const css = readFileSync("static/v82/chat.css", "utf8");
    expect(css).toMatch(/@media \(min-width: 421px\) \{\s*\.chat-offer \{ grid-template-columns: minmax\(0, 1fr\) fit-content\(40%\); \}/);
    expect(css).toMatch(/\.chat-offer \.co-pick, \.chat-offer \.co-src \{ white-space: nowrap; \}/);
    // A narrow column still stacks the card (the container rule comes after, so it wins).
    expect(css.indexOf("fit-content(40%)")).toBeLessThan(css.indexOf("@container chat (max-width: 360px)"));
  });
});
