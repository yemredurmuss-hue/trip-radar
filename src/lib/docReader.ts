// The assistant that reads a document (spec 0.34.6 §2): a policy, a ticket, a booking dropped in the chat or
// on the board goes to the traveller's own model with one question — what is it, from whom, for whom, when,
// where, which reference, how much — answered only from what's written on it. Then the code, not the model,
// decides: a card of the same kind and date/route/provider takes the file and is marked booked (its missing
// fields filled, the traveller's corrections never overwritten); else a booked record of the right kind is
// made (a policy in Diğer). One sentence in the chat says what happened; the file stays in Belgeler.
// Pure, except readDocument at the end.
import { z } from "zod";
import { cityOfAirport } from "./airports";
import { transportMode } from "./cardKinds";
import { sectionOfItem, type SectionId } from "./categories";
import { db, listItems, newId as makeId, nextTime, notifyChanged } from "./db";
import { linkDoc } from "./docs";
import { L } from "./i18n";
import { currencyCode, formatDateRange, isoDate } from "./items";
import { getProvider, type LlmProvider } from "./llm";
import type { Attachment } from "./llm/types";
import { cityKeyOf, departureDay, sameCity } from "./plan";
import { ALL_PLANNED_KINDS, checkPlanned, plannedItem, type PlannedInput } from "./planned";
import { isInsurance, isPaperwork, isRental, isTrip, isVisa } from "./travelKinds";
import { DOC_KINDS, type ChatMessage, type DocKind, type DocRecord, type Item, type PlannedKind, type Trip } from "./types";

/** Read at most this much (Gemini takes 20 MB inline, base64 is a third larger); a bigger file is kept unread. */
export const DOC_READ_MAX_BYTES = 10 * 1024 * 1024;

const READ_KINDS = [...DOC_KINDS, "not_a_document"] as const;
export type ReadKind = (typeof READ_KINDS)[number];

/** What the model reads off the document: only what's written on it, null otherwise. */
export const DocFactsSchema = z.object({
  doc_type: z.enum(READ_KINDS),
  provider: z.string().nullable(),
  title: z.string().nullable(),
  travellers: z.array(z.string()),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  time: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  city: z.string().nullable(),
  booking_ref: z.string().nullable(),
  flight_number: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
});
export type DocFacts = z.infer<typeof DocFactsSchema>;

export const docSystem = () =>
  L(
    `Bir seyahat belgesini okuyorsun (PDF ya da görsel). Yalnız belgede açıkça yazanı ver; tahmin etme, yazmayan alana null (travellers'a []) ver.
doc_type: insurance (seyahat/sağlık sigortası poliçesi), flight (uçak bileti, biniş kartı, uçuş onayı), stay (otel/ev rezervasyon onayı), train, bus, ferry (bilet), event (müze, konser, tur, etkinlik bileti), esim (eSIM/QR), car_rental (araç kiralama), visa (vize, ETIAS), other (seyahat belgesi ama bunlardan değil), not_a_document (bir web sayfasının, ilanın ya da arama sonuçlarının ekran görüntüsü; bilet/onay/poliçe değil).
provider: düzenleyen firma (Allianz, TAP, Booking.com ya da otelin adı). title: belgenin ne olduğu birkaç kelimeyle (ör. "Seyahat sağlık sigortası", otelin ya da etkinliğin adı). travellers: belgedeki kişi adları.
start_date/end_date: YYYY-AA-GG (sigorta: kapsam; konaklama: giriş/çıkış; uçuş: kalkış günü). time: SS:DD (kalkış ya da giriş saati). from/to: uçuş/tren için kalkış ve varış (şehir ya da havalimanı kodu). city: konaklama, etkinlik ya da kiralamanın şehri. booking_ref: PNR, rezervasyon ya da poliçe no. flight_number: ör. TP1234. amount: ödenen toplam tutar (sayı), currency: ISO kodu (EUR, TRY).`,
    `You are reading a travel document (a PDF or a picture). Give only what is plainly written on it; never guess: null for anything not written (travellers: []).
doc_type: insurance (travel/health insurance policy), flight (plane ticket, boarding pass, flight confirmation), stay (hotel/home booking confirmation), train, bus, ferry (ticket), event (museum, concert, tour, event ticket), esim (eSIM/QR), car_rental (car hire), visa (visa, ETIAS), other (a travel document but none of these), not_a_document (a screenshot of a web page, a listing or search results; not a ticket, confirmation or policy).
provider: who issued it (Allianz, TAP, Booking.com or the hotel's name). title: what it is in a few words (e.g. "Travel health insurance", the hotel's or the event's name). travellers: the people named on it.
start_date/end_date: YYYY-MM-DD (insurance: cover; stay: check-in/out; flight: day of departure). time: HH:MM (departure or check-in). from/to: departure and arrival for a flight/train (city or airport code). city: the city of a stay, event or hire. booking_ref: PNR, booking or policy number. flight_number: e.g. TP1234. amount: total paid (a number), currency: ISO code (EUR, TRY).`,
  );

export const docPrompt = (trip: Pick<Trip, "title" | "confirmedDates">, name: string, today: string) =>
  [
    L(`Gezi: ${trip.title}`, `Trip: ${trip.title}`),
    trip.confirmedDates ? L(`Gezi tarihleri: ${trip.confirmedDates.start} – ${trip.confirmedDates.end}`, `Trip dates: ${trip.confirmedDates.start} – ${trip.confirmedDates.end}`) : null,
    L(`Bugün: ${today}`, `Today: ${today}`),
    L(`Dosya adı: ${name}`, `File name: ${name}`),
  ]
    .filter(Boolean)
    .join("\n");

const text = (v: unknown, max = 80): string | null => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The answer made safe: real dates, a time, a currency code, a positive amount, short texts. */
export function cleanFacts(raw: DocFacts): DocFacts {
  const start = isoDate(raw.start_date);
  const end = isoDate(raw.end_date);
  const time = text(raw.time, 5);
  const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0 ? Math.round(raw.amount * 100) / 100 : null;
  return {
    doc_type: (READ_KINDS as readonly string[]).includes(raw.doc_type) ? raw.doc_type : "other",
    provider: text(raw.provider),
    title: text(raw.title),
    travellers: (Array.isArray(raw.travellers) ? raw.travellers : []).map((t) => text(t, 60)).filter((t): t is string => Boolean(t)).slice(0, 9),
    start_date: start,
    end_date: start && end && end >= start ? end : null,
    time: time && TIME.test(time) ? time : null,
    from: text(raw.from, 60),
    to: text(raw.to, 60),
    city: text(raw.city, 60),
    booking_ref: text(raw.booking_ref, 40),
    flight_number: text(raw.flight_number, 12),
    amount,
    currency: amount != null ? currencyCode(raw.currency) : null,
  };
}

const place = (s: string | null | undefined): string | null => (s ? cityKeyOf(cityOfAirport(s.trim())) : null);
const folded = (s: string | null | undefined) =>
  (s ?? "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const mentions = (hay: string | null | undefined, needle: string | null | undefined): boolean => {
  const [h, n] = [folded(hay), folded(needle)];
  return Boolean(h && n && n.length >= 3 && (` ${h} `.includes(` ${n} `) || ` ${n} `.includes(` ${h} `)));
};

/** The records a document of this kind may belong to. */
function sameKind(kind: DocKind, item: Item): boolean {
  if (item.status === "dismissed") return false;
  switch (kind) {
    case "insurance":
      return isInsurance(item);
    case "flight":
      return item.category === "flight";
    case "stay":
      return item.category === "stay";
    case "train":
    case "bus":
    case "ferry":
      return item.category === "transport" && (transportMode(item) === kind || (transportMode(item) == null && isTrip(item)));
    case "car_rental":
      return item.category === "transport" && isRental(item);
    case "event":
      return (item.category === "activity" || item.category === "other") && !isPaperwork(item);
    case "esim":
      return item.category === "esim" || (isPaperwork(item) && /\besim\b|e-sim/i.test(item.name));
    case "visa":
      return isVisa(item);
    case "other":
      return false;
  }
}

/** Kinds that cover the whole trip: one such card is the one, without a date or a route to agree on. */
const WHOLE_TRIP: readonly DocKind[] = ["insurance", "esim", "visa", "car_rental"];
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;

/** How well a record agrees with the document: null on a contradiction (another day, another route, another city). */
export function agreement(kind: DocKind, facts: DocFacts, item: Item): number | null {
  let score = 0;
  const day = departureDay(item);
  if (!WHOLE_TRIP.includes(kind) && facts.start_date && day) {
    if (kind === "stay") {
      const theirs = { start: day, end: isoDate(item.dates.end) ?? day };
      const ours = { start: facts.start_date, end: facts.end_date ?? facts.start_date };
      if (day === facts.start_date) score += 2;
      else if (theirs.end > theirs.start && ours.end > ours.start && overlaps(theirs, ours)) score += 1;
      else return null;
    } else if (day === facts.start_date) score += 2;
    else return null;
  }
  if (item.flight && (facts.from || facts.to)) {
    const [a, b] = [place(item.flight.from), place(facts.from)];
    const [c, d] = [place(item.flight.to ?? item.city), place(facts.to)];
    if (a && b) {
      if (a !== b) return null;
      score += 1;
    }
    if (c && d) {
      if (c !== d) return null;
      score += 1;
    }
  }
  if ((kind === "stay" || kind === "event" || kind === "car_rental") && facts.city && item.city) {
    if (!sameCity(facts.city, item.city)) return null;
    score += 1;
  }
  if (facts.flight_number && item.flight?.flightNumber && folded(item.flight.flightNumber) === folded(facts.flight_number)) score += 3;
  if (facts.booking_ref && mentions(`${item.statusNote ?? ""} ${item.summary}`, facts.booking_ref)) score += 3;
  if (facts.provider && (mentions(item.provider, facts.provider) || mentions(item.name, facts.provider))) score += 1;
  if (kind === "event" || kind === "stay") {
    if (facts.title && mentions(item.name, facts.title)) score += 2;
    // A ticket for one of many things to do: it must name it or be for its day.
    if (kind === "event" && score < 2) return null;
  }
  return score;
}

const decidedFirst = (i: Item) => (i.status === "booked" ? 0 : i.status === "chosen" ? 1 : 2);

/** The card the document belongs to: same kind, nothing contradicting, most in agreement; null when none is clear. */
export function matchDoc(facts: DocFacts, items: Item[]): Item | null {
  if (facts.doc_type === "not_a_document" || facts.doc_type === "other") return null;
  const kind = facts.doc_type;
  const scored = items
    .filter((i) => sameKind(kind, i))
    .map((item) => ({ item, score: agreement(kind, facts, item) }))
    .filter((x): x is { item: Item; score: number } => x.score != null && (WHOLE_TRIP.includes(kind) || x.score >= 1));
  scored.sort((a, b) => b.score - a.score || decidedFirst(a.item) - decidedFirst(b.item) || a.item.createdAt - b.item.createdAt);
  return scored[0]?.item ?? null;
}

/** What the reference is called on its card's note (an event's says "ticket", so it reads as a booking). */
function refNote(kind: DocKind, ref: string | null): string | null {
  if (kind === "event") return ref ? L(`Bilet · ${ref}`, `Ticket · ${ref}`) : L("Bilet belgelerde", "Ticket in the documents");
  if (!ref) return null;
  if (kind === "flight") return `PNR ${ref}`;
  if (kind === "insurance") return L(`Poliçe no ${ref}`, `Policy no ${ref}`);
  return L(`Rezervasyon no ${ref}`, `Booking ref ${ref}`);
}

/**
 * The card with the document's facts: booked, and each field it lacks filled in. Nothing it already says is
 * replaced, and a field the traveller corrected (userEdits) is left alone.
 */
export function fillFromDoc(item: Item, facts: DocFacts, now: number): Item {
  const kind = facts.doc_type as DocKind;
  const edited = item.userEdits ?? {};
  const out: Item = { ...item, updatedAt: now };
  if (item.status !== "booked") Object.assign(out, { status: "booked", statusAt: now });
  if (!item.dates.start && facts.start_date && !edited.start) {
    out.dates = { start: facts.start_date, end: item.dates.end ?? (edited.end ? null : facts.end_date), source: "user" };
  } else if (item.dates.start && !item.dates.end && facts.end_date && !edited.end && item.dates.start === facts.start_date) {
    out.dates = { ...item.dates, end: facts.end_date };
  }
  if (item.flight || ((kind === "flight" || kind === "train" || kind === "bus" || kind === "ferry") && (facts.from || facts.to || facts.time))) {
    const f = item.flight ?? { from: null, to: null, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null };
    const day = out.dates.start ?? facts.start_date;
    out.flight = {
      ...f,
      from: f.from ?? (edited.from ? null : facts.from),
      to: f.to ?? (edited.to ? null : facts.to),
      departure: f.departure ?? (facts.time && day && !edited.time ? `${day}T${facts.time}` : null),
      flightNumber: f.flightNumber ?? facts.flight_number,
      carrier: f.carrier ?? (kind === "flight" ? facts.provider : null),
    };
  }
  if (item.price.amount == null && facts.amount != null && edited.price == null) {
    out.price = { amount: facts.amount, currency: facts.currency, scope: "total", taxesIncluded: "unknown", source: "user", observedAt: now };
  }
  if (!item.provider && facts.provider) out.provider = facts.provider;
  if (item.guests.adults == null && facts.travellers.length) out.guests = { ...item.guests, adults: facts.travellers.length };
  const note = refNote(kind, facts.booking_ref);
  if (note && !(item.statusNote ?? "").includes(facts.booking_ref ?? note)) out.statusNote = [item.statusNote, note].filter(Boolean).join(" · ");
  return out;
}

const PLANNED_FOR: Partial<Record<DocKind, PlannedKind>> = {
  insurance: "insurance", flight: "flight", stay: "stay", train: "train", bus: "bus", ferry: "ferry",
  event: "activity", esim: "esim", car_rental: "car_rental", visa: "other",
};

function titleFor(kind: DocKind, facts: DocFacts): string | null {
  switch (kind) {
    case "insurance":
      return [facts.title ?? L("Seyahat sigortası", "Travel insurance"), facts.provider].filter(Boolean).join(" · ");
    case "stay":
    case "event":
      return facts.title ?? facts.provider;
    case "esim":
      return facts.provider ? `eSIM · ${facts.provider}` : null;
    case "visa":
      return facts.title && /vize|visa|etias/i.test(facts.title) ? facts.title : [L("Vize", "Visa"), facts.city].filter(Boolean).join(" · ");
    default:
      return null;
  }
}

/** A booked record of the right kind for a document no card takes (a policy goes to Diğer); null for "other". */
export function itemFromDoc(facts: DocFacts, tripId: string, id: string, now: number): Item | null {
  const kind = facts.doc_type as DocKind;
  const planned = PLANNED_FOR[kind];
  if (!planned) return null;
  const stay = kind === "stay" || kind === "car_rental";
  let input: PlannedInput = {
    kind: planned,
    date: facts.start_date,
    end_date: stay || kind === "insurance" || kind === "esim" || kind === "visa" ? facts.end_date : null,
    time: facts.time,
    from: kind === "flight" || kind === "train" || kind === "bus" || kind === "ferry" ? facts.from : null,
    to: kind === "flight" || kind === "train" || kind === "bus" || kind === "ferry" ? facts.to : null,
    city: facts.city,
    title: titleFor(kind, facts),
    booked: true,
    note: null,
  };
  // A field the record can't hold is dropped rather than the record (a stay's check-out before its check-in).
  if (checkPlanned(input, ALL_PLANNED_KINDS, { complete: false })) input = { ...input, end_date: null, time: null };
  if (checkPlanned(input, ALL_PLANNED_KINDS, { complete: false })) input = { ...input, date: null };
  const made = plannedItem(input, tripId, id, now);
  return fillFromDoc({ ...made, status: "booked", statusAt: now }, facts, now);
}

export type DocOutcome =
  | { kind: "linked"; item: Item; facts: DocFacts }
  | { kind: "created"; item: Item; facts: DocFacts }
  | { kind: "kept"; facts: DocFacts }
  | { kind: "not_document"; facts: DocFacts };

/** Where the document goes: the card that takes it, a new booked record, or Belgeler alone. */
export function placeDoc(facts: DocFacts, items: Item[], tripId: string, id: string, now: number): DocOutcome {
  if (facts.doc_type === "not_a_document") return { kind: "not_document", facts };
  const match = matchDoc(facts, items);
  if (match) return { kind: "linked", item: fillFromDoc(match, facts, now), facts };
  const made = itemFromDoc(facts, tripId, id, now);
  return made ? { kind: "created", item: made, facts } : { kind: "kept", facts };
}

/** "Diğer'e", "to Other": the section a record landed in, as the sentence says it. */
const SECTION_TO: Record<SectionId, [string, string]> = {
  flight: ["Uçuş'a", "Flights"],
  stay: ["Konaklama'ya", "Stays"],
  transport: ["Ulaşım'a", "Getting around"],
  activity: ["Etkinlikler'e", "Activities"],
  todo: ["Yapılacak şeyler'e", "Things to do"],
  food: ["Restoranlar'a", "Restaurants"],
  other: ["Diğer'e", "Other"],
  inspo: ["İlham'a", "Inspiration"],
};

function whatOf(facts: DocFacts): string {
  const p = facts.provider ? `${facts.provider} ` : "";
  const route = facts.from && facts.to ? `${cityOfAirport(facts.from)} → ${cityOfAirport(facts.to)} ` : "";
  switch (facts.doc_type) {
    case "insurance": {
      const t = facts.title && /sigorta|insurance|seguro/i.test(facts.title) ? lower(facts.title) : null;
      return L(`${p}${t ?? "sigorta"} poliçeni`, `your ${p}${t ?? "insurance"} policy`);
    }
    case "flight":
      return L(`${route}uçuş biletini`, `your ${route}flight ticket`);
    case "stay":
      return L(`${facts.title ?? facts.provider ?? ""} rezervasyonunu`.trim(), `your ${facts.title ?? facts.provider ?? ""} booking`.replace(/\s+/g, " "));
    case "train":
      return L(`${route}tren biletini`, `your ${route}train ticket`);
    case "bus":
      return L(`${route}otobüs biletini`, `your ${route}bus ticket`);
    case "ferry":
      return L(`${route}feribot biletini`, `your ${route}ferry ticket`);
    case "event":
      return L(`${facts.title ? `${facts.title} ` : ""}biletini`, `your ${facts.title ? `${facts.title} ` : ""}ticket`);
    case "esim":
      return L(`${p}eSIM'ini`, `your ${p}eSIM`);
    case "car_rental":
      return L(`${p}araç kiralamanı`, `your ${p}car hire`);
    case "visa":
      return L("vizeni", "your visa");
    default:
      return L("belgeni", "your document");
  }
}

/** "7–21 Eki, 2 kişi" */
function extrasOf(facts: DocFacts, item: Item | null): string {
  const start = facts.start_date ?? item?.dates.start ?? null;
  const end = facts.end_date ?? (facts.start_date ? null : (item?.dates.end ?? null));
  const n = facts.travellers.length;
  return [start ? formatDateRange(start, end) : null, n ? L(`${n} kişi`, `${n} traveller${n === 1 ? "" : "s"}`) : null].filter(Boolean).map((s) => `, ${s}`).join("");
}

/** The assistant's one sentence: what it did with the file, and that it's in Belgeler. */
export function docSentence(outcome: DocOutcome, fileName: string): string {
  if (outcome.kind === "kept" || outcome.kind === "not_document") {
    return L(`${fileName} Belgeler'e kaydedildi; hangi karta ait olduğunu oradan seçebilirsin.`, `${fileName} is saved in Documents; you can pick the card it belongs to there.`);
  }
  const what = whatOf(outcome.facts);
  const extras = extrasOf(outcome.facts, outcome.item);
  if (outcome.kind === "linked") {
    return L(
      `${capital(what)} "${outcome.item.name}" kartına bağladım ve alındı olarak işaretledim${extras}. Belgeler'de duruyor.`,
      `I attached ${what} to "${outcome.item.name}" and marked it booked${extras}. It's in Documents.`,
    );
  }
  const [tr, en] = SECTION_TO[sectionOfItem(outcome.item)];
  return L(`${capital(what)} ${tr} ekledim${extras}. Belgeler'de duruyor.`, `I added ${what} to ${en}${extras}. It's in Documents.`);
}
const lower = (s: string) => (s ? s[0].toLocaleLowerCase("tr") + s.slice(1) : s);
const capital = (s: string) => (s ? s[0].toLocaleUpperCase("tr") + s.slice(1) : s);

/** A file's bytes in base64 (for a PDF; a picture is made smaller first by the board). */
export async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export async function plainAttachment(doc: DocRecord): Promise<Attachment> {
  return { mimeType: doc.type as Attachment["mimeType"], data: await base64Of(doc.blob) };
}

export interface ReadDeps {
  llm?: LlmProvider;
  /** How the file is sent (the board shrinks a picture first); default: as it is. */
  attachment?: (doc: DocRecord) => Promise<Attachment>;
  now?: () => number;
  newId?: () => string;
  today?: string;
}

async function saveTurn(message: Omit<ChatMessage, "id" | "createdAt">): Promise<void> {
  await (await db()).put("messages", { ...message, id: makeId(), createdAt: nextTime() });
}

/**
 * Reads a trip's file with the traveller's model and puts it where it belongs: linked to its card (booked,
 * filled in), or a new booked record, or kept in Belgeler alone. Writes the chat's two lines ("📎 poliçe.pdf"
 * and the sentence). A picture that isn't a document (a page's screenshot) is left to the caller.
 */
export async function readDocument(tripId: string, docId: string, deps: ReadDeps = {}): Promise<DocOutcome & { sentence: string }> {
  const d = await db();
  const [trip, doc] = await Promise.all([d.get("trips", tripId), d.get("docs", docId)]);
  if (!trip || !doc) throw new Error(L("Belge bulunamadı.", "Document not found."));
  if (doc.size > DOC_READ_MAX_BYTES) {
    throw new Error(L(`${doc.name} okunmak için çok büyük (10 MB üstü); Belgeler'de duruyor.`, `${doc.name} is too large to read (over 10 MB); it's in Documents.`));
  }
  const llm = deps.llm ?? (await getProvider());
  const now = deps.now?.() ?? Date.now();
  const file = await (deps.attachment ?? plainAttachment)(doc);
  const raw = await llm.generateJson(docSystem(), docPrompt(trip, doc.name, deps.today ?? new Date(now).toISOString().slice(0, 10)), DocFactsSchema, [file]);
  const facts = cleanFacts(raw);
  const outcome = placeDoc(facts, await listItems(tripId), tripId, (deps.newId ?? makeId)(), now);
  const sentence = docSentence(outcome, doc.name);
  if (outcome.kind === "not_document") return { ...outcome, sentence };
  if (outcome.kind === "linked" || outcome.kind === "created") await d.put("items", outcome.item);
  const kind = facts.doc_type === "not_a_document" ? undefined : facts.doc_type;
  await linkDoc(doc.id, outcome.kind === "kept" ? doc.itemId : outcome.item.id, kind);
  await saveTurn({ tripId, role: "user", content: llm.userContent([L(`[Belge eklendi: ${doc.name}]`, `[Document added: ${doc.name}]`)]), text: `📎 ${doc.name}`, choices: [], provider: llm.id });
  await saveTurn({ tripId, role: "assistant", content: llm.assistantContent(sentence), text: sentence, choices: [], provider: llm.id });
  notifyChanged();
  return { ...outcome, sentence };
}
