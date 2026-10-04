import { useEffect, useRef, useState } from "react";
import { db, notifyChanged } from "../lib/db";
import { updateTrip } from "./actions";
import { L } from "../lib/i18n";
import { lowerText } from "../lib/i18nText";
import { CRITERION_LABELS, LEVEL_LABELS, requirementLabel, saidTopics, WISH_TOPIC, WISHES } from "../lib/decision";
import { activeSignals, pendingSignals } from "../lib/intent";
import { CATEGORY_LABELS } from "../lib/items";
import { amenityLabel, type Category, type CriterionId, type Trip } from "../lib/types";
import { HeroIcon } from "./Icons";
import type { Decisions } from "./useDecisions";

export interface Entry {
  key: string;
  /** What it applies to: "Tüm gezi", a category, or a place's name. */
  scope: string;
  /** Short form for the collapsed line. */
  short: string;
  text: string;
  detail: string;
  /** Either a change to the stored trip, or a standalone action. */
  change?: (trip: Trip) => Trip;
  action?: () => Promise<void>;
}

type Signal = ReturnType<typeof pendingSignals>[number];

/** "Seni böyle anladım": what the traveller said and what was read from their saves and choices, and the one guess to ask about. */
export function intentEntries(trip: Trip, decisions: Decisions | null): { entries: Entry[]; guess: Signal | undefined } {
  const entries: Entry[] = [];

  for (const [c, level] of Object.entries(trip.priorities ?? {}) as [CriterionId, number][]) {
    entries.push({
      key: `p:${c}`,
      scope: L("Tüm gezi", "Whole trip"),
      short: `${CRITERION_LABELS[c]}: ${lowerText(LEVEL_LABELS[level])}`,
      text: `${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level]}`,
      detail: L("söylediğin", "you said"),
      change: (t) => {
        const priorities = { ...t.priorities };
        delete priorities[c];
        return { ...t, priorities };
      },
    });
  }
  for (const [cat, levels] of Object.entries(trip.categoryPriorities ?? {}) as [Category, Partial<Record<CriterionId, number>>][]) {
    for (const [c, level] of Object.entries(levels ?? {}) as [CriterionId, number][]) {
      entries.push({
        key: `cp:${cat}:${c}`,
        scope: CATEGORY_LABELS[cat],
        short: `${CRITERION_LABELS[c]}: ${lowerText(LEVEL_LABELS[level])}`,
        text: `${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level]}`,
        detail: L("söylediğin", "you said"),
        change: (t) => {
          const categoryPriorities = { ...t.categoryPriorities, [cat]: { ...t.categoryPriorities?.[cat] } };
          delete categoryPriorities[cat]![c];
          return { ...t, categoryPriorities };
        },
      });
    }
  }
  for (const r of trip.requirements ?? []) {
    const label = requirementLabel(r);
    entries.push({
      key: `r:${label}`,
      scope: CATEGORY_LABELS.stay,
      short: L(`${label} şart`, `${label} required`),
      text: L(`Şart: ${label}`, `Required: ${label}`),
      detail: L("uymayan seçenek önerilmez", "options that don't fit aren't suggested"),
      change: (t) => ({ ...t, requirements: (t.requirements ?? []).filter((x) => requirementLabel(x) !== label) }),
    });
  }
  for (const a of trip.wantedAmenities ?? []) {
    entries.push({
      key: `a:${a}`,
      scope: CATEGORY_LABELS.stay,
      short: L(`${a} istiyorsun`, `you want ${amenityLabel(a)}`),
      text: L(`İstenen: ${a}`, `Wanted: ${amenityLabel(a)}`),
      detail: L("olanağı olan öne geçer", "places that have it rank higher"),
      change: (t) => ({ ...t, wantedAmenities: (t.wantedAmenities ?? []).filter((x) => x !== a) }),
    });
  }
  // "Sorun değil" on a finding: shown with the place, removable (the note written for the assistant goes too).
  for (const key of trip.acceptedFindings ?? []) {
    const [listingKey, kind] = key.split("#");
    const listing = decisions?.ctx.listings.get(listingKey);
    const finding = listing?.findings.find((f) => `${f.topic}:${f.polarity}` === kind);
    if (!listing || !finding) continue;
    // The note may be in either language (it is written in the board's language).
    const notes = [`"${finding.text}" benim için sorun değil`, `"${finding.text}" is fine with me`];
    entries.push({
      key: `ok:${key}`,
      scope: listing.name,
      short: L(`${lowerText(finding.text)} sorun değil`, `${lowerText(finding.text)} is fine`),
      text: L(`Sorun değil: ${finding.text}`, `Fine by you: ${finding.text}`),
      detail: L("söylediğin", "you said"),
      action: async () => {
        await updateTrip(trip.id, (t) => ({ ...t, acceptedFindings: (t.acceptedFindings ?? []).filter((k) => k !== key) }));
        const d = await db();
        for (const p of await d.getAll("preferences")) if (p.tripId === trip.id && notes.includes(p.text)) await d.delete("preferences", p.id);
        notifyChanged();
      },
    });
  }
  // "Önemli, kalsın": the place is out for it; removable the same way.
  for (const key of trip.confirmedFindings ?? []) {
    const [listingKey, kind] = key.split("#");
    const listing = decisions?.ctx.listings.get(listingKey);
    const finding = listing?.findings.find((f) => `${f.topic}:${f.polarity}` === kind);
    if (!listing || !finding) continue;
    const notes = [`"${finding.text}" benim için önemli`, `"${finding.text}" matters to me`];
    entries.push({
      key: `must:${key}`,
      scope: listing.name,
      short: L(`${lowerText(finding.text)} önemli`, `${lowerText(finding.text)} matters`),
      text: L(`Önemli: ${finding.text}`, `Matters: ${finding.text}`),
      detail: L("söylediğin · elendi", "you said · ruled out"),
      action: async () => {
        await updateTrip(trip.id, (t) => ({ ...t, confirmedFindings: (t.confirmedFindings ?? []).filter((k) => k !== key) }));
        const d = await db();
        for (const p of await d.getAll("preferences")) if (p.tripId === trip.id && notes.includes(p.text)) await d.delete("preferences", p.id);
        notifyChanged();
      },
    });
  }
  for (const p of decisions?.preferences ?? []) {
    if (/^".+" (benim için sorun değil|is fine with me)$/.test(p.text) && entries.some((e) => e.key.startsWith("ok:"))) continue;
    if (/^".+" (benim için önemli|matters to me)$/.test(p.text) && entries.some((e) => e.key.startsWith("must:"))) continue;
    // What the note asks for becomes its own criterion ("Sessizlik: önemli"), unless they set it otherwise.
    const topics = saidTopics([p.text]);
    const wishes = WISHES.filter((w) => topics.has(WISH_TOPIC[w]) && trip.priorities?.[w] === undefined).map((w) => CRITERION_LABELS[w]);
    entries.push({
      key: `n:${p.id}`,
      scope: p.tripId ? L("Tüm gezi", "Whole trip") : L("Tüm geziler", "All trips"),
      short: p.text,
      text: p.text,
      detail: `${L("not", "note")}${
        wishes.length ? L(` · ${wishes.join(", ")} önemli sayılıyor`, ` · ${wishes.join(", ")} counted as important`) : ""
      }`,
      action: async () => {
        await (await db()).delete("preferences", p.id);
        notifyChanged();
      },
    });
  }
  for (const s of activeSignals(decisions?.signals ?? [], trip)) {
    entries.push({
      key: `s:${s.id}`,
      scope: L("Tüm gezi", "Whole trip"),
      short:
        s.delta > 0
          ? L(`${lowerText(CRITERION_LABELS[s.criterion])} önemli`, `${lowerText(CRITERION_LABELS[s.criterion])} matters`)
          : L(`${lowerText(CRITERION_LABELS[s.criterion])} ikinci planda`, `${lowerText(CRITERION_LABELS[s.criterion])} matters less`),
      text: s.text,
      detail: L(`onayladığın · ${s.evidence}`, `you confirmed · ${s.evidence}`),
      change: (t) => ({
        ...t,
        confirmedSignals: (t.confirmedSignals ?? []).filter((id) => id !== s.id),
        ignoredSignals: [...new Set([...(t.ignoredSignals ?? []), s.id])],
      }),
    });
  }
  // A guess from their choices changes nothing until they say yes: asked, one at a time.
  const guess = pendingSignals(decisions?.signals ?? [], trip)[0];
  return { entries, guess };
}

/**
 * The hero's "Seni böyle anladım" line: the first topics and a waiting question, closed; open, a
 * window over the page (it doesn't push anything) with each entry, its scope and a ×.
 */
export function IntentRow({ trip, decisions }: { trip: Trip; decisions: Decisions | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const { entries, guess } = intentEntries(trip, decisions);
  if (!entries.length && !guess) {
    return <div className="hx-intent empty">{L("Konuştukça ve seçtikçe seni tanıyacağım; anladıklarımı burada göreceksin.", "As you chat and choose, I'll get to know you. What I understand shows up here.")}</div>;
  }
  const preview = entries.slice(0, 3).map((e) => e.short).join(", ");
  return (
    <div className={`hx-intent${open ? " open" : ""}`} ref={box}>
      <button className="hx-intent-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <HeroIcon name="spark" size={18} className="spark" />
        <span className="title">{L("Seni böyle anladım", "What I understood")}</span>
        <span className="meta">
          {preview && ` · ${preview}`}
          {entries.length > 3 && ` · +${entries.length - 3}`}
          {guess && L(" · 1 soru", " · 1 question")}
        </span>
        {guess && <span className="q" />}
        <HeroIcon name="chevDown" size={18} className="chev" />
      </button>
      {open && (
        <div className="hx-intent-pop">
          {entries.length > 0 && (
            <ul>
              {entries.map((e) => (
                <li key={e.key}>
                  <span>
                    <span className="hx-tag">{e.scope}</span>
                    {e.text} <small>· {e.detail}</small>
                  </span>
                  <button className="x" aria-label={L(`${e.text} kaldır`, `Remove ${e.text}`)} title={L("Kaldır / yok say", "Remove / ignore")} onClick={() => void (e.change ? updateTrip(trip.id, e.change) : e.action?.())}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {guess && (
            <div className={`ask${entries.length ? "" : " first"}`}>
              <p>
                {guess.question} <span className="muted">{guess.evidence}</span>
              </p>
              <button className="yes" onClick={() => void updateTrip(trip.id, (t) => ({ ...t, confirmedSignals: [...new Set([...(t.confirmedSignals ?? []), guess.id])] }))}>
                {L("Evet", "Yes")}
              </button>
              <button onClick={() => void updateTrip(trip.id, (t) => ({ ...t, ignoredSignals: [...new Set([...(t.ignoredSignals ?? []), guess.id])] }))}>{L("Hayır", "No")}</button>
            </div>
          )}
          <div className="edit">{L("Yanlış olanı × ile kaldır; yenisini sohbette söylemen yeter.", "Remove what's wrong with ×; just say anything new in the chat.")}</div>
        </div>
      )}
    </div>
  );
}
