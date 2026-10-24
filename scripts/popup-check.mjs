// Simgeye basınca, tek bakış (0.45.0, tuval 15–16): the built popup (dist/popup.html) with the service worker's answers stubbed. It opens at
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
const glance = { mine: 16, next: { key: "flight:ist-opo", section: "flight", act: "Seç", text: "İstanbul → Porto", sub: "8 Eki · 2 seçenek" } };
const view = (where, extra = {}) => ({ kind: "page", title: "Memmo Alfama Hotel", sub: "Booking.com · konaklama · 12 – 16 Kas", site: "https://www.booking.com/*", travelSite: true, along: true, what: "stay", where, desk: { candidate: null, planned: null }, key: true, price: null, pocket, hero: null, video: false, confirm: null, glance, fresh: false, failed: null, alongAsked: true, ...extra });
const answer = (v, m) =>
  m.type === "popup:view" ? v : m.type === "popup:save" ? { captureId: "c1", tripId: m.pick?.tripId ?? "pt", tripTitle: m.pick?.tripId === "bali" ? "Bali" : "Portekiz", deck: "Konaklama" } : m.type === "popup:pocket" ? v.pocket : m.type === "popup:move" ? { tripId: m.pick.tripId, tripTitle: "Bali" } : m.type === "popup:current" ? { ...v, fresh: false, where: { ...v.where, trip: { id: m.tripId, title: "Bali" } } } : true;

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
    const type = f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html";
    return r.fulfill({ contentType: type, body: readFileSync(path.join("dist", f)) });
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("https://popup.test/popup.html");
  await page.locator(".tb").waitFor();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
  return page;
}

const known = { trip: { id: "pt", title: "Portekiz" }, country: "Portekiz", trips, picks: ["pt", "bali"], saved: false, names: [] };
const unknown = { ...known, trip: null };
const text = (p) => p.locator(".tb").innerText();
const asked = (p, type) => p.evaluate((t) => window.__asked.filter((m) => m.type === t), type);
// 1. A place's own page, the trip known: one card, one button, Biriktirdiklerim under it; nothing saved by opening it.
let p = await open(view(known), "1-page");
assert.equal((await asked(p, "popup:save")).length, 0, "opening saves nothing");
assert.match(await text(p), /^Trip Radar\nUygulamayı aç ↗\n×\nPortekiz\n▾\n[\s\S]*Memmo Alfama Hotel\nBooking\.com · konaklama · 12 – 16 Kas\n\+ Konaklama destesine ekle[\s\S]*Biriktirdiklerim 16$/);
assert.equal(await p.locator(".tb-go").count(), 1, "one big button");
await p.keyboard.press("Enter");
await p.locator(".pk-done").waitFor();
assert.match(await text(p), /Eklendi\nPortekiz · Konaklama · okunuyor\nGeri al[\s\S]*Yanlış gezi mi\?\nDeğiştir/);
await p.screenshot({ path: `${out}/2-added.png` });
assert.deepEqual((await asked(p, "popup:save"))[0].pick, {});
await p.waitForTimeout(2200);
assert.equal(await p.evaluate(() => window.__closed === true), true, "it closes itself");
// 2. The chip: another trip for this page and the next (nothing saved).
p = await open(view(known), "3-chip");
await p.locator(".tb-chip").click();
await p.locator(".pk-qp button", { hasText: "Bali" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:current"))[0].tripId, "bali");
assert.equal((await asked(p, "popup:save")).length, 0);
// 3. The first time (no trip picked to collect for): "Hangi gezi için topluyorsun?", a press picks, nothing saved.
p = await open(view(unknown, { fresh: true }), "4-first");
assert.match(await text(p), /Hangi gezi için topluyorsun\?\nBir kez sorarım; sonra hep oraya\./);
await p.locator(".pk-qp button", { hasText: "Portekiz" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:current"))[0].tripId, "pt");
assert.equal((await asked(p, "popup:save")).length, 0);
assert.match(await text(p), /\+ Konaklama destesine ekle/, "then the page's card, into the trip picked");
// 4. Looks like another trip: asked where, the one that fits first ("önerim"); a press saves there.
p = await open(view(unknown, { pocket: { ...pocket, trip: { id: "bali", title: "Bali", when: "Ocak", count: 3, photo: null } } }), "5-other");
assert.match(await text(p), /Bu sayfa Portekiz için\nŞu an Bali için topluyorsun\. Nereye kaydedeyim\?\nPortekiz\n12 – 19 Kas · tutuyor\nönerim\nBali[\s\S]*\+ Yeni gezi: Portekiz/);
await p.locator(".tb-opt.best").click();
await p.locator(".pk-done").waitFor();
assert.equal((await asked(p, "popup:save"))[0].pick.tripId, "pt");
// 5. Already in the deck.
p = await open(view({ ...known, saved: true }), "6-saved");
assert.match(await text(p), /Memmo Alfama Hotel zaten destende\nPortekiz · Konaklama\nPanoda karşılaştır\nFiyatı düşerse haber veririm\nFiyatı yenile/);
// 5b. An idea already in the deck: nothing to compare and no price to watch; "✓ Eklendi", the board a press below.
p = await open(view({ ...known, saved: true }, { what: "idea", video: true, hero: dot, title: "Bali'de 15 gün", sub: "YouTube · video" }), "6b-saved-idea");
assert.match(await text(p), /Bali'de 15 gün zaten destende\nPortekiz · İlham\n✓ Eklendi\nBiriktirdiklerim 16\nPanoda gör$/);
assert.equal(await p.getByText(/Fiyat|karşılaştır/).count(), 0, "no price lines on an idea");
// 6. A video: its picture with the play mark, "+ İlham'a ekle", saved as an idea.
p = await open(view(known, { what: "idea", video: true, hero: dot, title: "Bali'de 3 gün: Ubud", sub: "YouTube · video", site: "https://www.youtube.com/*", travelSite: false, along: false }), "7-video");
assert.equal(await p.locator(".tb-hero.video").count(), 1);
await p.getByRole("button", { name: /İlham'a ekle/ }).click();
await p.locator(".pk-done").waitFor();
assert.equal((await asked(p, "popup:save"))[0].idea, true);
// 7. A list: never one record; "Bu listeden seç" ticks on the page (the switch asked by the same press when off).
p = await open(view(known, { what: "list", title: "Lizbon: 412 otel", along: false }), "8-list");
assert.equal(await p.getByRole("button", { name: /destesine ekle/ }).count(), 0, "no whole-list save");
await p.getByRole("button", { name: "Bu listeden seç" }).click();
await p.waitForTimeout(100);
assert.equal((await p.evaluate(() => window.__asked.filter((m) => m.tab && m.type === "desk:select"))).length, 1);
// 8. A booking's confirmation: said first; "Evet, kaydet" saves it, "Bu değil" goes on to the page.
p = await open(view(known, { confirm: { code: "4821 993 107", name: "Visesa Ubud Resort", paid: "€378" } }), "9-confirm");
assert.match(await text(p), /Rezervasyon onayı buldum\nVisesa Ubud Resort\nOnay kodu 4821 993 107 · €378 ödendi\nPortekiz gezisine rezervasyon olarak kaydedeyim mi\?[\s\S]*Evet, kaydet\nBaşka gezi\nBu değil/);
await p.getByRole("button", { name: "Bu değil" }).click();
assert.match(await text(p), /\+ Konaklama destesine ekle/);
p = await open(view(known, { confirm: { code: "4821 993 107", name: null, paid: null } }), "9b-confirm");
await p.getByRole("button", { name: "Evet, kaydet" }).click();
await p.locator(".pk-done").waitFor();
assert.equal((await asked(p, "popup:save")).length, 1);
// 9. A save that couldn't be read a moment ago: said first, "Tekrar dene"; "Bu sayfaya geç".
p = await open(view(known, { failed: { id: "c:f", title: "Casa do Bairro" } }), "10-failed");
assert.match(await text(p), /Casa do Bairro okunamadı\nKayıt duruyor; bir daha okuyayım\.\nTekrar dene[\s\S]*Bu sayfaya geç/);
await p.getByRole("button", { name: "Tekrar dene" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:retry"))[0].id, "c:f");
// 10. A new tab (açılır kart v1.1, 0.47.2): the trips ahead, the selected one big (photo, how long, how ready, Pano's count),
// the others a row each; a press on a row selects that trip (no decision here: decisions are the Plan's). No trips: one invitation.
const shelfTrip = (id, title, when, countdown, ready, mine, photo = dot) => ({ id, title, photo, art: "illus/ucus.png", when, countdown, ready, mine });
const shelf = {
  selected: true,
  total: 4,
  trips: [
    shelfTrip("bali", "15-Day Bali Honeymoon", "26 Eki – 9 Kas", { text: "2 gün kaldı", tone: "soon" }, { plan: 72, booked: 44, fresh: false }, 14),
    shelfTrip("pt", "Porto hafta sonu", "12 – 15 Ara", { text: "7 hafta kaldı", tone: "far" }, { plan: 55, booked: 30, fresh: false }, 9),
    shelfTrip("oz", "Ozora Festival 2027", null, null, { plan: 0, booked: 0, fresh: true }, 2, null),
  ],
};
const newTab = { kind: "none", title: "", sub: "", site: null, travelSite: false, along: false, what: "idea", where: null, desk: { candidate: null, planned: null }, key: true, price: null, pocket, hero: null, video: false, confirm: null, glance, fresh: false, failed: null, alongAsked: true, shelf };
p = await open(newTab, "11-newtab");
assert.match(await text(p), /^Trip Radar\nUygulamayı aç ↗\n×\n2 gün kaldı\n15-Day Bali Honeymoon\n26 Eki – 9 Kas\n%72\nhazır\n14 Pano'da\nSeçili gezi\nÖbür geziler\nPorto hafta sonu\n12 – 15 Ara · 7 hafta kaldı\n%55\nOzora Festival 2027\ntarihsiz\n\+ Yeni gezi\nTüm geziler \(4\)$/);
assert.equal(await p.getByText(/Karar ver|Sıradaki|eklenemez/).count(), 0, "no decision on the new tab's card");
assert.equal(await p.locator(".tb-chip").count(), 0, "the band names the trip; no chip");
await p.getByRole("button", { name: "Porto hafta sonu gezisine geç" }).click();
await p.waitForTimeout(100);
assert.equal((await asked(p, "popup:current"))[0].tripId, "pt", "a row selects that trip");
p = await open({ ...newTab, shelf: { selected: false, total: 0, trips: [] } }, "11b-newtab-empty");
assert.match(await text(p), /İlk gezini başlat[\s\S]*\+ Yeni gezi$/);
// 11. A travel site without the switch, once: "+ koyayım mı?"; "Ekle" goes on to the page. No key: the quiet line says so.
p = await open(view(known, { along: false, alongAsked: false, key: false }), "12-along");
assert.match(await text(p), /Booking\.com'da kartlara \+ koyayım mı\?[\s\S]*Evet, yanımda ol/);
await p.getByRole("button", { name: "Ekle", exact: true }).click();
assert.match(await text(p), /\+ Konaklama destesine ekle[\s\S]*AI bağlı değil · kayıtlar bekler\nBağla$/);
assert.equal((await asked(p, "popup:along-asked")).length, 1, "asked once: not again");
console.log(JSON.stringify({ ok: true }));
await browser.close();
