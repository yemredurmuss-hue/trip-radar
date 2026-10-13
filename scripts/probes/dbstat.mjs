const { app, log, id, T } = P;
await app.goto(`chrome-extension://${id}/app.html`); await app.waitForTimeout(1500);
const s = await app.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
  const out = { version: db.version, stores: {} };
  for (const n of [...db.objectStoreNames]) out.stores[n] = await new Promise((r) => { const q = db.transaction(n).objectStore(n).count(); q.onsuccess = () => r(q.result); });
  const trips = await new Promise((r) => { const q = db.transaction("trips").objectStore("trips").getAll(); q.onsuccess = () => r(q.result); });
  out.trips = trips.map((t) => t.title);
  out.ls = Object.keys(localStorage).sort();
  const chromeKeys = await chrome.storage.local.get(null);
  out.chromeKeys = Object.keys(chromeKeys).sort();
  return out;
});
log("EXT", id);
log("DB", JSON.stringify(s));
