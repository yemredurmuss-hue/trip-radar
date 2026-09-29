import { useState } from "react";
import { requestReading } from "../lib/browser";
import { addEvent, db, newId, notifyChanged } from "../lib/db";
import { LEVEL_LABELS, type GroupDecision } from "../lib/decision";
import { CATEGORY_LABELS, formatDateRange, formatPrice, listingKeyOf } from "../lib/items";
import { acceptKey, monthLabel, readingLine } from "../lib/listing";
import { prosConsFor, type ProCon } from "../lib/proscons";
import { rereadListing } from "../lib/reader";
import type { FactSource, Finding, Item, ItemStatus, Listing, Trip } from "../lib/types";
import { updateTrip } from "./actions";
import type { Decisions } from "./useDecisions";

const SOURCE_TEXT: Record<FactSource, string> = {
  url: "URL'den",
  page: "sayfada doğrulandı",
  screenshot: "ekran görüntüsünden",
  unverified: "doğrulanmadı",
  none: "bilinmiyor",
};

const STATUS_ACTIONS: { status: ItemStatus; label: string; event: string }[] = [
  { status: "chosen", label: "Plana al", event: "plana alındı" },
  { status: "booked", label: "Rezerve ettim", event: "rezerve edildi olarak işaretlendi" },
  { status: "dismissed", label: "Ele", event: "elendi" },
  { status: "saved", label: "Seçeneklere geri al", event: "seçeneklere geri alındı" },
];

function Source({ source }: { source: FactSource }) {
  return <span className={`badge ${source}`}>{SOURCE_TEXT[source]}</span>;
}

function daysAgo(ms: number): string {
  const days = Math.floor((Date.now() - ms) / (24 * 3600e3));
  return days <= 0 ? "bugün" : `${days} gün önce`;
}

/** This option's score, rank and per-criterion breakdown within its need group. */
function DecisionBreakdown({ item, decision, onCompare }: { item: Item; decision: GroupDecision | undefined; onCompare: () => void }) {
  const option = decision?.options.find((o) => o.item.id === item.id);
  if (!decision || !option) return null;
  const single = decision.status === "single";
  const ranked = decision.options.filter((o) => o.score != null);
  const rank = ranked.indexOf(option) + 1;
  const aiNote = decision.analysis?.aiScores.find((s) => s.itemId === item.id);
  return (
    <div className="breakdown">
      <div className="breakdown-head">
        <span>
          {single ? (
            <span className="muted">Tek seçenek · bir tane daha kaydedince puanlanır</span>
          ) : option.score != null ? (
            <>
              <span className={`score-big${option === decision.winner ? " best" : ""}`}>{option.score}</span>
              <span className="muted"> / 100 · {rank}. sırada ({ranked.length} seçenek)</span>
            </>
          ) : option.excluded ? (
            <span className="tone-warning">{option.excluded} — karşılaştırmaya alınmadı</span>
          ) : (
            <span className="tone-warning">Puan yok{option.missing.length ? ` · eksik: ${option.missing.join(", ")}` : ""}</span>
          )}
        </span>
        <button className="link-btn" onClick={onCompare}>
          Karşılaştır →
        </button>
      </div>
      {option.parts.length > 0 && (
        <div className="parts">
          {option.parts.map((p) => (
            <div key={p.criterion} className={`part${p.weight === 0 ? " off" : ""}`}>
              <span className="part-label">
                {p.label}
                <span className="muted"> · {LEVEL_LABELS[p.level].toLowerCase()}</span>
              </span>
              <span className="part-value">{p.display ?? <span className="muted">bilinmiyor</span>}</span>
              <span className="bar">
                {p.s != null && !single && (
                  <span style={{ width: `${Math.max(4, Math.round(p.s * 100))}%` }} className={p.s >= 0.75 ? "good" : p.s >= 0.45 ? "mid" : "low"} />
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {option.unmet.length > 0 && <p className="tone-warning small-note">Şartına uymuyor: {option.unmet.join(", ")}</p>}
      {option.unsure.length > 0 && <p className="muted small-note">Kontrol et: {option.unsure.join(", ")} sayfada görünmüyor</p>}
      {aiNote && <p className="muted small-note">AI değerlendirmesi: {aiNote.score}/10 · {aiNote.note}</p>}
    </div>
  );
}

/** "Sorun değil": the finding stops counting against places of this kind, and the assistant learns it. */
async function setAccepted(item: Item, listing: Listing, f: Finding, on: boolean): Promise<void> {
  const key = acceptKey(listing.key, f);
  const note = `"${f.text}" benim için sorun değil`;
  await updateTrip(item.tripId, (t) => ({
    ...t,
    acceptedFindings: on ? [...new Set([...(t.acceptedFindings ?? []), key])] : (t.acceptedFindings ?? []).filter((k) => k !== key),
  }));
  const d = await db();
  if (on) await d.put("preferences", { id: newId(), tripId: item.tripId, text: note, createdAt: Date.now() });
  else for (const p of await d.getAll("preferences")) if (p.tripId === item.tripId && p.text === note) await d.delete("preferences", p.id);
  notifyChanged();
}

/** Everything read about the place, as pros (left) and cons (right), each with the text behind it. */
function Evidence({ item, decision, decisions }: { item: Item; decision: GroupDecision | undefined; decisions: Decisions | null }) {
  const listing = decisions?.ctx.listings.get(listingKeyOf(item));
  const pc = prosConsFor(item, decision, decisions?.ctx.listings, decisions?.ctx);
  const reading = readingLine(item, listing);
  if (!pc || (!pc.pros.length && !pc.cons.length && !reading)) return null;
  return (
    <div className="evidence">
      <h3>Artılar ve eksiler</h3>
      {reading && (
        <div className={`reading tone-${reading.tone}`}>
          {reading.text}
          {listing && item.captureIds.length > 0 && (
            <button
              className="link-btn"
              onClick={async () => {
                await rereadListing(listing.key);
                requestReading(true);
              }}
            >
              Tekrar oku
            </button>
          )}
        </div>
      )}
      <div className="pc full">
        <div className="pc-col pros">
          {pc.pros.map((line) => (
            <EvidenceLine key={line.key} line={line} sign="+" item={item} listing={listing} />
          ))}
          {!pc.pros.length && <span className="muted">Öne çıkan bir artı bulunmadı.</span>}
        </div>
        <div className="pc-col cons">
          {pc.cons.map((line) => (
            <EvidenceLine key={line.key} line={line} sign="−" item={item} listing={listing} />
          ))}
          {!pc.cons.length && <span className="muted">Öne çıkan bir eksi bulunmadı.</span>}
        </div>
      </div>
      {listing && listing.dropped > 0 && (
        <p className="muted small-note">Sayfada bulunamayan {listing.dropped} alıntı gösterilmedi.</p>
      )}
    </div>
  );
}

function EvidenceLine({ line, sign, item, listing }: { line: ProCon; sign: string; item: Item; listing: Listing | undefined }) {
  const [open, setOpen] = useState(false);
  const f = line.finding;
  const reviews = f && listing ? f.reviewIds.map((id) => listing.reviews.find((r) => r.id === id)).filter((r) => r != null) : [];
  const hasEvidence = Boolean(f && (reviews.length || f.quotes.length));
  const classes = ["pc-line", line.decisive && "decisive", line.unverified && "unverified", line.stale && "stale", line.accepted && "accepted"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <span className="pc-sign" aria-hidden>
        {sign}
      </span>
      <div>
        {line.text}
        {line.detail && <span className="pc-detail"> · {line.detail}</span>}
        <div className="pc-actions">
          {hasEvidence && (
            <button className="link-btn" onClick={() => setOpen(!open)}>
              {open ? "Kanıtı gizle" : "Kanıt"}
            </button>
          )}
          {f && listing && f.polarity === "negative" && f.verified && (
            <button className="link-btn" onClick={() => void setAccepted(item, listing, f, !line.accepted)}>
              {line.accepted ? "Geri al" : "Sorun değil"}
            </button>
          )}
        </div>
        {open && f && (
          <div className="quotes">
            {reviews.map((r) => (
              <blockquote key={r.id}>
                “{r.text}”{r.date && <span className="muted"> — {monthLabel(r.date)}</span>}
              </blockquote>
            ))}
            {f.quotes.map((q) => (
              <blockquote key={q}>
                “{q}”<span className="muted"> — {f.source === "amenities" ? "olanaklar" : f.source === "policy" ? "kurallar" : "açıklama"}</span>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  item: Item;
  group: Item[];
  trips: Trip[];
  decision: GroupDecision | undefined;
  decisions: Decisions | null;
  onClose: () => void;
  onMoved: (tripId: string) => void;
  onCompare: () => void;
}

export function ItemDrawer({ item, group, trips, decision, decisions, onClose, onMoved, onCompare }: Props) {
  async function setStatus(status: ItemStatus, event: string) {
    const d = await db();
    await d.put("items", { ...item, status, updatedAt: Date.now() });
    await addEvent(item.tripId, `${item.name} ${event}`);
    notifyChanged();
  }

  /** Manual fix when a capture landed in the wrong trip. */
  async function moveTo(value: string) {
    const d = await db();
    let target = trips.find((t) => t.id === value);
    if (value === "__new") {
      const title = prompt("Yeni gezinin adı", item.country ?? item.city ?? "")?.trim();
      if (!title) return;
      const now = Date.now();
      target = { id: newId(), title, confirmedDates: null, budget: null, heroImage: item.imageUrl, createdAt: now, updatedAt: now };
      await d.put("trips", target);
    }
    if (!target || target.id === item.tripId) return;
    await d.put("items", { ...item, tripId: target.id, status: "saved", updatedAt: Date.now() });
    await addEvent(item.tripId, `${item.name} → ${target.title} gezisine taşındı`);
    await addEvent(target.id, `${item.name} bu geziye taşındı`);
    notifyChanged();
    onClose();
    onMoved(target.id);
  }

  async function remove() {
    if (!confirm(`${item.name} tamamen silinsin mi?`)) return;
    await (await db()).delete("items", item.id);
    notifyChanged();
    onClose();
  }

  const p = item.price;
  const scope = { total: "toplam", per_night: "gecelik", per_person: "kişi başı", unknown: "kapsam belirsiz" }[p.scope];
  const taxes = { yes: "vergiler dahil", no: "vergiler hariç", unknown: "vergi durumu belirsiz" }[p.taxesIncluded];
  const guests = [
    item.guests.adults != null && `${item.guests.adults} yetişkin`,
    item.guests.children ? `${item.guests.children} çocuk` : null,
    item.guests.rooms != null && `${item.guests.rooms} oda`,
  ].filter(Boolean);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={item.name}>
        <button className="close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        {item.imageUrl && <img className="cover" src={item.imageUrl} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
        <h2>{item.name}</h2>
        <div className="muted">
          {[CATEGORY_LABELS[item.category], item.provider, item.city].filter(Boolean).join(" · ")}
        </div>
        <label className="move">
          Gezi:
          <select value={item.tripId} onChange={(e) => void moveTo(e.target.value)}>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
            <option value="__new">+ Yeni gezi…</option>
          </select>
        </label>

        <div className="actions">
          {STATUS_ACTIONS.filter((a) => a.status !== "saved" || item.status !== "saved").map((a) => (
            <button key={a.status} className={item.status === a.status ? "on" : ""} onClick={() => void setStatus(a.status, a.event)}>
              {a.label}
            </button>
          ))}
        </div>

        <DecisionBreakdown item={item} decision={decision} onCompare={onCompare} />
        <Evidence item={item} decision={decision} decisions={decisions} />

        <div className="facts">
          <div className="fact">
            <span className="k">Fiyat</span>
            <span>
              {p.amount != null ? `${formatPrice(p.amount, p.currency)} · ${scope} · ${taxes}` : "Görülmedi"}
              <Source source={p.source} />
              {p.amount != null && <div className="muted">{daysAgo(p.observedAt)} görüldü</div>}
            </span>
          </div>
          <div className="fact">
            <span className="k">Tarih</span>
            <span>
              {item.dates.start ? formatDateRange(item.dates.start, item.dates.end) : "Bilinmiyor"}
              <Source source={item.dates.source} />
            </span>
          </div>
          {guests.length > 0 && (
            <div className="fact">
              <span className="k">Kişi / oda</span>
              <span>{guests.join(", ")}</span>
            </div>
          )}
          {item.optionDetail && (
            <div className="fact">
              <span className="k">Seçenek</span>
              <span>{item.optionDetail}</span>
            </div>
          )}
          {item.flight && (
            <div className="fact">
              <span className="k">Uçuş</span>
              <span>
                {[item.flight.carrier, item.flight.flightNumber].filter(Boolean).join(" ")}{" "}
                {item.flight.from} → {item.flight.to}
                <div className="muted">
                  {[item.flight.departure?.replace("T", " "), item.flight.arrival?.replace("T", " ")].filter(Boolean).join(" → ")}
                  {item.flight.stops != null && ` · ${item.flight.stops === 0 ? "direkt" : `${item.flight.stops} aktarma`}`}
                </div>
              </span>
            </div>
          )}
          <div className="fact">
            <span className="k">İptal</span>
            <span>
              {item.cancellation.summary ?? "Bilinmiyor"}
              <Source source={item.cancellation.source} />
            </span>
          </div>
          <div className="fact">
            <span className="k">Puan</span>
            <span>
              {item.rating.value != null
                ? `${item.rating.value}${item.rating.scale ? ` / ${item.rating.scale}` : ""}${item.rating.count ? ` · ${item.rating.count} yorum` : ""}`
                : "Bilinmiyor"}
              <Source source={item.rating.source} />
            </span>
          </div>
          {(item.location.address || item.location.area) && (
            <div className="fact">
              <span className="k">Konum</span>
              <span>
                {[item.location.area, item.location.address].filter(Boolean).join(" · ")}
                {item.location.approximate && <div className="muted">Yaklaşık konum</div>}
              </span>
            </div>
          )}
        </div>

        {item.reviewSummary && (
          <>
            <h3>Yorumlardan</h3>
            <p>{item.reviewSummary}</p>
          </>
        )}
        {item.missing.length > 0 && (
          <>
            <h3>Eksik bilgi</h3>
            <p className="muted">
              {item.missing.join(", ")}. Sayfayı açıp (tarih seçiliyken) eklentiyle tekrar kaydedersen tamamlanır.
            </p>
          </>
        )}

        {item.priceHistory.length > 1 && (
          <>
            <h3>Fiyat geçmişi</h3>
            <ul>
              {item.priceHistory.map((h) => (
                <li key={h.observedAt}>
                  {formatPrice(h.amount, h.currency)} · {new Date(h.observedAt).toLocaleDateString("tr-TR")}
                </li>
              ))}
            </ul>
          </>
        )}

        {item.url && (
          <p>
            <a href={item.url} target="_blank" rel="noreferrer">
              Orijinal sayfayı aç ↗
            </a>
            <br />
            <span className="muted" style={{ fontSize: 13 }}>
              Fiyatı güncellemek için sayfayı açıp eklentiye tekrar tıkla.
            </span>
          </p>
        )}
        <button className="danger-link" onClick={() => void remove()}>
          Bu kaydı sil
        </button>
      </aside>
    </>
  );
}
