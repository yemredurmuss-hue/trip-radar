// Fark listeler (plan v46): the four lists (Yapılacaklar, Hazırlık, Belgeler, İlham) on a Japan trip like the v46 drawing's Japonya.
// `[SHOTS_WIDTH=1000] [SHOTS_LANG=en] CHROMIUM_PATH=... node scripts/fark-listeler-shots.mjs <out-dir>` after `npm run build`.
import { chromium } from "playwright-core";
import path from "node:path";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const out = path.resolve(process.argv[2] ?? "e2e-output/fark-listeler");
mkdirSync(out, { recursive: true });
const WIDTH = Number(process.env.SHOTS_WIDTH ?? 1000);
const EN = process.env.SHOTS_LANG === "en";
const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-fl-")), {
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  headless: false, timezoneId: "Europe/Istanbul", viewport: { width: WIDTH, height: 1000 }, locale: EN ? "en-US" : "tr-TR",
  args: ["--headless=new", "--hide-scrollbars", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4", EN ? "--lang=en-US" : "--lang=tr-TR", `--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
});
await ctx.route(/functions\/v1\/(web-search|city-image|offers)/, (r) => r.fulfill({ json: { answer: null, url: null, offers: [], reason: "not-configured" } }));
await ctx.clock.install({ time: new Date("2026-10-05T10:00:00") });
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const id = new URL(worker.url()).host;
for (const p of ctx.pages()) if (p.url().includes("app.html")) await p.close();
const app = await ctx.newPage();
const errors = [];
app.on("pageerror", (e) => errors.push(e.message));
await app.goto(`chrome-extension://${id}/app.html`);
await app.getByText(/Örnek geziyi yükle →|Load the sample trip →/).click();
await app.getByRole("heading", { name: /Portekiz \(örnek\)|\(sample\)/ }).waitFor();
await app.waitForTimeout(1500);

const tid = await app.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
  const all = (s) => new Promise((r) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
  const trips = await all("trips"); const items = await all("items");
  const sample = trips[0]; const stay0 = items.find((i) => i.name === "Lisboa Loft");
  const now = Date.now();
  const mk = (o) => ({ ...stay0, tripId: "jp-trip", captureIds: [], needKey: null, createdAt: now, updatedAt: now, rating: { value: null, scale: null, count: null, source: "none" },
    cancellation: { summary: null, freeUntil: null, source: "none" }, imageUrl: null, url: null, provider: null, country: "Japonya", countryCode: "JP", ...o, id: crypto.randomUUID(), metrics: { ...stay0.metrics, ...(o.metrics ?? {}) } });
  const none = { amount: null, currency: "EUR", scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now };
  const price = (amount, scope = "total") => ({ amount, currency: "EUR", scope, taxesIncluded: "yes", source: "page", observedAt: now });
  const nd = { start: null, end: null, source: "none" };
  const maps = (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
  const stay = (name, city, s, e) => mk({ category: "stay", name, city, status: "chosen", needKey: `stay:${city}`, dates: { start: s, end: e, source: "url" }, price: price(300), url: "https://www.booking.com/hotel/jp/x.html" });
  const ride = (name, from, to, d, key) => mk({ category: "transport", plannedKind: "train", name, city: from, status: "chosen", needKey: key, dates: { start: d, end: null, source: "page" }, price: price(120), provider: "JR", flight: { from, to, departure: `${d}T09:00`, arrival: `${d}T11:00`, carrier: null, flightNumber: null, stops: null } });
  const idea = (name, city, note, status, o = {}) => mk({ category: "activity", name, city, summary: note, status, dates: nd, price: none, booking: "none", addedBy: "Emre", ...o });
  const food = (name, city, note, status, o = {}) => mk({ category: "food", name, city, summary: note, status, dates: nd, price: none, booking: "none", url: maps(name), ...o });
  const prep = (name, note) => mk({ category: "other", name, city: null, summary: note, status: "saved", prep: true, dates: nd, price: none, booking: "none", country: null, countryCode: null });
  const rec = [
    stay("Shinjuku Granbell", "Tokyo", "2027-04-01", "2027-04-06"), stay("Gora Kadan", "Hakone", "2027-04-06", "2027-04-08"), stay("Gion Machiya", "Kyoto", "2027-04-08", "2027-04-13"), stay("Dotonbori Hotel", "Osaka", "2027-04-13", "2027-04-16"),
    ride("Romancecar · Tokyo → Hakone", "Tokyo", "Hakone", "2027-04-06", "transport:1"), ride("Shinkansen Hikari · Hakone → Kyoto", "Hakone", "Kyoto", "2027-04-08", "transport:2"), ride("JR Special Rapid · Kyoto → Osaka", "Kyoto", "Osaka", "2027-04-13", "transport:3"),
    food("Omoide Yokocho izakaya", "Tokyo", "Shinjuku · akşam", "chosen"), idea("Meiji Tapınağı", "Tokyo", "Harajuku · ücretsiz", "chosen"),
    food("Tsukiji'de sabah sushi", "Tokyo", "4,5 · erken git", "saved"), idea("Yanaka eski sokakları", "Tokyo", "yürüyüş", "saved"), food("Ichiran Ramen Shibuya", "Tokyo", "4,4 · gece açık", "saved"),
    idea("Owakudani buhar vadisi", "Hakone", "teleferikle", "chosen"),
    idea("Fushimi Inari, sabah 7'de", "Kyoto", "kalabalıktan önce", "chosen"), idea("Arashiyama bambu ormanı", "Kyoto", "sabah erken", "chosen"), food("Nishiki pazarı", "Kyoto", "öğle atıştırma", "saved"),
    food("Pontocho'da nehre bakan küçük aile restoranı Kiyamachi Yoshikawa Tempura", "Kyoto", "4,6 · rezervasyon önerilir", "chosen"), idea("Nara geyik parkı", "Kyoto", "45 dk · yarım gün", "saved"),
    food("Kuromon pazarı", "Osaka", "4,3 · öğle", "chosen"), idea("Dotonbori akşam yürüyüşü", "Osaka", "ışıklar", "saved"), food("Mizuno okonomiyaki", "Osaka", "sıra olur", "saved"),
    prep("Suica ya da ICOCA kartı", "tren, metro, market"), prep("A tipi priz adaptörü", "Japonya 100V"), prep("Nakit yen", "küçük yerler kart almıyor"), prep("Kolay çıkan rahat ayakkabı", "tapınak ve ryokanda çıkarılıyor"), prep("Valiz kargosu (takkyubin)", "Tokyo → Kyoto, 1 gün önce"), prep("Temiz çorap", "ayakkabısız yerler çok"),
    mk({ category: "other", plannedKind: "insurance", name: "Seyahat sağlık sigortası", city: null, status: "saved", needKey: "cover:insurance", dates: { start: "2027-04-01", end: "2027-04-16", source: "user" }, price: none, summary: "Japonya'da sağlık pahalı" }),
    mk({ category: "esim", name: "Airalo · Moshi Moshi", city: null, status: "chosen", needKey: "cover:esim", dates: { start: "2027-04-01", end: "2027-04-16", source: "user" }, price: price(32), provider: "Airalo", summary: "Japonya eSIM · 10 GB", url: "https://www.airalo.com/japan-esim" }),
    idea("Kyoto'da 3 gün: sakura rotası", "Kyoto", null, "saved", { url: "https://www.youtube.com/watch?v=abc", addedBy: "Sabine" }), idea("Hakone ryokan odası · Reels", "Hakone", null, "saved", { url: "https://www.instagram.com/reel/xyz/" }),
  ];
  const tx = db.transaction(["items", "trips"], "readwrite");
  rec.forEach((i) => tx.objectStore("items").put(i));
  tx.objectStore("trips").put({ ...sample, demo: false, createdAt: now, updatedAt: now, id: "jp-trip", title: "Japonya (karşılaştırma)", confirmedDates: { start: "2027-04-01", end: "2027-04-16" } });
  await new Promise((r) => (tx.oncomplete = r));
  new BroadcastChannel("trip-radar").postMessage("changed");
  return "jp-trip";
});
await app.waitForTimeout(1000);
await app.goto(`chrome-extension://${id}/app.html#trip=${tid}`);
await app.reload();
await app.waitForTimeout(2500);
for (const s of await app.locator(".cat-sec.closed .cat-title").all()) await s.click();
await app.waitForTimeout(600);
await app.setViewportSize({ width: WIDTH, height: 7000 });
await app.waitForTimeout(6000);
await app.mouse.move(0, 0);
const secs = app.locator(".cat-sec");
for (let i = 0; i < (await secs.count()); i++) {
  const sid = await secs.nth(i).getAttribute("data-section");
  await secs.nth(i).screenshot({ path: `${out}/sec-${sid}.png` });
}
console.log("OVERFLOW", await app.evaluate(() => document.documentElement.scrollWidth - innerWidth));
console.log("errors", JSON.stringify(errors));
if (process.env.KEEP) { globalThis.P = { app, out, id }; await import(path.resolve(process.env.KEEP)); }
await ctx.close();
