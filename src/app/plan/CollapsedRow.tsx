// A closed section's record (kategoriler-v2 .row): ring · name · city · date · time · price · status, one thin
// line. A press opens the section and takes you to its card; nothing is hidden while closed.
import type { CatEntry } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { formatPrice } from "../../lib/items";

export function CollapsedRow({ entry, onGo }: { entry: CatEntry; onGo: (entry: CatEntry) => void }) {
  const r = entry.row;
  return (
    <li>
      <button type="button" className="cat-row" onClick={() => onGo(entry)} aria-label={L(`${r.name}: kartına git`, `${r.name}: go to its card`)}>
        <span className={`cat-ring ${r.ring}`} aria-hidden>
          {r.ring === "yes" ? "✓" : ""}
        </span>
        <b>{r.name}</b>
        <span className="cat-meta">{r.meta}</span>
        <span className="cat-price">{r.price ? formatPrice(r.price.amount, r.price.currency) : ""}</span>
        <span className={`cat-st${r.ok ? " ok" : ""}`}>{r.status}</span>
      </button>
    </li>
  );
}
