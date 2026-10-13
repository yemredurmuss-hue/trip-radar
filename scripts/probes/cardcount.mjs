const { app, log, open } = P;
const tids = await app.evaluate(async () => { const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); }); return new Promise((r) => { const q = db.transaction("trips").objectStore("trips").getAll(); q.onsuccess = () => r(q.result.map((t) => [t.id, t.title])); }); });
for (const [tid, title] of tids.slice(0, 3)) {
  await open(tid);
  await app.setViewportSize({ width: 1440, height: 7000 }); await app.waitForTimeout(2500);
  const c = await app.evaluate(() => { const q = (s) => document.querySelectorAll(s).length; return { pk: q(".pk-card"), ev: q(".ev-card"), ek: q(".ek-card"), ticket: q(".pk-card.tk"), sec: q(".cat-sec"), items_listed: q(".cat-sec .pk-card, .cat-sec .ev-card") }; });
  log(title, JSON.stringify(c));
}
