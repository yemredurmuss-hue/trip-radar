const { app, T, log, open, tab, shot } = P;
await open(T.ozora);
const txt = await app.evaluate(() => document.body.innerText);
log("has question", /Çadır kampı mı, karavan mı, otel mi\?/.test(txt), "chips", JSON.stringify(await app.locator(".chat button").allInnerTexts()));
await shot("camp-ozora");
