import { addEvent, db, newId, notifyChanged } from "../lib/db";
import { moveDocsToTrip } from "../lib/docs";
import { LEVEL_LABELS, type GroupDecision } from "../lib/decision";
import { L, locale } from "../lib/i18n";
import { lowerText } from "../lib/i18nText";
import { CATEGORY_LABELS, formatDateRange, formatPrice } from "../lib/items";
import type { FactSource, Item, ItemStatus, Trip } from "../lib/types";
import { removeItem } from "./actions";
import { Evidence } from "./Evidence";
import type { Decisions } from "./useDecisions";

const sourceText = (): Record<FactSource, string> => ({
  url: L("URL'den", "from the URL"),
  page: L("sayfada doğrulandı", "checked on the page"),
  screenshot: L("ekran görüntüsünden", "from a screenshot"),
  unverified: L("doğrulanmadı", "not checked"),
  user: L("sen söyledin", "you said so"),
  none: L("bilinmiyor", "unknown"),
});

/** The drawer's status buttons; `event` is the line written to the trip's log, a whole sentence per language. */
const statusActions = (): { status: ItemStatus; label: string; event: (name: string) => string }[] => [
  { status: "chosen", label: L("Plana al", "Add to plan"), event: (name) => L(`${name} plana alındı`, `${name} added to the plan`) },
  {
    status: "booked",
    label: L("Rezerve ettim", "I booked it"),
    event: (name) => L(`${name} rezerve edildi olarak işaretlendi`, `${name} marked as booked`),
  },
  { status: "dismissed", label: L("Ele", "Rule out"), event: (name) => L(`${name} elendi`, `${name} ruled out`) },
  {
    status: "saved",
    label: L("Seçeneklere geri al", "Back to options"),
    event: (name) => L(`${name} seçeneklere geri alındı`, `${name} moved back to options`),
  },
];

function Source({ source }: { source: FactSource }) {
  return <span className={`badge ${source}`}>{sourceText()[source]}</span>;
}

/** When the price was seen, as a whole phrase ("3 gün önce görüldü"). */
function seenAgo(ms: number): string {
  const days = Math.floor((Date.now() - ms) / (24 * 3600e3));
  if (days <= 0) return L("bugün görüldü", "seen today");
  return L(`${days} gün önce görüldü`, `seen ${days} day${days === 1 ? "" : "s"} ago`);
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
            <span className="muted">{L("Tek seçenek · bir tane daha kaydedince puanlanır", "Only option · save one more to score it")}</span>
          ) : option.score != null ? (
            <>
              <span className={`score-big${option === decision.winner ? " best" : ""}`}>{option.score}</span>
              <span className="muted">
                {L(` / 100 · ${rank}. sırada (${ranked.length} seçenek)`, ` / 100 · #${rank} of ${ranked.length} option${ranked.length === 1 ? "" : "s"}`)}
              </span>
            </>
          ) : option.excluded ? (
            <span className="tone-warning">{L(`${option.excluded}: karşılaştırmaya alınmadı`, `${option.excluded}: left out of the comparison`)}</span>
          ) : (
            <span className="tone-warning">
              {L("Puan yok", "No score")}
              {option.missing.length ? L(` · eksik: ${option.missing.join(", ")}`, ` · missing: ${option.missing.join(", ")}`) : ""}
            </span>
          )}
        </span>
        <button className="link-btn" onClick={onCompare}>
          {L("Karşılaştır →", "Compare →")}
        </button>
      </div>
      {option.parts.length > 0 && (
        <div className="parts">
          {option.parts.map((p) => (
            <div key={p.criterion} className={`part${p.weight === 0 ? " off" : ""}`}>
              <span className="part-label">
                {p.label}
                <span className="muted"> · {lowerText(LEVEL_LABELS[p.level])}</span>
              </span>
              <span className="part-value">{p.display ?? <span className="muted">{L("bilinmiyor", "unknown")}</span>}</span>
              <span className="bar">
                {p.s != null && !single && (
                  <span style={{ width: `${Math.max(4, Math.round(p.s * 100))}%` }} className={p.s >= 0.75 ? "good" : p.s >= 0.45 ? "mid" : "low"} />
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {option.penalties.length > 0 && (
        <p className="tone-warning small-note">
          {L("Ciddi sorun, puandan düşüldü", "Serious issue, taken off the score")}: {option.penalties.map((f) => f.text).join(", ")} (−{option.penaltyPoints})
        </p>
      )}
      {option.unmet.length > 0 && <p className="tone-warning small-note">{L(`Şartına uymuyor: ${option.unmet.join(", ")}`, `Doesn't meet your must-have: ${option.unmet.join(", ")}`)}</p>}
      {option.unsure.length > 0 && <p className="muted small-note">
          {L(`Kontrol et: ${option.unsure.join(", ")} sayfada görünmüyor`, `Check: ${option.unsure.join(", ")} not shown on the page`)}
        </p>}
      {aiNote && <p className="muted small-note">
          {L("AI değerlendirmesi", "AI review")}: {aiNote.score}/10 · {aiNote.note}
        </p>}
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
  async function setStatus(status: ItemStatus, event: (name: string) => string) {
    const d = await db();
    // The stored record, not the board's corrected copy (its corrections stay beside the page's values).
    const fresh = (await d.get("items", item.id)) ?? item;
    await d.put("items", { ...fresh, status, statusAt: Date.now(), updatedAt: Date.now() });
    await addEvent(item.tripId, event(item.name));
    notifyChanged();
  }

  /** Manual fix when a capture landed in the wrong trip. */
  async function moveTo(value: string) {
    const d = await db();
    let target = trips.find((t) => t.id === value);
    if (value === "__new") {
      const title = prompt(L("Yeni gezinin adı", "Name of the new trip"), item.country ?? item.city ?? "")?.trim();
      if (!title) return;
      const now = Date.now();
      target = { id: newId(), title, confirmedDates: null, budget: null, heroImage: item.imageUrl, createdAt: now, updatedAt: now };
      await d.put("trips", target);
    }
    if (!target || target.id === item.tripId) return;
    const fresh = (await d.get("items", item.id)) ?? item;
    await d.put("items", { ...fresh, tripId: target.id, status: "saved", updatedAt: Date.now() });
    await moveDocsToTrip(item.id, target.id);
    await addEvent(item.tripId, L(`${item.name} → ${target.title} gezisine taşındı`, `${item.name} moved to ${target.title}`));
    await addEvent(target.id, L(`${item.name} bu geziye taşındı`, `${item.name} moved to this trip`));
    notifyChanged();
    onClose();
    onMoved(target.id);
  }

  /** No confirm dialog: the board shows "… silindi · Geri al" for 8 seconds. */
  async function remove() {
    await removeItem(item);
    onClose();
  }

  const p = item.price;
  const scope = {
    total: L("toplam", "total"),
    per_night: L("gecelik", "per night"),
    per_person: L("kişi başı", "per person"),
    unknown: L("kapsam belirsiz", "unclear what it covers"),
  }[p.scope];
  const taxes = {
    yes: L("vergiler dahil", "taxes included"),
    no: L("vergiler hariç", "taxes not included"),
    unknown: L("vergi durumu belirsiz", "taxes unclear"),
  }[p.taxesIncluded];
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const { adults, children, rooms } = item.guests;
  const guests = [
    adults != null && L(`${adults} yetişkin`, count(adults, "adult", "adults")),
    children ? L(`${children} çocuk`, count(children, "child", "children")) : null,
    rooms != null && L(`${rooms} oda`, count(rooms, "room", "rooms")),
  ].filter(Boolean);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={item.name}>
        <button className="close" onClick={onClose} aria-label={L("Kapat", "Close")}>
          ×
        </button>
        {item.imageUrl && <img className="cover" src={item.imageUrl} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
        <h2>{item.name}</h2>
        <div className="muted">
          {[CATEGORY_LABELS[item.category], item.provider, item.city].filter(Boolean).join(" · ")}
        </div>
        <label className="move">
          {L("Gezi:", "Trip:")}
          <select value={item.tripId} onChange={(e) => void moveTo(e.target.value)}>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
            <option value="__new">{L("+ Yeni gezi…", "+ New trip…")}</option>
          </select>
        </label>

        <div className="actions">
          {statusActions().filter((a) => a.status !== "saved" || item.status !== "saved").map((a) => (
            <button key={a.status} className={item.status === a.status ? "on" : ""} onClick={() => void setStatus(a.status, a.event)}>
              {a.label}
            </button>
          ))}
        </div>

        <DecisionBreakdown item={item} decision={decision} onCompare={onCompare} />
        <Evidence item={item} decision={decision} decisions={decisions} />

        <div className="facts">
          <div className="fact">
            <span className="k">{L("Fiyat", "Price")}</span>
            <span>
              {p.amount != null ? `${formatPrice(p.amount, p.currency)} · ${scope} · ${taxes}` : L("Görülmedi", "Not seen")}
              <Source source={p.source} />
              {p.amount != null && <div className="muted">{seenAgo(p.observedAt)}</div>}
            </span>
          </div>
          <div className="fact">
            <span className="k">{L("Tarih", "Dates")}</span>
            <span>
              {item.dates.start ? formatDateRange(item.dates.start, item.dates.end) : L("Bilinmiyor", "Unknown")}
              <Source source={item.dates.source} />
            </span>
          </div>
          {guests.length > 0 && (
            <div className="fact">
              <span className="k">{L("Kişi / oda", "Guests / rooms")}</span>
              <span>{guests.join(", ")}</span>
            </div>
          )}
          {item.optionDetail && (
            <div className="fact">
              <span className="k">{L("Seçenek", "Option")}</span>
              <span>{item.optionDetail}</span>
            </div>
          )}
          {item.flight && (
            <div className="fact">
              <span className="k">{L("Uçuş", "Flight")}</span>
              <span>
                {[item.flight.carrier, item.flight.flightNumber].filter(Boolean).join(" ")}{" "}
                {item.flight.from} → {item.flight.to}
                <div className="muted">
                  {[item.flight.departure?.replace("T", " "), item.flight.arrival?.replace("T", " ")].filter(Boolean).join(" → ")}
                  {item.flight.stops != null && ` · ${item.flight.stops === 0 ? L("direkt", "direct") : L(`${item.flight.stops} aktarma`, `${item.flight.stops} stop${item.flight.stops === 1 ? "" : "s"}`)}`}
                </div>
              </span>
            </div>
          )}
          <div className="fact">
            <span className="k">{L("İptal", "Cancellation")}</span>
            <span>
              {item.cancellation.summary ?? L("Bilinmiyor", "Unknown")}
              <Source source={item.cancellation.source} />
            </span>
          </div>
          <div className="fact">
            <span className="k">{L("Puan", "Rating")}</span>
            <span>
              {item.rating.value != null
                ? `${item.rating.value}${item.rating.scale ? ` / ${item.rating.scale}` : ""}${item.rating.count ? L(` · ${item.rating.count} yorum`, ` · ${item.rating.count} reviews`) : ""}`
                : L("Bilinmiyor", "Unknown")}
              <Source source={item.rating.source} />
            </span>
          </div>
          {(item.location.address || item.location.area) && (
            <div className="fact">
              <span className="k">{L("Konum", "Location")}</span>
              <span>
                {[item.location.area, item.location.address].filter(Boolean).join(" · ")}
                {item.location.approximate && <div className="muted">{L("Yaklaşık konum", "Approximate location")}</div>}
              </span>
            </div>
          )}
        </div>

        {item.reviewSummary && (
          <>
            <h3>{L("Yorumlardan", "From reviews")}</h3>
            <p>{item.reviewSummary}</p>
          </>
        )}
        {item.missing.length > 0 && (
          <>
            <h3>{L("Eksik bilgi", "Missing info")}</h3>
            <p className="muted">
              {item.missing.join(", ")}.{" "}
              {L(
                "Sayfayı açıp (tarih seçiliyken) eklentiyle tekrar kaydedersen tamamlanır.",
                "Open the page (with dates picked) and save it again with the extension to fill it in.",
              )}
            </p>
          </>
        )}

        {item.priceHistory.length > 1 && (
          <>
            <h3>{L("Fiyat geçmişi", "Price history")}</h3>
            <ul>
              {item.priceHistory.map((h) => (
                <li key={h.observedAt}>
                  {formatPrice(h.amount, h.currency)} · {new Date(h.observedAt).toLocaleDateString(locale())}
                </li>
              ))}
            </ul>
          </>
        )}

        {item.url && (
          <p>
            <a href={item.url} target="_blank" rel="noreferrer">
              {L("Orijinal sayfayı aç ↗", "Open the original page ↗")}
            </a>
            <br />
            <span className="muted" style={{ fontSize: 13 }}>
              {L("Fiyatı güncellemek için sayfayı açıp eklentiye tekrar tıkla.", "To update the price, open the page and click the extension again.")}
            </span>
          </p>
        )}
        <button className="danger-link" onClick={() => void remove()}>
          {L("Bu kaydı sil", "Delete this")}
        </button>
      </aside>
    </>
  );
}
