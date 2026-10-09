// Screenshots of the live board beside the approved drawing, for a side-by-side look (no assertions): the sample trip's
// Plan head, each section, and the Pano; and the same parts of docs/mockups/2026-10-08-japonya-web-v11.html (state C,
// "Karar ve rezerve"). Run after `npm run build`: `node scripts/shots.mjs` → e2e-output/shots/{live,mock}-*.png.
import { chromium } from "playwright-core";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = path.resolve("e2e-output/shots");
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

if (only !== "mock") {
  const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-shots-")), {
    executablePath,
    headless: false,
    timezoneId: "Europe/Istanbul",
    viewport: { width: 1440, height: 1000 },
    locale: "tr-TR",
    args: ["--headless=new", "--lang=tr-TR", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await context.route("**/functions/v1/offers**", (route) => route.fulfill({ json: { offers: [] } }));
  await context.route(/functions\/v1\/(web-search|city-image)/, (route) => route.fulfill({ json: { answer: null, url: null, reason: "not-configured" } }));
  await context.clock.install({ time: new Date("2026-10-05T10:00:00") });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  for (const p of context.pages()) if (p.url().includes("app.html")) await p.close();
  const app = await context.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await app.waitForTimeout(1500);
  // Every section open, as the drawing shows them.
  for (const s of await app.locator(".cat-sec.closed .cat-title").all()) await s.click();
  await app.waitForTimeout(600);
  await app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await app.waitForTimeout(400);
  await app.screenshot({ path: `${out}/live-top.png` });
  await app.locator(".hx").first().screenshot({ path: `${out}/live-hero.png` }).catch(() => undefined);
  const secs = app.locator(".cat-sec");
  for (let i = 0; i < (await secs.count()); i++) {
    const sid = await secs.nth(i).getAttribute("data-section");
    await secs.nth(i).screenshot({ path: `${out}/live-sec-${i}-${sid}.png` });
  }
  await app.getByRole("tab", { name: "Pano", exact: true }).click().catch(() => undefined);
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
