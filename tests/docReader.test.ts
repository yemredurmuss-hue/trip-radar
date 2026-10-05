// 0.34.6 §1–2: a file dropped in the chat is kept with the trip and read by the traveller's own model (mocked
// here: no API call); the code then links it to its card (booked, filled in, corrections kept) or makes the
// right booked record, and says so in one sentence.
import "fake-indexeddb/auto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sectionOfItem } from "../src/lib/categories";
import { db, listItems, listMessages } from "../src/lib/db";
import { addTripDoc, checkDoc, docGroupOf, getDoc, linkDoc, listDocMeta, restoreDoc, takeDoc } from "../src/lib/docs";
import { cleanFacts, DocFactsSchema, docSentence, fillFromDoc, matchDoc, placeDoc, readDocument, type DocFacts } from "../src/lib/docReader";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { geminiProvider, type GeminiClient } from "../src/lib/llm/gemini";
import { fitsStrict, schemaLoad } from "../src/lib/llm/schemaBudget";
import type { LlmProvider } from "../src/lib/llm/types";
import { plannedItem } from "../src/lib/planned";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const facts = (over: Partial<DocFacts>): DocFacts => ({
  doc_type: "other", provider: null, title: null, travellers: [], start_date: null, end_date: null, time: null, from: null, to: null,
  city: null, booking_ref: null, flight_number: null, amount: null, currency: null, ...over,
});
const policy = facts({
  doc_type: "insurance", provider: "Allianz", title: "Seyahat sağlık sigortası", travellers: ["Emre Durmuş", "Ayşe Durmuş"],
  start_date: "2026-10-07", end_date: "2026-10-21", booking_ref: "AZ-998877", amount: 48.5, currency: "EUR",
});
const said = (kind: Parameters<typeof plannedItem>[0]["kind"], over: Partial<Parameters<typeof plannedItem>[0]> = {}, id: string = kind) =>
  plannedItem({ kind, date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over }, "t1", id, 1);

describe("file intake", () => {
  it("accepts PDF, PNG and JPG; refuses the rest", () => {
    expect(checkDoc({ name: "police.pdf", type: "application/pdf", size: 10 })).toBeNull();
    expect(checkDoc({ name: "qr.png", type: "image/png", size: 10 })).toBeNull();
    expect(checkDoc({ name: "bilet.jpg", type: "image/jpeg", size: 10 })).toBeNull();
    expect(checkDoc({ name: "notes.docx", type: "application/msword", size: 10 })).not.toBeNull();
    expect(checkDoc({ name: "clip.mp4", type: "video/mp4", size: 10 })).not.toBeNull();
  });

  it("a dropped file is kept with the trip, linked to no card; linked later; deleted and brought back", async () => {
    const doc = await addTripDoc("t9", new File(["%PDF-1.4"], "police.pdf", { type: "application/pdf" }), 5);
    expect(doc).toMatchObject({ itemId: "", tripId: "t9", type: "application/pdf" });
    await linkDoc(doc.id, "card-1", "insurance");
    expect((await listDocMeta("t9"))[0]).toMatchObject({ itemId: "card-1", kind: "insurance" });
    const taken = await takeDoc(doc.id);
    expect(await listDocMeta("t9")).toEqual([]);
    await restoreDoc(taken!);
    expect((await getDoc(doc.id))?.itemId).toBe("card-1");
  });
});

describe("reading the answer", () => {
  it("the schema fits Claude's strict output limits", () => {
    expect(fitsStrict(schemaLoad(zodOutputFormat(DocFactsSchema as never).schema))).toBe(true);
  });
  it("keeps only real dates, times, codes and amounts", () => {
    const c = cleanFacts(facts({ doc_type: "flight", start_date: "7 Ekim", end_date: "2026-10-01", time: "9:5", amount: -3, currency: "€", travellers: ["  A  ", "", "B"] }));
    expect(c).toMatchObject({ start_date: null, end_date: null, time: null, amount: null, currency: null, travellers: ["A", "B"] });
    expect(cleanFacts(facts({ amount: 48.5, currency: "€" })).currency).toBe("EUR");
  });
});

describe("where the document goes", () => {
  it("a policy with no card: a booked insurance record in Diğer, with its facts", () => {
    const out = placeDoc(policy, [], "t1", "new", 9);
    expect(out.kind).toBe("created");
    const item = (out as { item: Item }).item;
    expect(item).toMatchObject({ plannedKind: "insurance", category: "other", status: "booked", provider: "Allianz", name: "Seyahat sağlık sigortası · Allianz" });
    expect(item.dates).toMatchObject({ start: "2026-10-07", end: "2026-10-21" });
    expect(item.price).toMatchObject({ amount: 48.5, currency: "EUR", source: "user" });
    expect(item.guests.adults).toBe(2);
    expect(item.statusNote).toContain("AZ-998877");
    expect(sectionOfItem(item)).toBe("other");
    expect(docSentence(out, "police.pdf")).toBe("Allianz seyahat sağlık sigortası poliçeni Diğer'e ekledim, 7–21 Ekim, 2 kişi. Belgeler'de duruyor.");
  });

  it("a policy and the insurance card planned from the template: linked, booked, filled", () => {
    const card = said("insurance");
    expect(matchDoc(policy, [card])?.id).toBe(card.id);
    const out = placeDoc(policy, [card], "t1", "new", 9);
    expect(out).toMatchObject({ kind: "linked", item: { id: card.id, status: "booked", provider: "Allianz" } });
    expect(docSentence(out, "police.pdf")).toMatch(/^Allianz seyahat sağlık sigortası poliçeni "Seyahat sigortası" kartına bağladım ve alındı olarak işaretledim, 7–21 Ekim, 2 kişi\./);
  });

  it("a flight ticket finds its flight by day and route, never another day's", () => {
    const out = said("flight", { date: "2026-10-07", from: "IST", to: "OPO" }, "out");
    const home = said("flight", { date: "2026-10-12", from: "OPO", to: "IST" }, "home");
    const ticket = facts({ doc_type: "flight", provider: "TAP", start_date: "2026-10-12", time: "18:40", from: "Porto", to: "İstanbul", booking_ref: "X7Y8Z9", flight_number: "TP1764" });
    expect(matchDoc(ticket, [out, home])?.id).toBe("home");
    const filled = fillFromDoc(home, ticket, 9);
    expect(filled.flight).toMatchObject({ departure: "2026-10-12T18:40", flightNumber: "TP1764", carrier: "TAP", from: "OPO", to: "IST" });
    expect(filled.statusNote).toBe("PNR X7Y8Z9");
    // Another day: a new booked flight.
    expect(matchDoc({ ...ticket, start_date: "2026-10-20" }, [out, home])).toBeNull();
  });

  it("a stay confirmation finds the saved page by its dates and city; the traveller's corrections stay", () => {
    const page = makeItem({ category: "stay", name: "Jardim Stay", city: "Porto", dates: { start: "2026-10-08", end: "2026-10-11", source: "page" }, status: "chosen", userEdits: { price: 300 } });
    const other = makeItem({ category: "stay", name: "Casa Azul", city: "Porto", dates: { start: "2026-10-08", end: "2026-10-11", source: "page" } });
    const conf = facts({ doc_type: "stay", title: "Jardim Stay", provider: "Booking.com", city: "Porto", start_date: "2026-10-08", end_date: "2026-10-11", amount: 285, currency: "EUR", booking_ref: "4021.556" });
    const hit = matchDoc(conf, [other, page]);
    expect(hit?.id).toBe(page.id);
    const filled = fillFromDoc(page, conf, 9);
    expect(filled.status).toBe("booked");
    expect(filled.price.amount).toBeNull(); // corrected by hand: not written over
    expect(filled.userEdits).toEqual({ price: 300 });
    // Lisbon's dates: not this one.
    expect(matchDoc({ ...conf, city: "Lizbon", title: null }, [page])).toBeNull();
  });

  it("an event ticket must name its thing to do or be for its day", () => {
    const fado = said("activity", { title: "Fado gecesi", city: "Porto", date: "2026-10-10" }, "fado");
    const market = said("todo", { title: "Porto Belo Pazarı", city: "Porto" }, "market");
    expect(matchDoc(facts({ doc_type: "event", title: "Fado gecesi", city: "Porto" }), [market, fado])?.id).toBe("fado");
    expect(matchDoc(facts({ doc_type: "event", title: "Serralves" }), [market, fado])).toBeNull();
    const made = placeDoc(facts({ doc_type: "event", title: "Serralves", city: "Porto", start_date: "2026-10-09" }), [], "t1", "s", 1);
    expect(made.kind).toBe("created");
    expect(sectionOfItem((made as { item: Item }).item)).toBe("activity"); // a ticket: Etkinlikler, booked
  });

  it("something it can't tell stays in Belgeler alone; a page's screenshot isn't a document", () => {
    expect(placeDoc(facts({ doc_type: "other" }), [], "t1", "x", 1).kind).toBe("kept");
    expect(placeDoc(facts({ doc_type: "not_a_document" }), [], "t1", "x", 1).kind).toBe("not_document");
  });
});

describe("Belgeler's groups", () => {
  it("by the card, else by what was read", () => {
    expect(docGroupOf({}, said("flight", { date: "2026-10-07" }))).toBe("flight");
    expect(docGroupOf({}, said("taxi", { date: "2026-10-07" }))).toBe("transport");
    expect(docGroupOf({}, said("insurance"))).toBe("insurance");
    expect(docGroupOf({}, said("esim"))).toBe("internet");
    expect(docGroupOf({}, said("activity", { title: "Fado" }))).toBe("event");
    expect(docGroupOf({ kind: "train" }, null)).toBe("transport");
    expect(docGroupOf({ kind: "visa" }, null)).toBe("other");
    expect(docGroupOf({}, null)).toBe("other");
  });
});

const trip: Trip = { id: "t1", title: "Portekiz", confirmedDates: { start: "2026-10-07", end: "2026-10-21" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };

describe("readDocument (mocked model)", () => {
  it("Gemini gets the PDF inline; the policy lands in Diğer, booked, the file linked, two chat lines", async () => {
    const d = await db();
    await d.put("trips", trip);
    const doc = await addTripDoc("t1", new File(["%PDF-1.4 policy"], "police.pdf", { type: "application/pdf" }), 5);
    const bodies: any[] = [];
    const client: GeminiClient = {
      models: {
        generateContent: (async (body: any) => {
          bodies.push(body);
          return { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(policy) }] }, finishReason: "STOP" }] };
        }) as never,
      },
    };
    const out = await readDocument("t1", doc.id, { llm: geminiProvider(client, "gemini-test", 0), today: "2026-10-05" });
    expect(bodies[0].contents[0].parts[0].inlineData).toEqual({ mimeType: "application/pdf", data: btoa("%PDF-1.4 policy") });
    expect(bodies[0].config.responseJsonSchema.properties.doc_type.enum).toContain("insurance");
    expect(out.kind).toBe("created");
    const items = await listItems("t1");
    const ins = items.find((i) => i.plannedKind === "insurance")!;
    expect(ins).toMatchObject({ status: "booked", category: "other" });
    expect((await getDoc(doc.id))).toMatchObject({ itemId: ins.id, kind: "insurance" });
    const chat = await listMessages("t1");
    expect(chat.map((m) => [m.role, m.text])).toEqual([
      ["user", "📎 police.pdf"],
      ["assistant", "Allianz seyahat sağlık sigortası poliçeni Diğer'e ekledim, 7–21 Ekim, 2 kişi. Belgeler'de duruyor."],
    ]);
    expect(chat[1].content).toEqual([{ text: chat[1].text }]);
  });

  it("Claude gets a document block (a picture: an image block)", async () => {
    const calls: Anthropic.MessageCreateParams[] = [];
    const client = {
      messages: {
        parse: async (params: Anthropic.MessageCreateParams) => {
          calls.push(params);
          return { stop_reason: "end_turn", parsed_output: facts({ doc_type: "other" }), content: [] };
        },
      },
    } as unknown as Anthropic;
    const llm = anthropicProvider(client, "claude-opus-5");
    await llm.generateJson("s", "p", DocFactsSchema, [{ mimeType: "application/pdf", data: "QQ==" }, { mimeType: "image/png", data: "Qg==" }]);
    const content = calls[0].messages[0].content as Anthropic.ContentBlockParam[];
    expect(content.map((b) => b.type)).toEqual(["document", "image", "text"]);
    expect(content[0]).toMatchObject({ source: { type: "base64", media_type: "application/pdf", data: "QQ==" } });
    expect(llm.assistantContent("ok")).toEqual([{ type: "text", text: "ok" }]);
  });

  it("a file too large to read is kept unread", async () => {
    const d = await db();
    await d.put("trips", trip);
    const big = await addTripDoc("t1", new File([new Uint8Array(11 * 1024 * 1024)], "scan.pdf", { type: "application/pdf" }), 5);
    const llm = { generateJson: async () => { throw new Error("must not be called"); } } as unknown as LlmProvider;
    await expect(readDocument("t1", big.id, { llm })).rejects.toThrow(/10 MB/);
    expect((await getDoc(big.id))?.itemId).toBe("");
  });
});
