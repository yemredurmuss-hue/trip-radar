// Simgeye basınca, tek Kaydet (0.47.29–0.47.31, docs/mockups/eklenti-tek-kaydet-v2 + v3): the built popup (dist/popup.html)
// with the service worker's answers stubbed. One layout: the page on top (its icon, its name, a corner mark for a booking's
// confirmation or a planned flight's search), the trips under it (cover, name, Pano's count, how ready, one button), at most
// one line at the bottom. A row selects, "Kaydet" (or Enter) saves, the count opens the trip; saved: "Kaydedildi" and ↶,
// another trip's "Kaydet" moves it; on the plan already: ✓, then "Fiyatı yenile" and "Çıkar". Nothing is saved by opening it.
// Run after `npm run build`: CHROMIUM_PATH=… node scripts/popup-check.mjs → e2e-output/popup/*.png
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve("e2e-output/popup");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--headless=new"] });
const dot = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#c9b9a3"/></svg>');
const VERSION = JSON.parse(readFileSync("dist/manifest.json", "utf8")).version;
const shelfTrip = (id, title, ready, mine, photo = dot) => ({ id, title, photo, art: "illus/ucus.png", when: null, countdown: null, ready, mine });
const shelf = {
  selected: true,
  total: 4,
  trips: [
    shelfTrip("pt", "Portekiz", { plan: 64, booked: 40, fresh: false }, 23),
    shelfTrip("gr", "Yunanistan", { plan: 36, booked: 10, fresh: false }, 9),
    shelfTrip("ca", "Kanada", { plan: 18, booked: 0, fresh: false }, 5),
    shelfTrip("bl", "Bali", { plan: 0, booked: 0, fresh: true }, 0, null),
  ],
};
const trips = shelf.trips.map((t) => ({ id: t.id, title: t.title, when: null, match: t.id === "pt", photos: [dot] }));
const pocket = { trip: { id: "pt", title: "Portekiz", when: null, count: 23, decks: {}, photo: dot }, rows: [], waiting: 0, key: true };
const known = { trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: ["pt", "gr"], saved: false };
const unknown = { ...known, trip: null };
const view = (where, extra = {}) => ({ kind: "page", title: "Casa do Jardim · Porto", sub: "Booking.com · konaklama", site: "https://www.booking.com/*", travelSite: true, along: true, what: "stay", where, desk: { candidate: null, planned: null }, key: true, pocket, confirm: null, failed: null, alongAsked: true, shelf, favicon: null, here: null, ...extra });
const answer = (v, m) =>
  m.type === "popup:view"
    ? v
    : m.type === "popup:save"
      ? { captureId: "c1", tripId: m.pick?.tripId ?? "pt", tripTitle: "Portekiz", deck: "Konaklama" }
      : m.type === "popup:move"
        ? { tripId: m.pick.tripId, tripTitle: "Yunanistan" }
        : m.type === "popup:current"
          ? { ...v, where: v.where && { ...v.where, trip: { id: m.tripId, title: m.tripId } } }
          : true;

async function open(v, name) {
  const page = await browser.newPage({ viewport: { width: 380, height: 620 }, locale: "tr-TR" });
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
    const type = f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : f.endsWith(".png") ? "image/png" : "text/html";
    return r.fulfill({ contentType: type, body: readFileSync(path.join("dist", f)) });
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("https://popup.test/popup.html");
  await page.locator(".tk-trips, .tb-empty").first().waitFor();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
  return page;
}
const rows = (p) => p.locator(".tk-row .tk-pick b").allInnerTexts();
const asked = (p, type) => p.evaluate((t) => window.__asked.filter((m) => m.type === t), type);
const row = (p, title) => p.locator(".tk-row", { has: p.locator(".tk-pick b", { hasText: title }) });

// 1. A page, its trip known: the page, the selected trip first, three rows; opening saves nothing; Enter saves there.
let p = await open(view(known), "1-page");
assert.equal((await asked(p, "popup:save")).length, 0, "opening saves nothing");
assert.equal(await p.locator(".tk-page b").innerText(), "Casa do Jardim · Porto");
assert.deepEqual(await rows(p), ["Portekiz", "Yunanistan", "Kanada"]);
assert.equal(await p.locator(".tk-row.sel .tk-pick b").innerText(), "Portekiz");
assert.equal(await p.locator(".tk-foot").innerText(), "Tümü (4)\n+ Yeni gezi: Portekiz");
assert.equal(await p.getByText(/Biriktirdiklerim|Uygulamayı aç|düştü|kaldı/).count(), 0, "nothing but what works");
await p.keyboard.press("Enter");
await p.locator(".tk-row.saved").waitFor();
assert.deepEqual((await asked(p, "popup:save"))[0].pick, { tripId: "pt", remember: true });
assert.match(await row(p, "Portekiz").innerText(), /Portekiz\n24\nKaydedildi/);
await p.screenshot({ path: `${out}/2-saved.png` });
// 1b. Saved: another trip's "Kaydet" moves it there (the same record); ↶ takes it back.
await row(p, "Yunanistan").hover();
await row(p, "Yunanistan").getByRole("button", { name: "Kaydet" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:move"))[0].pick.tripId, "gr");
assert.equal((await asked(p, "popup:save")).length, 1, "moved, not saved again");
await p.locator(".tk-row.saved").getByRole("button", { name: "Geri al" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:undo")).length, 1);
// 1c. Left alone, it closes itself.
p = await open(view(known), "1c-close");
await p.keyboard.press("Enter");
await p.locator(".tk-row.saved").waitFor();
await p.mouse.move(370, 610);
await p.waitForTimeout(2300);
assert.equal(await p.evaluate(() => window.__closed === true), true, "it closes itself");

// 2. A row selects that trip (remembered for the page's country); nothing saved. "Tümü" opens the rest in place.
p = await open(view(known), "3-select");
await row(p, "Yunanistan").locator(".tk-pick").click();
await p.waitForTimeout(100);
assert.deepEqual((await asked(p, "popup:current"))[0], { type: "popup:current", tabId: 7, tripId: "gr", remember: true });
assert.equal((await asked(p, "popup:save")).length, 0);
await p.getByRole("button", { name: "Tümü (4)" }).click();
assert.equal((await rows(p)).length, 4);
// 2b. The count opens the trip (and the popup goes).
await row(p, "Kanada").locator(".tk-cnt").click();
await p.waitForTimeout(100);
assert.equal(await p.evaluate(() => window.__closed === true), true, "the count opens the trip");

// 3. No trip known: "Hangi geziye?", nothing selected, Enter does nothing; the trip it looks like first.
p = await open(view(unknown), "4-which");
assert.equal(await p.locator(".tk-ask").innerText(), "Hangi geziye?");
assert.equal(await p.locator(".tk-row.sel").count(), 0);
assert.deepEqual((await rows(p)).slice(0, 1), ["Portekiz"], "the trip the page looks like comes first");
await p.keyboard.press("Enter");
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:save")).length, 0, "Enter with no trip selected saves nothing");
await row(p, "Kanada").hover();
await row(p, "Kanada").getByRole("button", { name: "Kaydet" }).click();
await p.locator(".tk-row.saved").waitFor();
assert.equal((await asked(p, "popup:save"))[0].pick.tripId, "ca");

// 4. On the plan already: ✓; over it "Fiyatı yenile" (saved again) and "Çıkar" (a card not chosen).
p = await open(view({ ...known, saved: true }, { here: { tripId: "pt", itemId: "it1", removable: true } }), "5-here");
assert.equal(await row(p, "Portekiz").locator(".tk-in").count(), 1);
await row(p, "Portekiz").hover();
await p.screenshot({ path: `${out}/5b-here-hover.png` });
await row(p, "Portekiz").getByRole("button", { name: "Çıkar" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:remove"))[0].id, "i:it1");
p = await open(view({ ...known, saved: true }, { here: { tripId: "pt", itemId: "it1", removable: false } }), "5c-here-chosen");
await row(p, "Portekiz").hover();
assert.equal(await row(p, "Portekiz").getByRole("button", { name: "Çıkar" }).count(), 0, "a chosen card is the Plan's to change");
await row(p, "Portekiz").getByRole("button", { name: "Fiyatı yenile" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:save"))[0].pick.tripId, "pt");

// 5. A booking's confirmation: the green ticket on the page and in "Kaydet"; never saved as an idea.
p = await open(view(known, { what: "idea", confirm: { code: "2JB52G", name: null, paid: null } }), "6-confirm");
assert.equal(await p.locator(".tk-fav em.ok").count(), 1);
assert.equal(await p.locator(".tk-row.sel .tk-save.ok").count(), 1);
await p.locator(".tk-row.sel .tk-save").click();
await p.locator(".tk-row.saved").waitFor();
assert.equal((await asked(p, "popup:save"))[0].idea, false, "a confirmation is no idea");
// 5b. An article or a video: an idea for İlham.
p = await open(view(known, { what: "idea" }), "6b-idea");
await p.keyboard.press("Enter");
await p.locator(".tk-row.saved").waitFor();
assert.equal((await asked(p, "popup:save"))[0].idea, true);

// 6. A planned flight's search: the plane mark, only its trip, no "Tümü" or new trip (it goes to that row).
p = await open(view(known, { what: "flight", desk: { candidate: null, planned: { title: "Portekiz", from: "IST", to: "OPO", day: "2026-11-12", count: 2 } } }), "7-planned");
assert.equal(await p.locator(".tk-fav em.acc").count(), 1);
assert.deepEqual(await rows(p), ["Portekiz"]);
assert.equal(await p.locator(".tk-foot .btn-link").count(), 0);

// 7. A list without the "+": the one line at the bottom; with it, nothing there.
p = await open(view(known, { what: "list", along: false }), "8-list");
assert.equal(await p.locator(".tk-alt").innerText(), "Sonuçlara + koy");
await p.getByRole("switch", { name: "Sonuçlara + koy" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:along-asked")).length, 1);
p = await open(view(known, { what: "list", along: true }), "8b-list-along");
assert.equal(await p.locator(".tk-alt").count(), 0);
// 7b. No key: the line says so instead.
p = await open(view(known, { key: false, along: false, alongAsked: false }), "8c-nokey");
assert.equal(await p.locator(".tk-alt").innerText(), "AI bağlı değil · kayıtlar bekler\nBağla");

// 8. A save that couldn't be read a moment ago: a line above the trips, ↻ reads it again.
p = await open(view(known, { failed: { id: "c:f", title: "Casa do Bairro" } }), "9-failed");
assert.match(await p.locator(".tk-warn").innerText(), /Casa do Bairro okunamadı/);
await p.getByRole("button", { name: "Tekrar dene" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:retry"))[0].id, "c:f");

// 9. A new tab: the trips, no page and no "Kaydet"; a row selects. No trips: one invitation.
const newTab = { ...view(null), kind: "none", title: "", site: null, travelSite: false, along: false, what: "idea" };
p = await open(newTab, "10-newtab");
assert.equal(await p.locator(".tk-page").count(), 0);
assert.equal(await p.locator(".tk-save").count(), 0);
await row(p, "Yunanistan").locator(".tk-pick").click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:current"))[0].tripId, "gr");
p = await open({ ...newTab, shelf: { selected: false, total: 0, trips: [] } }, "10b-empty");
assert.match(await p.locator(".tb-empty").innerText(), /İlk gezini başlat[\s\S]*\+ Yeni gezi$/);
console.log(JSON.stringify({ ok: true }));
await browser.close();
