// The empty cards' "Kendin ara" row (boş kartlar, spec 2026-10-06-bos-kartlar-design.md): the brands' searches as
// their letters, kept for the back face (BackFace) and the need card (NeedCard). The empty cards themselves gave way
// to the intent boxes' own states in plan v82 (plan/v82/IntentBox).
import { L } from "../../lib/i18n";
import { BRANDS, type SearchLink } from "../../lib/searchLinks";

/** "Kendin ara [G] [S] [K]": the brand's letter on its colour, drawn here (nothing fetched); its name opens beside it on hover or focus. */
export function SearchRow({ links }: { links: SearchLink[] }) {
  if (!links.length) return null;
  return (
    <span className="ek-find">
      <span className="ek-ara">{L("Kendin ara", "Search yourself")}</span>
      {links.map((l) => (
        <a key={l.url} className="ek-link" data-brand={l.brand} href={l.url} target="_blank" rel="noopener noreferrer"
          title={L(`${l.label} · yeni sekmede açılır`, `${l.label} · opens in a new tab`)}>
          <span className="ek-lg" style={{ background: BRANDS[l.brand].color }} aria-hidden>
            {BRANDS[l.brand].letter}
          </span>
          {/* Logo first: on a screen with a pointer the name and the ↗ open beside it on hover or focus (docs/mockups/ux-katmanli-arayuz, option C). */}
          <span className="ek-nm">
            {l.label}
            <span className="ek-up" aria-hidden> ↗</span>
          </span>
        </a>
      ))}
    </span>
  );
}
