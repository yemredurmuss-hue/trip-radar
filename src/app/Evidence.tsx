import { useState } from "react";
import { requestReading } from "../lib/browser";
import type { GroupDecision } from "../lib/decision";
import { listingKeyOf } from "../lib/items";
import { monthLabel, readingLine } from "../lib/listing";
import { prosConsFor, type ProCon } from "../lib/proscons";
import { rereadListing } from "../lib/reader";
import type { Item, Listing } from "../lib/types";
import { setFindingVerdict } from "./findingVerdict";
import type { Decisions } from "./useDecisions";

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
  const classes = ["pc-line", line.decisive && "decisive", line.serious && "serious", line.unverified && "unverified", (line.stale || line.faded) && "stale", line.accepted && "accepted"]
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
          {f && listing && f.polarity === "negative" && f.verified && (line.accepted || line.confirmed ? (
            <button className="link-btn" onClick={() => void setFindingVerdict(item, listing, f, null)}>
              Geri al
            </button>
          ) : (
            <>
              <button className="link-btn" onClick={() => void setFindingVerdict(item, listing, f, "fine")}>
                Sorun değil
              </button>
              {f.severity !== "low" && (
                <button className="link-btn" title="Bu seçeneği eler" onClick={() => void setFindingVerdict(item, listing, f, "matters")}>
                  Önemli, kalsın
                </button>
              )}
            </>
          ))}
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

