import { useEffect, useRef, useState } from "react";
import { db, notifyChanged } from "../lib/db";
import { updateTrip } from "./actions";
import { L } from "../lib/i18n";
import { CRITERION_LABELS, LEVEL_LABELS, requirementLabel, saidTopics, WISH_TOPIC, WISHES } from "../lib/decision";
import { activeSignals, pendingSignals } from "../lib/intent";
import { CATEGORY_LABELS } from "../lib/items";
import { preferenceRows, type Pref } from "../lib/preferences";
import { amenityLabel, type Category, type CriterionId, type Trip } from "../lib/types";
import { HeroIcon } from "./Icons";
import { useAppear } from "./useAppear";
import type { Decisions } from "./useDecisions";

export interface Entry {
  key: string;
  /** What it applies to: "Tüm gezi", a category, or a place's name. */
  scope: string;
  /** What the hero card's "Tercihler" rows make of it (lib/preferences.ts). */
  pref: Pref;
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
      pref: { kind: "priority", topic: CRITERION_LABELS[c], level },
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
        pref: { kind: "category", scope: CATEGORY_LABELS[cat], topic: CRITERION_LABELS[c], level },
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
      pref: { kind: "requirement", topic: label },
      text: L(`Şart: ${label}`, `Required: ${label}`),
      detail: L("uymayan seçenek önerilmez", "options that don't fit aren't suggested"),
      change: (t) => ({ ...t, requirements: (t.requirements ?? []).filter((x) => requirementLabel(x) !== label) }),
    });
  }
  for (const a of trip.wantedAmenities ?? []) {
    entries.push({
      key: `a:${a}`,
      scope: CATEGORY_LABELS.stay,
      pref: { kind: "amenity", topic: L(a, amenityLabel(a)) },
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
      pref: { kind: "fine", topic: finding.text },
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
      pref: { kind: "matters", topic: finding.text },
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
      pref: { kind: "note", topic: p.text },
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
      pref: { kind: "signal", topic: CRITERION_LABELS[s.criterion], up: s.delta > 0 },
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
 * The hero card's "Tercihler" (v9; "Seni böyle anladım" before): at most two rows of what was understood
 * (lib/preferences.ts) and "+7 tercih ›"; a tap opens the window over the card (it doesn't push anything)
 * with each entry, its scope, where it came from and a ×, and the one waiting question.
 */
export function Preferences({ trip, decisions }: { trip: Trip; decisions: Decisions | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { entries, guess } = intentEntries(trip, decisions);
  const nothing = !entries.length && !guess;
  const appear = useAppear(entries.length > 0);
  // Answering the last question leaves nothing to show: close, so a later entry doesn't appear already open.
  useEffect(() => {
    if (nothing) setOpen(false);
  }, [nothing]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const { rows, rest } = preferenceRows(entries.map((e) => e.pref));
  const toggle = () => setOpen(!open);
  const question = guess && (
    <span className="ask-mark">
      <i aria-hidden />
      {L("1 soru", "1 question")}
    </span>
  );
  return (
    <div className={`hx-block hx-prefs${open ? " open" : ""}`} ref={box}>
      {nothing ? (
        <h3 className="hx-h">{L("Tercihler", "Preferences")}</h3>
      ) : (
        <button className="hx-h" aria-expanded={open} onClick={toggle}>
          {L("Tercihler", "Preferences")}
        </button>
      )}
      {entries.length > 0 ? (
        <div key="full" className={`hx-prefs-body${appear}`}>
          <dl className="hx-prefs-rows">
            {rows.slice(0, 2).map((r, n) => (
              <div key={n}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          <button className="hx-link hx-prefs-link" aria-expanded={open} onClick={toggle}>
            <span>{rest > 0 ? L(`+${rest} tercih`, `+${rest} more`) : L("Düzenle", "Edit")}</span>
            <HeroIcon name="chevRight" size={18} />
            {question && <span className="sep">·</span>}
            {question}
          </button>
        </div>
      ) : (
        <div key="empty" className="hx-prefs-body">
          <p className="hx-empty">{L("Konuştukça ve seçtikçe seni tanıyacağım.", "As you chat and choose, I'll get to know you.")}</p>
          {guess && (
            <button className="hx-link hx-prefs-link" aria-expanded={open} onClick={toggle}>
              {question}
              <HeroIcon name="chevRight" size={18} />
            </button>
          )}
        </div>
      )}
      {open && (
        <div className="hx-prefs-pop" role="dialog" aria-label={L("Seni böyle anladım", "What I understood")}>
          <div className="pop-title">{L("Seni böyle anladım", "What I understood")}</div>
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
