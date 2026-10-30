// ✓ hatırlanır (lib/resultMarks.ts, tek Kaydet v3): a saved result is known on its page while its save stands.
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { saveSnapshot } from "../src/lib/process";
import { resultPrint } from "../src/lib/resultMark";
import { markSaved, marksOn, savedAlready } from "../src/lib/resultMarks";
import { undoSave } from "../src/lib/saveUndo";

const store: Record<string, unknown> = {};
beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => void Object.assign(store, o) } },
  };
});

const URL1 = "https://www.skyscanner.com.tr/transport/flights/ath/ist/270512/?adults=1";
const snap = (text: string) => ({ url: URL1, title: "t", pageText: text, viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] });
const pegasus = resultPrint("Pegasus 07:40 IST Direkt 09:05 ATH €86 Seç");

describe("a result saved on a page, known again there", () => {
  it("known on the same page (trackers aside), not on another", async () => {
    const c = await saveSnapshot(snap("pegasus"), null, { forTripId: "gr" });
    await markSaved(URL1, pegasus, c.id);
    expect((await marksOn(`${URL1}&utm_source=mail#x`)).map((m) => m.captureId)).toEqual([c.id]);
    expect(await marksOn("https://www.skyscanner.com.tr/transport/flights/ath/ist/280512/")).toEqual([]);
  });

  it("pressed again for the same trip (or with none said): the save before; for another trip: none", async () => {
    const again = resultPrint("Pegasus 07:40 IST Direkt 09:05 ATH €82 Seç");
    expect((await savedAlready(URL1, again, "gr"))?.tripId).toBe("gr");
    expect(await savedAlready(URL1, again, null)).not.toBeNull();
    expect(await savedAlready(URL1, again, "pt")).toBeNull();
  });

  it("taken back, or its card deleted from the Pano: no longer known", async () => {
    const [first] = await marksOn(URL1);
    await undoSave(first.captureId);
    expect(await marksOn(URL1)).toEqual([]);

    const c = await saveSnapshot(snap("pegasus 2"), null, { forTripId: "gr" });
    await markSaved(URL1, pegasus, c.id);
    const d = await db();
    await d.put("captures", { ...(await d.get("captures", c.id))!, itemId: "gone", status: "done" });
    expect(await marksOn(URL1)).toEqual([]);
  });
});
