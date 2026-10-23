// Benle gezen eklenti, 0.41.0: the built content script on a Booking hotel's own page ("Desteye ekle" at the bottom
// right) and on a Booking list (a "+" on each result), with the extension's answers stubbed. The first add asks which
// trip here on the page (Hangi gezi); picked with "hep buraya koy", the next "+" goes there without asking.
// Run after `npm run build`: CHROMIUM_PATH=… node scripts/companion-stay-check.mjs → e2e-output/companion/stay-*.png
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve("e2e-output/companion");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--headless=new"] });

async function open(url, fixture) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, locale: "tr-TR" });
  await page.route("https://www.booking.com/**", (r) => r.fulfill({ contentType: "text/html", body: readFileSync(`tests/fixtures/companion/${fixture}`, "utf8") }));
  await page.addInitScript(() => {
    // (the check opens the companion's shadow root to press its buttons; the extension's own is closed)
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return attach.call(this, { ...o, mode: "open" }); };
    window.__asked = [];
    const where = { trip: null, country: "Portekiz", saved: false, names: ["Casa Balthazar"], trips: [
      { id: "pt", title: "Portekiz", when: "12 – 19 Kas", match: true },
      { id: "bali", title: "Bali", when: "Ocak", match: false },
    ] };
    window.chrome = {
      runtime: { lastError: undefined, sendMessage: (m, cb) => (window.__asked.push(m), setTimeout(() => cb(m.type === "desk:where" ? where : m.type === "desk:route" ? null : { ok: true, tripId: m.tripId ?? null }), 10)) },
      storage: { local: { get: async () => ({ lang: "tr" }), set: async () => undefined } },
    };
  });
  await page.goto(url);
  await page.addScriptTag({ path: "dist/companion.js" });
  await page.waitForTimeout(1200);
  return page;
}
const inShadow = (page, fn) => page.evaluate(fn);

// 1. A hotel's own page: "Desteye ekle", asked which trip, sent whole into the picked trip.
const hotel = await open("https://www.booking.com/hotel/pt/memmo-alfama.html?checkin=2026-11-12&checkout=2026-11-16", "booking-hotel.html");
const pill = await inShadow(hotel, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".pill button")?.textContent);
assert.match(pill ?? "", /Desteye ekle/, "the hotel's page has its Desteye ekle");
await hotel.screenshot({ path: `${out}/stay-1-pill.png` });
await inShadow(hotel, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".pill button").click());
await hotel.waitForTimeout(200);
const choices = await inShadow(hotel, () => [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".ask button.t")].map((b) => b.firstChild.textContent));
assert.deepEqual(choices, ["Portekiz", "Bali", "+ Yeni gezi: Portekiz"], "the country's trip first, the others, a new one");
await hotel.screenshot({ path: `${out}/stay-2-ask.png` });
await inShadow(hotel, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".ask button.t.best").click());
await hotel.waitForTimeout(300);
const page = await hotel.evaluate(() => window.__asked.find((m) => m.type === "desk:page"));
assert.equal(page.tripId, "pt");
assert.equal(page.remember, true, "kept as Portugal's trip");
assert.match(page.snapshot.pageText, /Memmo Alfama/, "the whole page goes, as the toolbar's save");
const done = await inShadow(hotel, () => document.getElementById("trip-radar-companion").shadowRoot.textContent);
assert.match(done, /Portekiz · Konaklama destesine girdi/);
await hotel.screenshot({ path: `${out}/stay-3-done.png` });

// 2. A list: a "+" on each result, "Destende var" on the deck's own; the first asks, the second goes without asking.
const list = await open("https://www.booking.com/searchresults.html?ss=Lisbon&checkin=2026-11-12&checkout=2026-11-16", "booking-list.html");
const pins = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus").length);
assert.equal(pins, 3, "a + on each of the three results");
const tags = await inShadow(list, () => [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .tag")].map((t) => t.textContent));
assert.deepEqual(tags, ["Destende var"], "Casa Balthazar is in the deck");
const noPill = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".pill"));
assert.equal(noPill, null, "a list has no Desteye ekle");
await list.screenshot({ path: `${out}/stay-4-list.png` });
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus")[1].click());
await list.waitForTimeout(200);
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".ask button.t.best").click());
await list.waitForTimeout(400);
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus")[0].click());
await list.waitForTimeout(400);
const adds = await list.evaluate(() => window.__asked.filter((m) => m.type === "desk:add"));
assert.equal(adds.length, 2);
assert.match(adds[0].text, /Lumiares.*€ 1\.040/, "only that result's own text");
assert.equal(adds[0].tripId, "pt");
assert.equal(adds[1].tripId, undefined, "the second goes to the remembered trip, nothing asked");
const asks = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".ask"));
assert.equal(asks, null);
await list.screenshot({ path: `${out}/stay-5-added.png` });
console.log(JSON.stringify({ ok: true }));
await browser.close();
