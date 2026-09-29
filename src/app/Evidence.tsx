import { useState } from "react";
import { requestReading } from "../lib/browser";
import { db, newId, notifyChanged } from "../lib/db";
import type { GroupDecision } from "../lib/decision";
import { listingKeyOf } from "../lib/items";
import { acceptKey, monthLabel, readingLine } from "../lib/listing";
import { prosConsFor, type ProCon } from "../lib/proscons";
import { rereadListing } from "../lib/reader";
import type { Finding, Item, Listing } from "../lib/types";
import { updateTrip } from "./actions";
import type { Decisions } from "./useDecisions";

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
export function Evidence({
  item,
  decision,
  decisions,
  heading = true,
}: {
  item: Item;
  decision: GroupDecision | undefined;
  decisions: Decisions | null;
  heading?: boolean;
}) {
  const listing = decisions?.ctx.listings.get(listingKeyOf(item));
  const pc = prosConsFor(item, decision, decisions?.ctx.listings, decisions?.ctx);
  const reading = readingLine(item, listing);
  if (!pc || (!pc.pros.length && !pc.cons.length && !reading)) return null;
  return (
    <div className="evidence">
      {heading && <h3>Artılar ve eksiler</h3>}
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
  const classes = ["pc-line", line.decisive && "decisive", line.serious && "serious", line.unverified && "unverified", line.stale && "stale", line.accepted && "accepted"]
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

