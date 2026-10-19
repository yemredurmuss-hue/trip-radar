// The Bavul (v82 T6 a, the prototype's .q-bv): Hazırlık's last line, folded: "Bavul · Emre için · Ekim havası, 7 gün ·
// 3/5 hazır · 1 alınacak". Open: what's known and asked, the groups with their reasons, each line's tick, its shop when
// it's still to buy and its "bana göre değil" (×; the line folds into "kaldırıldı · Geri al" for a moment, no toast), then
// the traveller's own "Her gezide götürdüklerin" with "+ Ekle". The list and its counts are lib/prepPack.ts.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { L } from "../../../lib/i18n";
import { setDone } from "../../../lib/ideas";
import { packCount, packKey, withName, type PackRow, type PackView } from "../../../lib/prepPack";
import { shopFor } from "../../../lib/providers";
import { UNDO_MS } from "../../../lib/undo";
import type { Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";
import { useCardEnv } from "../../cards/PlanCard";
import type { PrepModel } from "./usePrep";
import { PrepIcon } from "./PrepIcons";
import { ShopLink } from "./PrepRow";

/** Ticks a suggested line as packed on this trip (a record ticks itself). */
function setReady(trip: Trip, key: string, ready: boolean) {
  return updateTrip(
    trip.id,
    (t) => {
      const rest = (t.packing?.ready ?? []).filter((k) => k !== key);
      return { ...t, packing: { ...t.packing, ready: ready ? [...rest, key] : rest } };
    },
    { touch: false },
  );
}

function setAnswer(trip: Trip, id: string, answer: string | null) {
  return updateTrip(
    trip.id,
    (t) => {
      const { [id]: _was, ...rest } = t.packing?.answers ?? {};
      return { ...t, packing: { ...t.packing, answers: answer == null ? rest : { ...rest, [id]: answer } } };
    },
    { touch: false },
  );
}

export function Bavul({ view, sub, bag, model }: { view: PackView; sub: string; bag: string | null; model: PrepModel }) {
  const env = useCardEnv();
  const { trip, mine, saveMine, shopHome } = model;
  const [open, setOpen] = useState(false);
  // Lines just said "bana göre değil": drawn as "kaldırıldı · Geri al" where they stood, for the undo's seconds.
  const [gone, setGone] = useState<{ key: string; name: string; group: string }[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const notForMe = (row: PackRow, group: string) => {
    saveMine({ ...mine, never: withName(mine.never, row.name, true) });
    // A record goes with the board's own "Geri al" (it's deleted like any chore); a suggested line folds here.
    if (row.item) return env.remove(row.item);
    setGone((g) => [...g.filter((x) => x.key !== row.key), { key: row.key, name: row.name, group }]);
    timers.current.set(row.key, setTimeout(() => setGone((g) => g.filter((x) => x.key !== row.key)), UNDO_MS));
  };
  const undo = (key: string, name: string) => {
    clearTimeout(timers.current.get(key));
    setGone((g) => g.filter((x) => x.key !== key));
    saveMine({ ...mine, never: withName(mine.never, name, false) });
  };
  const tick = (row: PackRow) => void (row.item ? setDone(row.item, !row.ready) : setReady(trip, row.key, !row.ready));
  const known = bag ? [{ q: L("Bagaj", "Baggage"), a: bag }] : [];
  return (
    <li className="q-bvli">
      <div className={`q-bv${open ? " open" : ""}`}>
        <button type="button" className="q-bvs" aria-expanded={open} aria-controls={`bavul-${trip.id}`} onClick={() => setOpen(!open)}>
          <span className="q-bvic">
            <PrepIcon name="bag" size={18} />
          </span>
          <span className="q-pt1">
            <b>{L("Bavul", "Packing")}</b>
            {sub && <small>{sub}</small>}
          </span>
          {view.total > 0 && <span className="q-bvn">{packCount(view)}</span>}
          <span className="q-bvchev" aria-hidden>
            <PrepIcon name="chev" size={16} stroke={2.2} />
          </span>
        </button>
        {open && (
          <div className="q-bvb" id={`bavul-${trip.id}`}>
            {(known.length > 0 || view.asks.length > 0) && (
              <div className="q-bvqs">
                {known.map((k) => (
                  <span key={k.q} className="q-bvq done">
                    <small>{k.q}</small>
                    <b>{k.a}</b>
                  </span>
                ))}
                {view.asks.map((a) =>
                  a.answer ? (
                    <span key={a.id} className="q-bvq done">
                      <small>{a.text}</small>
                      <button type="button" className="q-bvans" aria-label={L(`${a.text} ${a.answer}: cevabı değiştir`, `${a.text} ${a.answer}: change the answer`)} onClick={() => void setAnswer(trip, a.id, null)}>
                        {a.answer}
                      </button>
                    </span>
                  ) : (
                    <span key={a.id} className="q-bvq" role="group" aria-label={a.text}>
                      <small>{a.text}</small>
                      {a.options.map((o) => (
                        <button key={o} type="button" className="q-bva" onClick={() => void setAnswer(trip, a.id, o)}>
                          {o}
                        </button>
                      ))}
                    </span>
                  ),
                )}
              </div>
            )}
            {view.groups.length > 0 && (
              <div className="q-bvgs">
                {[...view.groups.map((g) => g.title), ...gone.map((x) => x.group)]
                  .filter((t, i, all) => all.indexOf(t) === i)
                  .map((title) => {
                    const rows = view.groups.find((g) => g.title === title)?.rows ?? [];
                    const folded = gone.filter((x) => x.group === title && !rows.some((r) => r.key === x.key));
                    return (
                      <div key={title} className="q-bvg">
                        <b>{title}</b>
                        <ul>
                          {rows.map((r) => (
                            <li key={r.key} className={`q-bv1${r.ready ? " done" : r.buy ? " buy" : ""}`} aria-label={r.name}>
                              <button type="button" className="q-ck q-bvck" role="checkbox" aria-checked={r.ready} aria-label={r.ready ? L(`${r.name}: hazır değil`, `${r.name}: not packed`) : L(`${r.name}: hazır`, `${r.name}: packed`)} onClick={() => tick(r)}>
                                {r.ready && <PrepIcon name="check" size={11} stroke={3.2} />}
                              </button>
                              <span className="q-pt1">
                                <b>{r.name}</b>
                                {r.why && <small>{r.why}</small>}
                              </span>
                              {r.buy && !r.ready && <BuyLink thing={r.name} home={shopHome} />}
                              <button type="button" className="q-bvx" aria-label={L(`${r.name}: bana göre değil`, `${r.name}: not for me`)} title={L("Bana göre değil", "Not for me")} onClick={() => notForMe(r, title)}>
                                <PrepIcon name="x" size={12} stroke={2.4} />
                              </button>
                            </li>
                          ))}
                          {folded.map((x) => (
                            <li key={x.key} className="q-bv1 gone">
                              <span className="q-pt1">
                                <small>{L(`${x.name} kaldırıldı · bir daha önermem`, `${x.name} removed · won't suggest it again`)}</small>
                              </span>
                              <button type="button" className="q-bvundo" onClick={() => undo(x.key, x.name)}>
                                {L("Geri al", "Undo")}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            )}
            <Mine always={mine.always} onChange={(always) => saveMine({ ...mine, always })} />
          </div>
        )}
      </div>
    </li>
  );
}

function BuyLink({ thing, home }: { thing: string; home: string | null }) {
  const shop = shopFor(thing, home);
  return shop ? <ShopLink provider={shop.provider} url={shop.url} /> : null;
}

/** "Her gezide götürdüklerin": the traveller's own, on every trip; "+ Ekle" opens a small box (Enter adds, Esc closes). */
function Mine({ always, onChange }: { always: string[]; onChange: (always: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  // Esc leaves without adding, even as the box loses focus on its way out.
  const cancelled = useRef(false);
  const close = () => {
    setAdding(false);
    setText("");
    requestAnimationFrame(() => addButton.current?.focus());
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      cancelled.current = true;
      close();
    }
    if (e.key === "Enter" && text.trim()) {
      onChange(withName(always, text, true));
      setText("");
    }
  };
  const onBlur = () => {
    if (!cancelled.current && text.trim()) onChange(withName(always, text, true));
    cancelled.current = false;
    close();
  };
  return (
    <div className="q-bvf">
      <span className="q-bvml">
        <small>{L("Her gezide götürdüklerin", "What you take on every trip")}</small>
        {always.map((m) => (
          <span key={packKey(m)} className="q-bvm">
            {m}
            <button type="button" className="q-bvmx" aria-label={L(`${m}: her gezide götürdüklerinden çıkar`, `${m}: take off what you take on every trip`)} onClick={() => onChange(withName(always, m, false))}>
              <PrepIcon name="x" size={10} stroke={2.6} />
            </button>
          </span>
        ))}
        {adding ? (
          <input className="q-bvin" autoFocus value={text} maxLength={48} aria-label={L("Her gezide götürdüğün bir şey", "Something you take on every trip")} placeholder={L("ör. Kulaklık", "e.g. Headphones")}
            onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={onBlur} />
        ) : (
          <button ref={addButton} type="button" className="q-bvadd" onClick={() => setAdding(true)}>
            + {L("Ekle", "Add")}
          </button>
        )}
      </span>
      <small className="q-bvnote">{L("Bu liste sana göre: kaldırdığını bir daha önermem, eklediğin sonraki gezilerde de gelir.", "This list is yours: what you remove isn't suggested again, what you add comes on your next trips too.")}</small>
    </div>
  );
}
