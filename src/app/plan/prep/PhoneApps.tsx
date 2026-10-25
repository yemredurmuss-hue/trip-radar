// Hazırlık's "Telefonuna kur" (0.39.7; 0.39.8 kısa liste, lib/phoneApps.ts): a folded line under the Bavul, drawn like it:
// "Telefonuna kur · Mısır · 5 uygulama + internet · 1/6 kuruldu". Open: the short list (at most six, most important
// first, each with its kind, why and "yedek: Careem" when it has a second), the eSIM provider, and a folded "Diğer
// uygulamalar (N)" with the rest by kind. Each line: its App Store and Google Play pages (the AI's: a search), "Kurdum"
// and × (not for me, "Geri al" for a moment).
import { useMemo, useState } from "react";
import { L, lang } from "../../../lib/i18n";
import { countryName } from "../../../lib/prepKnow";
import { kindWord, planNames, stayCities, tripDays } from "../../../lib/prepPack";
import { kindTitle, phoneCount, phonePlan, phoneSub, tripKinds, tripShape, type PhoneAiInput, type PhoneApp } from "../../../lib/phoneApps";
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
  const shape = useMemo(() => tripShape(items), [items]);
  const hidden = trip.phone?.hidden ?? [];
  const plan = useMemo(
    () =>
      table
        ? phonePlan({ table, countries, countryName, kinds, shape, rides, days: tripDays(range), ai: trip.phone?.ai ?? null, hidden, lang: lang() === "en" ? "en" : "tr" })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the trip's fields it reads
    [table, countries.join(), kinds.join(), shape, rides.join(), range?.start, range?.end, trip.phone?.ai, hidden.join()],
  );
  const input: PhoneAiInput = {
    countries: countries.map(countryName),
    cities: stayCities(items),
    kinds,
    about: aboutOf(trip),
    plan: planNames(items),
    candidates: (plan?.candidates ?? []).map((a) => ({ key: a.key, name: a.name, cat: a.cat, why: a.why })),
  };
  usePhoneAi(trip, input, plan != null && plan.candidates.length > 0, priority);
  return { plan, table };
}

export function PhoneApps({ model }: { model: PrepModel }) {
  const { trip, countries } = model;
  const { plan, table } = usePhoneModel(model, "now");
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gone, setGone] = useState<PhoneApp | null>(null);
  if (!plan || (plan.main.length === 0 && !plan.esim)) return null;
  const done = trip.phone?.done ?? [];
  const count = phoneCount(plan, done);
  const sub = phoneSub(countries.slice(0, 3).map(countryName), plan);
  const hide = (app: PhoneApp) => {
    setGone(app);
    void setHidden(trip, app.key, true);
  };
  const moreCount = plan.more.reduce((n, g) => n + g.apps.length, 0);
  const row = (a: PhoneApp, label: boolean) => <AppRow key={a.key} app={a} label={label ? kindTitle(a.cat, table) : null} on={done.includes(a.key)} trip={trip} onHide={hide} />;
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
            <div className="q-bvg q-phmain">
              <ul>
                {plan.main.map((a) => row(a, true))}
                {plan.esim && row(plan.esim, true)}
              </ul>
            </div>
            {moreCount > 0 && (
              <div className="q-phmore">
                <button type="button" className="q-phmb" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
                  {L(`Diğer uygulamalar (${moreCount})`, `Other apps (${moreCount})`)}
                  <PrepIcon name="chev" size={14} stroke={2.2} />
                </button>
                {moreOpen && (
                  <div className="q-bvgs">
                    {plan.more.map((g) => (
                      <div key={g.key} className="q-bvg">
                        <b>{g.title}</b>
                        <ul>{g.apps.map((a) => row(a, g.key === "intent"))}</ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function AppRow({ app: a, label, on, trip, onHide }: { app: PhoneApp; label: string | null; on: boolean; trip: Trip; onHide: (a: PhoneApp) => void }) {
  return (
    <li className={`q-bv1 q-ph1${on ? " done" : ""}`} aria-label={a.name}>
      <button type="button" className="q-ck q-bvck" role="checkbox" aria-checked={on} aria-label={a.name} onClick={() => void setDone(trip, a.key, !on)}>
        {on && <PrepIcon name="check" size={11} stroke={3.2} />}
      </button>
      <span className="q-pt1">
        <b>
          {a.name}
          {a.ai && <span className="q-phai">AI</span>}
          {label && <span className="q-phk">{label}</span>}
          {a.where.length > 0 && <span className="q-phw">{a.where.join(", ")}</span>}
        </b>
        {(a.why || a.alt) && (
          <small>
            {a.why}
            {a.alt && <span className="q-phalt">{L(` · yedek: ${a.alt}`, ` · backup: ${a.alt}`)}</span>}
          </small>
        )}
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
}

/** The AI's pick asked ahead (after the Bavul's), whatever is open: Hazırlık opens with it made. Draws nothing. */
export function PhonePrefetch(): null {
  usePhoneModel(usePrep([]), "soon");
  return null;
}


