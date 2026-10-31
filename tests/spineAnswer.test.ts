// tests/spineAnswer.test.ts: the summary's question answered with a tap ("Her şey dahil resort") is kept as the trip's
// preference under its topic, so the stay card it is about says it; a typed sentence that isn't one of the taps isn't.
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { keepSpineAnswer } from "../src/lib/assistant";
import { db } from "../src/lib/db";
import type { Trip } from "../src/lib/types";

it("a tap on the summary's question becomes 'Konaklama → her şey dahil resort'; the question waits no more", async () => {
  const d = await db();
  const trip: Trip = { id: "sa", title: "Maldivler", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, spine: { rationale: "", facts: [], ask: { text: "Su üstü villayı hangi tarzda düşünüyorsunuz?", topic: "stay_style", choices: ["Her şey dahil resort", "Sakin butik ada"] } } };
  await d.put("trips", trip);
  expect(await keepSpineAnswer("sa", "uçuşları bul")).toBe(false);
  expect(await keepSpineAnswer("sa", "Her şey dahil resort")).toBe(true);
  const after = (await d.get("trips", "sa"))!;
  expect(after.wants?.said).toEqual(["Konaklama → Her şey dahil resort"]);
  expect(after.spine?.ask).toBeNull();
  expect(await keepSpineAnswer("sa", "Sakin butik ada")).toBe(false);
});
