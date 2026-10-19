// v82 geçişi: screenshots of the built board with the sample trip, to set beside the approved prototype
// (plan-v32-tasarim: docs/mockups/plan-v83-turler/index.html). No assertions. Run after `npm run build`:
//   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/v82-shots.mjs [label] [tr|en]
// → e2e-output/v82/<label>/<width>-{top,hero,sec-N-id}.png at 1440, 1280, 860 and 390 px, and heights.json (each intent box's
// height by width). "en" draws the board in English (the browser's language, as the e2e's English parts do: lib/i18n browserLang).
// A pointer that hovers, as in the e2e (what shows only on hover stays hidden).
import { chromium } from "playwright-core";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const label = process.argv[2] ?? "now";
const lang = process.argv[3] === "en" ? "en-US" : "tr-TR";
const out = path.resolve(`e2e-output/v82/${label}`);
mkdirSync(out, { recursive: true });
const extension = path.resolve("dist");
const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "trip-radar-v82-")), {
  executablePath: process.env.CHROMIUM_PATH,
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: 1440, height: 1000 },
  locale: lang,
  args: ["--headless=new", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4", `--lang=${lang}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
await context.addInitScript(() => { try { sessionStorage.setItem("trip-radar:opening-off", "1"); } catch {} });
await context.route(/^https?:\/\/(?!generativelanguage\.googleapis|api\.anthropic)/, (route) =>
  route.request().resourceType() === "image" ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ status: 404, json: {} }));
await context.clock.install({ time: new Date("2026-10-05T10:00:00") });
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const id = new URL(worker.url()).host;
for (const p of context.pages()) if (p.url().includes("app.html")) await p.close();
const app = await context.newPage();
const errors = [];
app.on("pageerror", (e) => errors.push(e.message));
app.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await app.goto(`chrome-extension://${id}/app.html`);
await app.getByText(/Örnek geziyi yükle →|Load the sample trip →/).click();
await app.getByRole("heading", { name: /Portekiz \(örnek\)|\(sample\)/ }).waitFor();
await app.waitForTimeout(1500);
const heights = {};
for (const width of [1440, 1280, 860, 390]) {
  await app.setViewportSize({ width, height: 1000 });
  // (from the top: the widths before left the page where their last category opened)
  await app.evaluate(() => { scrollTo(0, 0); document.querySelector(".panel")?.scrollTo(0, 0); });
  await app.waitForTimeout(500);
  await app.screenshot({ path: `${out}/${width}-top.png` });
  const hero = app.locator(".x-hero, .hx").first();
  if (await hero.count()) await hero.screenshot({ path: `${out}/${width}-hero.png` }).catch(() => undefined);
  // Every category open, one at a time (the plan is an accordion), each shot whole.
  const secs = app.locator(".q-sec, .cat-sec");
  const n = await secs.count();
  heights[width] = [];
  for (let i = 0; i < n; i++) {
    const sec = secs.nth(i);
    const head = sec.locator(".q-row1, .cat-title").first();
    // A v82 category (q-sec) is open with "open"; an old one (cat-sec) is open unless "closed".
    if (!(await sec.evaluate((el) => (el.classList.contains("q-sec") ? el.classList.contains("open") : !el.classList.contains("closed"))))) await head.click().catch(() => undefined);
    await app.waitForTimeout(450);
    const sid = (await sec.getAttribute("data-section")) ?? (await sec.getAttribute("id")) ?? String(i);
    await sec.screenshot({ path: `${out}/${width}-sec-${i}-${sid}.png` }).catch(() => undefined);
    heights[width].push(...(await sec.locator(".q-int").evaluateAll((els) => els.map((e) => `${e.id || e.dataset.kind}:${e.dataset.st ?? ""}:${Math.round(e.getBoundingClientRect().height)}`))));
  }
  const overflow = await app.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  heights[width].push(`overflow:${overflow}`);
}
writeFileSync(`${out}/heights.json`, JSON.stringify({ heights, errors }, null, 1));
console.log(JSON.stringify({ out, errors: errors.length }, null, 0));
await context.close();
