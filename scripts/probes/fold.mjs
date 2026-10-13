const { app, T, log, open } = P;
await open(T.sample);
await app.waitForTimeout(1500);
for (const n of ["close", "open", "close", "open"]) {
  const o = await app.evaluate(async () => {
    const s = document.querySelector('.cat-sec[data-section="stay"]');
    const out = []; const t0 = performance.now();
    s.querySelector(".cat-title").click();
    await new Promise((res) => { let k = 0; const f = () => { const cf = s.querySelector(".cat-fold"); out.push([Math.round(performance.now() - t0), cf ? Math.round(cf.getBoundingClientRect().height) : null, cf ? cf.className.replace("cat-fold", "").trim() : "-", cf ? cf.getAnimations().map((a) => [a.transitionProperty, Math.round(a.currentTime)]) : []]); if (performance.now() - t0 < 600) requestAnimationFrame(f); else res(); }; f(); });
    return out;
  });
  log(n, JSON.stringify(o.filter((_, i) => i % 3 === 0)));
  await app.waitForTimeout(700);
}
