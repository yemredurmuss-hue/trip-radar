// Chrome Web Store assets (0.36): the extension's icons (16, 32, 48, 128 px, from store/icon.svg, into
// static/icons), the small promo tile (440×280) and screenshots (1280×800) of the sample trip, into store/.
// Run after `npm run build`: node scripts/store-assets.mjs
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

function macChromium() {
  const cache = path.join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium")).sort().reverse()) {
    for (const arch of ["chrome-mac-arm64", "chrome-mac", "chrome-mac-x64"]) {
      const exe = path.join(cache, dir, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}
const executablePath = process.env.CHROMIUM_PATH ?? macChromium();
const svg = readFileSync("store/icon.svg", "utf8");
mkdirSync("static/icons", { recursive: true });
const extension = path.resolve("dist");
const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "tr-store-")), {
  executablePath,
  headless: false,
  locale: "tr-TR",
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  args: ["--headless=new", "--lang=tr-TR", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  // Icons.
  const page = await context.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.locator("svg").screenshot({ path: `static/icons/icon-${size}.png`, omitBackground: true });
  }
  // The small promo tile.
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(`<style>html,body{margin:0}body{width:440px;height:280px;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;background:linear-gradient(135deg,#f6f3ff,#e9f6f3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d1d1f}svg{width:110px;height:110px;flex:none}b{display:block;font-size:34px;letter-spacing:-.02em}span{display:block;margin-top:8px;font-size:17px;line-height:1.35;color:#3a3a3c}</style>${svg}<div><b>Trip Radar</b><span>Gezerken bulduğunu kaydet; AI karşılaştırsın, gün gün plana koysun.</span></div>`);
  await page.screenshot({ path: "store/promo-440x280.png" });
  await page.close();

  // Screenshots of the sample trip at 1280×800.
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  for (const p of context.pages()) if (p.url().includes("#settings")) await p.close();
  const app = await context.newPage();
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  await app.waitForTimeout(2500);
  const shot = async (name, scroll) => {
    if (scroll) await scroll();
    await app.waitForTimeout(600);
    await app.screenshot({ path: `store/screenshot-${name}.png` });
  };
  await shot("1-hero");
  const tab = (name) => app.getByRole("tab", { name, exact: true });
  await shot("2-plan", () => app.locator(".cat-plan").evaluate((el) => el.scrollIntoView({ block: "start" })));
  await shot("3-activities", () => app.locator('.cat-sec[data-section="activity"]').evaluate((el) => el.scrollIntoView({ block: "start" })));
  await tab("Günlük akış").click();
  await shot("4-days", () => app.locator(".dl, .dc").first().evaluate((el) => el.scrollIntoView({ block: "start" })));
  console.log("store assets written: static/icons/*, store/promo-440x280.png, store/screenshot-*.png");
} finally {
  await context.close();
}
