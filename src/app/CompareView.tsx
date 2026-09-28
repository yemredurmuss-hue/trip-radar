import { useEffect, useState } from "react";
import { requestAnalysis } from "../lib/browser";
import { addEvent, db, hasActiveKey, notifyChanged } from "../lib/db";
import {
  CRITERION_LABELS,
  DEFAULT_LEVELS,
  LEVEL_LABELS,
  resetPriorities,
  withPriorities,
  type GroupDecision,
  type OptionResult,
  type Part,
} from "../lib/decision";
import { CATEGORY_LABELS, formatPrice } from "../lib/items";
import { AMENITIES, type Amenity, type CriterionId, type Item, type PriorityLevel, type Trip } from "../lib/types";

interface Props {
  trip: Trip;
  decision: GroupDecision;
  title: string | null;
  onClose: () => void;
  onOpenItem: (item: Item) => void;
}

const MAX_COLUMNS = 5;

/** Side-by-side comparison of one need: the numbers, the weights the user controls, and why. */
export function CompareView({ trip, decision, title, onClose, onOpenItem }: Props) {
  const d = decision;
  const columns = d.options.filter((o) => !o.excluded).slice(0, MAX_COLUMNS);
  const excluded = d.options.filter((o) => o.excluded);
  const unmeasured = (Object.keys(DEFAULT_LEVELS[d.category]) as CriterionId[]).filter(
    (c) => !d.criteria.includes(c) && c !== "ai" && (c !== "amenities" || trip.wantedAmenities?.length),
  );
  const levelOf = (c: CriterionId) => columns[0]?.parts.find((p) => p.criterion === c)?.level ?? 0;

  async function saveTrip(next: Trip) {
    await (await db()).put("trips", next);
    notifyChanged();
  }
  const setLevel = (criterion: CriterionId, level: PriorityLevel) =>
    saveTrip(withPriorities(trip, [{ criterion, level, category: d.category }]));
  const toggleAmenity = (a: Amenity) => {
    const wanted = trip.wantedAmenities ?? [];
    return saveTrip({ ...trip, wantedAmenities: wanted.includes(a) ? wanted.filter((x) => x !== a) : [...wanted, a], updatedAt: Date.now() });
  };

  async function choose(option: OptionResult) {
    const chosen = option.item.status === "chosen";
    await (await db()).put("items", { ...option.item, status: chosen ? "saved" : "chosen", updatedAt: Date.now() });
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
          <div className="verdict-main">{d.summary}</div>
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
                      {o.score != null ? (
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
              {d.criteria.map((c) => (
                <tr key={c} className={levelOf(c) === 0 ? "off" : ""}>
                  <th className="crit-col">
                    <div>{CRITERION_LABELS[c]}</div>
                    <LevelPicker level={levelOf(c)} onChange={(level) => void setLevel(c, level)} />
                  </th>
                  {columns.map((o) => (
                    <Cell key={o.item.id} part={o.parts.find((p) => p.criterion === c)} />
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
                  <li key={r.criterion}>
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
                  <li key={r.criterion}>
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
          <button className="link-btn" onClick={() => void saveTrip(resetPriorities(trip, d.category))}>
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

function Cell({ part }: { part: Part | undefined }) {
  if (!part || part.s == null) return <td className="muted">bilinmiyor</td>;
  const pct = Math.round(part.s * 100);
  return (
    <td>
      <div className="cell-value">{part.display}</div>
      <div className="bar" aria-label={`%${pct}`}>
        <span style={{ width: `${Math.max(4, pct)}%` }} className={pct >= 75 ? "good" : pct >= 45 ? "mid" : "low"} />
      </div>
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
