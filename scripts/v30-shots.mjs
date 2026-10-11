// Screenshots of the v30 parts on the sample trip, to look at (no assertions): the Plan head, the sticky summary bar, "Yolculuk sırasıyla",
// "Gün gün", the cards of a section each, the Pano. Run after `npm run build`: `node scripts/v30-shots.mjs [out-dir]`.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "e2e-output/v30");
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
const WIDTH = Number(process.env.SHOTS_WIDTH ?? 1440);
const EN = process.env.SHOTS_LANG === "en";
const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-v30-")), {
  executablePath: process.env.CHROMIUM_PATH ?? macChromium(),
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: WIDTH, height: 1000 },
  locale: process.env.SHOTS_LANG === "en" ? "en-US" : "tr-TR",
  args: ["--headless=new", process.env.SHOTS_LANG === "en" ? "--lang=en-US" : "--lang=tr-TR", `--disable-extensions-except=${path.resolve("dist")}`, `--load-extension=${path.resolve("dist")}`],
});
await context.route(/functions\/v1\/(web-search|city-image|offers)/, (route) => route.fulfill({ json: { answer: null, url: null, offers: [], reason: "not-configured" } }));
await context.clock.install({ time: new Date("2026-10-05T10:00:00") });
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const id = new URL(worker.url()).host;
for (const p of context.pages()) if (p.url().includes("app.html")) await p.close();
const app = await context.newPage();
const errors = [];
app.on("pageerror", (e) => errors.push(e.message));
await app.goto(`chrome-extension://${id}/app.html`);
await app.getByText(/Örnek geziyi yükle →|Load the sample trip →/).click();
await app.getByRole("heading", { name: /Portekiz \(örnek\)|\(sample\)/ }).waitFor();
await app.waitForTimeout(1500);
// The sample has no train on the plan: its saved one is chosen here, so the ride card can be looked at.
await app.evaluate(async () => {
  const request = indexedDB.open("trip-radar");
  const database = await new Promise((resolve, reject) => ((request.onsuccess = () => resolve(request.result)), (request.onerror = () => reject(request.error))));
  const tx = database.transaction("items", "readwrite");
  const items = tx.objectStore("items");
  const all = await new Promise((resolve) => (items.getAll().onsuccess = (e) => resolve(e.target.result)));
  const train = all.find((i) => i.category === "transport" && i.status === "saved");
  if (train) items.put({ ...train, status: "chosen", provider: train.provider ?? "Comboios de Portugal", updatedAt: Date.now() });
  await new Promise((resolve) => (tx.oncomplete = resolve));
  new BroadcastChannel("trip-radar").postMessage("changed");
});
await app.waitForTimeout(1500);
for (const s of await app.locator(".cat-sec.closed .cat-title").all()) await s.click();
await app.waitForTimeout(600);
await app.mouse.move(0, 0);
await app.screenshot({ path: `${out}/01-plan-top.png` });
// The sticky bar: the hero scrolled away.
await app.locator(".panel").evaluate((el) => (el.scrollTop = 1400));
await app.waitForTimeout(700);
await app.screenshot({ path: `${out}/02-sticky.png`, clip: { x: 0, y: 0, width: WIDTH, height: 320 } });
await app.locator(".panel").evaluate((el) => (el.scrollTop = 0));
// The sections, one by one.
await app.setViewportSize({ width: WIDTH, height: 7000 });
// The entrances (the motion language) finish before a section is shot.
await app.waitForTimeout(2500);
const secs = app.locator(".cat-sec");
for (let i = 0; i < (await secs.count()); i++) {
  const sid = await secs.nth(i).getAttribute("data-section");
  await secs.nth(i).screenshot({ path: `${out}/sec-${i}-${sid}.png` });
}
// The card's back: "N seçenek ›" turns the card in place; its options are small cards across the row.
for (const sec of ["stay", "flight"]) {
  const opts = app.locator(`.cat-sec[data-section="${sec}"] .nd-opts`).first();
  if (await opts.count()) {
    await opts.click();
    await app.waitForTimeout(700);
    await app.locator(`.cat-sec[data-section="${sec}"]`).screenshot({ path: `${out}/back-${sec}.png` });
    await app.locator(`.cat-sec[data-section="${sec}"] .ch-head`).getByRole("button", { name: EN ? "Close" : "Kapat" }).click();
    await app.waitForTimeout(300);
  }
}
// × folds a chosen card in place: why it went.
{
  const card = app.locator(".cat-sec[data-section=\"transport\"] .pk-card").first();
  if (await card.count()) {
    await card.hover();
    await card.locator(".pk-x").click({ force: true });
    await app.waitForTimeout(400);
    await app.locator(".cat-sec[data-section=\"transport\"]").screenshot({ path: `${out}/sec-2-transport-fold.png` });
    await app.locator(".pk-fold-u").click();
    await app.waitForTimeout(300);
  }
}
await app.setViewportSize({ width: WIDTH, height: 1000 });
// "Yolculuk sırasıyla" and "Gün gün".
await app.getByRole("tab", { name: EN ? "In trip order" : "Yolculuk sırasıyla", exact: true }).click();
await app.waitForTimeout(800);
await app.setViewportSize({ width: WIDTH, height: 4200 });
await app.waitForTimeout(500);
await app.locator(".sy").screenshot({ path: `${out}/03-story.png` }).catch(() => app.screenshot({ path: `${out}/03-story.png` }));
await app.setViewportSize({ width: WIDTH, height: 1000 });
await app.getByRole("tab", { name: EN ? "Day by day" : "Gün gün", exact: true }).click();
await app.waitForTimeout(800);
await app.screenshot({ path: `${out}/04-days.png` });
// Belgeler from the ••• menu, then the Pano.
await app.getByRole("button", { name: EN ? "Trip menu" : "Gezi menüsü" }).click();
await app.screenshot({ path: `${out}/05-menu.png`, clip: { x: 0, y: 0, width: WIDTH, height: 700 } });
await app.locator(".menu").getByRole("button", { name: EN ? "Documents" : "Belgeler", exact: true }).click();
await app.waitForTimeout(600);
await app.screenshot({ path: `${out}/06-docs.png` });
await app.getByRole("tab", { name: /^(Pano|Board)$/ }).click();
await app.waitForTimeout(800);
await app.screenshot({ path: `${out}/07-pano.png` });
console.log("errors:", JSON.stringify(errors));
await context.close();
