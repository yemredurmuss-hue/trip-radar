// Partner links (src/lib/affiliate.ts): a partner brand's page goes through Travelpayouts when clicked; a private
// page, another brand or a link already turned goes as it is.
import { describe, expect, it } from "vitest";
import { installPartnerLinks, partnerUrl } from "../src/lib/affiliate";

const parts = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("partner links", () => {
  it("turns a partner brand's page, subdomains too, the page kept whole", () => {
    const page = "https://www.booking.com/searchresults.html?ss=Ubud&checkin=2026-11-12&group_adults=2";
    const turned = partnerUrl(page);
    expect(turned.startsWith("https://tp.media/r?")).toBe(true);
    expect(parts(turned)).toEqual({ campaign_id: "84", marker: "281838", p: "2076", sub_id: "tripradar", trs: "34810", u: page });
    expect(parts(partnerUrl("https://tr.trip.com/hotels/list?city=1")).campaign_id).toBe("121");
    expect(parts(partnerUrl("https://www.getyourguide.com/s/?q=Porto")).campaign_id).toBe("108");
    expect(parts(partnerUrl("https://www.kiwi.com/en/search/results/porto/lisbon")).campaign_id).toBe("111");
  });

  it("leaves other brands, look-alike hosts, partner links and non-web links as they are", () => {
    for (const url of [
      "https://www.airbnb.com/rooms/1",
      "https://www.skyscanner.net/transport/flights/ist/opo/",
      "https://www.google.com/travel/flights?q=x",
      "https://notbooking.com/x",
      "https://tp.media/r?campaign_id=84&u=x",
      // the project's own Viator / GetYourGuide partner pages keep their code
      "https://www.viator.com/tours/Ubud/x/d5467-7626P305?mcid=42383&pid=P00324133&medium=api",
      "https://www.getyourguide.com/ubud-l1234/?partner_id=ABC123",
      "mailto:a@b.c",
      "not a url",
    ]) expect(partnerUrl(url)).toBe(url);
  });

  it("never sends a page that may carry the traveller's own booking or account", () => {
    for (const url of [
      "https://secure.booking.com/myreservations.html?bn=123456&pincode=1234",
      "https://www.booking.com/confirmation.html?aid=1",
      "https://www.agoda.com/account/bookings",
      "https://www.getyourguide.com/customer/ticket/abc",
      "https://www.trip.com/order/detail?orderId=9",
      "https://www.aviasales.com/search/IST1011OPO1?email=a@b.c",
      "https://www.expedia.com/trips/123",
    ]) expect(partnerUrl(url)).toBe(url);
  });

  it("turns a link just before it's followed, on a click or a middle click", () => {
    const listeners: Record<string, (e: Event) => void> = {};
    const doc = { addEventListener: (t: string, f: (e: Event) => void) => (listeners[t] = f), removeEventListener: () => {} } as unknown as Document;
    installPartnerLinks(doc);
    const a = { href: "https://www.viator.com/searchResults/all?text=Porto" } as HTMLAnchorElement;
    const target = { closest: () => a } as unknown as Element;
    listeners.click({ target } as unknown as Event);
    expect(parts(a.href).campaign_id).toBe("47");
    const again = a.href;
    listeners.auxclick({ target } as unknown as Event);
    expect(a.href).toBe(again);
  });
});
