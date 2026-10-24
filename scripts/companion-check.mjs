// Benle gezen eklenti, seviye 2: the built content script (dist/companion.js) on a saved flight results page, with the
// extension's answers stubbed (a planned Bangkok ✈ İstanbul with two options in its deck). No extension, no network: it
// checks the strip, a "+" on each result and the labels, then presses one "+" (no "add what's on screen": one result at a
// time). Then a Skyscanner-like ticket with a screen reader's price in its times' half: the "+" goes by the whole ticket.
// Run after `npm run build`: CHROMIUM_PATH=… node scripts/companion-check.mjs → e2e-output/companion/*.png
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve("e2e-output/companion");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--headless=new"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "tr-TR" });
const URL = "https://www.skyscanner.com.tr/transport/flights/bkk/ist/270402/?adultsv2=2";
await page.route("https://www.skyscanner.com.tr/**", (r) => r.fulfill({ contentType: "text/html", body: readFileSync("tests/fixtures/companion/skyscanner-bkk-ist.html", "utf8") }));
await page.addInitScript(() => {
  window.__asked = [];
  const route = { tripId: "th", title: "Tayland", from: "Bangkok", to: "İstanbul", day: "2027-04-02", deck: [
    { name: "Turkish Airlines TK69", dep: "15:15", arr: "22:30", price: 326, currency: "EUR", stops: 0 },
    { name: "Qatar Airways QR833", dep: "20:05", arr: "06:40", price: 354, currency: "EUR", stops: 1 },
  ], chosen: { name: "Emirates EK123", dep: "09:40", arr: "19:55", price: 330, currency: "EUR", stops: 1 } };
  window.chrome = {
    runtime: { id: "x", lastError: undefined, onMessage: { addListener: () => undefined }, sendMessage: (m, cb) => (window.__asked.push(m), setTimeout(() => cb(m.type === "desk:route" ? route : m.type === "desk:seen" ? { save: 42 } : { ok: true }), 10)) },
    storage: { local: { get: async () => ({ lang: "tr" }) } },
  };
});
await page.goto(URL);
await page.addScriptTag({ path: "dist/companion.js" });
await page.waitForTimeout(1200);
const shadow = await page.evaluate(() => {
  const host = document.getElementById("trip-radar-companion");
  return host ? { strip: true } : null;
});
assert.ok(shadow, "the companion's host is on the page");
await page.screenshot({ path: `${out}/1-strip-and-plus.png` });
// (closed shadow root: what it drew is checked by its effects, the screenshot, and its questions)
const asked = await page.evaluate(() => window.__asked.map((m) => m.type));
assert.ok(asked.includes("desk:route"), "it asked which row this search is for");
// (fiyat izleme: the chosen flight seen on the page, its price there sent once)
const seen = await page.evaluate(() => window.__asked.filter((m) => m.type === "desk:seen"));
assert.equal(seen.length, 1, "the chosen flight's price on the site asked about once");
assert.equal(seen[0].price, 288);
// The "+" pins sit outside the cards, by their right edge (0.44.1): press the second card's.
const card = page.locator(".card").nth(1);
const box = await card.boundingBox();
await page.mouse.click(box.x + box.width + 10 + 15, box.y + 10 + 15);
await page.waitForTimeout(400);
const adds = await page.evaluate(() => window.__asked.filter((m) => m.type === "desk:add"));
assert.equal(adds.length, 1, "one + pressed, one result added");
assert.match(adds[0].text, /Emirates.*09:40.*19:55.*€288/, "only that result's own text goes");
await page.screenshot({ path: `${out}/2-added.png` });
// 0.47.3: Skyscanner writes "Total cost 8,480 TL" for screen readers (1 px wide) in the times' half of a ticket; that half
// isn't the card: the "+" goes by the whole ticket's right edge, never in its middle on the price.
const sr = "position:absolute;width:1px;height:24px;overflow:hidden;clip:rect(0 0 0 0)";
const ticket = (n, dep, arr, price) => `<div class="tk" style="display:flex;width:720px;height:110px;margin:16px 0;border:1px solid #ccc;border-radius:12px">
  <div class="body" style="width:500px;padding:12px;position:relative"><span style="${sr}">Flight option ${n}: Total cost ${price} TL.</span><b>Pegasus Airlines</b><div>${dep} ALC → ${arr} BJV · 9h 50 · 1 stop SAW</div></div>
  <div class="price" style="width:220px;padding:12px;border-left:1px solid #ccc"><div>9 deals from</div><b style="font-size:22px">${price} TL</b><button>Select</button></div></div>`;
const sky = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "tr-TR" });
await sky.route("https://www.skyscanner.com.tr/**", (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><html><body style="margin:0;padding:40px 200px">${ticket(1, "12:25", "00:15", "8,480")}${ticket(2, "11:45", "22:20", "12,604")}</body></html>` }));
await sky.addInitScript(() => {
  window.__asked = [];
  const route = { tripId: "a", title: "Alicante Trip", from: "Alicante", to: "Bodrum", day: "2026-10-27", deck: [], chosen: null };
  window.chrome = {
    runtime: { id: "x", lastError: undefined, onMessage: { addListener: () => undefined }, sendMessage: (m, cb) => (window.__asked.push(m), setTimeout(() => cb(m.type === "desk:route" ? route : { ok: true }), 10)) },
    storage: { local: { get: async () => ({ lang: "tr" }) } },
  };
});
await sky.goto("https://www.skyscanner.com.tr/transport/flights/alc/bjv/261027/?adultsv2=1");
await sky.addScriptTag({ path: "dist/companion.js" });
await sky.waitForTimeout(1200);
await sky.screenshot({ path: `${out}/3-hidden-price.png` });
const tk = await sky.locator(".tk").first().boundingBox();
await sky.mouse.click(tk.x + tk.width + 10 + 15, tk.y + 10 + 15);
await sky.waitForTimeout(400);
const skyAdds = await sky.evaluate(() => window.__asked.filter((m) => m.type === "desk:add"));
assert.equal(skyAdds.length, 1, "the + sits by the whole ticket's right edge");
assert.match(skyAdds[0].text, /Pegasus Airlines.*12:25.*9 deals from.*8,480 TL/, "the whole ticket goes, its visible price too");
console.log(JSON.stringify({ ok: true, asked: await page.evaluate(() => window.__asked.map((m) => m.type)) }));
await browser.close();
