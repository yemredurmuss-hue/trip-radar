const { app, log, id } = P;
await app.goto(`chrome-extension://${id}/app.html`); await app.waitForTimeout(1500);
const r = await app.evaluate(async () => {
  const db = await new Promise((r) => { const q = indexedDB.open("trip-radar"); q.onsuccess = () => r(q.result); });
  const all = (s) => new Promise((r) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
  const trips = await all("trips"); const items = await all("items");
  const sample = trips.find((t) => /Portekiz/.test(t.title));
  const now = Date.now();
  const stay0 = items.find((i) => i.name === "Lisboa Loft");
  // an undated trip with one saved stay and nothing else; a photoless trip with a flight and an activity, no city photos
  const undated = { ...sample, id: "undated-trip", title: "Tarihsiz gezi", demo: false, confirmedDates: null, createdAt: now, updatedAt: now };
  delete undated.dates; 
  const mk = (tripId, o) => ({ ...stay0, id: crypto.randomUUID(), tripId, captureIds: [], needKey: null, createdAt: now, updatedAt: now, imageUrl: null, ...o });
  const nodate = { amount: null, currency: "EUR", scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now };
  const rec = [
    mk("undated-trip", { category: "stay", name: "Bir otel", status: "saved", city: "Roma", country: "İtalya", countryCode: "IT", dates: { start: null, end: null, source: "none" } }),
    mk("undated-trip", { category: "activity", name: "Kolezyum turu", status: "saved", city: "Roma", country: "İtalya", countryCode: "IT", dates: { start: null, end: null, source: "none" }, price: nodate }),
  ];
  const tx = db.transaction(["trips", "items"], "readwrite");
  tx.objectStore("trips").put(undated);
  rec.forEach((i) => tx.objectStore("items").put(i));
  await new Promise((r) => (tx.oncomplete = r));
  return { items: items.length, trips: trips.length };
});
log("seeded extra", JSON.stringify(r));
