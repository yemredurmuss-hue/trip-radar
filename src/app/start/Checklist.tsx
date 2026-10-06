// "Gezin şekilleniyor N/6": the interview's checklist (Layla's "Your trip is taking shape"). A row pressed asks
// its question again. On a narrow screen it folds into a thin bar above the chat (spec item 9). In the chat's
// language (each part made inside withLang), whatever the board's.
import { useState } from "react";
import { L, withLang, type Lang } from "../../lib/i18n";
import type { ChecklistRow, QuestionId } from "../../lib/startTrip";
import { UiIcon } from "../cards/Silhouettes";

/** "4'ü", "6'sı": the ending after a number read aloud (sıfır, bir, iki, üç, dört, beş, altı). */
const ACCUSATIVE = ["ı", "i", "si", "ü", "ü", "i", "sı"];

function Ring({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="st-ring" aria-hidden>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className="st-ring-bg" />
        <circle cx="32" cy="32" r={r} className="st-ring-fg" strokeDasharray={`${(c * done) / total} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <span>
        <b>{done}</b>/{total}
      </span>
    </div>
  );
}

interface Props {
  rows: ChecklistRow[];
  onAsk: (q: QuestionId) => void;
  disabled?: boolean;
  /**
   * The route's proposal is on its way (rev 3): the ROTA row says so, the chat goes on. "new": nothing shown yet;
   * "refine": the classic circuit is shown, the model's may refine it.
   */
  drawing?: "new" | "refine" | null;
  lang: Lang;
}

export function Checklist({ rows, onAsk, disabled, drawing = null, lang }: Props) {
  const done = rows.filter((r) => r.done || r.tentative).length;
  return withLang(lang, () => (
    <div className="st-list">
      <div className="st-list-head">
        <Ring done={done} total={rows.length} />
        <div>
          <div className="st-eyebrow">{L("GEZİ LİSTESİ", "TRIP CHECKLIST")}</div>
          <div className="st-list-title">{L("Gezin şekilleniyor", "Your trip is taking shape")}</div>
          <div className="st-list-sub">{L(`${rows.length} bilgiden ${done}'${ACCUSATIVE[done] ?? "i"} tamam`, `${done} of ${rows.length} captured`)}</div>
        </div>
      </div>
      <ol className="st-rows">
        {rows.map((r) => {
          const busy = Boolean(drawing) && r.id === "route" && !r.done;
          const status = (
            <span className="st-row-drawing" role="status">
              <span className="st-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              {L("Rotayı çiziyor…", "Drawing the route…")}
            </span>
          );
          return (
            <li key={r.id}>
              <button type="button" className={`st-row${r.done ? " done" : ""}${r.tentative ? " tentative" : ""}${busy ? " drawing" : ""}`} disabled={disabled} onClick={() => onAsk(r.ask)} title={L("Bunu yeniden sor", "Ask this again")}>
                <span className="st-check" aria-hidden>
                  {r.done ? <UiIcon name="check" size={14} /> : r.tentative ? "?" : null}
                </span>
                <span className="st-row-text">
                  <span className="st-row-label">
                    {r.label}
                    {r.tentative ? <em className="st-row-check">{L(" · kontrol", " · check")}</em> : r.required && !r.done && <em>{L(" · gerekli", " · needed")}</em>}
                  </span>
                  <span className="st-row-value">
                    {busy && drawing === "new" ? (
                      status
                    ) : busy ? (
                      <>
                        {r.value}
                        {status}
                      </>
                    ) : r.skipped && !r.done ? (
                      L("Atlandı · sonra sohbetten", "Skipped · later in the chat")
                    ) : (
                      r.value
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  ));
}

/** "Gezimi oluştur" when every row is done; "Şimdilik bununla oluştur" while some are open (item 4). */
export const generateLabel = (complete: boolean) => (complete ? L("Gezimi oluştur", "Generate my trip") : L("Şimdilik bununla oluştur", "Generate with this for now"));

/**
 * The dark card under the list: it works as soon as the destination is known (what's missing is asked later in the
 * board's chat, which goes on with this conversation), also while the model is working (rev 3: what's on its way is
 * dropped, the best route there is gets built). Only "no destination yet" disables it, and only then does it look so.
 */
export function GenerateCard({ ready, complete, missing, onGenerate, lang }: { ready: boolean; complete: boolean; missing: string[]; onGenerate: () => void; lang: Lang }) {
  return withLang(lang, () => (
    <div className="st-gen-card">
      <button type="button" className="st-gen-btn" data-auto-keep disabled={!ready} aria-disabled={!ready} onClick={onGenerate}>
        <span aria-hidden>✨</span> {generateLabel(complete)}
      </button>
      <p>
        {!ready
          ? L(`Oluşturmak için ${missing.join(" ve ")} yeter.`, `All it needs is ${missing.join(" and ")}.`)
          : complete
            ? L("Her şey hazır; oluşturunca pano açılır.", "Everything's set; the board opens once it's made.")
            : L("Şimdi oluşturur, eksikleri sonra pano sohbetinde sorar; ya da konuşmaya devam et.", "It builds it now and asks what's missing later in the board's chat; or keep talking.")}
      </p>
    </div>
  ));
}

/** Narrow screens: "4/6 · Gezin şekilleniyor ▾", the list opening under it. */
export function ChecklistBar({ rows, onAsk, ready, complete, onGenerate, disabled, drawing, lang }: Props & { ready: boolean; complete: boolean; onGenerate: () => void }) {
  const [open, setOpen] = useState(false);
  const done = rows.filter((r) => r.done || r.tentative).length;
  return withLang(lang, () => (
    <div className={`st-bar${open ? " open" : ""}`}>
      <div className="st-bar-row">
        <button type="button" className="st-bar-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="st-bar-track" aria-hidden>
            <span style={{ width: `${(done / rows.length) * 100}%` }} />
          </span>
          <span>
            <b>
              {done}/{rows.length}
            </b>{" "}
            · {L("Gezin şekilleniyor", "Your trip is taking shape")} {open ? "▴" : "▾"}
          </span>
        </button>
        {ready && (
          <button type="button" className="st-bar-gen" data-auto-keep onClick={onGenerate}>
            ✨ {complete ? L("Oluştur", "Generate") : L("Şimdilik oluştur", "Generate for now")}
          </button>
        )}
      </div>
      {open && <Checklist rows={rows} onAsk={(q) => (setOpen(false), onAsk(q))} disabled={disabled} drawing={drawing} lang={lang} />}
    </div>
  ));
}
