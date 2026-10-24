// Benle gezen eklenti, seviye 2: the built content script (dist/companion.js) on a saved flight results page, with the
// extension's answers stubbed (a planned Bangkok ✈ İstanbul with two options in its deck). No extension, no network: it
// checks the strip, a "+" on each result and the labels, then presses one "+" and "Ekrandakileri desteye ekle".
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
console.log(JSON.stringify({ ok: true, asked: await page.evaluate(() => window.__asked.map((m) => m.type)) }));
await browser.close();
