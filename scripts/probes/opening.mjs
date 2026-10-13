const { app, T, log, open, tab, shot, W, ctx } = P;
await app.addInitScript(() => {
  window.__ev = [];
  const t0 = performance.now();
  const rec = (n) => window.__ev.push([Math.round(performance.now() - t0), n]);
  const obs = new MutationObserver(() => {
    const fx = document.querySelector(".op-fx");
    if (fx && !window.__fx) { window.__fx = performance.now(); rec("op-fx in"); }
    if (!fx && window.__fx && !window.__fxOut) { window.__fxOut = performance.now(); rec("op-fx out"); }
    const away = !!document.querySelector(".mascot-seat.away");
    if (away !== window.__away) { window.__away = away; rec(away ? "mascot away" : "mascot home"); }
    const sp = document.querySelectorAll(".op-spark").length, st = document.querySelectorAll(".op-star").length;
    if ((sp || st) && !window.__sp) { window.__sp = 1; rec(`sparks ${sp} stars ${st}`); }
  });
  document.addEventListener("DOMContentLoaded", () => obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }));
});
for (const key of ["sample"]) {
  await app.goto(`chrome-extension://${P.id}/app.html`);
  await app.evaluate((id) => { localStorage.removeItem(`trip-radar:opened:${id}`); sessionStorage.removeItem("trip-radar:opening-off"); }, T[key]);
  await app.goto(`chrome-extension://${P.id}/app.html#trip=${T[key]}`);
  await app.reload();
  const t = Date.now();
  await app.waitForTimeout(300); await shot("opening-300");
  await app.waitForTimeout(250); await shot("opening-600");
  await app.waitForTimeout(1500);
  log("events", JSON.stringify(await app.evaluate(() => window.__ev)));
  log("op-fx left", await app.locator(".op-fx").count(), "mascot away", await app.locator(".mascot-seat.away").count(), "scrollTop", await app.locator(".panel").evaluate((e) => e.scrollTop));
  // second open: should not play
  await app.evaluate(() => { window.__ev = []; window.__fx = 0; window.__fxOut = 0; });
  await app.reload(); await app.waitForTimeout(1200);
  log("2nd open events", JSON.stringify(await app.evaluate(() => window.__ev)));
}
