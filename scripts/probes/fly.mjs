const { app, T, log, open, tab, shot } = P;
for (const key of ["sample", "ozora", "states"]) {
  await open(T[key]);
  const btns = app.getByRole("button", { name: /^\+?\s*(Plana koy|Plana ekle)$/ });
  const n = await btns.count();
  log(key, "Plan 'Plana koy' buttons", n);
  if (n) {
    const b = btns.first();
    await b.scrollIntoViewIfNeeded();
    const info = await b.evaluate((el) => ({ sec: el.closest("[data-section]")?.getAttribute("data-section"), headVisible: (() => { const m = el.closest("[data-section]")?.querySelector(".cat-head .cat-n, .cat-head .cat-ic"); const r = m?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; })() }));
    log(key, "button section", JSON.stringify(info));
    await app.evaluate(() => { window.__fly = null; const o = new MutationObserver(() => { const f = document.querySelector(".mv-fly"); if (f && !window.__fly) window.__fly = [f.textContent, f.getAnimations().map((a) => Math.round(a.effect.getComputedTiming().duration))]; }); o.observe(document.body, { childList: true }); });
    await b.click(); await app.waitForTimeout(60);
    log(key, "fly chip", JSON.stringify(await app.evaluate(() => window.__fly)), "bump animations on cat-n/tab:", JSON.stringify(await app.evaluate(() => document.getAnimations().filter((a) => a.effect?.target && a.transitionProperty === undefined && a.animationName === undefined && a.effect.getComputedTiming().duration === 380).map((a) => a.effect.target.className?.toString().slice(0, 30) + "|" + (a.effect.getKeyframes()[1]?.scale)))));
    await app.waitForTimeout(900);
  }
  await tab("Pano").catch(() => app.getByRole("tab", { name: /^Pano/ }).click());
  await app.waitForTimeout(1000);
  const pb = app.getByRole("button", { name: /^\+?\s*Plana koy$/ });
  log(key, "Pano 'Plana koy' buttons", await pb.count());
  if (await pb.count()) {
    await pb.first().scrollIntoViewIfNeeded();
    await app.evaluate(() => { window.__fly = null; const o = new MutationObserver(() => { const f = document.querySelector(".mv-fly"); if (f && !window.__fly) window.__fly = [f.textContent, f.getAnimations().map((a) => Math.round(a.effect.getComputedTiming().duration))]; }); o.observe(document.body, { childList: true }); });
    await pb.first().click(); await app.waitForTimeout(80);
    log(key, "Pano fly chip", JSON.stringify(await app.evaluate(() => window.__fly)), "scale kf:", JSON.stringify(await app.evaluate(() => document.getAnimations().filter((a) => a.effect?.getKeyframes?.().some((k) => k.scale)).map((a) => [a.effect.target.className?.toString().slice(0, 30), a.effect.getKeyframes()[1].scale]))));
    await app.waitForTimeout(900);
    break;
  }
}
