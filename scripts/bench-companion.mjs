// Ölçüm: sitedeki "+" betiğinin (companion.js) canlı bir arama sayfasına maliyeti. Emre 2026-10-29: "Skyscanner açınca
// donuyor, Gizli pencerede donmuyor". Sahte bir Skyscanner sonuç sayfası canlı arama gibi sürekli değişir (dönen fiyat
// simgeleri, gelen sonuçlar, yeniden sıralama, ara sıra kaydırma); betik hiç yokken, eski derlemeyle ve yenisiyle sayfanın
// harcadığı süre Chrome'un kendi sayaçlarıyla (CDP Performance) ölçülür. Eklentinin kendisi yüklenmez: betik sayfaya
// konur, chrome.runtime taklit edilir (cevaplar sabit), böylece fark yalnız betiğin kendi işidir.
//
//   node scripts/bench-companion.mjs [eski.js] [yeni.js]   (varsayılan yeni: dist/companion.js; SECONDS=30)
import { chromium } from "playwright-core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const SECONDS = Number(process.env.SECONDS ?? 30);
const ROUNDS = Number(process.env.ROUNDS ?? 2);
const URL = "https://www.skyscanner.com.tr/transport/flights/ist/lis/261110/261114/?adultsv2=2&cabinclass=economy&rtn=1";

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

// A results page the size of Skyscanner's: filters, 60 results (airline, logo, two hours, a price with its spinner, a
// link), a footer; its own script keeps changing it as a live search does.
const PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Cheap flights from Istanbul to Lisbon on Skyscanner</title>
<style>body{font:14px system-ui;margin:0}.wrap{display:flex;gap:24px;max-width:1200px;margin:0 auto}.f{width:260px}.res{flex:1}
.card{display:flex;justify-content:space-between;border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0;min-height:110px;background:#fff}
.spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid #39f;border-top-color:transparent;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}.side{width:220px}</style></head><body>
<header><h1>İstanbul - Lizbon</h1><nav>${Array.from({ length: 40 }, (_, i) => `<a href="/x${i}">Bağlantı ${i}</a>`).join(" ")}</nav></header>
<div class="wrap"><aside class="f">${Array.from({ length: 30 }, (_, i) => `<label><input type="checkbox"> Filtre ${i} <small>from ${1000 + i * 37} TL</small></label><br>`).join("")}</aside>
<main class="res" id="res"></main><aside class="side">${Array.from({ length: 6 }, (_, i) => `<div class="ad"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="200" height="150" alt=""><p>Reklam ${i}</p></div>`).join("")}</aside></div>
<footer>${Array.from({ length: 200 }, (_, i) => `<span>Altbilgi metni ${i}</span>`).join(" ")}</footer>
<script>
const AIR = ["AJet", "Pegasus Airlines", "Turkish Airlines", "TAP Air Portugal", "Lufthansa"];
let n = 0;
function card() {
  const i = n++, h = 6 + (i % 14), m = (i * 7) % 60, dur = 4 + (i % 3);
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = '<div><b>' + AIR[i % 5] + '</b><br><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="48" height="48" alt="">' +
    '<span class="t">' + String(h).padStart(2, "0") + ':' + String(m).padStart(2, "0") + '</span> → <span>' + String(h + dur).padStart(2, "0") + ':' + String(m).padStart(2, "0") +
    '</span> <small>' + dur + 'h 20 · Direct</small></div><div><span class="p">' + (1300 + ((i * 97) % 2500)).toLocaleString("en") + ' TL</span> <i class="spin"></i>' +
    '<br><a href="/book/' + i + '">Select →</a></div>';
  return d;
}
const res = document.getElementById("res");
for (let i = 0; i < 25; i++) res.append(card());
// The live search: spinners turn (CSS), prices change, results arrive, the list is sorted again.
setInterval(() => { const ps = document.querySelectorAll(".p"); const p = ps[Math.floor(Math.random() * ps.length)]; if (p) p.textContent = (1300 + Math.floor(Math.random() * 2500)).toLocaleString("en") + " TL"; }, 900);
setInterval(() => { if (res.children.length < 60) res.append(card()); }, 1500);
setInterval(() => { const cs = [...res.children]; cs.sort(() => Math.random() - 0.5); res.append(...cs); }, 5000);
</script></body></html>`;

// chrome.runtime as the content script sees it, with fixed answers (a planned flight's trip, nothing saved).
const STUB = `(() => {
  const where = { trip: { id: "t1", title: "Lizbon" }, country: "Portekiz", trips: [{ id: "t1", title: "Lizbon", when: "10–14 Kas", match: true, photos: [] }], picks: ["t1"], saved: false, names: [] };
  const route = { tripId: "t1", title: "Lizbon", from: "IST", to: "LIS", day: "2026-11-10", deck: [], chosen: null };
  const answer = (m) => m.type === "desk:where" ? where : m.type === "desk:route" ? route : m.type === "desk:pocket" ? { trip: { id: "t1", title: "Lizbon", count: 3, decks: { flight: 3 } }, rows: [], key: true, waiting: 0 } : null;
  window.__asks = 0;
  const chromeStub = {
    runtime: { id: "bench", lastError: undefined, sendMessage: (m, cb) => { window.__asks++; setTimeout(() => cb && cb(answer(m)), 5); }, getURL: (p) => p },
    storage: { local: { get: async () => ({}), set: async () => undefined } },
  };
  // (a page's own window.chrome can't be replaced: its runtime and storage are filled in)
  const c = window.chrome ?? (window.chrome = {});
  c.runtime = chromeStub.runtime;
  c.storage = chromeStub.storage;
})();`;

const executablePath = process.env.CHROMIUM_PATH ?? macChromium();
const builds = [
  { name: "betik yok", file: null },
  { name: "eski (0.47.25)", file: process.argv[2] ?? null },
  { name: "yeni", file: process.argv[3] ?? "dist/companion.js" },
].filter((b, i) => i === 0 || (b.file && existsSync(b.file)));

const browser = await chromium.launch({ executablePath, headless: true, args: ["--headless=new"] });
const metric = (list, name) => list.metrics.find((m) => m.name === name)?.value ?? 0;
const results = Object.fromEntries(builds.map((b) => [b.name, []]));
try {
  for (let round = 0; round < ROUNDS; round++) {
    for (const b of builds) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
      await ctx.route("https://www.skyscanner.com.tr/**", (r) => r.fulfill({ contentType: "text/html", body: PAGE }));
      const page = await ctx.newPage();
      if (b.file) await page.addInitScript(STUB);
      await page.goto(URL);
      if (b.file) await page.addScriptTag({ content: readFileSync(b.file, "utf8") });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Performance.enable");
      await page.waitForTimeout(1000);
      const half = (SECONDS * 1000) / 2;
      const m0 = await cdp.send("Performance.getMetrics");
      // Phase 1: the page open, nobody touching it (the traveller typing in another app).
      await page.waitForTimeout(half);
      const m1 = await cdp.send("Performance.getMetrics");
      // Phase 2: a traveller scrolling and moving the mouse over the results.
      const t0 = Date.now();
      while (Date.now() - t0 < half) {
        const s = Math.floor((Date.now() - t0) / 1000);
        if (s % 4 < 2) await page.mouse.wheel(0, s % 8 < 4 ? 400 : -400);
        else await page.mouse.move(600 + (s % 7) * 20, 300 + (s % 5) * 40);
        await page.waitForTimeout(250);
      }
      const m2 = await cdp.send("Performance.getMetrics");
      const d = (a, b, k) => (metric(b, k) - metric(a, k)) * 1000;
      const pins = await page.evaluate(() => Boolean(document.getElementById("trip-radar-companion")));
      const asks = await page.evaluate(() => window.__asks ?? 0);
      results[b.name].push({ idle: d(m0, m1, "TaskDuration"), idleLayouts: metric(m1, "LayoutCount") - metric(m0, "LayoutCount"), active: d(m1, m2, "TaskDuration"), activeLayouts: metric(m2, "LayoutCount") - metric(m1, "LayoutCount"), pins, asks });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

const avg = (xs, k) => xs.reduce((s, x) => s + x[k], 0) / xs.length;
const half = (SECONDS * 1000) / 2;
const none = results["betik yok"];
console.log(`\nYarısı boşta, yarısı kaydırma ve fare (${SECONDS} sn, ${ROUNDS} tur ortalaması; ms ana iş parçacığı, # yerleşim hesabı):`);
console.log("derleme".padEnd(16), "boşta ms".padStart(9), "boşta #".padStart(8), "betik payı".padStart(11), "kullanım ms".padStart(12), "kullanım #".padStart(11), "betik payı".padStart(11));
for (const b of builds) {
  const xs = results[b.name];
  const extra = (k) => (b.file ? `+${(avg(xs, k) - avg(none, k)).toFixed(0)} (${(((avg(xs, k) - avg(none, k)) / half) * 100).toFixed(1)}%)` : "—");
  console.log(
    b.name.padEnd(16),
    avg(xs, "idle").toFixed(0).padStart(9),
    avg(xs, "idleLayouts").toFixed(0).padStart(8),
    extra("idle").padStart(11),
    avg(xs, "active").toFixed(0).padStart(12),
    avg(xs, "activeLayouts").toFixed(0).padStart(11),
    extra("active").padStart(11),
    b.file ? ` + çizildi: ${xs.every((x) => x.pins)}, soru: ${avg(xs, "asks").toFixed(0)}` : "",
  );
}
