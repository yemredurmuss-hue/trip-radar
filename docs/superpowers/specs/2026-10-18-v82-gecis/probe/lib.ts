// Ortak yardımcılar: başlangıç sohbetini AI'sız (kod okuması + elle verilen "model okuması") kurmak ve
// canlı boru hattını (wouldMake → buildPlan → buildLegs → buildTimeline → categorize) saf olarak çalıştırmak.
import { setLang, withLang } from "/home/user/trip-radar/src/lib/i18n";
import { wouldMake, playbookCards } from "/home/user/trip-radar/src/lib/startCreate";
import {
  acceptExtraction, applyAnswer, applyText, creationOf, mergeExtracted, newStart, nextQuestion, parseStartText, withTypedLang, previewOf, pbAsks,
  type RawExtraction, type StartState,
} from "/home/user/trip-radar/src/lib/startTrip";
import { startPlaybook, tripIntentOf, type RawPlan } from "/home/user/trip-radar/src/lib/playbooks";
import { buildPlan } from "/home/user/trip-radar/src/lib/plan";
import { buildLegs } from "/home/user/trip-radar/src/lib/legs";
import { buildTimeline } from "/home/user/trip-radar/src/lib/timeline";
import { categorize, planSectionOf, type CatSection } from "/home/user/trip-radar/src/lib/categories";
import { isEmptyRecord } from "/home/user/trip-radar/src/lib/emptyCards";
import { isPlaceholder } from "/home/user/trip-radar/src/lib/startTrip";
import { ruleSuggestions } from "/home/user/trip-radar/src/lib/suggestions";
import { journeyOf } from "/home/user/trip-radar/src/lib/tripShape";
import { visaFor } from "/home/user/trip-radar/src/lib/visa";
import { countryInfo } from "/home/user/trip-radar/src/lib/countries";
import type { Item, Trip } from "/home/user/trip-radar/src/lib/types";

export const TODAY = "2026-10-18";
export const raw = (over: Partial<RawExtraction> & { plan?: RawPlan }): RawExtraction & { plan?: RawPlan } => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});
const NONE = { card: "", to: "", n: 0, amount: 0, currency: "", items: [] as string[] };
export const eff = (o: Record<string, unknown>) => ({ ...NONE, ...o });
export const plan = (over: Partial<RawPlan>): RawPlan => ({
  label: "", base: "classic", focus: "around", stay_type: "hotel", stay_port: "", cards: [], questions: [], blocked_sections: [], blocked_words: [], prep: [], tip: "", tone: "", avoid: "", musts: [], ...over,
});

/** Bir satır, sohbetin aldığı gibi: kodun okuması ve (verildiyse) modelin okuması. AI çağrısı yok. */
export function typed(s: StartState, text: string, model: (Partial<RawExtraction> & { plan?: RawPlan }) | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const read = mergeExtracted(parseStartText(text, TODAY, q), model ? acceptExtraction(raw(model), TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}
export const fresh = (mode: StartState["mode"] = "plan", lang: "tr" | "en" = "tr") => newStart(`s-${Math.random()}`, mode, 1, lang);
export { applyAnswer, creationOf, startPlaybook, tripIntentOf, setLang, withLang, pbAsks, previewOf, playbookCards };

export const itemRow = (i: Item) => ({
  name: i.name, cat: i.category, kind: i.plannedKind ?? null, city: i.city, d: [i.dates.start, i.dates.end].filter(Boolean).join("→") || null,
  from: i.flight?.from ?? null, to: i.flight?.to ?? null, stayKind: i.metrics?.stayKind ?? null, noBooking: i.noBooking != null, status: i.status,
  adults: i.guests.adults, note: i.statusNote ?? null,
});

/** Canlı boru hattı: bölümler, her bölümde girdiler (ad · meta · durum · aşama), kural önerileri, gezinin şekli. */
export function pipeline(trip: Trip, items: Item[], today = TODAY) {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (item: Item) => ({ placeholder: isPlaceholder(trip, item), empty: isEmptyRecord(trip, item, 0, items), docs: 0, today });
  const sections = categorize({ plan, timeline, items, legs, hidden, today, stageCtx });
  const secs = sections
    .filter((s) => s.entries.length || s.hidden.length)
    .map((s: CatSection) => ({
      id: s.id,
      status: s.status?.text ?? null,
      entries: s.entries.map((e) => `${planSectionOf(e) !== s.id ? `[→${planSectionOf(e)}] ` : ""}${e.row.name} · ${e.row.meta} · ${e.state}/${e.stage ?? "-"}${e.piece.kind === "group" ? ` · ${e.piece.group.items.length} seçenek` : ""}`),
      prep: s.prep.length,
      hidden: s.hidden.length,
    }));
  let rules: string[] = [];
  try {
    rules = ruleSuggestions({ trip, plan, items, timeline, legs, mains: [], home: "TR", today }).map((r) => `${r.section}: ${r.title}`);
  } catch (e) {
    rules = [`HATA ${(e as Error).message}`];
  }
  const shape = journeyOf(plan, legs, items);
  return {
    range: plan.range,
    nights: plan.nights,
    stayBlocks: plan.stayBlocks.map((b) => `${b.kind} ${b.city} ${b.range.start}→${b.range.end} (${b.nights})`),
    looseStays: plan.looseStays.length,
    legs: legs.map((l) => `${l.kind} ${l.date} ${l.from.city ?? l.from.label}→${l.to.city ?? l.to.label} [${l.status}${l.mode ? " " + l.mode : ""}]`),
    sections: secs,
    rules,
    shape: shape ? shape.stops.map((s) => `${s.city}(${s.sub},${s.stage})`).join(" — ") + " | hops: " + shape.hops.map((h) => h.mode).join(",") : null,
  };
}

/** Başlangıçtan oluşan gezi: tür, niyet, oluşturulan kayıtlar ve canlı plan. */
export function made(s: StartState, today = TODAY) {
  return withLang(s.lang, () => {
    const c = creationOf(s);
    const w = wouldMake(s, 1);
    if (!c || !w) return { error: "creationOf null (nereye bilinmiyor)", where: s.where, intent: s.intent ?? null };
    const codes = [...new Set(Object.values(c.countries).map((x) => x.code))];
    return {
      where: s.where ? `${s.where.place} (${s.where.country ?? "-"}, ${s.where.code ?? "-"})` : null,
      intentEvent: s.intent ? `${s.intent.kind}:${s.intent.name}@${s.intent.place}` : null,
      playbook: startPlaybook(s),
      pbQuestions: pbAsks(s).map((a) => a.key),
      tripIntent: w.trip.intent ? { playbook: w.trip.intent.playbook, label: w.trip.intent.label ?? null, musts: w.trip.intent.musts?.map((m) => m.text) ?? [] } : null,
      title: c.title, dates: c.dates, road: c.road, stayAs: c.stayAs ?? null, budget: c.budget,
      travellers: c.travellers,
      items: w.items.map(itemRow),
      countries: codes.map((code) => ({ code, visa: visaFor("TR", code).label, currency: countryInfo(code)?.currency ?? "(tabloda yok)" })),
      live: pipeline(w.trip, w.items, today),
    };
  });
}
