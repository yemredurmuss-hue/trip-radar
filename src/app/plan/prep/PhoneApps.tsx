// Hazırlık's "Telefonuna kur" (0.39.7, lib/phoneApps.ts): a folded line under the Bavul, drawn like it: "Telefonuna kur ·
// Tayland · 6 uygulama + internet · 1/7 kuruldu". Open: the groups (rides, trains, town transit, maps, messaging, food,
// paying; the trip's kinds; the internet's eSIM providers; the AI's), each line with why, its App Store and Google Play
// pages (the AI's: a search), "Kurdum" and × (not for me, "Geri al" for a moment).
import { useMemo, useState } from "react";
import { L, lang } from "../../../lib/i18n";
import { countryName } from "../../../lib/prepKnow";
import { kindWord, planNames, stayCities, tripDays } from "../../../lib/prepPack";
import { phoneCount, phoneGroups, phoneSub, tripKinds, type PhoneAiInput, type PhoneApp, type PhoneGroup } from "../../../lib/phoneApps";
import type { Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";
import { usePrep, type PrepModel } from "./usePrep";
import { PrepIcon } from "./PrepIcons";
import { usePhoneAi, usePhoneTable } from "./usePhoneApps";

const toggle = (list: readonly string[] | undefined, key: string, on: boolean): string[] => {
  const rest = (list ?? []).filter((k) => k !== key);
  return on ? [...rest, key] : rest;
};
const setDone = (trip: Trip, key: string, on: boolean) =>
  updateTrip(trip.id, (t) => ({ ...t, phone: { ...t.phone, done: toggle(t.phone?.done, key, on) } }), { touch: false });
const setHidden = (trip: Trip, key: string, on: boolean) =>
  updateTrip(trip.id, (t) => ({ ...t, phone: { ...t.phone, hidden: toggle(t.phone?.hidden, key, on) } }), { touch: false });

/** The trip's words for the AI: its kind, who goes, the money level. */
function aboutOf(trip: Trip): string[] {
  const out: string[] = [];
  const kind = kindWord(trip.intent);
  if (kind) out.push(kind);
  const b = trip.wants?.budget;
  if (b) out.push(b === "low" ? "budget / backpacker" : b === "high" ? "luxury" : "mid-range");
  const c = trip.wants?.company;
  if (c) out.push(`travelling with: ${String(c)}`);
  return out;
}

/** What the row draws and asks, for Hazırlık open and for the AI asked ahead (PhonePrefetch). */
export function usePhoneModel(model: Pick<PrepModel, "trip" | "items" | "countries" | "range" | "rides">, priority: "now" | "soon" = "now") {
  const { trip, items, countries, range, rides } = model;
  const table = usePhoneTable();
  const kinds = useMemo(() => tripKinds(trip, items), [trip, items]);
  const hidden = trip.phone?.hidden ?? [];
  const groups = useMemo(
    () =>
      table
        ? phoneGroups({ table, countries, countryName, kinds, rides, days: tripDays(range), ai: trip.phone?.ai ?? null, hidden, lang: lang() === "en" ? "en" : "tr" })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the trip's fields it reads
    [table, countries.join(), kinds.join(), rides.join(), range?.start, range?.end, trip.phone?.ai, hidden.join()],
  );
  const input: PhoneAiInput = {
    countries: countries.map(countryName),
    cities: stayCities(items),
    kinds,
    about: aboutOf(trip),
    plan: planNames(items),
    have: groups.filter((g) => g.key !== "ai").flatMap((g) => g.apps.map((a) => a.name)),
  };
  usePhoneAi(trip, input, table != null && countries.length > 0, priority);
  return { groups, table };
}

export function PhoneApps({ model }: { model: PrepModel }) {
  const { trip, countries } = model;
  const { groups } = usePhoneModel(model, "now");
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState<PhoneApp | null>(null);
  if (groups.length === 0) return null;
  const done = trip.phone?.done ?? [];
  const count = phoneCount(groups, done);
  const sub = phoneSub(countries.slice(0, 3).map(countryName), groups);
  const hide = (app: PhoneApp) => {
    setGone(app);
    void setHidden(trip, app.key, true);
  };
  return (
    <li className="q-phli">
      <div className={`q-bv${open ? " open" : ""}`}>
        <button type="button" className="q-bvs" aria-expanded={open} aria-controls={`phone-${trip.id}`} onClick={() => setOpen(!open)}>
          <span className="q-bvic">
            <PrepIcon name="phone" size={18} />
          </span>
          <span className="q-pt1">
            <b>{L("Telefonuna kur", "Set up your phone")}</b>
            {sub && <small>{sub}</small>}
          </span>
          {count.total > 0 && <span className="q-bvn">{L(`${count.done}/${count.total} kuruldu`, `${count.done}/${count.total} installed`)}</span>}
          <span className="q-bvchev" aria-hidden>
            <PrepIcon name="chev" size={16} stroke={2.2} />
          </span>
        </button>
        {open && (
          <div className="q-bvb" id={`phone-${trip.id}`}>
            {gone && (
              <div className="q-phgone">
                <small>{L(`${gone.name} kaldırıldı`, `${gone.name} removed`)}</small>
                <button
                  type="button"
                  className="q-bvundo"
                  onClick={() => {
                    void setHidden(trip, gone.key, false);
                    setGone(null);
                  }}
                >
                  {L("Geri al", "Undo")}
                </button>
              </div>
            )}
            <div className="q-bvgs">
              {groups.map((g) => (
                <Group key={g.key} group={g} done={done} trip={trip} onHide={hide} />
              ))}
            </div>
            <small className="q-bvnote">
              {L(
                "Ülkenin uygulamaları elle tutulan tablodan gelir; AI etiketliler bu gezi için AI'ın önerisi, mağazada aratırsın.",
                "The countries' apps come from a hand-kept table; the AI-tagged ones are the AI's picks for this trip, found by a search.",
              )}
            </small>
          </div>
        )}
      </div>
    </li>
  );
}

function Group({ group, done, trip, onHide }: { group: PhoneGroup; done: readonly string[]; trip: Trip; onHide: (a: PhoneApp) => void }) {
  return (
    <div className="q-bvg">
      <b>{group.title}</b>
      <ul>
        {group.apps.map((a) => {
          const on = done.includes(a.key);
          return (
            <li key={a.key} className={`q-bv1 q-ph1${on ? " done" : ""}`} aria-label={a.name}>
              <button type="button" className="q-ck q-bvck" role="checkbox" aria-checked={on} aria-label={on ? L(`${a.name}: kurulmadı`, `${a.name}: not installed`) : L(`${a.name}: kurdum`, `${a.name}: installed`)} onClick={() => void setDone(trip, a.key, !on)}>
                {on && <PrepIcon name="check" size={11} stroke={3.2} />}
              </button>
              <span className="q-pt1">
                <b>
                  {a.name}
                  {a.ai && <span className="q-phai">AI</span>}
                  {a.where.length > 0 && <span className="q-phw">{a.where.join(", ")}</span>}
                </b>
                {a.why && <small>{a.why}</small>}
              </span>
              <span className="q-phst">
                {a.ios && (
                  <a href={a.ios} target="_blank" rel="noreferrer">
                    App Store
                  </a>
                )}
                {a.android && (
                  <a href={a.android} target="_blank" rel="noreferrer">
                    Google Play
                  </a>
                )}
                {a.search && (
                  <a href={a.search} target="_blank" rel="noreferrer">
                    {L("Ara ↗", "Search ↗")}
                  </a>
                )}
              </span>
              <button type="button" className="q-bvx" aria-label={L(`${a.name}: bana göre değil`, `${a.name}: not for me`)} title={L("Bana göre değil", "Not for me")} onClick={() => onHide(a)}>
                <PrepIcon name="x" size={12} stroke={2.4} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The AI's lines asked ahead (after the Bavul's), whatever is open: Hazırlık opens with them made. Draws nothing. */
export function PhonePrefetch(): null {
  usePhoneModel(usePrep([]), "soon");
  return null;
}
