// The chat's side of an arrival (arrive/ChatArrivals.tsx, arrive/intake.ts): what was handed to the chat sits
// in time order among the messages, a file's chip moves under the "📎 name" line its reading wrote, and the
// chip says where the file went.
import { afterEach, describe, expect, it } from "vitest";
import { chatRows, fileChip } from "../src/app/arrive/ChatArrivals";
import { addIntake, intakeNow, KEEP_MS, MAX, pruneIntake, resetIntake, updateIntake, type FileIntake, type Intake, type LinkIntake } from "../src/app/arrive/intake";
import { setLang } from "../src/lib/i18n";
import type { ChatMessage } from "../src/lib/types";

afterEach(() => {
  resetIntake();
  setLang("tr");
});

const msg = (id: string, role: ChatMessage["role"], text: string, createdAt: number): ChatMessage => ({ id, tripId: "t1", role, content: null, text, choices: [], createdAt });
const file = (over: Partial<FileIntake> = {}): FileIntake => ({ id: "f1", kind: "file", tripId: "t1", source: "chat", at: 1000, name: "policy.pdf", type: "application/pdf", state: "reading", ...over });

describe("intake", () => {
  it("keeps what was handed over and updates a file's reading", () => {
    const link = addIntake<LinkIntake>({ kind: "link", tripId: "t1", source: "chat", url: "https://airbnb.com/rooms/1", captureId: "c1" });
    const f = addIntake<FileIntake>({ kind: "file", tripId: "t1", source: "board", name: "a.pdf", type: "application/pdf", state: "reading" });
    expect(intakeNow().map((e) => e.id)).toEqual([link.id, f.id]);
    updateIntake(f.id, { state: "done", itemId: "i1" });
    expect(intakeNow()[1]).toMatchObject({ state: "done", itemId: "i1" });
    expect(intakeNow()[0]).toBe(link); // the others stay the same objects
  });
});

describe("chatRows", () => {
  const link: LinkIntake = { id: "l1", kind: "link", tripId: "t1", source: "chat", at: 1500, url: "https://www.airbnb.com/rooms/1", captureId: "c1" };
  it("puts a link sent in this trip's chat among the messages, by time", () => {
    const rows = chatRows([msg("m1", "user", "selam", 1000), msg("m2", "event", "✓ Casa kaydedildi → Konaklama", 2000)], [link], "t1");
    expect(rows.map((r) => (r.kind === "msg" ? r.m.id : r.e.id))).toEqual(["m1", "l1", "m2"]);
  });
  it("leaves out what was handed to the board or another trip's chat", () => {
    const rows = chatRows([], [{ ...link, source: "board" }, { ...link, id: "l2", tripId: "t2" }], "t1");
    expect(rows).toEqual([]);
  });
  it("moves a read file's chip under its own '📎 name' line, else keeps its bubble", () => {
    const read = file({ state: "done", itemId: "i1", section: "other", itemName: "Seyahat sağlık sigortası" });
    const withLine = chatRows([msg("u", "user", "📎 policy.pdf", 1200), msg("a", "assistant", "Sigortayı Diğer'e ekledim.", 1201)], [read], "t1");
    expect(withLine).toHaveLength(2);
    expect(withLine[0]).toMatchObject({ kind: "msg", file: read });
    // Still reading: its own bubble at the time it was handed over.
    const reading = chatRows([msg("u0", "user", "merhaba", 900)], [file()], "t1");
    expect(reading.map((r) => r.kind)).toEqual(["msg", "intake"]);
    // An older line with the same name isn't this file's.
    const older = chatRows([msg("old", "user", "📎 policy.pdf", 10)], [{ ...read, at: 60_000 }], "t1");
    expect(older.map((r) => r.kind)).toEqual(["msg", "intake"]);
  });
});

describe("chat rows for a failed file", () => {
  it("says it once: the chat's own line, no chip beside it", () => {
    expect(chatRows([], [file({ state: "error", error: "Çok büyük", logged: true })], "t1")).toEqual([]);
    expect(chatRows([], [file({ state: "error", error: "Çok büyük" })], "t1")).toEqual([]);
  });
});

describe("pruneIntake", () => {
  const link = (id: string, endedAt?: number): Intake => ({ id, kind: "link", tripId: "t1", source: "chat", at: 0, url: "https://x.com", captureId: id, endedAt });
  it("drops a file 2 minutes after it ended, a screenshot's picture, never a link sent in the chat", () => {
    const now = 10 * KEEP_MS;
    const entries: Intake[] = [
      { ...file({ id: "done-old", state: "done" }), endedAt: now - KEEP_MS },
      { ...file({ id: "done-new", state: "done" }), endedAt: now - 1000 },
      { ...file({ id: "reading" }) },
      { ...file({ id: "shot", state: "screenshot", thumb: "data:image/jpeg;base64,AAAA", captureId: "c" }), endedAt: now - KEEP_MS },
      link("l-old", now - 5 * KEEP_MS),
    ];
    const out = pruneIntake(entries, now);
    expect(out.map((e) => e.id)).toEqual(["done-new", "reading", "shot", "l-old"]);
    expect((out[2] as FileIntake).thumb).toBeUndefined();
    expect(pruneIntake(out, now)).toBe(out); // nothing more to do: the same list
  });
  it("keeps at most MAX entries, the newest", () => {
    const many = Array.from({ length: MAX + 5 }, (_, i) => link(`l${i}`));
    const out = pruneIntake(many, 0);
    expect(out).toHaveLength(MAX);
    expect(out[0].id).toBe("l5");
  });
});

describe("fileChip", () => {
  it("reads, then says where the file went", () => {
    expect(fileChip(file())).toEqual({ tone: "work", text: "Okunuyor…" });
    expect(fileChip(file({ state: "done", itemId: "i1", section: "other", itemName: "Seyahat sağlık sigortası" }))).toEqual({ tone: "done", text: "→ Sigorta ve internet · Seyahat sağlık sigortası", itemId: "i1" });
    expect(fileChip(file({ state: "done" }))).toEqual({ tone: "done", text: "→ Belgeler'e eklendi", itemId: null });
    expect(fileChip(file({ state: "error", error: "Çok büyük" }))).toEqual({ tone: "error", text: "Okunamadı", captureId: null, detail: "Çok büyük" });
    setLang("en");
    expect(fileChip(file({ state: "done" })).text).toBe("→ Added to Documents");
  });
});
