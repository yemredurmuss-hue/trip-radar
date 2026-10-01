import { useState } from "react";
import { db, notifyChanged } from "../lib/db";
import { updateTrip } from "./actions";
import { L } from "../lib/i18n";
import { lowerText } from "../lib/i18nText";
import { CRITERION_LABELS, LEVEL_LABELS, requirementLabel, saidTopics, WISH_TOPIC, WISHES } from "../lib/decision";
import { activeSignals, pendingSignals } from "../lib/intent";
import { CATEGORY_LABELS } from "../lib/items";
import { amenityLabel, type Category, type CriterionId, type Trip } from "../lib/types";
import type { Decisions } from "./useDecisions";

interface Entry {
  key: string;
  /** Short form for the collapsed line. */
  short: string;
  text: string;
  detail: string;
  /** Either a change to the stored trip, or a standalone action. */
  change?: (trip: Trip) => Trip;
  action?: () => Promise<void>;
}

/** "Seni böyle anladım": what the traveller said and what was read from their saves and choices. */
export function IntentCard({ trip, decisions }: { trip: Trip; decisions: Decisions | null }) {
  const [open, setOpen] = useState(false);
  const entries: Entry[] = [];

  for (const [c, level] of Object.entries(trip.priorities ?? {}) as [CriterionId, number][]) {
    entries.push({
      key: `p:${c}`,
      short: `${CRITERION_LABELS[c]}: ${lowerText(LEVEL_LABELS[level])}`,
      text: `${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level]}`,
      detail: L("söylediğin · tüm gezi", "you said · whole trip"),
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
        short: `${CRITERION_LABELS[c]}: ${lowerText(LEVEL_LABELS[level])}`,
        text: `${CATEGORY_LABELS[cat]} · ${CRITERION_LABELS[c]}: ${LEVEL_LABELS[level]}`,
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
      short: L(`${label} şart`, `${label} required`),
      text: L(`Şart: ${label}`, `Required: ${label}`),
      detail: L("uymayan seçenek önerilmez", "options that don't fit aren't suggested"),
      change: (t) => ({ ...t, requirements: (t.requirements ?? []).filter((x) => requirementLabel(x) !== label) }),
    });
  }
  for (const a of trip.wantedAmenities ?? []) {
    entries.push({
      key: `a:${a}`,
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
      short: L(`${lowerText(finding.text)} sorun değil`, `${lowerText(finding.text)} is fine`),
      text: L(`Sorun değil: ${finding.text}`, `Fine by you: ${finding.text}`),
      detail: L(`söylediğin · ${listing.name}`, `you said · ${listing.name}`),
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
      short: L(`${lowerText(finding.text)} önemli`, `${lowerText(finding.text)} matters`),
      text: L(`Önemli: ${finding.text}`, `Matters: ${finding.text}`),
      detail: L(`söylediğin · ${listing.name} elendi`, `you said · ${listing.name} ruled out`),
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
      short: p.text,
      text: p.text,
      detail: `${p.tripId ? L("not · bu gezi", "note · this trip") : L("not · tüm geziler", "note · all trips")}${
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
  const question = guess && (
    <div className="intent-question">
      <span>
        <b>{guess.question}</b> <span className="muted">{guess.evidence}</span>
      </span>
      <span className="intent-answers">
        <button className="pill-btn outline small" onClick={() => void updateTrip(trip.id, (t) => ({ ...t, confirmedSignals: [...new Set([...(t.confirmedSignals ?? []), guess.id])] }))}>
          {L("Evet", "Yes")}
        </button>
        <button className="link-btn quiet" onClick={() => void updateTrip(trip.id, (t) => ({ ...t, ignoredSignals: [...new Set([...(t.ignoredSignals ?? []), guess.id])] }))}>
          {L("Hayır", "No")}
        </button>
      </span>
    </div>
  );

  if (!entries.length) {
    return question ? <div className="intent-card">{question}</div> : <div className="intent-card empty">{L("Konuştukça ve seçtikçe seni tanıyacağım; anladıklarımı burada göreceksin.", "As you chat and choose, I'll get to know you. What I understand shows up here.")}</div>;
  }
  const preview = entries.slice(0, 3).map((e) => e.short).join(" · ");
  return (
    <div className="intent-card">
      <button className="intent-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="intent-title">{L("Seni böyle anladım", "What I understood")}</span>
        <span className="intent-preview">
          {preview}
          {entries.length > 3 && ` · +${entries.length - 3}`}
        </span>
        <span className="muted">{open ? L("Gizle", "Hide") : L("Düzenle", "Edit")}</span>
      </button>
      {question}
      {open && (
        <ul className="intent-list">
          {entries.map((e) => (
            <li key={e.key}>
              <span>
                {e.text}
                <span className="muted"> · {e.detail}</span>
              </span>
              <button className="intent-remove" aria-label={L(`${e.text} kaldır`, `Remove ${e.text}`)} title={L("Kaldır / yok say", "Remove / ignore")} onClick={() => void (e.change ? updateTrip(trip.id, e.change) : e.action?.())}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
