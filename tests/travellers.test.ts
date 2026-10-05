// Who goes, without sharing (0.37): "Bu seyahati iki kişilik yapmak istiyorum, Sabine'yi eklemek istiyorum,
// onunla paylaşmadan". The names typed or said, the shared trip's people and me, each once; how many drives the
// budget's level per person; the chat's set_travellers is undoable; the names travel with the shared settings.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listMessages } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { applyFields, applySettings, settingsOf } from "../src/lib/share/settings";
import { diffSettings, lineText } from "../src/lib/share/settingsDiff";
import { budgetLevel } from "../src/lib/tripStyle";
import { fieldsBefore, restoreFields, whoGoes, withTravellers } from "../src/lib/tripSettings";
import { onTripChange, type TripChange } from "../src/lib/tripUndo";
import { changeTravellers, undo } from "../src/app/actions";
import { undoEvent } from "../src/lib/eventUndo";
import type { Trip } from "../src/lib/types";

const trip = (over: Partial<Trip> = {}): Trip => ({ id: "w1", title: "Porto", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });

describe("who goes", () => {
  it("merges the names said, me and the shared trip's people, each once whatever the case; me first", () => {
    expect(whoGoes({ travellers: { names: ["Sabine"] }, me: "Emre", adults: 1 })).toEqual({ names: ["Emre", "Sabine"], count: 2, me: "Emre" });
    // No profile name: "Ben".
    expect(whoGoes({ travellers: { names: ["Sabine"] }, adults: null }).names).toEqual(["Ben", "Sabine"]);
    // Shared: the sharing name and the members, the names said added, "sabine " the same as "Sabine".
    expect(whoGoes({ travellers: { names: ["sabine ", "Ali"] }, shared: true, me: "Emre", members: ["Emre", "Sabine"] })).toMatchObject({ names: ["Emre", "Sabine", "Ali"], count: 3 });
    // Case aside in any language (a Turkish lower case would make "SABINE" "sabıne").
    expect(whoGoes({ travellers: { names: ["SABINE", "Sabine", "İsmail", "ismail"] }, me: "Emre" }).names).toEqual(["Emre", "SABINE", "İsmail"]);
    // Shared without anyone said: as before (the people on the share).
    expect(whoGoes({ shared: true, me: "Emre", members: ["emre", "Sabine"] }).names).toEqual(["Emre", "Sabine"]);
  });

  it("counts the count said, else the saves' adults, never fewer than the names", () => {
    expect(whoGoes({ adults: 2 })).toEqual({ names: [], count: 2, me: null }); // nobody named: the saves, as before
    expect(whoGoes({ adults: null }).count).toBe(0);
    expect(whoGoes({ travellers: { names: ["Sabine", "Ali"] }, adults: 1 }).count).toBe(3);
    expect(whoGoes({ travellers: { names: ["Sabine"], count: 4 }, adults: 2 }).count).toBe(4);
    expect(whoGoes({ travellers: { names: [], count: 1 }, adults: 2 }).count).toBe(1); // "tek gidiyorum" wins over the saves
    expect(whoGoes({ travellers: { names: ["Sabine", "Ali"], count: 1 } }).count).toBe(3);
  });

  it("adds and removes names (case aside, trimmed, once), keeps or sets the count, and refuses a bad count", () => {
    const one = withTravellers(undefined, { add: ["Sabine", " sabine", ""] });
    expect(one).toEqual({ travellers: { names: ["Sabine"] }, missing: [] });
    const two = withTravellers({ names: ["Sabine"], count: 3 }, { add: ["Ali"], remove: ["SABINE", "Zeynep"] });
    expect(two).toEqual({ travellers: { names: ["Ali"], count: 3 }, missing: ["Zeynep"] });
    expect(withTravellers({ names: ["Ali"], count: 3 }, { count: null })).toEqual({ travellers: { names: ["Ali"] }, missing: [] });
    expect(withTravellers(undefined, { count: 2.5 })).toMatch(/tam sayı/);
    expect(withTravellers(undefined, { count: 99 })).toMatch(/1 ile 50/);
  });

  it("drives the budget's level per person", () => {
    const budget = { amount: 1500, currency: "EUR" };
    // €1.500 for 7 days: one person €214 a day (high), two €107 (mid).
    expect(budgetLevel(budget, 7, whoGoes({ adults: 1 }).count, null)).toBe("high");
    expect(budgetLevel(budget, 7, whoGoes({ travellers: { names: ["Sabine"] }, adults: 1 }).count, null)).toBe("mid");
  });
});

describe("who goes travels with the shared settings", () => {
  it("is a synced field; a board that doesn't know it never wipes it; taking everyone out is sent as no names", () => {
    const mine = trip({ travellers: { names: ["Sabine"] } });
    expect(settingsOf(mine).travellers).toEqual({ names: ["Sabine"] });
    // An older board's settings have no `travellers`: the names here stay.
    expect(applySettings(mine, { ...settingsOf(mine), travellers: null }).travellers).toEqual({ names: ["Sabine"] });
    expect(applySettings(mine, { ...settingsOf(mine), travellers: { names: [] } }).travellers).toEqual({ names: [] });
    // Geçmiş / the notice's "Geri al" to a time before anyone was named: nobody named.
    expect(applyFields(mine, { ...settingsOf(mine), travellers: null }, ["travellers"]).travellers).toEqual({ names: [] });
    expect(diffSettings(settingsOf(trip()), settingsOf(mine)).map(lineText)).toEqual(["Gidenler: yok → Sabine"]);
    // Undoing "Sabine eklendi" on a shared trip (review, 0.37): sent as nobody named, so the other computer follows
    // (a missing field would be null, which a board keeps its names over).
    const added = withTravellers(undefined, { add: ["Sabine"] });
    if (typeof added === "string") throw new Error(added);
    const before = fieldsBefore(trip(), ["travellers"]);
    expect(before.before).toEqual({ travellers: { names: [] } });
    const undone = restoreFields(trip({ travellers: added.travellers }), before);
    const peer = trip({ id: "peer", travellers: { names: ["Sabine"] } });
    expect(applySettings(peer, settingsOf(undone)).travellers).toEqual({ names: [] });
    // Even a line kept before this fix (no value before): nobody named, not a missing field.
    expect(restoreFields(trip({ travellers: added.travellers }), { fields: ["travellers"], before: {} }).travellers).toEqual({ names: [] });
    expect(diffSettings(settingsOf(mine), settingsOf(trip({ travellers: { names: ["Sabine"], count: 3 } }))).map(lineText)).toEqual(["Gidenler: Sabine → Sabine · 3 kişi"]);
  });
});

describe("set_travellers in the chat", () => {
  let changes: TripChange[] = [];
  let off = () => {};
  beforeEach(() => {
    changes = [];
    off = onTripChange((c) => changes.push(c));
  });
  afterEach(() => off());

  function fakeClient(responses: Partial<Anthropic.Message>[]) {
    const calls: Anthropic.MessageCreateParams[] = [];
    const client = {
      messages: {
        create: async (params: Anthropic.MessageCreateParams) => {
          calls.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error("no more fake responses");
          return next;
        },
      },
    } as unknown as Anthropic;
    return { client, calls };
  }

  it("'Sabine de geliyor' names her without sharing, the hero says two, and Geri al takes it back", async () => {
    const d = await db();
    await d.put("trips", trip({ id: "w2" }));
    const { client, calls } = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "set_travellers", input: { add: ["Sabine"], remove: [], count: 0 }, caller: { type: "direct" } }] as Anthropic.ContentBlock[] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Sabine'yi ekledim; paylaşmadım, ikiniz görünüyorsunuz.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("w2", "Sabine de geliyor ama henüz paylaşma", anthropicProvider(client, "claude-opus-5"));
    expect((await d.get("trips", "w2"))!.travellers).toEqual({ names: ["Sabine"] });
    const result = JSON.parse((calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);
    expect(result).toMatchObject({ named: ["Sabine"], people: 2 });
    expect(result.shown).toMatch(/^Kahramanda: Ben & Sabine · 2 kişi/);
    expect((await d.get("trips", "w2"))!.shareId).toBeUndefined(); // nothing shared
    expect((await listMessages("w2")).some((m) => m.role === "event" && m.text === "Gidenler: Sabine (sohbetten)")).toBe(true);
    // A tool changed it: no "couldn't change" note.
    expect((await listMessages("w2")).filter((m) => m.role === "assistant").at(-1)!.text).not.toMatch(/Not:/);
    expect(changes).toHaveLength(1);
    await undo({ kind: "trip", change: changes[0] });
    expect((await d.get("trips", "w2"))!.travellers).toEqual({ names: [] }); // nobody named, never a missing field
  });

  it("'2 kişiyiz' sets the count; the same again changes nothing and says so", async () => {
    const d = await db();
    await d.put("trips", trip({ id: "w3" }));
    const first = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "set_travellers", input: { add: [], remove: [], count: 2 }, caller: { type: "direct" } }] as Anthropic.ContentBlock[] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Not aldım: 2 kişisiniz.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("w3", "2 kişiyiz", anthropicProvider(first.client, "claude-opus-5"));
    expect((await d.get("trips", "w3"))!.travellers).toEqual({ names: [], count: 2 });
    const again = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "set_travellers", input: { add: [], remove: [], count: 2 }, caller: { type: "direct" } }] as Anthropic.ContentBlock[] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Zaten 2 kişi olarak kayıtlı.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("w3", "iki kişiyiz", anthropicProvider(again.client, "claude-opus-5"));
    expect(JSON.parse((again.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string)).toMatchObject({ unchanged: true, people: 2 });
    expect(changes).toHaveLength(1);
  });

  it("the hero's popover writes the same way, with a line in Geçmiş", async () => {
    const d = await db();
    await d.put("trips", trip({ id: "w4" }));
    expect(await changeTravellers("w4", { add: ["Sabine"] }, "Gidenler: Sabine eklendi")).toBe(true);
    const written = (await d.get("trips", "w4"))!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    // The same name again: nothing written, not even the time (it mustn't win a settings sync), no line.
    expect(await changeTravellers("w4", { add: ["sabine"] }, "tekrar")).toBe(false);
    expect((await d.get("trips", "w4"))!.updatedAt).toBe(written);
    expect((await d.get("trips", "w4"))!.travellers).toEqual({ names: ["Sabine"] });
    await changeTravellers("w4", { remove: ["Sabine"] }, "Gidenler: Sabine çıkarıldı");
    expect((await d.get("trips", "w4"))!.travellers).toEqual({ names: [] });
    const lines = (await listMessages("w4")).filter((m) => m.role === "event");
    expect(lines.map((m) => m.text)).toEqual(["Gidenler: Sabine eklendi", "Gidenler: Sabine çıkarıldı"]);
    // Geçmiş's Geri al on the newest line: Sabine is back; the older line no longer matches the trip, so it stays.
    await undoEvent(lines[1].id);
    expect((await d.get("trips", "w4"))!.travellers).toEqual({ names: ["Sabine"] });
    await undoEvent(lines[0].id); // "eklendi" taken back now: nobody named, as before it
    expect((await d.get("trips", "w4"))!.travellers).toEqual({ names: [] });
  });
});
