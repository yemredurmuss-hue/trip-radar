const { app, log, open, shot, over } = P;
await open("undated-trip");
log("tabs", JSON.stringify(await app.locator("[role=tab]").allInnerTexts()));
await app.getByRole("tab", { name: /^Pano/ }).click(); await app.waitForTimeout(1200);
log("pn-card", await app.locator(".pn-card").count(), "pano text:", (await app.locator(".panel").first().innerText()).replace(/\s+/g, " ").slice(0, 200));
await shot("undated-pano");
