// Screenshots of the v46 screens on three trips, to look at (no assertions): the sample (Portekiz, classic), Ozora (a festival: the
// reason, a camp, a car to pick up and drop, the closed tours note, rest after it) and "states" (a flight, a stay, a ride and a tour in
// every look: empty, searching, our pick, chosen, booked, arranged). Per trip: the Plan head, the sticky bar, the cards of each section,
// the three Plan views, the Pano, the chat, the trip menu, the backs, the ⓘ balloons, the detail windows; and the page's horizontal overflow.
// Run after `npm run build`: `[SHOTS_WIDTH=390] [SHOTS_LANG=en] [SHOTS_TRIPS=sample,ozora,states] node scripts/v30-shots.mjs [out-dir]`.
// Files are `<trip>-<name>.png`. CHROMIUM_PATH picks the browser (the Playwright cache on a Mac, /opt/pw-browsers on the Linux box).
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "e2e-output/v46");
mkdirSync(out, { recursive: true });
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = path.join(homedir(), "Library/Caches/ms-playwright");
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium")).sort().reverse())
      for (const arch of ["chrome-mac-arm64", "chrome-mac", "chrome-mac-x64"]) {
        const exe = path.join(cache, dir, arch, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
        if (existsSync(exe)) return exe;
      }
  }
  const linux = "/opt/pw-browsers";
  if (existsSync(linux)) for (const dir of readdirSync(linux).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
    const exe = path.join(linux, dir, "chrome-linux/chrome");
    if (existsSync(exe)) return exe;
  }
  return undefined;
}
const WIDTH = Number(process.env.SHOTS_WIDTH ?? 1440);
const EN = process.env.SHOTS_LANG === "en";

// ---- The mockup side (plan v46, F10): SHOTS_MOCKUP=<path of docs/mockups/plan-v46-sira/index.html, from `git show origin/plan-v30-wip:...`>
// shoots the drawing at SHOTS_WIDTH into <out-dir>: Japonya (acts B and C, and A: prompt only) and Ozora, the Plan's sections, the three
// views, the Pano, the chat, the backs, the ⓘ balloons, the detail windows, the three stages and the time states. TR only (the drawing has no EN).
if (process.env.SHOTS_MOCKUP) {
  const W = WIDTH;
  const b = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: W, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.route(/images\.kiwi\.com|google/, (r) => r.abort());
  await p.goto("file://" + path.resolve(process.env.SHOTS_MOCKUP));
  await p.waitForTimeout(1500);
  const mstep = async (name, fn) => { try { await fn(); } catch (e) { console.log("FAIL", name, String(e).split("\n")[0].slice(0, 120)); } };
  const shotEl = (name, sel, nth = 0) => mstep(name, async () => { await p.locator(sel).nth(nth).screenshot({ path: `${out}/${name}.png`, timeout: 8000 }); });
  const shotVp = (name) => mstep(name, async () => { await p.screenshot({ path: `${out}/${name}.png` }); });
  const overflow = async (tag) => console.log("OVERFLOW", tag, await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
  const clickText = async (sel, re) => { await p.locator(sel).filter({ hasText: re }).first().click(); await p.waitForTimeout(500); };
  const runs = [["japonya", 0, "B"], ["japonya-karar", 0, "C"], ["japonya-prompt", 0, "A"], ["ozora", 1, "C"]];
  for (const [tag, t, act] of runs) {
    await mstep("trip", async () => { await p.locator("#trips button").nth(t).click(); await p.waitForTimeout(500); });
    await mstep("act", async () => { await clickText("#tabs button", new RegExp({A:"Yalnız",B:"Prompt",C:(t===1?"Festival":"Karar")}[act])); await p.waitForTimeout(500); });
    await mstep("stage3", async () => { await p.evaluate(() => setStage(3)); await p.waitForTimeout(2800); });
    await mstep("plan", async () => { await p.evaluate(() => window.scrollTo(0, 0)); await p.locator(".topnav button").first().click(); await p.waitForTimeout(500); await clickText(".planbar button", /Kategoriye/); await p.waitForTimeout(2500); });
    await shotVp(`${tag}-01-top`);
    await p.evaluate(() => { let st = document.getElementById("hm"); if (!st) { st = document.createElement("style"); st.id = "hm"; st.textContent = "#mhRoot{display:none!important}" + (innerWidth < 700 ? ".chat{display:none!important}" : ""); document.head.appendChild(st); } });
    await overflow(tag + " plan");
    const full = ["flight", "stay", "transport", "activity", "todo", "docs", "prep", "insp"];
    const n = await p.locator(".main .sec").count();
    for (let i = 0; i < n; i++) await shotEl(`${tag}-sec-${full[i]}`, ".main .sec", i);
    await shotEl(`${tag}-journey`, ".main .journey");
    await shotEl(`${tag}-hero`, ".main .hero");
    await shotEl(`${tag}-chat`, ".chat");
    await mstep("sticky", async () => { await p.evaluate(() => { const st = document.getElementById("hm"); if (st) st.remove(); window.scrollTo(0, 1500); }); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${tag}-02-sticky.png`, clip: { x: 0, y: 0, width: W, height: 220 } }); await p.evaluate(() => { window.scrollTo(0, 0); const st = document.createElement("style"); st.id = "hm"; st.textContent = "#mhRoot{display:none!important}" + (innerWidth < 700 ? ".chat{display:none!important}" : ""); document.head.appendChild(st); }); });
    // views
    await mstep("story", async () => { await clickText(".planbar button", /Yolculuk/); await p.waitForTimeout(1500); });
    await shotEl(`${tag}-view-story`, "#view .main"); await overflow(tag + " story");
    await mstep("days", async () => { await clickText(".planbar button", /Gün gün/); await p.waitForTimeout(1500); });
    await shotEl(`${tag}-view-days`, "#view .main"); await overflow(tag + " days");
    await mstep("pano", async () => { await p.locator(".topnav button").nth(1).click(); await p.waitForTimeout(1800); });
    await shotEl(`${tag}-view-pano`, "#view .pano"); await overflow(tag + " pano");
    await mstep("back to plan", async () => { await p.locator(".topnav button").first().click(); await p.waitForTimeout(500); await clickText(".planbar button", /Kategoriye/); await p.waitForTimeout(1500); });
    // menu
    await mstep("menu", async () => { await p.locator(".tripmore").click(); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${tag}-menu.png`, clip: { x: 0, y: 0, width: W, height: 500 } }); await p.keyboard.press("Escape"); await p.mouse.click(5, 5); });
    // back faces
    for (const [si, sn] of [[0, "flight"], [1, "stay"], [2, "transport"]]) {
      await mstep("back " + sn, async () => {
        const btn = p.locator(".main .sec").nth(si).locator(".chg").first();
        if (!(await btn.count())) { console.log("no chg in", tag, sn); return; }
        await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(1200);
        await p.locator(".main .sec").nth(si).screenshot({ path: `${out}/${tag}-back-${sn}.png` }); await overflow(tag + " back " + sn);
        await p.keyboard.press("Escape"); await p.evaluate(() => { if (typeof openK !== "undefined") { openK = null; rerender(); } }); await p.waitForTimeout(500);
      });
    }
    // info balloons
    for (const [si, sn] of [[0, "flight"], [1, "stay"], [2, "transport"]]) {
      await mstep("info " + sn, async () => {
        const inf = p.locator(".main .sec").nth(si).locator(".inf").first();
        if (!(await inf.count())) { console.log("no inf", tag, sn); return; }
        await inf.scrollIntoViewIfNeeded(); await inf.hover(); await p.waitForTimeout(600);
        const bb = await p.locator(".main .sec").nth(si).boundingBox();
        await p.screenshot({ path: `${out}/${tag}-info-${sn}.png`, clip: { x: Math.max(0, bb.x), y: Math.max(0, bb.y), width: Math.min(bb.width, W), height: Math.min(bb.height + 100, 1400) }, fullPage: true });
        await p.mouse.move(0, 0);
      });
    }
    // detail windows
    await mstep("detail", async () => {
      const r = await p.evaluate(() => { const s = stateFor(cur); const k = Object.keys(s.slots).find((x) => s.slots[x].m === "rez"); const e = (s.planned || []).find(([x, m]) => m === "rez"); return { k, e: e && e[0] }; });
      if (r.k) { await p.evaluate((k) => openDetail(k), r.k); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${tag}-detail-card.png` }); await p.keyboard.press("Escape"); await p.evaluate(() => { try { closePicker(); } catch (e) {} }); await p.waitForTimeout(300); }
      if (r.e) { await p.evaluate((k) => openEvDetail(k), r.e); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${tag}-detail-event.png` }); await p.evaluate(() => { try { closePicker(); } catch (e) {} }); await p.waitForTimeout(300); }
    });
  }
  // stages and time states, on Japonya C and Ozora C
  for (const [tag, t, act] of [["japonya-karar", 0, "C"], ["ozora", 1, "C"]]) {
    await mstep("trip", async () => { await p.locator("#trips button").nth(t).click(); await p.waitForTimeout(400); await clickText("#tabs button", new RegExp({A:"Yalnız",B:"Prompt",C:(t===1?"Festival":"Karar")}[act])); });
    for (const st of [1, 2]) {
      await mstep("stage" + st, async () => { await p.evaluate((n) => setStage(n), st); await p.waitForTimeout(st === 1 ? 600 : 4500); });
      for (let i = 0; i < 4; i++) await shotEl(`${tag}-stage${st}-sec-${["flight","stay","transport","activity"][i]}`, ".main .sec", i);
    }
    await mstep("stage3", async () => { await p.evaluate(() => setStage(3)); await p.waitForTimeout(2500); });
    for (const [nm, re] of [["soon", /Yaklaşınca/], ["flightday", /Uçuş günü/], ["delay", /Rötar/], ["landed", /İndi/]]) {
      await mstep("now " + nm, async () => { await clickText("#nowsel button", re); await p.waitForTimeout(1500); });
      await shotEl(`${tag}-now-${nm}-flight`, ".main .sec", 0);
      await shotEl(`${tag}-now-${nm}-transport`, ".main .sec", 2);
    }
    await mstep("nowreset", async () => { await clickText("#nowsel button", /Bugün/); });
  }

  console.log("mockup pageerrors", JSON.stringify(errs));
  await b.close();
  process.exit(0);
}
const TRIPS = (process.env.SHOTS_TRIPS ?? "sample,ozora,states").split(",").filter(Boolean);
// SHOTS_PROFILE keeps the browser profile (the seeded trips) in that folder, for probing it afterwards; SHOTS_TRIPS="" only seeds.
const context = await chromium.launchPersistentContext(process.env.SHOTS_PROFILE ?? mkdtempSync(path.join(tmpdir(), "trip-radar-v30-")), {
  executablePath: findChromium(),
  headless: false,
  timezoneId: "Europe/Istanbul",
  viewport: { width: WIDTH, height: 1000 },
  locale: EN ? "en-US" : "tr-TR",
  args: ["--headless=new", "--hide-scrollbars", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4", EN ? "--lang=en-US" : "--lang=tr-TR", `--disable-extensions-except=${path.resolve(process.env.SHOTS_DIST ?? "dist")}`, `--load-extension=${path.resolve(process.env.SHOTS_DIST ?? "dist")}`],
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

// ---- Seeds. The sample: its saved train is chosen (a ride card to look at) and a fellow traveller's booked stay (corner faces).
const sampleId = await app.evaluate(async () => {
  const request = indexedDB.open("trip-radar");
  const database = await new Promise((resolve, reject) => ((request.onsuccess = () => resolve(request.result)), (request.onerror = () => reject(request.error))));
  const tx = database.transaction("items", "readwrite");
  const items = tx.objectStore("items");
  const all = await new Promise((resolve) => (items.getAll().onsuccess = (e) => resolve(e.target.result)));
  const train = all.find((i) => i.category === "transport" && i.status === "saved");
  if (train) items.put({ ...train, status: "chosen", provider: train.provider ?? "Comboios de Portugal", addedBy: "ai", updatedAt: Date.now() });
  const stay = all.find((i) => i.category === "stay" && i.status === "booked");
  if (stay) items.put({ ...stay, addedBy: "Sabine" });
  await new Promise((resolve) => (tx.oncomplete = resolve));
  new BroadcastChannel("trip-radar").postMessage("changed");
  return all[0].tripId;
});

// Ozora (a festival) and "states" (every look of the four kinds of cards), written straight into the database.
const seeded = await app.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
  const all = (s) => new Promise((r) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
  const trips = await all("trips");
  const items = await all("items");
  const sample = trips[0];
  const stay0 = items.find((i) => i.name === "Lisboa Loft");
  const now = Date.now();
  const mk = (tripId, o) => ({
    ...stay0, tripId, captureIds: [], needKey: null, createdAt: now, updatedAt: now, rating: { value: null, scale: null, count: null, source: "none" },
    cancellation: { summary: null, freeUntil: null, source: "none" }, imageUrl: null, url: null, provider: null, ...o, id: crypto.randomUUID(),
    metrics: { ...stay0.metrics, ...(o.metrics ?? {}) },
  });
  const price = (amount, scope = "per_person") => ({ amount, currency: "EUR", scope, taxesIncluded: "yes", source: "page", observedAt: now });
  const guests = { adults: 2, children: null, rooms: 1 };
  const flightOf = (tripId, o) => mk(tripId, { category: "flight", guests, price: price(160, "total"), ...o, flight: o.flight ?? { from: o.from, to: o.to, departure: o.dep ?? null, arrival: o.arr ?? null, carrier: o.carrier ?? null, flightNumber: o.nr ?? null, stops: o.stops ?? 0 }, metrics: { durationMinutes: o.min ?? 130 } });
  const none = { amount: null, currency: "EUR", scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now };

  // ---- Ozora
  const oz = "ozora-trip";
  const base = { country: "Macaristan", countryCode: "HU" };
  const ozItems = [
    flightOf(oz, { ...base, name: "TK · İstanbul → Budapeşte", provider: "Turkish Airlines", city: "Budapeşte", status: "booked", needKey: "flight:ist-bud", dates: { start: "2027-07-24", end: null, source: "page" }, from: "IST", to: "BUD", dep: "2027-07-24T09:40", arr: "2027-07-24T10:55", carrier: "TK", nr: "TK1033", addedBy: "Emre" }),
    flightOf(oz, { ...base, name: "TK · Budapeşte → İstanbul", provider: "Turkish Airlines", city: "İstanbul", status: "booked", needKey: "flight:bud-ist", dates: { start: "2027-08-03", end: null, source: "page" }, from: "BUD", to: "IST", dep: "2027-08-03T12:10", arr: "2027-08-03T15:20", carrier: "TK", nr: "TK1034" }),
    mk(oz, { ...base, category: "stay", name: "Hotel Gozsdu", provider: "Booking.com", city: "Budapeşte", status: "chosen", needKey: "stay:budapeste", dates: { start: "2027-07-24", end: "2027-07-26", source: "url" }, price: price(180, "total"), guests, location: { address: null, area: "Erzsébetváros", approximate: false }, url: "https://www.booking.com/hotel/hu/gozsdu.html" }),
    mk(oz, { ...base, category: "stay", name: "Ozora kamp alanı", city: "Dádpuszta", status: "booked", needKey: "stay:ozora", dates: { start: "2027-07-26", end: "2027-08-02", source: "user" }, price: none, guests, metrics: { stayKind: "camp" } }),
    mk(oz, { ...base, category: "stay", name: "Rudas termal oteli", provider: "Booking.com", city: "Budapeşte", status: "chosen", needKey: "stay:budapeste-2", dates: { start: "2027-08-02", end: "2027-08-03", source: "url" }, price: price(95, "total"), guests, url: "https://www.booking.com/hotel/hu/rudas.html" }),
    mk(oz, { ...base, category: "transport", plannedKind: "car_rental", name: "Araba kiralama · Budapeşte Havalimanı", provider: "Sixt", city: "Budapeşte", status: "chosen", needKey: "transport:car", dates: { start: "2027-07-24", end: "2027-08-02", source: "user" }, price: price(310, "total"), guests, when: "Al 24 Tem 11:30 · Budapeşte Havalimanı → bırak 2 Ağu · Deák tér", url: "https://www.sixt.com/x" }),
    mk(oz, { ...base, category: "activity", name: "Ozora Festival bileti", provider: "Ozora", city: "Dádpuszta", status: "booked", needKey: "activity:ozora", url: "https://ozorafestival.eu/tickets", dates: { start: "2027-07-26", end: "2027-08-02", source: "page" }, price: price(280), guests, addedBy: "Emre" }),
    mk(oz, { ...base, category: "activity", name: "Széchenyi termal banyo", provider: "Viator", city: "Budapeşte", status: "chosen", needKey: "activity:budapeste", url: "https://www.viator.com/x", dates: { start: null, end: null, source: "none" }, price: price(32), addedBy: "Sabine" }),
    mk(oz, { ...base, category: "food", name: "Szimpla Kert", city: "Budapeşte", status: "chosen", needKey: "food:budapeste", dates: { start: null, end: null, source: "none" }, price: none }),
    mk(oz, { ...base, category: "activity", name: "Kahramanlar Meydanı", city: "Budapeşte", status: "chosen", needKey: "activity:budapeste-2", dates: { start: null, end: null, source: "none" }, price: none }),
  ];

  // ---- states: a flight, a stay, a ride and a tour in each look
  const st = "states-trip";
  const b = { country: "Japonya", countryCode: "JP" };
  const F = (nm, key, o) => flightOf(st, { ...b, name: nm, needKey: key, city: "Tokyo", dates: { start: "2027-04-01", end: null, source: "page" }, from: "IST", to: "HND", dep: "2027-04-01T09:40", arr: "2027-04-02T07:15", carrier: "QR", nr: "QR 242", min: 900, stops: 1, ...o });
  const S = (nm, key, o) => mk(st, { ...b, category: "stay", name: nm, needKey: key, city: "Tokyo", dates: { start: "2027-04-02", end: "2027-04-05", source: "url" }, price: price(330, "total"), guests, ...o });
  const T = (nm, key, o) => mk(st, { ...b, category: "transport", name: nm, needKey: key, city: "Tokyo", dates: { start: "2027-04-05", end: null, source: "page" }, price: price(120, "total"), guests, flight: { from: "Tokyo", to: "Kyoto", departure: "2027-04-05T09:00", arrival: "2027-04-05T11:15", carrier: null, flightNumber: null, stops: null }, ...o });
  const E = (nm, key, o) => mk(st, { ...b, category: "activity", name: nm, needKey: key, city: "Tokyo", dates: { start: "2027-04-03", end: null, source: "page" }, price: price(45), guests, ...o });
  const emptyFlight = { from: null, to: null, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null };
  const stateItems = [
    // flights: empty (bare chat plan), our pick (two priced options), chosen, booked, arranged
    F("Uçuş", "flight:empty", { origin: "chat", status: "chosen", provider: null, price: none, flight: emptyFlight, dates: { start: null, end: null, source: "none" } }),
    F("QR · İstanbul → Tokyo", "flight:draft", { status: "saved", provider: "Qatar Airways", price: price(820), url: "https://www.qatarairways.com/x" }),
    F("TK · İstanbul → Tokyo", "flight:draft", { status: "saved", provider: "Turkish Airlines", price: price(905), carrier: "TK", nr: "TK 52", stops: 0, min: 780, url: "https://www.turkishairlines.com/x" }),
    F("JL · İstanbul → Osaka", "flight:chosen", { status: "chosen", provider: "Japan Airlines", price: price(870), carrier: "JL", nr: "JL 44", url: "https://www.jal.co.jp/x", dep: "2027-04-08T10:10", arr: "2027-04-09T07:00", from: "IST", to: "KIX", city: "Osaka", dates: { start: "2027-04-08", end: null, source: "page" } }),
    F("TK · Osaka → İstanbul", "flight:booked", { status: "booked", provider: "Turkish Airlines", price: price(790), carrier: "TK", nr: "TK 49", stops: 0, from: "KIX", to: "IST", dep: "2027-04-16T11:00", arr: "2027-04-16T17:40", city: "Osaka", dates: { start: "2027-04-16", end: null, source: "page" }, addedBy: "Emre" }),
    F("Peach · Tokyo → Osaka", "flight:arranged", { status: "chosen", provider: "Peach", price: price(60), carrier: "MM", nr: "MM 214", stops: 0, from: "HND", to: "KIX", dep: "2027-04-12T08:00", arr: "2027-04-12T09:20", min: 80, arranged: true, noBooking: now, dates: { start: "2027-04-12", end: null, source: "page" } }),
    // stays
    S("Konaklama", "stay:empty", { origin: "chat", status: "chosen", provider: null, price: none, dates: { start: null, end: null, source: "none" } }),
    S("Asakusa Ryokan", "stay:draft", { status: "saved", provider: "Booking.com", price: price(480, "total"), url: "https://www.booking.com/hotel/jp/a.html", rating: { value: 9.1, scale: 10, count: 400, source: "page" }, dates: { start: "2027-04-05", end: "2027-04-09", source: "url" }, city: "Kyoto" }),
    S("Gion Machiya", "stay:draft", { status: "saved", provider: "Airbnb", price: price(560, "total"), url: "https://www.airbnb.com/rooms/g", dates: { start: "2027-04-05", end: "2027-04-09", source: "url" }, city: "Kyoto" }),
    S("Hyatt Centric Ginza", "stay:chosen", { status: "chosen", provider: "Booking.com", price: price(640, "total"), url: "https://www.booking.com/hotel/jp/h.html", rating: { value: 9.0, scale: 10, count: 900, source: "page" }, cancellation: { summary: "30 Mart'a kadar ücretsiz iptal", freeUntil: "2027-03-30", source: "page" } }),
    S("Gora Kadan", "stay:booked", { status: "booked", provider: "Booking.com", price: price(900, "total"), city: "Hakone", dates: { start: "2027-04-09", end: "2027-04-12", source: "url" }, rating: { value: 9.5, scale: 10, count: 300, source: "page" }, cancellation: { summary: "İade yok", freeUntil: null, source: "page" }, addedBy: "Sabine" }),
    S("Arkadaşın evi", "stay:arranged", { status: "chosen", provider: null, price: none, city: "Osaka", dates: { start: "2027-04-12", end: "2027-04-16", source: "user" }, arranged: true, noBooking: now }),
    // rides
    T("Shinkansen · Tokyo → Kyoto", "transport:draft", { status: "saved", provider: "JR", url: "https://www.jreast.co.jp/x" }),
    T("Shinkansen · Kyoto → Osaka", "transport:chosen", { status: "chosen", provider: "JR", dates: { start: "2027-04-12", end: null, source: "page" }, flight: { from: "Kyoto", to: "Osaka", departure: "2027-04-12T09:00", arrival: "2027-04-12T09:30", carrier: null, flightNumber: null, stops: null }, url: "https://www.jreast.co.jp/y" }),
    T("Hakone Romancecar · Tokyo → Hakone", "transport:booked", { status: "booked", provider: "Odakyu", dates: { start: "2027-04-09", end: null, source: "page" }, flight: { from: "Tokyo", to: "Hakone", departure: "2027-04-09T08:30", arrival: "2027-04-09T10:15", carrier: null, flightNumber: null, stops: null } }),
    T("Havalimanı transferi", "transport:arranged", { status: "chosen", provider: null, price: none, arranged: true, noBooking: now, dates: { start: "2027-04-02", end: null, source: "user" }, flight: { from: "Havalimanı", to: "Otel", departure: "2027-04-02T09:00", arrival: "2027-04-02T10:00", carrier: null, flightNumber: null, stops: null } }),
    // tours
    E("teamLab Planets", "activity:chosen", { status: "chosen", provider: "Klook", url: "https://www.klook.com/x" }),
    E("Shibuya Sky günbatımı", "activity:booked", { status: "booked", provider: "Klook", url: "https://www.klook.com/y", dates: { start: "2027-04-04", end: null, source: "page" }, addedBy: "Sabine" }),
    E("Gion yürüyüş turu", "activity:idea", { status: "saved", provider: "GetYourGuide", url: "https://www.getyourguide.com/z", dates: { start: null, end: null, source: "none" } }),
    E("Sumo antrenmanı", "activity:arranged", { status: "chosen", provider: null, price: none, arranged: true, noBooking: now }),
  ];

  const tx = db.transaction(["items", "trips"], "readwrite");
  for (const i of [...ozItems, ...stateItems]) tx.objectStore("items").put(i);
  const tripBase = { ...sample, demo: false, createdAt: now, updatedAt: now };
  tx.objectStore("trips").put({ ...tripBase, id: oz, title: "Ozora Festival 2027", confirmedDates: { start: "2027-07-24", end: "2027-08-03" }, intent: { playbook: "festival", name: "Ozora Festival", url: "https://ozorafestival.eu" } });
  tx.objectStore("trips").put({ ...tripBase, id: st, title: "Durumlar (denetim)", confirmedDates: { start: "2027-04-01", end: "2027-04-16" } });
  await new Promise((resolve) => (tx.oncomplete = resolve));
  new BroadcastChannel("trip-radar").postMessage("changed");
  return { oz, st };
});
const tripIds = { sample: sampleId, ozora: seeded.oz, states: seeded.st };
await app.waitForTimeout(1200);

// Does the page scroll sideways (documentElement.scrollWidth > innerWidth)? The culprits are what sticks out past the window and no
// ancestor clips (an overflow:auto strip that is itself inside the window does not count).
const overflow = async (name) => {
  const w = await app.evaluate(() => {
    const W = window.innerWidth;
    const over = document.documentElement.scrollWidth - W;
    const clipped = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { if (a !== document.documentElement && getComputedStyle(a).overflowX !== "visible" && a.getBoundingClientRect().right <= W + 1) return true; } return false; };
    const culprits = [];
    if (over > 0)
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > W + 1 && !clipped(el)) culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").join(".").slice(0, 50)}@${Math.round(r.right)}`);
      }
    return { over, culprits: culprits.slice(0, 4) };
  });
  console.log(`OVERFLOW ${name}: ${w.over}${w.culprits.length ? " <- " + w.culprits.join(" ") : ""}`);
};
import { writeFileSync as wfs } from "node:fs";
const tag = process.env.CAP_TRIP ?? "states";
await app.setViewportSize({ width: WIDTH, height: 1100 });
await app.goto(`chrome-extension://${id}/app.html#trip=${tripIds[tag]}`);
await app.reload();
await app.waitForTimeout(2500);
for (const s of await app.locator(".cat-sec.closed .cat-title").all()) await s.click();
await app.setViewportSize({ width: WIDTH, height: 9000 });
await app.waitForTimeout(3000);
// Phase 1: every card's options (its back face), captured by turning it and turning it back.
const backs = {};
const cards = app.locator(".cat-sec .cat-grid > *");
const n = await cards.count();
for (let i = 0; i < n; i++) {
  const c = cards.nth(i);
  const alt = c.locator(".pk-alt, .nd-opts").first();
  if (!(await alt.count())) continue;
  try {
    await alt.click({ timeout: 3000 });
    await app.waitForTimeout(700);
    const grid = await app.evaluate(() => { const b = document.querySelector(".ch-back"); if (!b) return null; const rows = [...b.querySelectorAll(".ch-row")]; return { grid: rows.length ? '<div class="nf-grid">' + rows.map((r) => r.outerHTML).join("") + "</div>" : null, n: rows.length }; });
    if (grid) backs[i] = grid;
    const close = app.locator(".ch-back .ch-head").getByRole("button", { name: EN ? "Close" : "Kapat" });
    if (await close.count()) await close.first().click(); else await app.keyboard.press("Escape");
    await app.waitForTimeout(400);
  } catch (e) { console.log("back fail", i, String(e).slice(0, 100)); }
}
console.log("backs", Object.keys(backs).length, "of", n);
const data = await app.evaluate(async ({ backs, tag }) => {
  const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
  const all = (s) => new Promise((r) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
  const items = await all("items");
  const byId = new Map(items.map((i) => [i.id, i]));
  const MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const fd = (s) => { if (!s) return null; const d = new Date(s + "T00:00:00"); return d.getDate() + " " + MON[d.getMonth()]; };
  const nights = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 864e5) : null);
  const KIND = { flight: "Uçuş", stay: "Konaklama", transport: "Ulaşım", activity: "Etkinlik", todo: "Yapılacak", other: "Belgeler" };
  const COL = { flight: "var(--c-fly,#6a4fe0)", stay: "var(--c-stay,#1d8577)", transport: "var(--c-move,#b5761c)", activity: "var(--c-exp,#c0256b)", todo: "var(--c-todo,#1f7a45)", other: "var(--c-doc,#0f7a5e)" };
  const WORDS = { flight: ["aktarma az", "orta bütçe"], stay: ["sakin", "merkeze yakın", "orta bütçe"], transport: ["rahat", "bagajlı"], activity: ["kültür", "akşam"], todo: ["yerel yemek", "yürüyüş"], other: ["tüm gezi"] };
  const LINKS = { flight: ["Skyscanner", "Google Uçuşlar", "Kayak"], stay: ["Booking.com", "Airbnb", "Resmî site"], transport: ["Omio", "Rome2rio"], activity: ["Viator", "GetYourGuide", "Klook"], todo: ["Haritalar"], other: ["Airalo", "SafetyWing"] };
  const art = (sec, item, label) => {
    const t = `${label ?? ""} ${item?.name ?? ""} ${item?.provider ?? ""}`.toLowerCase();
    if (sec === "flight") return "illus/ucus.png";
    if (sec === "stay") return /airbnb|ev |evi|daire|machiya/.test(t) ? "illus/ev-daire.png" : /kamp|camp/.test(t) || item?.metrics?.stayKind === "camp" ? "illus/karavan.png" : "illus/otel.png";
    if (sec === "transport") return /araba|kiral|car|sixt/.test(t) || item?.plannedKind === "car_rental" ? "illus/arac-kiralama.png" : /transfer|taksi|havalimanı →|→ konaklama/.test(t) ? "illus/taksi-transfer.png" : /otobüs|bus/.test(t) ? "illus/otobus.png" : /vapur|feribot/.test(t) ? "illus/vapur.png" : "illus/tren.png";
    if (sec === "activity") return "illus/etkinlik-tur.png";
    if (sec === "todo") return "illus/yapilacak.png";
    return /sigorta/.test(t) ? "illus/sigorta.png" : "illus/esim.png";
  };
  const stageOf = (item, cardEl) => {
    if (item?.arranged) return ["Ayarlandı", "ar"];
    const tx = cardEl.textContent;
    if (/Bunu seç/.test(tx)) return ["Önerimiz", "ai"];
    if (!item) { if (/Bilet alındı|Rezerve ✓|Rezerve$/m.test(tx) || cardEl.querySelector(".pk-booked,.pk-r-done")) return ["Rezerve", "bk"]; if (/Ayarlandı/.test(tx)) return ["Ayarlandı", "ar"]; if (/Seçildi|Planlandı/.test(tx)) return ["Seçildi", "ch"]; }
    if (item?.status === "booked" || cardEl.querySelector(".pk-booked, .pk-r-done")) return ["Rezerve", "bk"];
    if (item?.status === "chosen" && !(item.origin === "chat" && item.price?.amount == null && !item.url)) return ["Seçildi", "ch"];
    return ["Arıyoruz", "op"];
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const intent = (sec, o) => {
    const words = o.words ?? WORDS[sec];
    const ch = words.slice(0, 2).map((w) => `<i>${esc(w)}</i>`).join("") + (words.length > 2 ? `<i class="more" title="${esc(words.slice(2).join(", "))}">+${words.length - 2}</i>` : "");
    const lk = (o.links ?? LINKS[sec].map((x) => [x, "#"])).map(([x, h]) => `<a href="${esc(h)}" target="_blank" rel="noopener">${esc(x)} ↗</a>`).join("");
    return `<aside class="ni" style="--k:${COL[sec]}" tabindex="0"><div class="ni-art"><img src="${o.art}" alt=""><span class="ni-kind">${KIND[sec]}</span><span class="ni-st ${o.stage[1]}">${o.stage[0]}</span></div><div class="ni-b"><b class="ni-t" title="${esc(o.title)}">${esc(o.title)}</b><div class="ni-m">${esc(o.meta)}</div><div class="ni-w">${ch}</div></div><div class="ni-links"><small>Kendin ara</small>${lk}</div></aside>`;
  };
  const fold = (label, count, inner, open) => `<details class="nf"${open ? " open" : ""}><summary><span class="nf-dot"></span><b>${count ? label : "Seçenek ara"}</b>${count ? `<span class="nf-n">${count}</span>` : ""}<span class="nf-r"><a href="#">Pano'da aç ›</a><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></summary><div class="nf-in">${inner}<div class="nf-f"><button type="button" class="nf-more">✦ Daha fazla bul</button></div></div></details>`;
  const groupWrap = (sec, intentHtml, mainEl, foldHtml) => {
    const g = document.createElement("div");
    g.className = "ng";
    g.style.setProperty("--gk", COL[sec]);
    g.innerHTML = intentHtml + `<div class="ng-r"><div class="ng-main"></div>${foldHtml}</div>`;
    g.querySelector(".ng-main").appendChild(mainEl);
    return g;
  };
  const panel = document.querySelector(".panel");
  panel.querySelectorAll(".sbar-slot, .pk-insert, .cat-add").forEach((e) => e.remove());
  let idx = 0;
  let firstOpen = true;
  for (const secEl of panel.querySelectorAll(".cat-sec")) {
    const sec = secEl.dataset.section;
    const grid = secEl.querySelector(".cat-grid");
    if (grid) {
      grid.classList.add("ng-list");
      for (const card of [...grid.children]) {
        const myIdx = idx++;
        const itemEl = card.querySelector("[data-item-id]");
        const item = itemEl ? byId.get(itemEl.getAttribute("data-item-id")) : null;
        const label = card.querySelector("[aria-label]")?.getAttribute("aria-label") ?? "";
        const f = item?.flight;
        let title = item?.city ?? label.split("·")[0].trim();
        const bigs = [...card.querySelectorAll("b, strong")].filter((b) => parseFloat(getComputedStyle(b).fontSize) >= 17 && b.textContent.trim().length < 30 && !/[€$]/.test(b.textContent) && !/^\d{1,2}[:.]\d{2}/.test(b.textContent.trim())).map((b) => b.textContent.trim());
        if ((sec === "flight" || sec === "transport") && bigs.length >= 2) title = `${bigs[0]} → ${bigs[1]}`;
        else if ((sec === "flight" || sec === "transport") && f?.from && f?.to) title = `${f.from} → ${f.to}`;
        else if (/→/.test(label)) title = label.replace(/:.*/, "");
        if (sec === "other") title = item?.name ?? label;
        const s = item?.dates?.start, e = item?.dates?.end;
        const nn = sec === "stay" ? nights(s, e) : null;
        const ppl = item?.guests?.adults ? `${item.guests.adults} kişi` : "2 kişi";
        const rng = (a, b) => { const A = fd(a), B = fd(b); if (!B) return A; const [d1, m1] = A.split(" "), [d2, m2] = B.split(" "); return m1 === m2 ? `${d1}–${d2} ${m1}` : `${A}–${B}`; };
        const meta = [nn ? `${nn} gece` : null, s ? (e && sec === "stay" ? rng(s, e) : fd(s)) : null, ppl].filter(Boolean).join(" · ");
        const stage = stageOf(item, card);
        const realLinks = [...card.querySelectorAll("a.ek-link")].map((a) => [a.querySelector(".ek-nm")?.firstChild?.textContent?.trim() || a.dataset.brand, a.href]);
        const back = backs[myIdx];
        const tiles = back?.grid ? back.grid.replace('<div class="nf-grid">', `<div class="nf-grid nf-${sec}">`) : `<p class="nf-none">Bu ihtiyaç için kayıtlı seçenek yok. Ara ya da Pano'dan ekle.</p>`;
        const cnt = back?.n ?? 0;
        const open = !!back?.grid && firstOpen && stage[1] !== "op";
        if (open) firstOpen = false;
        const g = groupWrap(sec, intent(sec, { title, meta, stage, art: art(sec, item, label), links: realLinks.length ? realLinks : null }), card, fold("Seçenekler", cnt, tiles, open));
        grid.appendChild(g);
      }
    }
    for (const city of secEl.querySelectorAll(".ev-city, .it-city")) {
      const name = city.getAttribute("aria-label") ?? city.querySelector("b")?.textContent ?? "";
      const head = city.querySelector(".ev-city-h, .it-city-h");
      const sub = head ? head.innerText.replace(name, "").replace(/\s+/g, " ").trim() : "";
      const row = city.querySelector(".ev-row, .it-grid");
      const isPlanned = (t) => t.matches(".it-tile.planned") || !!t.querySelector(".ev-card:not(.idea)") || t.matches(".ev-card:not(.idea)");
      const ideas = row ? [...row.children].filter((t) => !isPlanned(t)) : [];
      const planned = row ? [...row.children].filter((t) => !ideas.includes(t)) : [];
      const main = document.createElement("div");
      main.className = city.className + " ng-city";
      if (row) {
        const r2 = row.cloneNode(false);
        planned.forEach((t) => r2.appendChild(t));
        main.appendChild(r2);
        if (!planned.length) main.innerHTML = `<div class="ng-empty">Henüz planda bir şey yok, öneriler aşağıda.</div>`;
      } else main.innerHTML = `<div class="ng-empty">Henüz öneri yok.</div>`;
      const r3 = row ? row.cloneNode(false) : document.createElement("div");
      ideas.forEach((t) => r3.appendChild(t));
      const stage = planned.length ? [`${planned.length} planda`, "ch"] : ["Arıyoruz", "op"];
      const g = groupWrap(sec, intent(sec, { title: name, meta: sub.slice(0, 40) || "2 kişi", stage, art: art(sec, null, name) }), main, fold(sec === "activity" ? "Diğer öneriler · Viator ve AI" : "Diğer öneriler · Haritalar", ideas.length, ideas.length ? r3.outerHTML : `<p class="nf-none">Öneri yok.</p>`, false));
      city.replaceWith(g);
    }
  }
  // images: absolute paths
  const imgs = [...new Set([...panel.querySelectorAll("img")].map((i) => i.getAttribute("src")))];
  return { html: panel.outerHTML, imgs, title: document.querySelector(".hx h1")?.textContent ?? tag };
}, { backs, tag });
wfs(`/tmp/v31live/${tag}.json`, JSON.stringify(data));
console.log(tag, data.html.length, data.imgs.length, data.imgs.slice(0, 12));
await context.close();
