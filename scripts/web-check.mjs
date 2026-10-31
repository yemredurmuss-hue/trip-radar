// The web build (scripts/build-web.mjs) still opens as a page: the board loads with no uncaught error and the shim's
// storage answers as chrome.storage does. Run before a release with the e2e, so an extension-only API added to the board
// shows up here instead of as a blank web page. Usage: node scripts/web-check.mjs   (CHROMIUM_PATH as in scripts/e2e.mjs)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import * as esbuild from "esbuild";
import { chromium } from "playwright-core";

function macChromium() {
  const cache = path.join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))) {
    for (const arch of ["chrome-mac-arm64", "chrome-mac", "chrome-mac-x64"]) {
      const exe = path.join(cache, dir, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}
const executablePath =
  process.env.CHROMIUM_PATH ?? (process.platform === "darwin" ? macChromium() : null) ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Its own folder: a running `npm run web` keeps serving dist-web.
const out = "dist-web-check";
execFileSync("node", ["scripts/build-web.mjs", `--out=${out}`], { stdio: "inherit" });
const ctx = await esbuild.context({});
const { port } = await ctx.serve({ servedir: out, port: 0, host: "127.0.0.1" });
const browser = await chromium.launch({ executablePath, args: ["--lang=tr-TR"] });
const errors = [];
try {
  const page = await browser.newPage({ locale: "tr-TR", viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByText("Sıradaki gezi nereye?").waitFor({ timeout: 15_000 });
  // The worker's first run (onStartup) has had time to touch every API it uses.
  await page.waitForTimeout(3_000);
  assert.deepEqual(errors, [], `web build: uncaught errors\n${errors.join("\n")}`);

  const storage = await page.evaluate(async () => {
    const seen = [];
    chrome.storage.onChanged.addListener((changes, area) => seen.push([area, Object.keys(changes)]));
    await chrome.storage.local.set({ webCheck: { n: 1 } });
    const got = await chrome.storage.local.get({ webCheck: null, missing: "fallback" });
    await chrome.storage.local.remove("webCheck");
    const gone = await chrome.storage.local.get("webCheck");
    return { got, gone, seen };
  });
  assert.deepEqual(storage.got, { webCheck: { n: 1 }, missing: "fallback" });
  assert.deepEqual(storage.gone, {});
  assert.deepEqual(storage.seen, [["local", ["webCheck"]], ["local", ["webCheck"]]]);
  console.log("web-check: OK (board loads, no uncaught error, storage shim answers)");
} finally {
  await browser.close();
  await ctx.dispose();
}
