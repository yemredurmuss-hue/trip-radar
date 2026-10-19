// Chrome Web Store screenshots (0.38.0, v82 design): the sample trip (Portugal) at 1280×800, into store/:
//   1-hero        the hero (mosaic, strip, chips) and the Plan's head with its category rows
//   2-plan        Konaklama open: the intent boxes on their rail (one fixed size in every state)
//   3-activities  Etkinlik ve turlar open: a city's two rows, Planında and Öneriler
//   4-days        the Plan in trip order (Yolculuk sırasıyla): its chapters and steps
// Run after `npm run build`:
//   CHROMIUM_PATH=/path/to/chrome node scripts/store-shots.mjs [--offline]
// The pointer hovers, as in the e2e (what shows only on hover stays hidden until hovered). The clock is the sample's
// (5 October 2026, three days before it starts). The photo sources the hero asks (Wikipedia, Wikimedia, the sharing
// server's city-image function, Unsplash and Pexels) are let through so the mosaic shows real photos with their credits;
// everything else is answered 404 (no AI, no offers). --offline answers those 404 too: the hero then shows its plain
// cover, as a trip with no photo does. scripts/store-assets.mjs makes the icons and the promo tile.
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
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

const offline = process.argv.includes("--offline");
const executablePath = process.env.CHROMIUM_PATH ?? macChromium();
const extension = path.resolve("dist");
if (!existsSync(path.join(extension, "manifest.json"))) throw new Error("dist/ is missing: run `npm run build` first");

const PHOTOS = /^https:\/\/([a-z]+\.wikipedia\.org|upload\.wikimedia\.org|images\.unsplash\.com|images\.pexels\.com|[a-z0-9-]+\.supabase\.co\/functions\/v1\/city-image)/i;
const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "tr-store-shots-")), {
  executablePath,
  headless: false,
  timezoneId: "Europe/Istanbul",
  locale: "tr-TR",
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  args: [
    "--headless=new",
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "--lang=tr-TR",
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
try {
  // The opening's animation is not what a still shows.
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("trip-radar:opening-off", "1");
    } catch {
      // no storage: the opening plays and is waited out below
    }
  });
  await context.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (!offline && PHOTOS.test(url)) return route.continue();
    return route.request().resourceType() === "image" ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ status: 404, json: {} });
  });
  await context.clock.install({ time: new Date("2026-10-05T10:00:00") });

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  for (const p of context.pages()) if (p.url().includes("app.html")) await p.close();
  const app = await context.newPage();
  const errors = [];
  app.on("pageerror", (e) => errors.push(e.message));
  await app.goto(`chrome-extension://${id}/app.html`);
  await app.getByText("Örnek geziyi yükle →").click();
  await app.getByRole("heading", { name: "Portekiz (örnek)" }).waitFor();
  // The city photos and the mosaic's tiles (80 ms apart) come in.
  await app.waitForTimeout(offline ? 1500 : 6000);

  const top = () => app.evaluate(() => {
    scrollTo(0, 0);
    document.querySelector(".panel")?.scrollTo(0, 0);
  });
  /** A category open (the plan is an accordion: opening one shuts the other) and its head at the top. */
  const openSection = async (sid) => {
    const sec = app.locator(`.q-sec[data-section="${sid}"]`);
    if (!(await sec.evaluate((el) => el.classList.contains("open")))) await sec.locator(".q-row1").first().click();
    await app.waitForTimeout(900);
    await sec.evaluate((el) => el.scrollIntoView({ block: "start" }));
  };
  const shot = async (name) => {
    // Away from anything that shows on hover.
    await app.mouse.move(1270, 790);
    await app.waitForTimeout(700);
    await app.screenshot({ path: `store/screenshot-${name}.png` });
  };

  await top();
  await shot("1-hero");
  await openSection("stay");
  await shot("2-plan");
  await openSection("activity");
  await shot("3-activities");
  await top();
  await app.getByRole("tab", { name: "Yolculuk sırasıyla" }).click();
  await app.waitForTimeout(900);
  // The Plan's head with its switch just under the thin bar that pins over the plan once the hero is gone.
  await app.locator(".q-planbar").first().evaluate((el) => {
    el.style.scrollMarginTop = "76px";
    el.scrollIntoView({ block: "start" });
  });
  await shot("4-days");
  console.log(JSON.stringify({ written: "store/screenshot-{1-hero,2-plan,3-activities,4-days}.png", offline, errors }));
} finally {
  await context.close();
}
