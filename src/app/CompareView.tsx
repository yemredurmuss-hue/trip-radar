import { useEffect, useState } from "react";
import { requestAnalysis } from "../lib/browser";
import { addEvent, db, hasActiveKey, notifyChanged } from "../lib/db";
import {
  CRITERION_LABELS,
  DEFAULT_LEVELS,
  LEVEL_LABELS,
  inferredKey,
  isWish,
  levelFor,
  levelSource,
  resetPriorities,
  saidOf,
  withPriorities,
  type GroupDecision,
  type Inferred,
  type OptionResult,
  type Part,
} from "../lib/decision";
import { CATEGORY_LABELS, formatPrice } from "../lib/items";
import { prosConsFor } from "../lib/proscons";
import type { DecisionContext } from "../lib/decision";
import { ProsConsView } from "./ProsConsView";
import type { ValueCard } from "../lib/value";
import { updateTrip } from "./actions";
import { AMENITIES, type Amenity, type CriterionId, type Item, type PriorityLevel, type Trip } from "../lib/types";

interface Props {
  trip: Trip;
  decision: GroupDecision;
  card?: ValueCard;
  /** Signals currently nudging weights, to mark levels that came from them. */
  inferred?: Inferred;
  /** For each option's pros and cons (what was read on its page). */
  ctx?: DecisionContext;
  title: string | null;
  onClose: () => void;
  onOpenItem: (item: Item) => void;
}

const MAX_COLUMNS = 5;

/** Side-by-side comparison of one need: the numbers, the weights the user controls, and why. */
export function CompareView({ trip, decision, card, inferred, ctx, title, onClose, onOpenItem }: Props) {
  const d = decision;
  const single = d.status === "single";
  const columns = d.options.filter((o) => !o.excluded).slice(0, MAX_COLUMNS);
  const excluded = d.options.filter((o) => o.excluded);
  // A wish nobody asked for isn't "missing information" (the ones asked for, from a note or set here, are).
  const unmeasured = (Object.keys(DEFAULT_LEVELS[d.category]) as CriterionId[]).filter(
    (c) =>
      !d.criteria.includes(c) &&
      c !== "ai" &&
      (c !== "amenities" || trip.wantedAmenities?.length) &&
      (!isWish(c) || levelFor(trip, d.category, c, inferred, ctx ? saidOf(ctx) : undefined) > 0),
  );
  const levelOf = (c: CriterionId) => columns[0]?.parts.find((p) => p.criterion === c)?.level ?? 0;

  // Changes go to the trip as stored now, so a concurrent update (e.g. from the chat) isn't undone.
  const setLevel = (criterion: CriterionId, level: PriorityLevel) =>
    updateTrip(trip.id, (t) => withPriorities(t, [{ criterion, level, category: d.category }]));
  const toggleAmenity = (a: Amenity) =>
    updateTrip(trip.id, (t) => {
      const wanted = t.wantedAmenities ?? [];
      return { ...t, wantedAmenities: wanted.includes(a) ? wanted.filter((x) => x !== a) : [...wanted, a] };
    });

  async function choose(option: OptionResult) {
    const chosen = option.item.status === "chosen";
    await (await db()).put("items", { ...option.item, status: chosen ? "saved" : "chosen", statusAt: Date.now(), updatedAt: Date.now() });
    await addEvent(option.item.tripId, `${option.item.name} ${chosen ? "seçeneklere geri alındı" : "plana alındı"}`);
    notifyChanged();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="compare-modal" role="dialog" aria-label="Karşılaştırma" onClick={onClose}>
      <div className="compare-card" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <div className="muted">Karşılaştırma</div>
        <h2>{[CATEGORY_LABELS[d.category], title].filter(Boolean).join(" · ")}</h2>

        <div className={`verdict-box status-${d.status}`}>
          <div className="verdict-main">{card && !card.tie ? `${card.kicker}: ${card.pick.item.name}` : d.summary}</div>
          {card && <div className="verdict-because">{card.because}</div>}
          {card?.unless && <div className="verdict-because">Ama {card.unless.charAt(0).toLocaleLowerCase("tr") + card.unless.slice(1)}</div>}
          {card?.budget && <div className="verdict-because muted">{card.budget}</div>}
          <AiVerdict decision={d} />
        </div>

        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="crit-col">
                  <span className="muted">Kriter · önemi</span>
                </th>
                {columns.map((o) => (
                  <th key={o.item.id} className={o === d.winner ? "win" : ""}>
                    <button className="opt-name" onClick={() => onOpenItem(o.item)}>
                      {o.item.name}
                    </button>
                    <div className="muted opt-provider">{o.item.provider ?? ""}</div>
                    <div className="opt-score">
                      {single ? (
                        <span className="muted">Puan, karşılaştırınca çıkar</span>
                      ) : o.score != null ? (
                        <>
                          <span className={`score-big${o === d.winner ? " best" : ""}`}>{o.score}</span>
                          {o.confidence < 0.85 && <span className="muted conf"> · bilgi %{Math.round(o.confidence * 100)}</span>}
                        </>
                      ) : (
                        <span className="tone-warning">Puan yok</span>
                      )}
                    </div>
                    <button
                      className={`plan-btn${o.item.status === "chosen" || o.item.status === "booked" ? " on" : ""}`}
                      disabled={o.item.status === "booked"}
                      onClick={() => void choose(o)}
                    >
                      {o.item.status === "booked" ? "Rezerve ✓" : o.item.status === "chosen" ? "Planda ✓" : "Plana al"}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctx && (
                <tr className="pc-row">
                  <th className="crit-col">
                    <span className="muted">Artılar · eksiler</span>
                  </th>
                  {columns.map((o) => {
                    const pc = prosConsFor(o.item, d, ctx.listings, ctx);
                    return <td key={o.item.id}>{pc && <ProsConsView pc={pc} limit={3} stacked />}</td>;
                  })}
                </tr>
              )}
              {d.criteria.map((c) => (
                <tr key={c} className={levelOf(c) === 0 ? "off" : ""}>
                  <th className="crit-col">
                    <div>{CRITERION_LABELS[c]}</div>
                    <LevelPicker level={levelOf(c)} onChange={(level) => void setLevel(c, level)} />
                    {ctx && levelSource(trip, d.category, c, inferred, saidOf(ctx)) === "said" && (
                      <div className="muted level-note">notundan · seçersen senin ayarın olur</div>
                    )}
                    {inferred?.has(inferredKey(d.category, c)) && (
                      <div className="muted level-note" title={inferred.get(inferredKey(d.category, c))!.evidence}>
                        sezgi · seçersen senin ayarın olur
                      </div>
                    )}
                  </th>
                  {columns.map((o) => (
                    <Cell key={o.item.id} part={o.parts.find((p) => p.criterion === c)} bar={!single} />
                  ))}
                </tr>
              ))}
              {columns.some((o) => o.missing.length) && (
              <tr className="missing-row">
                <th className="crit-col muted">Eksik bilgi</th>
                {columns.map((o) => (
                  <td key={o.item.id} className="muted">
                    {o.missing.length ? o.missing.join(", ") : "—"}
                  </td>
                ))}
              </tr>
              )}
            </tbody>
          </table>
        </div>
        {unmeasured.length > 0 && (
          <p className="muted small-note">
            Bilgi olmadığı için karşılaştırılamadı: {unmeasured.map((c) => CRITERION_LABELS[c].toLowerCase()).join(", ")}.
          </p>
        )}
        {excluded.map((o) => (
          <p key={o.item.id} className="muted small-note">
            {o.item.name} karşılaştırmaya alınmadı: {o.excluded}.
          </p>
        ))}

        <div className="why-grid">
          {d.reasons.length > 0 && (
            <section>
              <h3>{d.winner ? `Neden ${d.winner.item.name}?` : "Öndekinin artıları"}</h3>
              <ul>
                {d.reasons.map((r) => (
                  <li key={r.key ?? r.criterion}>
                    {r.text} <span className="pts plus">+{r.points}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.tradeoffs.length > 0 && (
            <section>
              <h3>Karşılığında</h3>
              <ul>
                {d.tradeoffs.map((r) => (
                  <li key={r.key ?? r.criterion}>
                    {r.text} <span className="pts minus">{r.points}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.flips.length > 0 && (
            <section>
              <h3>Sonucu ne değiştirir?</h3>
              <ul>
                {d.flips.map((f) => (
                  <li key={f.criterion}>
                    {f.label} çok önemli olursa → <b>{f.winner}</b>{" "}
                    <button className="link-btn" onClick={() => void setLevel(f.criterion, 4)}>
                      dene
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.analysis && d.analysis.risks.length > 0 && (
            <section>
              <h3>Rezervasyondan önce kontrol et</h3>
              <ul>
                {d.analysis.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {d.category === "stay" && (
          <div className="amenities">
            <h3>İstediğin olanaklar</h3>
            <div className="chips">
              {AMENITIES.map((a) => (
                <button key={a} className={`chip${trip.wantedAmenities?.includes(a) ? " on" : ""}`} onClick={() => void toggleAmenity(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="compare-foot">
          <span className="muted">
            Puanları kaydettiğin sayfalardaki bilgilerden kod hesaplar; önemlerini sen belirlersin. AI değerlendirmesi düşük ağırlıklı ayrı bir kriterdir. Son karar senin.
          </span>
          <button className="link-btn" onClick={() => void updateTrip(trip.id, (t) => resetPriorities(t, d.category))}>
            Önemleri varsayılana döndür
          </button>
        </div>
        {trip.budget && (
          <p className="muted small-note">Gezi bütçesi: {formatPrice(trip.budget.amount, trip.budget.currency)}</p>
        )}
      </div>
    </div>
  );
}

function Cell({ part, bar }: { part: Part | undefined; bar: boolean }) {
  if (!part || part.s == null) return <td className="muted">bilinmiyor</td>;
  const pct = Math.round(part.s * 100);
  return (
    <td>
      <div className="cell-value">{part.display}</div>
      {bar && (
        <div className="bar" aria-label={`%${pct}`}>
          <span style={{ width: `${Math.max(4, pct)}%` }} className={pct >= 75 ? "good" : pct >= 45 ? "mid" : "low"} />
        </div>
      )}
      {part.note && <div className="tone-warning cell-note">{part.note}</div>}
    </td>
  );
}

function LevelPicker({ level, onChange }: { level: PriorityLevel; onChange: (level: PriorityLevel) => void }) {
  return (
    <select className={`level level-${level}`} value={level} onChange={(e) => onChange(Number(e.target.value) as PriorityLevel)}>
      {LEVEL_LABELS.map((label, i) => (
        <option key={label} value={i}>
          {label}
        </option>
      ))}
    </select>
  );
}

function AiVerdict({ decision }: { decision: GroupDecision }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  useEffect(() => {
    void hasActiveKey().then(setHasKey);
  }, []);
  const eligible = decision.options.filter((o) => !o.excluded).length;
  if (eligible < 2) return null;
  const a = decision.analysis;
  const previous = decision.staleAnalysis;
  if (!a && previous?.verdict) {
    // The last good review stays visible (dated) while a new one is pending or the model is busy.
    return (
      <div className="ai-verdict">
        <span className="ai-tag">AI yorumu · {new Date(previous.createdAt).toLocaleDateString("tr-TR")}</span> {previous.verdict}
        <div className="muted small-note">
          {hasKey === false
            ? "Yeni bilgiler geldi; güncellemek için Ayarlar'dan ücretsiz Gemini anahtarı ekle."
            : `Yeni bilgiler geldi; yorum güncelleniyor${decision.analysisFailure ? ` (son deneme: ${decision.analysisFailure.error})` : ""}.`}
        </div>
      </div>
    );
  }
  if (a) {
    return (
      <div className="ai-verdict">
        <span className="ai-tag">AI yorumu</span> {a.verdict}
        {a.reasons.length > 0 && (
          <ul>
            {a.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {a.question && <div className="ai-question">❓ {a.question}</div>}
      </div>
    );
  }
  if (hasKey === false) {
    return <div className="ai-verdict muted">AI yorumu için Ayarlar'dan ücretsiz Gemini anahtarı ekle.</div>;
  }
  if (decision.analysisFailure) {
    return (
      <div className="ai-verdict muted">
        AI yorumu alınamadı: {decision.analysisFailure.error}{" "}
        <button className="link-btn" onClick={() => requestAnalysis(true)}>
          Tekrar dene
        </button>
      </div>
    );
  }
  return <div className="ai-verdict muted">AI yorumu hazırlanıyor…</div>;
}
