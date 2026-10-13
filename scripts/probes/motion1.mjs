const { app, T, log, open, tab, shot, W, ctx } = P;
await app.evaluate(() => sessionStorage.setItem("trip-radar:opening-off", "1")).catch(() => {});
await open(T.sample);
// 1. tab slide
const ind = () => app.evaluate(() => { const l = document.querySelector(".plan-order"); return l && { x: getComputedStyle(l).getPropertyValue("--ind-x"), w: getComputedStyle(l).getPropertyValue("--ind-w"), has: l.classList.contains("has-ind"), dir: getComputedStyle(document.documentElement).getPropertyValue("--tab-dir"), ghosts: document.querySelectorAll(".mv-ghost").length }; });
log("plan-order before", JSON.stringify(await ind()));
await app.evaluate(() => { window.__rec = []; const t0 = performance.now(); const f = () => { const l = document.querySelector(".plan-order"); const ghost = document.querySelector(".mv-ghost"); const v = document.querySelector(".panel .trip-plan, .panel .cat-plan"); const bf = l && getComputedStyle(l, "::before").transform; window.__rec.push([Math.round(performance.now() - t0), bf, ghost ? Math.round(Number(getComputedStyle(ghost).opacity) * 100) : null, v ? Math.round(Number(getComputedStyle(v).opacity) * 100) + "|" + getComputedStyle(v).transform : null]); if (performance.now() - t0 < 500) requestAnimationFrame(f); }; requestAnimationFrame(f); });
await tab("Gün gün");
await app.waitForTimeout(700);
const rec = await app.evaluate(() => window.__rec);
log("tab slide samples (ms, indicator transform, ghost opacity%, new view opacity|transform):");
for (const r of rec.filter((_, i) => i % 3 === 0)) log("  ", JSON.stringify(r));
log("plan-order after", JSON.stringify(await ind()));
// reverse direction
await tab("Kategoriye göre"); await app.waitForTimeout(100); log("dir back", JSON.stringify(await ind())); await app.waitForTimeout(500);
// view tabs Plan/Pano
await tab("Pano").catch(() => app.getByRole("tab", { name: /^Pano/ }).click()); await app.waitForTimeout(80); log("view-tabs", await app.evaluate(() => { const l = document.querySelector(".view-tabs"); return l && [getComputedStyle(l).getPropertyValue("--ind-x"), l.classList.contains("has-ind"), document.querySelectorAll(".mv-ghost").length]; }));
await app.waitForTimeout(600);
await app.getByRole("tab", { name: "Plan", exact: true }).click(); await app.waitForTimeout(700);
// 2. section fold
const sec = app.locator('.cat-sec[data-section="flight"]');
const heights = (n) => app.evaluate(async (n) => { const s = document.querySelector('.cat-sec[data-section="flight"]'); const next = s.nextElementSibling; const out = []; const t0 = performance.now(); await new Promise((res) => { const f = () => { out.push([Math.round(performance.now() - t0), Math.round(s.getBoundingClientRect().height), Math.round(next.getBoundingClientRect().top)]); if (performance.now() - t0 < n) requestAnimationFrame(f); else res(); }; f(); }); return out; }, n);
const isClosed = await sec.evaluate((e) => e.classList.contains("closed"));
log("flight sec closed initially", isClosed);
const p1 = heights(520); await sec.locator(".cat-title").click(); const h1 = await p1;
log("fold toggle 1 samples", JSON.stringify(h1.filter((_, i) => i % 4 === 0)));
await app.waitForTimeout(500);
const p2 = heights(520); await sec.locator(".cat-title").click(); const h2 = await p2;
log("fold toggle 2 samples", JSON.stringify(h2.filter((_, i) => i % 4 === 0)));
await app.waitForTimeout(500);
// 3. drawer durations
const det = app.getByRole("button", { name: /^Ayrıntı ›?$/ }).first();
if (await det.count()) {
  await det.scrollIntoViewIfNeeded(); await det.click(); await app.waitForTimeout(100);
  log("drawer in", JSON.stringify(await app.evaluate(() => [...document.querySelectorAll(".drawer, .modal, .overlay")].map((e) => [e.className.slice(0, 40), e.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration])]))));
  await app.waitForTimeout(500);
  await app.evaluate(() => { window.__lv = null; const o = new MutationObserver(() => { const d = document.querySelector(".mv-leaving"); if (d && !window.__lv) window.__lv = [d.className.slice(0, 40), d.getAnimations().map((a) => [a.animationName, a.effect.getComputedTiming().duration])]; }); o.observe(document.body, { subtree: true, attributes: true, childList: true }); });
  await app.keyboard.press("Escape"); await app.waitForTimeout(500);
  log("drawer out", JSON.stringify(await app.evaluate(() => window.__lv)));
}
// 4. pulse
await open(T.states);
await app.waitForTimeout(800);
log("ek-card rings", await app.evaluate(() => { const r = [...document.querySelectorAll(PULSERS_SEL)]; return null; }).catch(() => "n/a"));
const rings = await app.evaluate(() => [...document.querySelectorAll(".ek-card .pk-ring.open, .ek-card .pk-ring.half, .pk-card.tk.tk-search")].map((e) => [e.className.slice(0, 30), e.hasAttribute("data-np"), getComputedStyle(e).animationName, getComputedStyle(e).animationDuration, Math.round(e.getBoundingClientRect().top), innerHeight]));
log("pulsers", JSON.stringify(rings));
