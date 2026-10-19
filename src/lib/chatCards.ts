// Sohbet uyumu (C34, v83 "sohbet uyumu"; z83_build.py chat_html) and a link dropped in the chat (C35): what the chat
// draws from its own messages and the Plan, nothing new asked of the assistant. A reply that put a record on the board or
// suggested one (made or changed in that turn, the one it names first) carries it as a card, the Plan's compact card:
// the site, the score, the name, one line, the price and its unit. "Planda göster" goes to its box (the Pano when the box
// doesn't show it, its category when there's no box); "Bunu seç" takes that very record. Under the conversation at most
// three quick replies fit to what's on the table ("Hangisi daha iyi?", "Bütçeme uyar mı?", "Osaka için de bak"). A link
// that couldn't be read is a card of its own (Okunamadı · Tekrar dene · Kaldır). Pure.
import { eventItemName, hostOf, predictSection, sectionTo, siteOf } from "./arrive";
import { brandOf, type Brand } from "./brands";
import { planSectionOfItem, type SectionId } from "./categories";
import { nameTargets, splitNames } from "./chatNames";
import { L } from "./i18n";
import { formatDateRange, formatPrice, isoDate } from "./items";
import type { Collection, IntentVM, OptionVM } from "./intents";
import { compactPrice } from "./journeyChapters";
import { clockOf } from "./legs";
import { ratingText } from "./offerSource";
import { lookWord } from "./stageWords";
import type { Capture, ChatMessage, Item, Trip } from "./types";

/**
 * Where "Planda göster" goes: the box the record is in; the Pano when its box doesn't show it (an option past the first
 * three, an İlham link); its category when no box holds it.
 */
export type PlanTarget =
  | { kind: "intent"; intentKey: string; section: SectionId; domKeys: string[]; itemId: string }
  | { kind: "section"; section: SectionId; itemId: string }
  | { kind: "pano"; section: SectionId; intentKey: string | null; itemId: string };

export interface ChatCardVM {
  messageId: string;
  itemId: string;
  brand: Brand | null;
  /** "9,0", "★ 4,8". */
  rating: string | null;
  title: string;
  /** "Ginza · metroya 2 dk", "09:00 → 11:15", "2 Ağustos". */
  sub: string | null;
  /** "€213" and "/ gece". */
  price: { amount: string; unit: string | null } | null;
  image: string | null;
  /** An option still, our pick, on the plan, bought. */
  state: "option" | "suggested" | "chosen" | "booked";
  /** On the plan already: the chip in the button's place ("Seçildi", "Planda", "Alındı"). */
  done: string | null;
  /** "Bunu seç" (one choice) / "Plana koy" (a row of cards): it takes this record. */
  pick: { itemId: string; label: string } | null;
  target: PlanTarget;
}

const findIntent = (collections: readonly Collection[], id: string): IntentVM | null => {
  for (const c of collections) for (const i of c.intents) if (i.itemIds.includes(id)) return i;
  return null;
};

/** The record as its box draws it (the chosen, one of the first options, a card on the row), if the box shows it. */
function shownIn(intent: IntentVM, id: string): OptionVM | null {
  return [intent.chosen, ...intent.options, ...intent.planned].find((o) => o?.id === id) ?? null;
}

/** "Planda göster": its box when the box shows it; the Pano when it's one of the options past the first; else its category. */
export function planTarget(item: Item, collections: readonly Collection[]): PlanTarget {
  const intent = findIntent(collections, item.id);
  if (intent) {
    return shownIn(intent, item.id)
      ? { kind: "intent", intentKey: intent.key, section: intent.section, domKeys: intent.domKeys, itemId: item.id }
      : { kind: "pano", section: intent.section, intentKey: intent.key, itemId: item.id };
  }
  const section = planSectionOfItem(item);
  // İlham lives on the Pano (v82), and so does what's of a category the Plan doesn't draw; else its category's row opens.
  if (section === "inspo" || !collections.some((c) => c.section.id === section)) return { kind: "pano", section, intentKey: null, itemId: item.id };
  return { kind: "section", section, itemId: item.id };
}

/** The card's one line: where a stay is, a ticket's hours, a thing's day. */
function subOf(item: Item, o: OptionVM | null): string | null {
  if (item.category === "stay") return o?.where ?? (item.location.area ?? (item.summary.trim() || null));
  const [dep, arr] = [clockOf(item.flight?.departure), clockOf(item.flight?.arrival)];
  const day = isoDate(item.dates.start) ?? isoDate(item.flight?.departure?.slice(0, 10));
  const hours = dep && arr ? `${dep} → ${arr}` : dep;
  return [day ? formatDateRange(day, null) : null, hours].filter(Boolean).join(" · ") || null;
}

/** A price for a record its box doesn't draw: the amount the page gave, with its scope. */
function plainPrice(item: Item): { amount: string; unit: string | null } | null {
  const { amount, currency, scope } = item.price;
  if (amount == null || amount <= 0) return null;
  const unit = scope === "per_night" ? L("/ gece", "/ night") : scope === "per_person" ? L("kişi başı", "each") : null;
  return { amount: formatPrice(amount, currency), unit };
}

/** The card for a record, from its box when the box draws it. */
export function chatCard(messageId: string, item: Item, collections: readonly Collection[]): ChatCardVM {
  const intent = findIntent(collections, item.id);
  const o = intent ? shownIn(intent, item.id) : null;
  const many = intent?.frame === "collection";
  const state: ChatCardVM["state"] =
    item.status === "booked" ? "booked" : item.status === "chosen" ? "chosen" : intent?.status === "suggested" && intent.chosen?.id === item.id ? "suggested" : "option";
  const done =
    state === "booked"
      ? item.category === "stay"
        ? lookWord("booked")
        : lookWord("booked", { as: "bought" })
      : state === "chosen"
        ? many
          ? L("Planda", "On the plan")
          : lookWord("chosen")
        : null;
  return {
    messageId,
    itemId: item.id,
    brand: o?.brand ?? brandOf(item.provider ?? siteOf(item.url), hostOf(item.url)),
    rating: item.rating.value != null ? ratingText(item.rating.value) : null,
    title: item.name,
    sub: subOf(item, o),
    price: o ? compactPrice(o) : plainPrice(item),
    image: o?.image ?? item.imageUrl,
    state,
    done,
    pick: done ? null : { itemId: item.id, label: many ? L("Plana koy", "Add to plan") : L("Bunu seç", "Take it") },
    target: planTarget(item, collections),
  };
}

export interface ChatCardInput {
  trip: Pick<Trip, "id">;
  /** The trip's chat, oldest first (db listMessages). */
  messages: readonly ChatMessage[];
  items: readonly Item[];
  collections: readonly Collection[];
  /**
   * The cards drawn before, by message (its record's id): a card stays on its reply once the record moves on. "Bunu seç"
   * on a record the turn only changed moves its change past the turn; its card says "Seçildi", it doesn't go.
   */
  kept?: ReadonlyMap<string, string>;
}

const said = (m: ChatMessage) => m.text.trim() !== "";
const live = (i: Item, tripId: string) => i.tripId === tripId && i.status !== "dismissed";

/**
 * The cards the chat draws, by message: on the last reply of each turn, the record that turn put on the board or
 * changed (made then, or its state changed then), the one the reply names first when it names one; on a line about
 * a saved link ("✓ Hyatt Centric Ginza kaydedildi → Konaklama"), that record. A turn that touched nothing has none.
 */
export function chatCards({ trip, messages, items, collections, kept }: ChatCardInput): Map<string, ChatCardVM> {
  const out = new Map<string, ChatCardVM>();
  const mine = items.filter((i) => live(i, trip.id));
  // A turn: from what the traveller said to the next thing they say; its card is on its last reply.
  const turn: { start: number; reply: ChatMessage | null } = { start: -Infinity, reply: null };
  const close = () => {
    const reply = turn.reply;
    if (!reply) return;
    const end = reply.createdAt;
    const touched = mine.filter((i) => (i.createdAt > turn.start && i.createdAt <= end) || (i.statusAt != null && i.statusAt > turn.start && i.statusAt <= end));
    const pick = pickOf(reply, touched, collections);
    if (pick) out.set(reply.id, chatCard(reply.id, pick, collections));
    turn.reply = null;
  };
  for (const m of messages) {
    if (m.role === "user" && said(m)) {
      close();
      turn.start = m.createdAt;
    } else if (m.role === "assistant" && said(m) && !m.landed) {
      turn.reply = m;
    } else if (m.role === "event" && said(m) && !m.routing) {
      const name = eventItemName(m.text);
      const item = name ? mine.filter((i) => i.name === name).sort((a, b) => b.updatedAt - a.updatedAt)[0] : undefined;
      if (item) out.set(m.id, chatCard(m.id, item, collections));
    }
  }
  close();
  for (const [messageId, itemId] of kept ?? []) {
    if (out.has(messageId) || !messages.some((m) => m.id === messageId)) continue;
    const item = mine.find((i) => i.id === itemId);
    if (item) out.set(messageId, chatCard(messageId, item, collections));
  }
  return out;
}

/** The turn's record: the one the reply names first, else what it put on the plan, else our pick among them, else the first. */
function pickOf(reply: ChatMessage, touched: Item[], collections: readonly Collection[]): Item | null {
  if (!touched.length) return null;
  const named = splitNames(reply.text, nameTargets(touched, touched[0].tripId)).find((p): p is { text: string; id: string } => typeof p !== "string");
  if (named) return touched.find((i) => i.id === named.id) ?? null;
  const settled = touched.filter((i) => i.status === "chosen" || i.status === "booked").sort((a, b) => (b.statusAt ?? b.updatedAt) - (a.statusAt ?? a.updatedAt))[0];
  if (settled) return settled;
  const ours = touched.find((i) => {
    const intent = findIntent(collections, i.id);
    return intent?.status === "suggested" && intent.chosen?.id === i.id;
  });
  return ours ?? [...touched].sort((a, b) => a.createdAt - b.createdAt)[0];
}

// --- quick replies -------------------------------------------------------------------------------------------------

/** At most this many chips under the conversation. */
export const QUICK_MAX = 3;

/**
 * The quick replies under the conversation (C34), fit to what's on the table: the last card's box (else the first box
 * waiting for a decision). "Hangisi daha iyi?" when it has options to weigh; "Bütçeme uyar mı?" with a budget and a
 * price; "<şehir> için de bak" for the next city whose same need is still open. None while the last reply asks its own
 * question with its own chips (those answer it).
 */
export function quickReplies({ trip, messages, cards, collections }: { trip: Pick<Trip, "budget">; messages: readonly ChatMessage[]; cards: ReadonlyMap<string, ChatCardVM>; collections: readonly Collection[] }): string[] {
  const last = [...messages].reverse().find((m) => m.role === "assistant" && said(m) && !m.landed);
  if (last?.choices.length) return [];
  const card = [...messages].reverse().map((m) => cards.get(m.id)).find((c): c is ChatCardVM => c != null) ?? null;
  const all = collections.flatMap((c) => c.intents);
  const intent = (card ? findIntent(collections, card.itemId) : null) ?? all.find((i) => i.status === "deciding" || i.status === "suggested") ?? null;
  if (!intent) return [];
  const out: string[] = [];
  if (intent.optionCount >= 2) out.push(L("Hangisi daha iyi?", "Which one is better?"));
  const priced = card?.price != null || [intent.chosen, ...intent.options].some((o) => o?.price || o?.ticket);
  if (trip.budget && priced) out.push(L("Bütçeme uyar mı?", "Does it fit my budget?"));
  const city = intent.head.city;
  if (city) {
    const same = all.filter((i) => i.section === intent.section && i.head.city && i.key !== intent.key);
    const at = all.indexOf(intent);
    // The next city on the way first, then any before it.
    const open = (i: IntentVM) => i.status === "searching" || i.status === "deciding";
    const next = same.filter((i) => all.indexOf(i) > at).find(open) ?? same.find(open);
    if (next?.head.city && next.head.city !== city) out.push(L(`${next.head.city} için de bak`, `Look for ${next.head.city} too`));
  }
  return out.slice(0, QUICK_MAX);
}

// --- a link dropped in the chat (C35) ----------------------------------------------------------------------------------

export interface LinkCardVM {
  captureId: string;
  state: "reading" | "failed" | "added";
  /** "Klook". */
  site: string | null;
  /** "klook.com/activity/91…": the address, short. */
  label: string;
  /** "Klook okunuyor…", "Sayfa yanıt vermedi", "✓ Etkinlik ve turlar'a eklendi". */
  line: string;
  /** The tag on its corner: "Okunamadı" while it failed. */
  tag: string | null;
  /** Failed: "Tekrar dene" and "Kaldır". */
  actions: ("retry" | "remove")[];
  /** The category it will most likely land in (its box shows the card there); null when the address doesn't say. */
  section: SectionId | null;
  /** Read and put on the board: the record (its own card takes over). */
  itemId: string | null;
}

/** "klook.com/activity/91…": host and path, cut at `max` characters. */
export function shortUrl(url: string | null | undefined, max = 21): string {
  if (!url) return "";
  let text = url;
  try {
    const u = new URL(url);
    text = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    text = url.replace(/^https?:\/\//, "");
  }
  return text.length > max ? `${text.slice(0, max).replace(/[/.\-_]+$/, "")}…` : text;
}

/** The first sentence of what went wrong, short; nothing invented when nothing was said. */
const firstSentence = (text: string | null): string | null => {
  const s = text?.trim().split(/(?<=[.!?])\s/)[0]?.replace(/[.!]$/, "") ?? "";
  return s ? (s.length > 60 ? `${s.slice(0, 59)}…` : s) : null;
};

/** A link handed in the chat as its card: being read, couldn't be read (Tekrar dene · Kaldır), or on the board. */
export function linkCard(capture: Pick<Capture, "id" | "status" | "error" | "url" | "title" | "itemId">, landed?: { section: SectionId } | null): LinkCardVM {
  const site = siteOf(capture.url);
  const section = landed?.section ?? predictSection({ url: capture.url, title: capture.title });
  const base = { captureId: capture.id, site, label: shortUrl(capture.url) || (capture.title ?? ""), section, itemId: capture.itemId };
  if (capture.status === "error") {
    return { ...base, state: "failed", line: firstSentence(capture.error) ?? L("Okunamadı", "Couldn't read it"), tag: L("Okunamadı", "Couldn't read it"), actions: ["retry", "remove"] };
  }
  if (capture.status === "done") {
    return { ...base, state: "added", line: landed ? L(`✓ ${sectionTo(landed.section)} eklendi`, `✓ Added ${sectionTo(landed.section)}`) : L("✓ Eklendi", "✓ Added"), tag: null, actions: [] };
  }
  return { ...base, state: "reading", line: site ? L(`${site} okunuyor…`, `Reading ${site}…`) : L("Okunuyor…", "Reading…"), tag: null, actions: [] };
}
