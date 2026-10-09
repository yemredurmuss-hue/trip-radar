// Screenshots of the live board beside the approved drawing, for a side-by-side look (no assertions): the sample trip's
// Plan head, each section, and the Pano; and the same parts of docs/mockups/2026-10-08-japonya-web-v11.html (state C,
// "Karar ve rezerve"). Run after `npm run build`: `node scripts/shots.mjs` → e2e-output/shots/{live,mock}-*.png.
import { chromium } from "playwright-core";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = path.resolve(`e2e-output/shots${process.env.SHOTS_STRESS ? "-stress" : ""}${process.env.SHOTS_LANG === "en" ? "-en" : ""}`);
mkdirSync(out, { recursive: true });
function macChromium() {
  const cache = path.join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium")).sort().reverse())
    for (const arch of ["chrome-mac-arm64", "chrome-mac", "chrome-mac-x64"]) {
      const exe = path.join(cache, dir, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(exe)) return exe;
    }
  return null;
}
const executablePath = process.env.CHROMIUM_PATH ?? macChromium();
const extension = path.resolve("dist");
const only = process.argv[2] ?? "both";
// SHOTS_LANG=en: the board in English (longer words); SHOTS_STRESS=1: the sample trip made busy as a real one is — four
// booked flights with their live data (landed, terminal, belt) and long file names, a stay with a long name, activities
// on the plan and booked — to see nothing spills or overlaps.
const EN = process.env.SHOTS_LANG === "en";
const STRESS = Boolean(process.env.SHOTS_STRESS);

if (only !== "mock") {
  const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-shots-")), {
    executablePath,
    headless: false,
    timezoneId: "Europe/Istanbul",
    viewport: { width: 1440, height: 1000 },
    locale: EN ? "en-US" : "tr-TR",
    args: ["--headless=new", EN ? "--lang=en-US" : "--lang=tr-TR", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
  await context.route(/functions\/v1\/(web-search|city-image)/, (route) => route.fulfill({ json: { answer: null, url: null, reason: "not-configured" } }));
  await context.clock.install({ time: new Date(STRESS ? "2026-10-05T23:30:00" : "2026-10-05T10:00:00") });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  for (const p of context.pages()) if (p.url().includes("app.html")) await p.close();
  const app = await context.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText(/Örnek geziyi yükle →|Load the sample trip →/).click();
  await app.getByRole("heading", { name: /Portekiz \(örnek\)|\(sample\)/ }).waitFor();
  await app.waitForTimeout(1500);
  if (STRESS) {
    await app.evaluate(async () => {
      const request = indexedDB.open("trip-radar");
      const database = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = database.transaction(["items", "docs"], "readwrite");
      const items = tx.objectStore("items");
      const all = await new Promise((resolve) => (items.getAll().onsuccess = (e) => resolve(e.target.result)));
      const home = all.find((i) => i.category === "flight" && i.status === "booked");
      const loft = all.find((i) => i.category === "stay" && i.status === "booked");
      const douro = all.find((i) => i.category === "activity" && i.status === "chosen");
      if (loft) items.put({ ...loft, name: "Bonfim Konaklaması – Yeni Tasarlanmış Daire - J" });
      const legs = [["e2e-f1", "Pegasus PC1071", "PC1071", "Pegasus", "SAW", "CPH", "2026-10-05T09:40", "2026-10-05T11:43"], ["e2e-f2", "KLM KL1274", "KL1274", "KLM", "CPH", "AMS", "2026-10-05T16:30", "2026-10-05T17:40"], ["e2e-f3", "KLM KL1577", "KL1577", "KLM", "AMS", "OPO", "2026-10-05T21:05", "2026-10-05T22:32"]];
      for (const [id, name, number, carrier, from, to, dep, arr] of legs)
        items.put({ ...home, id, name, provider: carrier, url: null, captureIds: [], owners: ["Emre"], flight: { ...home.flight, from, to, departure: dep, arrival: arr, carrier, flightNumber: number, stops: 0 } });
      if (douro) {
        items.put({ ...douro, id: "e2e-a1", name: "Douro Valley Full-Day Tour with Wine Tasting and Lunch", status: "booked", price: { ...douro.price, amount: 89 } });
        items.put({ ...douro, id: "e2e-a2", name: "Whale and Dolphin Watching Tour", status: "chosen", city: "Lizbon", price: { ...douro.price, amount: 66 } });
      }
      const docs = tx.objectStore("docs");
      for (const [n, itemId] of [["Ekran Resmi 2026-09-26 22.41.13.png", "e2e-f1"], ["Ekran Resmi 2026-10-06 00.33.18.png", "e2e-f2"]])
        docs.put({ id: `doc-${itemId}`, itemId, tripId: home.tripId, name: n, type: "image/png", size: 10, blob: new Blob(["x"], { type: "image/png" }), addedAt: Date.now() });
      await new Promise((resolve) => (tx.oncomplete = resolve));
      const end = (iata, t) => ({ iata, airport: null, scheduled: t, revised: null, actual: null, terminal: null, gate: null });
      const live = {};
      for (const [, , number, carrier, from, to, dep, arr] of legs)
        live[`${number}|${dep.slice(0, 10)}`] = { at: Date.now(), flight: { number, airline: carrier, status: "Landed", departure: end(from, dep), arrival: { ...end(to, arr), actual: arr, terminal: "3", belt: "10" }, fetchedAt: "t" } };
      await chrome.storage.local.set({ flightLive: live });
      new BroadcastChannel("trip-radar").postMessage("changed");
    });
    // The live data is read when the board opens.
    await app.reload();
    await app.getByRole("heading", { name: /Portekiz \(örnek\)|\(sample\)/ }).waitFor();
    await app.waitForTimeout(1500);
  }
  // Every section open, as the drawing shows them.
  for (const s of await app.locator(".cat-sec.closed .cat-title").all()) await s.click();
  await app.waitForTimeout(600);
  await app.mouse.move(0, 0);
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.waitForTimeout(400);
  await app.screenshot({ path: `${out}/live-top.png` });
  await app.locator(".hx").first().screenshot({ path: `${out}/live-hero.png` }).catch(() => undefined);
  // Tall enough for every section at once: an element bigger than the window is shot wrong inside the scrolling panel.
  await app.setViewportSize({ width: 1440, height: 7000 });
  await app.waitForTimeout(400);
  const secs = app.locator(".cat-sec");
  for (let i = 0; i < (await secs.count()); i++) {
    const sid = await secs.nth(i).getAttribute("data-section");
    await secs.nth(i).screenshot({ path: `${out}/live-sec-${i}-${sid}.png` });
  }
  await app.setViewportSize({ width: 1440, height: 1000 });
  await app.getByRole("tab", { name: /^(Pano|Board)$/ }).click().catch(() => undefined);
  await app.waitForTimeout(800);
  await app.screenshot({ path: `${out}/live-pano.png`, fullPage: true });
  await context.close();
}

if (only !== "live") {
  // The drawing loads its pictures from illus/ beside it.
  const dir = mkdtempSync(path.join(tmpdir(), "trip-radar-mock-"));
  mkdirSync(path.join(dir, "illus"));
  copyFileSync("docs/mockups/2026-10-08-japonya-web-v11.html", path.join(dir, "v11.html"));
  for (const f of readdirSync("static/illus")) copyFileSync(path.join("static/illus", f), path.join(dir, "illus", f));
  const browser = await chromium.launch({ executablePath, args: ["--headless=new"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(pathToFileURL(path.join(dir, "v11.html")).href);
  for (const k of ["C", "A"]) {
    await page.evaluate((k) => localStorage.setItem("tr-jp11", k), k);
    await page.reload();
    await page.waitForTimeout(2500);
    await page.locator(".planbar").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/mock-${k}-top.png` });
    const secs = page.locator(".sec");
    for (let i = 0; i < (await secs.count()); i++) {
      const sid = await secs.nth(i).getAttribute("data-sec");
      await secs.nth(i).screenshot({ path: `${out}/mock-${k}-sec-${i}-${sid}.png` });
    }
  }
  await page.evaluate(() => localStorage.setItem("tr-jp11", "P"));
  await page.reload();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/mock-pano.png`, fullPage: true });
  await browser.close();
}
console.log("shots in", out);
