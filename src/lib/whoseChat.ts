// Kişiye özel rezervasyon in the board's chat (spec 2026-10-06 "Sohbet"): "Sabine Alicante'den geliyor" opens her
// flight there as an empty card, gives the trip's own flight there to the rest ("Emre'nin bileti") and asks the way
// home in bold with chips; "bu bilet Sabine'in" makes a plan hers (set_owner); a document whose names can't be
// placed asks "Bu Ryanair bileti kimin?"; a plan that would be mine while I have no name asks "Sana ne diyeyim?".
// The code's own questions are answered here, without the model (ChatMessage.ask). Every sentence says only what
// was done, and every change has the board's "Geri al".
import { db, listItems, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import { formatDateRange } from "./items";
import { checkPlanned, planToSave, type PlannedInput } from "./planned";
import { sameCity } from "./plan";
import { cityOfAirport } from "./airports";
import { saveShareConfig } from "./share/store";
import { dative, placeholderPrint } from "./startTrip";
import { sameName } from "./tripSettings";
import { firstStop, genitive, isUnnamedMe, lastStop, ownerWords, peopleOf, restOwners, tripOrigin, whoseLabel, whoseOf, type WhoCtx } from "./whose";
import { loadWho, saveOwners, withOwners, writeOwners } from "./whoseStore";
import type { ChatAsk, Item, OwnerChange, Trip } from "./types";

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

/** "Sana ne diyeyim?": asked once, in bold, before anything would read "Ben'in"; what comes after waits for it. */
export function nameAsk(then: TurnAsk | null, ownerItem: string | null = null): TurnAsk {
  return { text: L("Sana ne diyeyim?", "What should I call you?"), choices: [], ask: { kind: "name", ownerItem, then } };
}

/**
 * The trip's own flights whose way someone now has a flight of their own for go to the rest of the people
 * (whose.restOwners), written for the caller's "Geri al". `needName`: the rest is me and I have no name yet.
 */
export async function giveRest(tripId: string, who: WhoCtx): Promise<{ owners: OwnerChange[]; lines: string[]; needName: boolean }> {
  const trip = await (await db()).get("trips", tripId);
  if (!trip) return { owners: [], lines: [], needName: false };
  const { changes, needName } = restOwners(trip, await listItems(tripId), who);
  const owners = await writeOwners(changes.map((c) => ({ id: c.item.id, owners: c.owners })));
  return { owners, lines: restLines(changes.filter((c) => owners.some((o) => o.id === c.item.id))), needName };
}

/** "Uçuş · İstanbul → Denpasar artık "Emre'nin bileti"." */
const restLines = (changes: { item: Item; owners: string[] }[]) =>
  changes.map((c) => L(`${c.item.name} artık "${whoseLabel(c.owners, "ticket")}".`, `${c.item.name} is now "${whoseLabel(c.owners, "ticket")}".`));

/**
 * Someone said to come from somewhere else (set_travellers `from`): without a flight of their own there yet, one is
 * opened for them (their place → where the trip lands, the trip's first day), and the trip's own flight there goes
 * to the rest ("Emre'nin bileti"); then the way home is asked (my name first, if I have none and the rest is me).
 * A place that is where the trip leaves from changes nothing. The caller's line in Geçmiş takes it all back.
 */
export async function arrivals(
  tripId: string,
  said: { name: string; place: string }[],
  who: WhoCtx,
): Promise<{ made: Item[]; owners: OwnerChange[]; ask: TurnAsk | null; lines: string[] }> {
  const made: Item[] = [];
  const lines: string[] = [];
  let ask: TurnAsk | null = null;
  for (const { name, place: from } of said) {
    const trip = await (await db()).get("trips", tripId);
    if (!trip) break;
    const items = await listItems(tripId);
    const origin = tripOrigin(items, trip);
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
        lines.push(
          L(
            `${name} için ${from} → ${first.city} boş uçuş kartı açıldı${first.date ? ` (${formatDateRange(first.date, null)})` : ""}, rozeti "${whoseLabel([name], "ticket")}".`,
            `An empty ${from} → ${first.city} flight card was opened for ${name}${first.date ? ` (${formatDateRange(first.date, null)})` : ""}, marked "${whoseLabel([name], "ticket")}".`,
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
  const rest = made.length ? await giveRest(tripId, who) : { owners: [], lines: [], needName: false };
  if (rest.needName) {
    lines.push(L("Kalan uçuş kullanıcının; adı olmadığı için önce adını soruyorum (kalın).", "The rest of the flight is the user's; they have no name yet, so their name is asked first (in bold)."));
    ask = nameAsk(ask);
  }
  return { made, owners: rest.owners, ask, lines: [...lines, ...rest.lines] };
}

/** A name as said ("Emre", "ben Emre", "Emre de"): letters only, at most three words; null for anything else. */
function nameSaid(text: string): string | null {
  const t = text
    .trim()
    .replace(/^(ben|bana|adım|benim adım|i'm|i am|call me|my name is)\s+/i, "")
    .replace(/\s+(de|diyebilirsin|derler|yeter)$/i, "")
    .replace(/[.!]+$/, "")
    .trim();
  if (!t || t.length > 40 || t.split(/\s+/).length > 3 || !/^\p{L}[\p{L}' -]*$/u.test(t) || /^(ben|me|herkes|everyone)$/i.test(t)) return null;
  return t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1);
}

/** What the code says back to its own question's answer, and the next question when there is one. */
export interface AskAnswer {
  text: string;
  next?: TurnAsk | null;
}

/**
 * An answer to a question the code asked (ChatMessage.ask), handled without the model: a chip, or my name for
 * "Sana ne diyeyim?". Null when what was said isn't one (the model answers then).
 */
export async function answerAsk(tripId: string, ask: ChatAsk, chips: string[], said: string): Promise<AskAnswer | null> {
  if (ask.kind === "name") return answerName(tripId, ask, said);
  const n = chips.findIndex((c) => c.trim().toLocaleLowerCase("tr-TR") === said.trim().toLocaleLowerCase("tr-TR"));
  if (n < 0) return null;
  if (ask.kind === "return") {
    if (n === chips.length - 1) {
      return { text: L(`Tamam; ${genitive(ask.name)} dönüşü belli olunca söyle, kartını o zaman açarım.`, `All right; tell me when ${ask.name}'s way home is known and I'll open its card then.`) };
    }
    if (n > 0 && ask.origin) {
      return { text: L(`Tamam: ${ask.name} dönüşte sizinle ${dative(ask.origin)} uçuyor; dönüş kartı herkesin kalıyor.`, `All right: ${ask.name} flies back with you to ${ask.origin}; the flight home stays everyone's.`) };
    }
    if (!ask.leave) return { text: L(`Dönüşün nereden kalktığı belli değil; ${genitive(ask.name)} dönüş kartını açamadım. Hiçbir şey değişmedi.`, `Where the way home leaves from isn't known; I couldn't open ${ask.name}'s flight home. Nothing changed.`) };
    const there = ownFlight(await listItems(tripId), ask.name, { from: ask.leave, to: ask.place });
    if (there) return { text: L(`${genitive(ask.name)} dönüş uçuşu zaten var (${there.name}); yeni kart açmadım.`, `${ask.name} already has a flight home (${there.name}); I didn't open another.`) };
    const made = await personFlight(tripId, ask.name, ask.leave, ask.place, ask.date);
    if (!made) return { text: L(`${genitive(ask.name)} dönüş kartı açılamadı; hiçbir şey değişmedi.`, `${ask.name}'s flight home couldn't be made; nothing changed.`) };
    // The trip's own flight home goes to the rest; the one "Geri al" takes both back.
    const trip = await (await db()).get("trips", tripId);
    const rest = trip ? restOwners(trip, await listItems(tripId), await loadWho(trip)) : { changes: [], needName: false };
    const day = ask.date ? `, ${formatDateRange(ask.date, null)}` : "";
    const label = L(`${genitive(ask.name)} dönüşü eklendi: ${ask.leave} → ${ask.place}`, `${ask.name}'s way home added: ${ask.leave} → ${ask.place}`);
    await saveOwners(tripId, rest.changes.map((c) => ({ id: c.item.id, owners: c.owners })), { event: label, label }, [made.id]);
    const text = L(
      `${genitive(ask.name)} dönüşünü ekledim: ${ask.leave} → ${ask.place}${day}, boş kart olarak; üstünde "${whoseLabel([ask.name], "ticket")}" yazıyor, aramaları 1 kişilik.`,
      `I added ${ask.name}'s way home: ${ask.leave} → ${ask.place}${day}, as an empty card; it says "${whoseLabel([ask.name], "ticket")}", its searches for one.`,
    );
    return { text: [text, ...restLines(rest.changes)].join(" "), next: rest.needName ? nameAsk(null) : null };
  }
  const item = await (await db()).get("items", ask.itemId);
  if (!item) return { text: L("O kayıt artık yok; hiçbir şey değişmedi.", "That record is gone; nothing changed.") };
  const owners = n < ask.names.length ? [ask.names[n]] : null;
  // "Ben" while I have no name: my name first, then it's mine.
  const trip = await (await db()).get("trips", tripId);
  if (owners && trip && isUnnamedMe(owners[0], await loadWho(trip))) return { text: "", next: nameAsk(null, item.id) };
  const words = ownerWords(item, owners);
  const saved = await saveOwners(tripId, [{ id: item.id, owners }], { event: words, label: words });
  return { text: saved ? L(`Tamam: ${words}.`, `Done: ${words}.`) : L(`Zaten öyleydi (${words}); hiçbir şey değişmedi.`, `It already was (${words}); nothing changed.`) };
}


/**
 * "Sana ne diyeyim?" answered: the name is saved as my profile (sharing) name, as Ayarlar → Profilim saves it; then
 * the plan asked about is mine, the trip's own flights go to whom they're for, and what waited is asked.
 */
async function answerName(tripId: string, ask: Extract<ChatAsk, { kind: "name" }>, said: string): Promise<AskAnswer | null> {
  const name = nameSaid(said);
  if (!name) return null;
  try {
    await saveShareConfig({ name });
  } catch {
    return { text: L("Adını kaydedemedim (depolama yok); Ayarlar → Profilim'den yazabilirsin. Hiçbir şey değişmedi.", "I couldn't save your name (no storage); you can write it in Settings → My profile. Nothing changed.") };
  }
  const trip = await (await db()).get("trips", tripId);
  const who = trip ? { ...(await loadWho(trip)), me: name } : name;
  const mine = ask.ownerItem ? await (await db()).get("items", ask.ownerItem) : undefined;
  const items = (await listItems(tripId)).map((i) => (mine && i.id === mine.id ? withOwners(i, [name]) : i));
  const rest = trip ? restOwners(trip, items, who) : { changes: [], needName: false };
  const changes = [...(mine ? [{ id: mine.id, owners: [name] }] : []), ...rest.changes.map((c) => ({ id: c.item.id, owners: c.owners }))];
  const words = mine ? ownerWords(mine, [name]) : rest.changes.length ? restLines(rest.changes).join(" ") : null;
  if (words && changes.length) await saveOwners(tripId, changes, { event: words, label: words });
  const done = [L(`Tamam, ${name}; adını profiline kaydettim.`, `All right, ${name}; I saved your name to your profile.`), ...(mine ? [`${words}.`] : []), ...restLines(rest.changes)];
  const then = ask.then ?? null;
  return { text: done.join(" "), next: then };
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
/** "Me" said as an owner ("ben", "benim"). */
export const SAYS_ME = /^(ben|me|i|myself|benim)$/i;

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
      if (SAYS_ME.test(n.trim())) {
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
