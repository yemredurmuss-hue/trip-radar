const { app, ctx, log, shot, over, W, step } = P;
const photoSvg = (hue) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="hsl(${hue},60%,55%)"/></svg>`;
await ctx.route(/wikipedia\.org\/api\/rest_v1\//, (route) => { const name = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "x"); return route.fulfill({ json: route.request().url().includes("/summary/") ? { originalimage: { source: `https://upload.wikimedia.org/e2e/${encodeURIComponent(name)}.jpg` } } : { items: [] } }); });
await ctx.route(/upload\.wikimedia\.org\/e2e\//, (route) => route.fulfill({ contentType: "image/svg+xml", body: photoSvg(Math.round(Math.random() * 360)) }));
await ctx.route(/functions\/v1\/city-image/, (route) => route.fulfill({ status: 404, json: {} }));
await ctx.route("https://generativelanguage.googleapis.com/**", (route) => route.abort());
const sentences = [["koh", "Sabine ile beraber Tayland Kohphandan 1 ay 10 ocak civarları gitmeyi düşünüyorum"], ["fest", "I want to go burning man africa with my friends and partner"]];
for (const [tag, sentence] of sentences) {
  await app.goto(`chrome-extension://${P.id}/app.html`);
  await app.waitForTimeout(1200);
  await step("start " + tag, async () => {
    await app.getByLabel(/Gezi kutusu|Trip box/).fill(sentence);
    await app.getByRole("button", { name: /Planlamaya başla|Start planning/ }).click();
    await app.locator(".st-ask, .st-screen").first().waitFor({ timeout: 8000 });
    if (await app.locator(".st-ask").count()) await app.locator(".st-ask").getByRole("button", { name: /Yeni gezi|New trip/ }).click();
    await app.waitForTimeout(2500);
    if (tag === "koh") {
      const list = app.locator(".st-side .st-list");
      await list.locator(".st-pv-photo img.in").first().waitFor({ timeout: 15000 }).catch(() => log("no photo img.in"));
      log("mosaic photos", await list.locator(".st-pv-mosaic .st-pv-photo").count(), "strip", await list.locator(".st-pv-photos .st-pv-photo").count());
      await shot("start-mosaic");
      await over("start mosaic");
      await list.getByRole("button", { name: /Şerit|Strip/ }).click(); await app.waitForTimeout(500);
      log("after Şerit: mosaic", await list.locator(".st-pv-mosaic").count(), "strip photos", await list.locator(".st-pv-photos .st-pv-photo").count());
      await shot("start-strip"); await over("start strip");
      log("layout stored", await app.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => /layout|mosaic|photo/i.test(k)))));
      await app.reload(); await app.waitForTimeout(2500);
      log("after reload strip kept:", await app.locator(".st-pv-mosaic").count() === 0, "(mosaic count)", await app.locator(".st-pv-mosaic").count());
      await app.locator(".st-side .st-list").getByRole("button", { name: /Mozaik|Mosaic/ }).click().catch(() => {});
    } else {
      log("bot questions", JSON.stringify(await app.locator(".st-msg-bot .st-q").allInnerTexts()));
      log("chips", JSON.stringify(await app.locator(".st-answers .st-chip, .st-chip").allInnerTexts()));
      await app.getByRole("button", { name: "+4 days in Cape Town" }).click().catch(() => app.getByRole("button", { name: /\+4/ }).click());
      await app.waitForTimeout(1500);
      log("bot questions 2", JSON.stringify(await app.locator(".st-msg-bot .st-q").allInnerTexts()));
      log("chips 2", JSON.stringify(await app.locator(".st-chip").allInnerTexts()));
      await shot("start-fest-2"); await over("start fest q");
    }
  });
}
