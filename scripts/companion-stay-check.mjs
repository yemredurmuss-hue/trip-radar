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
    const dot = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#c9b9a3"/></svg>');
    const where = { trip: null, country: "Portekiz", saved: false, names: ["Casa Balthazar"], picks: ["pt", "ma", "bali"], trips: [
      { id: "pt", title: "Portekiz", when: "12 – 19 Kas", match: true, photos: [dot, dot, dot] },
      { id: "ma", title: "Madeira, bahar", when: "Mar 2027", match: true, photos: [] },
      { id: "bali", title: "Bali", when: "Ocak", match: false, photos: [dot] },
      { id: "dk", title: "Kopenhag ve Amsterdam", when: "8 – 18 Eki", match: false, photos: [] },
    ] };
    window.chrome = {
      runtime: { lastError: undefined, onMessage: { addListener: (f) => (window.__onMessage = f) }, sendMessage: (m, cb) => (window.__asked.push(m), setTimeout(() => cb(m.type === "desk:where" ? where : m.type === "desk:route" ? null : { ok: true, tripId: m.tripId ?? null, captureId: `c${window.__asked.length}`, reading: 2 }), 10)) },
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
const choices = await inShadow(hotel, () => {
  const r = document.getElementById("trip-radar-companion").shadowRoot;
  return { picks: [...r.querySelectorAll(".qp button b")].map((b) => b.textContent), rest: [...r.querySelectorAll(".ask .ln b")].map((b) => b.textContent), covers: r.querySelectorAll(".qp .cv img").length };
});
assert.deepEqual(choices.picks, ["Portekiz", "Madeira, bahar", "Bali"], "Önerilen: the three most likely, the country's first");
assert.deepEqual(choices.rest, ["Kopenhag ve Amsterdam", "Yeni gezi: Portekiz"], "then every other trip, then a new one");
assert.equal(choices.covers, 4, "their covers (Portekiz three photos, Bali one; Madeira its letter)");
await hotel.screenshot({ path: `${out}/stay-2-ask.png` });
await inShadow(hotel, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".qp button.best").click());
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
// Pinterest's: a small "+" on the card's top edge, "+ Ekle" while the mouse is over the card.
const card2 = list.locator(".card").nth(1);
await card2.hover({ position: { x: 300, y: 90 } });
await list.waitForTimeout(250);
const hot = await inShadow(list, () => [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin")].map((p) => p.classList.contains("hot")));
assert.deepEqual(hot, [false, true, false], "only the card under the mouse opens its +");
await list.screenshot({ path: `${out}/stay-4-list.png` });
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus")[1].click());
await list.waitForTimeout(200);
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".qp button.best").click());
await list.waitForTimeout(400);
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus")[0].click());
await list.waitForTimeout(60);
assert.equal(await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".hop").length), 1, "hop: the card's small copy flies to the icon");
await list.waitForTimeout(500);
assert.equal(await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".hop").length), 0, "and is gone once it lands");
const adds = await list.evaluate(() => window.__asked.filter((m) => m.type === "desk:add"));
assert.equal(adds.length, 2);
assert.match(adds[0].text, /Lumiares.*€ 1\.040/, "only that result's own text");
assert.equal(adds[0].tripId, "pt");
assert.equal(adds[1].tripId, undefined, "the second goes to the remembered trip, nothing asked");
const asks = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".ask"));
assert.equal(asks, null);
await list.screenshot({ path: `${out}/stay-5-added.png` });
// The note: "Değiştir" and "Geri al"; Geri al takes the last one back.
const note = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".toast")?.textContent ?? "");
assert.match(note, /Portekiz · Konaklama destesine girdi · 2 okunuyor/);
assert.match(note, /Değiştir/);
await inShadow(list, () => [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".toast button")].find((b) => b.textContent === "Geri al").click());
await list.waitForTimeout(200);
assert.equal((await list.evaluate(() => window.__asked.filter((m) => m.type === "desk:undo"))).length, 1, "Geri al asked");
const plusAfter = await inShadow(list, () => [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus")].map((b) => b.classList.contains("done")));
assert.deepEqual(plusAfter, [false, true, false], "the one taken back has its + again");
// Bu sayfadan seç (from the toolbar): ticks, then all added at once into the known trip.
await list.evaluate(() => window.__onMessage({ type: "desk:select" }));
await list.waitForTimeout(150);
const ticks = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".plus.tick").length);
assert.ok(ticks >= 1, "the results not added yet become ticks");
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".plus.tick").click());
await list.waitForTimeout(100);
await list.screenshot({ path: `${out}/stay-6-select.png` });
await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelector(".toast.sel .go").click());
await list.waitForTimeout(500);
assert.equal((await list.evaluate(() => window.__asked.filter((m) => m.type === "desk:add"))).length, 3, "the ticked one added too");
console.log(JSON.stringify({ ok: true }));
await browser.close();
