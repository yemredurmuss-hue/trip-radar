// Kişiye özel rezervasyon in the board's chat (spec 2026-10-06 "Sohbet"): "Sabine Alicante'den geliyor" opens her
// flight there as an empty card and asks the way home in bold with chips; "bu bilet Sabine'in" makes a plan hers
// (set_owner); a document whose names can't be placed asks "Bu Ryanair bileti kimin?". The chips of the code's own
// questions are answered here, without the model (ChatMessage.ask). Every sentence says only what was done.
import { db, listItems, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import { formatDateRange } from "./items";
import { checkPlanned, planToSave, type PlannedInput } from "./planned";
import { sameCity } from "./plan";
import { cityOfAirport } from "./airports";
import { dative, placeholderPrint } from "./startTrip";
import { sameName } from "./tripSettings";
import { firstStop, genitive, headCountOf, lastStop, ownerWords, peopleOf, tripOrigin, whoseLabel, whoseOf, type WhoCtx } from "./whose";
import { saveOwners, withOwners } from "./whoseStore";
import type { ChatAsk, Item, Trip } from "./types";

/** A question the code puts under the reply, its chips and what they mean. */
export interface TurnAsk {
  text: string;
  choices: string[];
  ask: ChatAsk;
}

const place = (s: string | null | undefined) => (s?.trim() ? cityOfAirport(s.trim()) : null);
const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(place(a) && place(b) && sameCity(place(a), place(b)));
const live = (i: Item) => i.status !== "dismissed";
const ownedBy = (i: Item, name: string) => (i.forWho ?? []).some((n) => sameName(n, name));

/** This person's own flight the given way (to where the trip lands, or from where they come), if there is one. */
function ownFlight(items: Item[], name: string, way: { to?: string | null; from?: string | null }): Item | null {
  return (
    items.find(
      (i) => live(i) && i.category === "flight" && ownedBy(i, name) && ((way.to && same(i.flight?.to ?? i.city, way.to)) || (way.from && same(i.flight?.from, way.from))),
    ) ?? null
  );
}

/**
 * A flight of this person's own, made as the start makes the trip's (a place to fill: an empty card with the
 * searches), or the same one said again. Null when it can't be made (a bad day): nothing is written.
 */
export async function personFlight(tripId: string, name: string, from: string, to: string, date: string | null): Promise<Item | null> {
  const d = await db();
  const input: PlannedInput = { kind: "flight", date, end_date: null, time: null, from, to, city: null, title: null, booked: false, note: null };
  if (checkPlanned(input)) return null;
  // Only their own plans can be "the same one" (never the trip's İstanbul → Porto).
  const mine = (await listItems(tripId)).filter((i) => ownedBy(i, name));
  const { item } = planToSave(input, mine, tripId, newId(), Date.now());
  const saved = withOwners(item, [name], item.updatedAt);
  await d.put("items", saved);
  // A trip the start made keeps its flights as places to fill (startTrip.isPlaceholder): this one is one too.
  const tx = d.transaction("trips", "readwrite");
  const trip = await tx.store.get(tripId);
  if (trip?.startGuide) await tx.store.put({ ...trip, startGuide: { ...trip.startGuide, placeholders: { ...(trip.startGuide.placeholders ?? {}), [saved.id]: placeholderPrint(saved) } } });
  await tx.done;
  notifyChanged();
  return saved;
}

/** "Sabine dönüşte de Alicante'ye mi?" with Evet, Alicante · Hayır, İstanbul'a · Henüz belli değil. */
export function returnAsk(name: string, from: string, origin: string | null, leave: string | null, date: string | null): TurnAsk {
  return {
    text: L(`${name} dönüşte de ${dative(from)} mi?`, `Is ${name} flying back to ${from} too?`),
    choices: [L(`Evet, ${from}`, `Yes, ${from}`), ...(origin ? [L(`Hayır, ${dative(origin)}`, `No, to ${origin}`)] : []), L("Henüz belli değil", "Not sure yet")],
    ask: { kind: "return", name, place: from, leave, date, origin },
  };
}

/**
 * Someone said to come from somewhere else (set_travellers `from`): without a flight of their own there yet, one is
 * opened for them (their place → where the trip lands, the trip's first day), so the trip's own flight there counts
 * one fewer; then the way home is asked. A place that is where the trip leaves from changes nothing.
 */
export async function arrivals(tripId: string, said: { name: string; place: string }[], who: WhoCtx): Promise<{ made: Item[]; ask: TurnAsk | null; lines: string[] }> {
  const made: Item[] = [];
  const lines: string[] = [];
  let ask: TurnAsk | null = null;
  for (const { name, place: from } of said) {
    const trip = await (await db()).get("trips", tripId);
    if (!trip) break;
    const items = await listItems(tripId);
    const origin = tripOrigin(items);
    if (origin && same(from, origin)) {
      lines.push(L(`${name} gezinin kalktığı yerden (${origin}) geliyor; ayrı uçuş açılmadı.`, `${name} leaves from where the trip does (${origin}); no flight of their own was opened.`));
      continue;
    }
    const first = firstStop(trip, items);
    const there = ownFlight(items, name, { to: first.city, from });
    if (there) {
      lines.push(L(`${genitive(name)} kendi uçuşu zaten var (${there.name}); yeni kart açılmadı.`, `${name} already has a flight of their own (${there.name}); no new card.`));
    } else if (!first.city) {
      lines.push(L(`Gezinin nereye vardığı belli değil; ${name} için uçuş kartı açılmadı.`, `Where the trip lands isn't known; no flight card was opened for ${name}.`));
    } else {
      const flight = await personFlight(tripId, name, from, first.city, first.date);
      if (flight) {
        made.push(flight);
        const after = await listItems(tripId);
        const main = after.find((i) => live(i) && i.category === "flight" && !(i.forWho ?? []).length && same(i.flight?.to ?? i.city, first.city));
        const people = peopleOf(trip, who).length;
        const left = main ? headCountOf(main, trip, { total: Math.max(people, trip.travellers?.count ?? 0) || null, items: after, who }) : null;
        lines.push(
          L(
            `${name} için ${from} → ${first.city} boş uçuş kartı açıldı${first.date ? ` (${formatDateRange(first.date, null)})` : ""}, rozeti "${whoseLabel([name], "ticket")}"${main && left ? `; ${main.name} artık ${left} kişi` : ""}.`,
            `An empty ${from} → ${first.city} flight card was opened for ${name}${first.date ? ` (${formatDateRange(first.date, null)})` : ""}, marked "${whoseLabel([name], "ticket")}"${main && left ? `; ${main.name} is now for ${left}` : ""}.`,
          ),
        );
      } else {
        lines.push(L(`${name} için uçuş kartı açılamadı; hiçbir kart eklenmedi.`, `The flight card for ${name} couldn't be made; nothing was added.`));
      }
    }
    // The way home, unless they have one of their own already.
    const last = lastStop(trip, await listItems(tripId));
    if (!ownFlight(await listItems(tripId), name, { from: last.city, to: from })) ask = returnAsk(name, from, origin, last.city, last.date);
  }
  return { made, ask, lines };
}

/**
 * The chip of a question the code asked (ChatMessage.ask), answered without the model; null when what was said
 * isn't one of its chips (the model answers then).
 */
export async function answerAsk(tripId: string, ask: ChatAsk, chips: string[], said: string): Promise<string | null> {
  const n = chips.findIndex((c) => c.trim().toLocaleLowerCase("tr-TR") === said.trim().toLocaleLowerCase("tr-TR"));
  if (n < 0) return null;
  if (ask.kind === "return") {
    if (n === chips.length - 1) {
      return L(`Tamam; ${genitive(ask.name)} dönüşü belli olunca söyle, kartını o zaman açarım.`, `All right; tell me when ${ask.name}'s way home is known and I'll open its card then.`);
    }
    if (n > 0 && ask.origin) {
      return L(`Tamam: ${ask.name} dönüşte sizinle ${dative(ask.origin)} uçuyor; dönüş kartı herkesin kalıyor.`, `All right: ${ask.name} flies back with you to ${ask.origin}; the flight home stays everyone's.`);
    }
    if (!ask.leave) return L(`Dönüşün nereden kalktığı belli değil; ${genitive(ask.name)} dönüş kartını açamadım. Hiçbir şey değişmedi.`, `Where the way home leaves from isn't known; I couldn't open ${ask.name}'s flight home. Nothing changed.`);
    const items = await listItems(tripId);
    const there = ownFlight(items, ask.name, { from: ask.leave, to: ask.place });
    if (there) return L(`${genitive(ask.name)} dönüş uçuşu zaten var (${there.name}); yeni kart açmadım.`, `${ask.name} already has a flight home (${there.name}); I didn't open another.`);
    const made = await personFlight(tripId, ask.name, ask.leave, ask.place, ask.date);
    if (!made) return L(`${genitive(ask.name)} dönüş kartı açılamadı; hiçbir şey değişmedi.`, `${ask.name}'s flight home couldn't be made; nothing changed.`);
    const day = ask.date ? `, ${formatDateRange(ask.date, null)}` : "";
    return L(
      `${genitive(ask.name)} dönüşünü ekledim: ${ask.leave} → ${ask.place}${day}, boş kart olarak; üstünde "${whoseLabel([ask.name], "ticket")}" yazıyor, aramaları 1 kişilik.`,
      `I added ${ask.name}'s way home: ${ask.leave} → ${ask.place}${day}, as an empty card; it says "${whoseLabel([ask.name], "ticket")}", its searches for one.`,
    );
  }
  const item = await (await db()).get("items", ask.itemId);
  if (!item) return L("O kayıt artık yok; hiçbir şey değişmedi.", "That record is gone; nothing changed.");
  const owners = n < ask.names.length ? [ask.names[n]] : null;
  const words = ownerWords(item, owners);
  const saved = await saveOwners(tripId, [{ id: item.id, owners }], { event: words, label: words });
  return saved ? L(`Tamam: ${words}.`, `Done: ${words}.`) : L(`Zaten öyleydi (${words}); hiçbir şey değişmedi.`, `It already was (${words}); nothing changed.`);
}

/** "Bu Ryanair bileti kimin?" with a chip for each of the trip's people and Herkes. */
export function ownerAsk(item: Item, people: string[]): TurnAsk {
  const what = item.provider?.trim() || item.flight?.carrier?.trim() || item.name;
  const noun = item.category === "stay" ? L("rezervasyonu", "booking") : L("bileti", "ticket");
  return {
    text: L(`Bu ${what} ${noun} kimin?`, `Whose is this ${what} ${noun}?`),
    choices: [...people, L("Herkes", "Everyone")],
    ask: { kind: "owner", itemId: item.id, names: people },
  };
}

const EVERYONE = /^(everyone|everybody|all|herkes|herkesin|hepimiz|hepsi)$/i;
const ME = /^(ben|me|i|myself|benim)$/i;

/**
 * The chat's set_owner: whose these plans are, by the trip's names, or everyone's. Refused (nothing written) for a
 * name not on the trip, a trip of one, or "me" when I have no name yet (the chat asks "Sana ne diyeyim?" first).
 */
export async function setOwnerTool(tripId: string, input: { item_ids?: unknown; names?: unknown }, items: Item[], trip: Trip, who: WhoCtx): Promise<Record<string, unknown>> {
  const ids = (Array.isArray(input.item_ids) ? input.item_ids : []).filter((id): id is string => typeof id === "string" && id.trim() !== "");
  if (!ids.length) throw new Error(L("item_ids boş; hiçbir şey değişmedi.", "item_ids is empty; nothing changed."));
  const missing = ids.filter((id) => !items.some((i) => i.id === id));
  if (missing.length) throw new Error(L(`Bu id'lerle kayıt yok: ${missing.join(", ")}. Hiçbir şey değişmedi.`, `No records with these ids: ${missing.join(", ")}. Nothing changed.`));
  const raw = typeof input.names === "string" ? [input.names] : Array.isArray(input.names) ? input.names.filter((n): n is string => typeof n === "string" && n.trim() !== "") : [];
  const people = peopleOf(trip, who);
  const me = who && typeof who === "object" ? (who.me ?? null) : (who ?? null);
  let owners: string[] | null = null;
  if (raw.length && !raw.every((n) => EVERYONE.test(n.trim()))) {
    if (people.length < 2) {
      throw new Error(L("Gezide adıyla yazılmış tek kişi var; bir plana sahip yazmanın anlamı yok. Önce kimlerin gittiğini set_travellers ile yaz. Hiçbir şey değişmedi.", "Only one person is named on the trip; marking whose a plan is means nothing yet. Say who goes with set_travellers first. Nothing changed."));
    }
    const found: string[] = [];
    const unknown: string[] = [];
    for (const n of raw) {
      if (ME.test(n.trim())) {
        if (!me) throw new Error(L("Kullanıcının adı yok: önce 'Sana ne diyeyim?' diye sor; adını söyleyince set_owner'ı o adla çağır. Hiçbir şey değişmedi.", "The user has no name yet: first ask 'What should I call you?'; once they say it, call set_owner with that name. Nothing changed."));
        found.push(people.find((p) => sameName(p, me)) ?? me);
        continue;
      }
      const p = people.find((x) => sameName(x, n.trim()));
      if (p) found.push(p);
      else unknown.push(n.trim());
    }
    if (unknown.length) throw new Error(L(`Bu adlar gezide yok: ${unknown.join(", ")}. Gezidekiler: ${people.join(", ")}. Hiçbir şey değişmedi.`, `These names aren't on the trip: ${unknown.join(", ")}. On the trip: ${people.join(", ")}. Nothing changed.`));
    const unique = people.filter((p) => found.includes(p));
    owners = unique.length && unique.length < people.length ? unique : null;
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  const first = byId.get(ids[0])!;
  const words = ids.length === 1 ? ownerWords(first, owners) : `${ids.map((id) => byId.get(id)!.name).join(", ")}: ${owners ? whoseLabel(owners, null) : L("herkesin", "everyone's")}`;
  const saved = await saveOwners(tripId, ids.map((id) => ({ id, owners })), { event: words, label: words });
  if (!saved) return { unchanged: true, owners: owners ?? "everyone", note: L(`Zaten öyleydi (${words}); hiçbir şey değişmedi.`, `It already was (${words}); nothing changed.`) };
  const badge = owners ? whoseOf(withOwners(first, owners), trip, who)?.label ?? null : null;
  return {
    set: ids.map((id) => byId.get(id)!.name),
    owners: owners ?? "everyone",
    shown: owners
      ? L(`Kartında "${badge}" rozeti var. Panodaki 'Geri al' eski haline döndürür.`, `Its card shows "${badge}". The board's 'Undo' puts it back.`)
      : L("Herkesin: kartta rozet yok. Panodaki 'Geri al' eski haline döndürür.", "Everyone's: no badge on the card. The board's 'Undo' puts it back."),
  };
}
