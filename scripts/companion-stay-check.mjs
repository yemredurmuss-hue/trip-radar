// Benle gezen eklenti, 0.41.0–0.44.0: the built content script on a Booking hotel's own page (the gezi cebi on the right
// edge: "+ Konaklama destesine ekle") and on a Booking list (a "+" on each result, "Sonuçlardan seç" in the pocket), with
// the extension's answers stubbed. The first add asks which trip here on the page (Hangi gezi); picked with "hep buraya
// koy", the next "+" goes there without asking. The pocket's rows: × and tekrar. After an update: "sayfayı yenile".
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
    const pocket = { trip: { id: "pt", title: "Portekiz", when: "12 – 19 Kas", count: 7, decks: { stay: 4, flight: 2, activity: 1 }, photo: dot }, key: false, waiting: 2, rows: [
      { id: "c:r", title: "Lumiares Hotel", sub: "Booking.com", photo: null, state: "reading" },
      { id: "c:f", title: "Casa do Bairro", sub: "Airbnb", photo: null, state: "failed" },
      { id: "i:a", title: "Memmo Príncipe Real", sub: "Konaklama", photo: dot, state: "in" },
    ] };
    const answer = (m) => (m.type === "desk:where" ? where : m.type === "desk:route" ? null : m.type === "desk:pocket" ? pocket : { ok: true, tripId: m.tripId ?? null, captureId: `c${window.__asked.length}`, reading: 2 });
    window.chrome = {
      runtime: { id: "x", lastError: undefined, onMessage: { addListener: (f) => (window.__onMessage = f) }, sendMessage: (m, cb) => (window.__asked.push(m), setTimeout(() => cb(answer(m)), 10)) },
      storage: { local: { get: async () => ({ lang: "tr" }), set: async () => undefined } },
    };
  });
  await page.goto(url);
  await page.addScriptTag({ path: "dist/companion.js" });
  await page.waitForTimeout(1200);
  return page;
}
const inShadow = (page, fn) => page.evaluate(fn);

// 1. A hotel's own page: the pocket's tab on the edge (the trip, its count, a "+"); open: this page, what was added last.
const hotel = await open("https://www.booking.com/hotel/pt/memmo-alfama.html?checkin=2026-11-12&checkout=2026-11-16", "booking-hotel.html");
const shadow = (page, fn) => page.evaluate(`(${fn})(document.getElementById("trip-radar-companion").shadowRoot)`);
assert.equal(await shadow(hotel, (r) => r.querySelector(".pill")), null, "no bottom-right pill any more");
assert.equal(await shadow(hotel, (r) => r.querySelector(".tab")?.textContent), "4otel+", "the tab: the trip's hotels on a hotel site, and a + on a place's own page");
await hotel.screenshot({ path: `${out}/stay-1-tab.png` });
await shadow(hotel, (r) => r.querySelector(".tab").click());
await hotel.waitForTimeout(150);
const cep = await shadow(hotel, (r) => r.querySelector(".cep")?.innerText ?? "");
// 0.44.2 (sade): the trip and one number, one button, the last three by name (a state only when not fine), the board.
assert.match(cep, /^Portekiz\n4 otel[\s\S]*\+ Konaklama destesine ekle\nSon eklenenler\n[\s\S]*Lumiares Hotel[\s\S]*okunuyor[\s\S]*Casa do Bairro[\s\S]*okunamadı[\s\S]*tekrar[\s\S]*Memmo Príncipe Real[\s\S]*AI bağlı değil · 2 kayıt bekliyor\nPanoyu aç ↗[\s\S]*Bu sitede gösterme/);
assert.doesNotMatch(cep, /destede|Bu sayfa|Booking\.com|Airbnb/, "no state on a fine one, no page line, no source line");
await hotel.screenshot({ path: `${out}/stay-1-pocket.png` });
await shadow(hotel, (r) => [...r.querySelectorAll(".cep .lnk")].find((b) => b.textContent === "tekrar").click());
await shadow(hotel, (r) => r.querySelector('.cep .x[aria-label="Lumiares Hotel kaldır"]').click());
await hotel.waitForTimeout(100);
assert.deepEqual(await hotel.evaluate(() => window.__asked.filter((m) => m.type === "desk:retry" || m.type === "desk:remove").map((m) => [m.type, m.id])), [["desk:retry", "c:f"], ["desk:remove", "c:r"]]);
await hotel.waitForTimeout(100);
// "+ Konaklama destesine ekle": asked which trip (the pocket steps aside), sent whole into the picked trip.
await shadow(hotel, (r) => r.querySelector(".cep .go").click());
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
assert.equal(await shadow(hotel, (r) => r.querySelector(".tab .add")), null, "added: the tab's + goes");
await hotel.screenshot({ path: `${out}/stay-3-done.png` });
// An update while the page was open: the old script is cut off; a press says so, never breaks in silence.
await hotel.evaluate(() => (window.chrome.runtime.id = undefined));
await shadow(hotel, (r) => r.querySelector(".tab").click());
await hotel.waitForTimeout(100);
assert.match(await shadow(hotel, (r) => r.querySelector(".toast")?.textContent ?? ""), /Trip Radar yenilendi; bu sayfayı yenileyince \+ geri gelir\.Sayfayı yenile/);
assert.equal(await shadow(hotel, (r) => r.querySelector(".tab, .cep")), null, "its old pocket goes");
await hotel.screenshot({ path: `${out}/stay-3b-stale.png` });

// 2. A list: a "+" on each result, "Destende var" on the deck's own; the first asks, the second goes without asking.
const list = await open("https://www.booking.com/searchresults.html?ss=Lisbon&checkin=2026-11-12&checkout=2026-11-16", "booking-list.html");
const pins = await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .plus").length);
assert.equal(pins, 3, "a + on each of the three results");
const tags = await inShadow(list, () => [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin .tag")].map((t) => t.textContent));
assert.deepEqual(tags, ["Destende var"], "Casa Balthazar is in the deck");
// The pocket on a list: "Sonuçlardan seç", never the whole list as one record.
await shadow(list, (r) => r.querySelector(".tab").click());
await list.waitForTimeout(100);
assert.match(await shadow(list, (r) => r.querySelector(".cep .bd").innerText), /^Sonuçlardan seç\n/);
assert.equal(await shadow(list, (r) => [...r.querySelectorAll(".cep .go")].some((b) => /destesine ekle/.test(b.textContent))), false);
await list.screenshot({ path: `${out}/stay-4a-pocket.png` });
await list.keyboard.press("Escape");
await list.waitForTimeout(50);
assert.equal(await shadow(list, (r) => r.querySelector(".cep")), null, "Escape closes it");
// 0.44.1: each "+" outside its card by the right edge (nothing of the result covered), fixed to the page: scrolling moves
// it with its card, never after it.
const gap = () => list.evaluate(() => {
  const pins = [...document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".pin")].map((p) => p.getBoundingClientRect());
  return [...document.querySelectorAll(".card")].slice(0, 3).map((c, i) => { const r = c.getBoundingClientRect(); return [Math.round(pins[i].left - r.right), Math.round(pins[i].top - r.top)]; });
});
const before = await gap();
assert.ok(before.every(([dx]) => dx >= 8), `outside the card's right edge: ${JSON.stringify(before)}`);
await list.evaluate(() => ((document.body.style.paddingBottom = "1600px"), window.scrollBy(0, 120)));
assert.equal(await list.evaluate(() => scrollY), 120);
assert.deepEqual(await gap(), before, "scrolled at once with its card (no frame behind)");
await list.evaluate(() => window.scrollTo(0, 0));
// Pinterest's: a small "+" by the card, "+ Ekle" while the mouse is over the card.
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
assert.equal(await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".hop").length), 1, "hop: the card's small copy flies to the pocket");
await list.waitForTimeout(500);
assert.equal(await inShadow(list, () => document.getElementById("trip-radar-companion").shadowRoot.querySelectorAll(".hop").length), 0, "and is gone once it lands");
const adds = await list.evaluate(() => window.__asked.filter((m) => m.type === "desk:add"));
assert.equal(adds.length, 2);
assert.match(adds[0].text, /Lumiares.*€ 1\.040/, "only that result's own text");
assert.equal(adds[0].tripId, "pt");
assert.equal(adds[1].tripId, "pt", "the second goes to the trip on the pocket's top, nothing asked");
assert.notEqual(adds[1].remember, true);
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
