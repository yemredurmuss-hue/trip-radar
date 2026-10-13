const { app, T, log, open, tab, shot, W, ctx } = P;
await open(T.sample);
// tab: click in page, list animations right away and over time
const probeTab = (label, sel, tabText) => app.evaluate(async ([sel, tabText]) => {
  const btn = [...document.querySelectorAll(`${sel} [role=tab]`)].find((b) => b.textContent.trim().startsWith(tabText));
  const out = [];
  const t0 = performance.now();
  btn.click();
  await new Promise((res) => {
    const f = () => {
      const anims = document.getAnimations().filter((a) => a.playState === "running").map((a) => [a.animationName || a.transitionProperty || "script", Math.round(a.effect.getComputedTiming().duration), Math.round(a.currentTime)]);
      const l = document.querySelector(sel);
      out.push([Math.round(performance.now() - t0), l && getComputedStyle(l).getPropertyValue("--ind-x"), document.querySelectorAll(".mv-ghost").length, JSON.stringify(anims.filter((a) => /mv-|tab|opacity|transform|^script/.test(a[0]) || true).slice(0, 4))]);
      if (performance.now() - t0 < 450) requestAnimationFrame(f); else res();
    };
    f();
  });
  return out;
}, [sel, tabText]);
let r = await probeTab("plan-order", ".plan-order", "Gün gün");
log("Plan-order -> Gün gün"); for (const x of r.filter((_, i) => i % 3 === 0)) log("  ", JSON.stringify(x));
await app.waitForTimeout(500);
r = await probeTab("view-tabs", ".view-tabs", "Pano");
log("Plan -> Pano"); for (const x of r.filter((_, i) => i % 3 === 0)) log("  ", JSON.stringify(x));
await app.waitForTimeout(600);
await app.getByRole("tab", { name: "Plan", exact: true }).click(); await app.waitForTimeout(800);
await app.getByRole("tab", { name: "Kategoriye göre", exact: true }).click().catch(() => {}); await app.waitForTimeout(800);
// section fold, in page
const fold = (t) => app.evaluate(async () => {
  const s = document.querySelector('.cat-sec[data-section="stay"]');
  const next = s.nextElementSibling;
  const out = []; const t0 = performance.now();
  s.querySelector(".cat-title").click();
  await new Promise((res) => { const f = () => { const cf = s.querySelector(".cat-fold"); out.push([Math.round(performance.now() - t0), Math.round(s.getBoundingClientRect().height), Math.round(next.getBoundingClientRect().top), cf ? getComputedStyle(cf).gridTemplateRows.slice(0, 20) : "-", s.classList.contains("closed")]); if (performance.now() - t0 < 520) requestAnimationFrame(f); else res(); }; f(); });
  return out;
});
for (const n of ["toggle A", "toggle B"]) { const o = await fold(); log(n); for (const x of o.filter((_, i) => i % 4 === 0)) log("  ", JSON.stringify(x)); await app.waitForTimeout(400); }
