// Simgeye basınca (0.43.0) and the gezi cebi (0.44.0): the built popup (dist/popup.html) with the service worker's answers stubbed. It opens at
// once and saves nothing by itself; a known trip: one press (or Enter) adds; a new country: the picker, a press saves;
// already on the plan: "Fiyatı yenile"; then "✓ Eklendi · Değiştir · Geri al". The pocket: the trip on top, what was added
// last with ×/tekrar, the key line, a list's "Sonuçlardan seç", a page that can't be added. Run after `npm run build`:
// CHROMIUM_PATH=… node scripts/popup-check.mjs → e2e-output/popup/*.png
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve("e2e-output/popup");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--headless=new"] });
const dot = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#c9b9a3"/></svg>');
const trips = [
  { id: "pt", title: "Portekiz", when: "12 – 19 Kas", match: true, photos: [dot, dot, dot] },
  { id: "bali", title: "Bali", when: "Ocak", match: false, photos: [dot] },
  { id: "dk", title: "Kopenhag ve Amsterdam", when: "8 – 18 Eki", match: false, photos: [] },
];
const VERSION = JSON.parse(readFileSync("dist/manifest.json", "utf8")).version;
const pocket = {
  trip: { id: "pt", title: "Portekiz", when: "12 – 19 Kas", count: 12, photo: dot },
  rows: [
    { id: "c:r", title: "Lumiares Hotel", sub: "Booking.com", photo: null, state: "reading" },
    { id: "c:f", title: "Casa do Bairro", sub: "Airbnb", photo: null, state: "failed" },
    { id: "i:a", title: "Memmo Príncipe Real", sub: "Konaklama", photo: dot, state: "in" },
  ],
  waiting: 0,
  key: true,
};
const view = (where, extra = {}) => ({ kind: "page", title: "Memmo Alfama Hotel", sub: "Booking.com · konaklama · 12 – 16 Kas", site: "https://www.booking.com/*", travelSite: true, along: true, what: "stay", where, desk: { candidate: null, planned: null }, key: true, price: null, pocket, ...extra });
const answer = (v, m) =>
  m.type === "popup:view" ? v : m.type === "popup:save" ? { captureId: "c1", tripId: m.pick?.tripId ?? "pt", tripTitle: m.pick?.tripId === "bali" ? "Bali" : "Portekiz", deck: "Konaklama" } : m.type === "popup:pocket" ? v.pocket : m.type === "popup:move" ? { tripId: m.pick.tripId, tripTitle: "Bali" } : true;

async function open(v, name) {
  const page = await browser.newPage({ viewport: { width: 360, height: 620 }, locale: "tr-TR" });
  await page.addInitScript(([v, version, answerSrc]) => {
    const answer = eval(answerSrc);
    window.__asked = [];
    window.close = () => (window.__closed = true);
    const realFetch = window.fetch;
    window.fetch = (u, o) => (String(u).startsWith("chrome-extension://") ? Promise.resolve(new Response('{"version":"0.43.0"}')) : realFetch(u, o));
    window.chrome = {
      runtime: { lastError: undefined, getURL: (p) => `chrome-extension://x/${p}`, getManifest: () => ({ version }), sendMessage: (m, cb = () => undefined) => (window.__asked.push(m), setTimeout(() => cb(answer(v, m)), 30)) },
      tabs: { query: async () => [{ id: 7 }], sendMessage: async (_id, m) => void window.__asked.push({ tab: true, ...m }), create: async () => undefined, update: async () => undefined },
      scripting: { executeScript: async () => [] },
      storage: { local: { get: async () => ({ lang: "tr" }), set: async () => undefined, remove: async () => undefined } },
      permissions: { contains: async () => v.along, request: async () => true, remove: async () => true },
      action: { setBadgeText: async () => undefined },
    };
  }, [v, VERSION, answer.toString()]);
  await page.route("https://popup.test/**", (r) => {
    const f = new URL(r.request().url()).pathname.slice(1);
    const type = f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html";
    return r.fulfill({ contentType: type, body: readFileSync(path.join("dist", f)) });
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("https://popup.test/popup.html");
  await page.locator(".pk2").waitFor();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
  return page;
}

// 1. The trip known: nothing saved on open; Enter adds; "✓ Eklendi · Geri al", it closes itself.
let p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: ["pt", "bali"], saved: false, names: [] }), "1-known");
assert.equal((await p.evaluate(() => window.__asked.filter((m) => m.type === "popup:save"))).length, 0, "opening saves nothing");
assert.match(await p.locator(".cep-trip").innerText(), /Portekiz[\s\S]*12 – 19 Kas · 12 kayıt/);
assert.match(await p.locator(".pk-go").innerText(), /\+ Konaklama destesine ekle/);
assert.equal(await p.locator(".cep-row").count(), 3, "what was added last");
assert.match(await p.locator(".cep-foot").innerText(), /Portekiz panosunu aç/);
await p.keyboard.press("Enter");
await p.locator(".pk-done").waitFor();
assert.match(await p.locator(".pk-done").innerText(), /Eklendi · Portekiz · Konaklama/);
await p.screenshot({ path: `${out}/2-added.png` });
const save = await p.evaluate(() => window.__asked.find((m) => m.type === "popup:save"));
assert.deepEqual(save.pick, {}, "into the known trip");
await p.waitForTimeout(2000);
assert.equal(await p.evaluate(() => window.__closed === true), true, "it closes itself");
// 2. The trip on top opens the picker; a trip pressed both picks and saves.
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: ["pt", "bali"], saved: false, names: [] }), "3-chip");
await p.locator(".cep-trip").click();
await p.locator(".pk-qp button", { hasText: "Bali" }).click();
await p.locator(".pk-done").waitFor();
assert.equal((await p.evaluate(() => window.__asked.find((m) => m.type === "popup:save"))).pick.tripId, "bali");
// 3. No trip known: the picker at once, nothing saved until a press.
p = await open(view({ trip: null, country: "Portekiz", trips, picks: ["pt", "bali"], saved: false, names: [] }), "4-pick");
assert.equal(await p.locator(".pk-qp button").count(), 2);
assert.equal(await p.locator(".pk-ln").count(), 2, "the other trip and a new one");
assert.equal((await p.evaluate(() => window.__asked.filter((m) => m.type === "popup:save"))).length, 0);
await p.locator(".pk-ln.new").click();
await p.locator(".pk-done").waitFor();
assert.equal((await p.evaluate(() => window.__asked.find((m) => m.type === "popup:save"))).pick.newTrip, true);
// Undo takes it back.
await p.getByRole("button", { name: "Geri al" }).click();
await p.waitForTimeout(100);
assert.equal((await p.evaluate(() => window.__asked.filter((m) => m.type === "popup:undo"))).length, 1);
// 4. Already on the plan: said so, "Fiyatı yenile".
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: [], saved: true, names: [] }), "5-saved");
assert.match(await p.locator(".pk-in").innerText(), /Portekiz · Konaklama destesinde/);
await p.getByRole("button", { name: "Fiyatı yenile" }).waitFor();
// 5. Not a booking: "Fikir olarak ekle".
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: [], saved: false, names: [] }, { what: "idea", title: "Lizbon'da 10 gizli teras", sub: "medium.com · yazı", site: "https://medium.com/*", travelSite: false, along: false }), "6-idea");
await p.getByRole("button", { name: /Fikir olarak ekle/ }).click();
await p.locator(".pk-done").waitFor();
assert.equal((await p.evaluate(() => window.__asked.find((m) => m.type === "popup:save"))).idea, true);
// 6. A travel site without the switch: the switch said first, at the top.
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: [], saved: false, names: [] }, { along: false }), "7-switch");
assert.match(await p.locator(".pk-switch").innerText(), /Bu sitede \+ kapalı[\s\S]*Seyahat sitelerinde benle gel/);
// 7. The pocket's rows: × takes one back, "tekrar" reads a failed one again.
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: [], saved: false, names: [] }), "8-rows");
await p.getByRole("button", { name: "tekrar" }).click();
await p.getByRole("button", { name: "Lumiares Hotel kaldır" }).click();
await p.waitForTimeout(100);
assert.deepEqual(await p.evaluate(() => window.__asked.filter((m) => m.type === "popup:retry" || m.type === "popup:remove").map((m) => [m.type, m.id])), [["popup:retry", "c:f"], ["popup:remove", "c:r"]]);
// 8. A list: never one record; "Sonuçlardan seç" ticks on the page, "Ekrandakileri ekle" reads what's in view.
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: [], saved: false, names: [] }, { what: "list", title: "Lizbon: 412 otel" }), "9-list");
assert.equal(await p.getByRole("button", { name: /destesine ekle/ }).count(), 0, "no whole-list save");
await p.getByRole("button", { name: "Ekrandakileri ekle" }).click();
await p.locator(".pk-done").waitFor();
assert.equal((await p.evaluate(() => window.__asked.find((m) => m.type === "popup:save"))).inView, true);
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: [], saved: false, names: [] }, { what: "list", title: "Lizbon: 412 otel", along: false }), "10-list-off");
assert.equal(await p.locator(".pk-switch").count(), 0, "a list asks the switch on its own button");
await p.getByRole("button", { name: "Sonuçlardan seç" }).click();
await p.waitForTimeout(100);
assert.equal((await p.evaluate(() => window.__asked.filter((m) => m.tab && m.type === "desk:select"))).length, 1);
// 9. A page that can't be added (a new tab): the pocket still, never a dead end; no key: one line, saving goes on.
p = await open({ kind: "none", title: "", sub: "", site: null, travelSite: false, along: false, what: "idea", where: null, desk: { candidate: null, planned: null }, key: false, price: null, pocket: { ...pocket, key: false, waiting: 3 } }, "11-newtab");
assert.match(await p.locator(".pk2").innerText(), /Portekiz[\s\S]*eklenemiyor[\s\S]*Son eklenenler[\s\S]*AI bağlı değil: 3 kayıt bekliyor[\s\S]*Portekiz panosunu aç/);
// 10. Added into the wrong trip: "Değiştir" moves it.
p = await open(view({ trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: ["pt", "bali"], saved: false, names: [] }), "12-move");
await p.keyboard.press("Enter");
await p.getByRole("button", { name: "Değiştir" }).click();
await p.locator(".pk-qp button", { hasText: "Bali" }).click();
await p.locator(".pk-done", { hasText: "Bali" }).waitFor();
assert.equal((await p.evaluate(() => window.__asked.find((m) => m.type === "popup:move"))).pick.tripId, "bali");
await p.screenshot({ path: `${out}/13-moved.png` });
console.log(JSON.stringify({ ok: true }));
await browser.close();
