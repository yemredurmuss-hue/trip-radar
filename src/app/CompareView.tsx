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
import { L, locale } from "../lib/i18n";
import { lowerFirst, lowerText } from "../lib/i18nText";
import { CATEGORY_LABELS, formatPrice } from "../lib/items";
import { prosConsFor } from "../lib/proscons";
import type { DecisionContext } from "../lib/decision";
import { ProsConsView } from "./ProsConsView";
import { OptionBoard } from "./board/OptionBoard";
import type { ValueCard } from "../lib/value";
import { updateTrip } from "./actions";
import { AMENITIES, amenityLabel, type Amenity, type CriterionId, type Item, type PriorityLevel, type Trip } from "../lib/types";

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

/**
 * Side-by-side comparison of one need: the numbers, the weights the user controls, and why. Two views of it
 * (0.37): Kartlar, the options as a board of photo cards (stays with something to compare start there), and
 * Tablo, the criteria side by side; cards ticked on the board open the table with just those.
 */
export function CompareView({ trip, decision, card, inferred, ctx, title, onClose, onOpenItem }: Props) {
  const d = decision;
  const single = d.status === "single";
  const [view, setView] = useState<"cards" | "table">(() => (d.category === "stay" && d.options.filter((o) => !o.excluded).length >= 2 ? "cards" : "table"));
  const [only, setOnly] = useState<string[] | null>(null);
  const columns = d.options.filter((o) => !o.excluded && (!only || only.includes(o.item.id))).slice(0, MAX_COLUMNS);
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
    // The stored record, not the board's corrected copy (its corrections stay beside the page's values).
    const d = await db();
    const fresh = (await d.get("items", option.item.id)) ?? option.item;
    await d.put("items", { ...fresh, status: chosen ? "saved" : "chosen", statusAt: Date.now(), updatedAt: Date.now() });
    const name = option.item.name;
    await addEvent(
      option.item.tripId,
      chosen ? L(`${name} seçeneklere geri alındı`, `${name} moved back to options`) : L(`${name} plana alındı`, `${name} added to the plan`),
    );
    notifyChanged();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="compare-modal" role="dialog" aria-label={L("Karşılaştırma", "Comparison")} onClick={onClose}>
      <div className="compare-card" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label={L("Kapat", "Close")}>
          ×
        </button>
        <div className="muted">{L("Karşılaştırma", "Comparison")}</div>
        <h2>{[CATEGORY_LABELS[d.category], title].filter(Boolean).join(" · ")}</h2>

        <div className={`verdict-box status-${d.status}`}>
          <div className="verdict-main">{card && !card.tie ? `${card.kicker}: ${card.pick.item.name}` : d.summary}</div>
          {card && <div className="verdict-because">{card.because}</div>}
          {card?.unless && <div className="verdict-because">{L("Ama", "But")} {lowerFirst(card.unless)}</div>}
          {card?.budget && <div className="verdict-because muted">{card.budget}</div>}
          <AiVerdict decision={d} />
        </div>

        <div className="cmp-views" role="tablist" aria-label={L("Görünüm", "View")}>
          <button type="button" role="tab" aria-selected={view === "cards"} className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>
            ▦ {L("Kartlar", "Cards")}
          </button>
          <button type="button" role="tab" aria-selected={view === "table"} className={view === "table" ? "on" : ""} onClick={() => { setOnly(null); setView("table"); }}>
            ☰ {L("Tablo", "Table")}
          </button>
          {view === "table" && only && (
            <button type="button" className="link-btn" onClick={() => setOnly(null)}>
              {L("Hepsini göster", "Show all")}
            </button>
          )}
        </div>

        {view === "cards" ? (
          <OptionBoard
            decision={d}
            ctx={ctx}
            onOpenItem={onOpenItem}
            onChoose={(o) => void choose(o)}
            onSideBySide={(ids) => {
              setOnly(ids);
              setView("table");
            }}
            onAdd={() => {
              onClose();
              // The chat box takes a link; on the page itself, Trip Radar's Save does.
              setTimeout(() => (document.querySelector<HTMLTextAreaElement>(".chat-input textarea, textarea[placeholder^='Bir link'], textarea[placeholder^='Drop a link']") ?? document.querySelector<HTMLTextAreaElement>("textarea"))?.focus(), 50);
            }}
          />
        ) : (
        <>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="crit-col">
                  <span className="muted">{L("Kriter · önemi", "What counts · how much")}</span>
                </th>
                {columns.map((o) => (
                  <th key={o.item.id} className={o === d.winner ? "win" : ""}>
                    <button className="opt-name" onClick={() => onOpenItem(o.item)}>
                      {o.item.name}
                    </button>
                    <div className="muted opt-provider">{o.item.provider ?? ""}</div>
                    <div className="opt-score">
                      {single ? (
                        <span className="muted">{L("Puan, karşılaştırınca çıkar", "Scored once there's something to compare")}</span>
                      ) : o.score != null ? (
                        <>
                          <span className={`score-big${o === d.winner ? " best" : ""}`}>{o.score}</span>
                          {o.confidence < 0.85 && <span className="muted conf">{L(` · bilgi %${Math.round(o.confidence * 100)}`, ` · info ${Math.round(o.confidence * 100)}%`)}</span>}
                        </>
                      ) : (
                        <span className="tone-warning">{L("Puan yok", "No score")}</span>
                      )}
                    </div>
                    <button
                      className={`plan-btn${o.item.status === "chosen" || o.item.status === "booked" ? " on" : ""}`}
                      disabled={o.item.status === "booked"}
                      onClick={() => void choose(o)}
                    >
                      {o.item.status === "booked" ? L("Rezerve ✓", "Booked ✓") : o.item.status === "chosen" ? L("Planda ✓", "In plan ✓") : L("Plana al", "Add to plan")}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctx && (
                <tr className="pc-row">
                  <th className="crit-col">
                    <span className="muted">{L("Artılar · eksiler", "Pros · cons")}</span>
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
                      <div className="muted level-note">{L("notundan · seçersen senin ayarın olur", "from your note · pick one to make it yours")}</div>
                    )}
                    {inferred?.has(inferredKey(d.category, c)) && (
                      <div className="muted level-note" title={inferred.get(inferredKey(d.category, c))!.evidence}>
                        {L("sezgi · seçersen senin ayarın olur", "a guess · pick one to make it yours")}
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
                <th className="crit-col muted">{L("Eksik bilgi", "Missing info")}</th>
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
            {L("Bilgi olmadığı için karşılaştırılamadı", "Couldn't compare, no info")}:{" "}
            {unmeasured.map((c) => lowerText(CRITERION_LABELS[c])).join(", ")}.
          </p>
        )}
        {excluded.map((o) => (
          <p key={o.item.id} className="muted small-note">
            {L(`${o.item.name} karşılaştırmaya alınmadı: ${o.excluded}.`, `${o.item.name} left out of the comparison: ${o.excluded}.`)}
          </p>
        ))}

        <div className="why-grid">
          {d.reasons.length > 0 && (
            <section>
              <h3>{d.winner ? L(`Neden ${d.winner.item.name}?`, `Why ${d.winner.item.name}?`) : L("Öndekinin artıları", "What the leader has going for it")}</h3>
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
              <h3>{L("Karşılığında", "In return")}</h3>
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
              <h3>{L("Sonucu ne değiştirir?", "What would change the result?")}</h3>
              <ul>
                {d.flips.map((f) => (
                  <li key={f.criterion}>
                    {L(`${f.label} çok önemli olursa →`, `If ${lowerText(f.label)} matters a lot →`)} <b>{f.winner}</b>{" "}
                    <button className="link-btn" onClick={() => void setLevel(f.criterion, 4)}>
                      {L("dene", "try it")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.analysis && d.analysis.risks.length > 0 && (
            <section>
              <h3>{L("Rezervasyondan önce kontrol et", "Check before you book")}</h3>
              <ul>
                {d.analysis.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        </>
        )}

        {view === "table" && d.category === "stay" && (
          <div className="amenities">
            <h3>{L("İstediğin olanaklar", "Amenities you want")}</h3>
            <div className="chips">
              {AMENITIES.map((a) => (
                <button key={a} className={`chip${trip.wantedAmenities?.includes(a) ? " on" : ""}`} onClick={() => void toggleAmenity(a)}>
                  {amenityLabel(a)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="compare-foot">
          <span className="muted">
            {L(
              "Puanları kaydettiğin sayfalardaki bilgilerden kod hesaplar; önemlerini sen belirlersin. AI değerlendirmesi düşük ağırlıklı ayrı bir kriterdir. Son karar senin.",
              "Scores are worked out from the pages you saved; you decide what matters. The AI review is a separate, low-weight criterion. The final call is yours.",
            )}
          </span>
          <button className="link-btn" onClick={() => void updateTrip(trip.id, (t) => resetPriorities(t, d.category))}>
            {L("Önemleri varsayılana döndür", "Reset to default weights")}
          </button>
        </div>
        {trip.budget && (
          <p className="muted small-note">
            {L("Gezi bütçesi", "Trip budget")}: {formatPrice(trip.budget.amount, trip.budget.currency)}
          </p>
        )}
      </div>
    </div>
  );
}

function Cell({ part, bar }: { part: Part | undefined; bar: boolean }) {
  if (!part || part.s == null) return <td className="muted">{L("bilinmiyor", "unknown")}</td>;
  const pct = Math.round(part.s * 100);
  return (
    <td>
      <div className="cell-value">{part.display}</div>
      {bar && (
        <div className="bar" aria-label={L(`%${pct}`, `${pct}%`)}>
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
        <span className="ai-tag">
          {L("AI yorumu", "AI review")} · {new Date(previous.createdAt).toLocaleDateString(locale())}
        </span>{" "}
        {previous.verdict}
        <div className="muted small-note">
          {hasKey === false
            ? L(
                "Yeni bilgiler geldi; güncellemek için Ayarlar'dan ücretsiz Gemini anahtarı ekle.",
                "There's new info. To update the review, add a free Gemini key in Settings.",
              )
            : L(
                `Yeni bilgiler geldi; yorum güncelleniyor${decision.analysisFailure ? ` (son deneme: ${decision.analysisFailure.error})` : ""}.`,
                `There's new info; updating the review${decision.analysisFailure ? ` (last try: ${decision.analysisFailure.error})` : ""}.`,
              )}
        </div>
      </div>
    );
  }
  if (a) {
    return (
      <div className="ai-verdict">
        <span className="ai-tag">{L("AI yorumu", "AI review")}</span> {a.verdict}
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
    return <div className="ai-verdict muted">{L("AI yorumu için Ayarlar'dan ücretsiz Gemini anahtarı ekle.", "For an AI review, add a free Gemini key in Settings.")}</div>;
  }
  if (decision.analysisFailure) {
    return (
      <div className="ai-verdict muted">
        {L("AI yorumu alınamadı", "Couldn't get the AI review")}: {decision.analysisFailure.error}{" "}
        <button className="link-btn" onClick={() => requestAnalysis(true)}>
          {L("Tekrar dene", "Try again")}
        </button>
      </div>
    );
  }
  return <div className="ai-verdict muted">{L("AI yorumu hazırlanıyor…", "Preparing the AI review…")}</div>;
}
