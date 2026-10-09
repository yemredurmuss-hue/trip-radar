// The Pano (v11, docs/mockups/2026-10-08-japonya-web-v11.html, spec 2026-10-08-plan-pano-v11-design.md phase 5):
// every link the trip gathered, as big photo cards to choose from and put on the plan. Tabs by what it is (Tümü,
// a section of the Plan, Beğenilenler); Hepsi · Karar bekleyen · Planda; Sırala. A card: its photo (or its kind's
// mark), Önerim / En ucuz, the heart, its score, "✓ Planda" when it's on the plan; its need, its name (two lines at
// most), one grey line; the price and one button (Plana koy, or Plan'da gör →); who saved it and who liked it.
// A section's tab groups the options by need ("Kyoto · 5 gece · 3 seçenek", "Seçildi: X · Plan'da gör →").
import { useEffect, useMemo, useState } from "react";
import { cardFacts } from "../../lib/cardFacts";
import { cardKind, cardKindColor } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import {
  inCat,
  inState,
  likersOf,
  matchesQuery,
  PANO_CATS,
  panoCatLabel,
  panoCounts,
  panoEntries,
  panoGroups,
  needTitleOf,
  sortEntries,
  isAiOption,
  type PanoCat,
  type PanoEntry,
  type PanoSort,
  type PanoState,
} from "../../lib/pano";
import { sameName } from "../../lib/tripSettings";
import type { Item } from "../../lib/types";
import { chooseItem, toggleLike } from "../actions";
import { addLinks } from "../capture";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { FallbackImg } from "../FallbackImg";
import { useMyName } from "../Profile";
import type { Decisions } from "../useDecisions";

const SORTS: [PanoSort, () => string][] = [
  ["fit", () => L("Bize en uygun", "Best for us")],
  ["cheap", () => L("En ucuz", "Cheapest")],
  ["liked", () => L("En çok beğenilen", "Most liked")],
  ["new", () => L("En yeni eklenen", "Newest")],
];

export function Pano({ tripId, items, decisions, focus, onShow, onBack, onCompare }: {
  /** "+ Link ekle" puts a pasted link into this trip (read and placed like any capture). */
  tripId: string;
  items: Item[];
  decisions: Decisions | null;
  /** Opened from a plan card ("Pano'da N alternatif"): its need's group, framed and in view, with "← Plan'a dön". */
  focus: string | null;
  /** "Plan'da gör →": the Plan, scrolled to the card, which flashes. */
  onShow: (itemId: string) => void;
  onBack: () => void;
  onCompare: (group: string) => void;
}) {
  const entries = useMemo(() => panoEntries(items, decisions?.byGroup), [items, decisions?.byGroup]);
  const focused = focus ? entries.find((e) => e.group === focus) : undefined;
  const [cat, setCat] = useState<PanoCat>(focused?.section ?? "all");
  const [state, setState] = useState<PanoState>("all");
  const [sort, setSort] = useState<PanoSort>("fit");
  // v11: "Kayıtlarda ara", the view (Kartlar | Karşılaştır) and "+ Link ekle".
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (!focused) return;
    setCat(focused.section);
    setState("all");
    const t = setTimeout(() => document.getElementById(groupDomId(focused.group))?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [focus]);
  const counts = panoCounts(entries);
  const shown = sortEntries(entries.filter((e) => inCat(e, cat) && inState(e, state) && matchesQuery(e, query)), sort);
  const grouped = cat !== "all" && cat !== "liked";
  const card = (e: PanoEntry, showNeed: boolean, list: PanoEntry[]) => (
    <PanoCard key={e.item.id} entry={e} showNeed={showNeed} siblings={list} decisions={decisions} onShow={onShow} onCompare={onCompare} />
  );
  return (
    <section className="pn" aria-label={L("Pano", "Board")}>
      <header className="pn-head">
        <h2>{L("Pano", "Board")}</h2>
        <span className="pn-n">{L(`${entries.length} kayıt`, `${entries.length} saved`)}</span>
        <span className="pn-sp" />
        {focus && (
          <button type="button" className="pn-back" onClick={onBack}>
            ← {L("Plan'a dön", "Back to the plan")}
          </button>
        )}
        <label className="pn-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L("Kayıtlarda ara", "Search saved")} aria-label={L("Kayıtlarda ara", "Search saved")} />
        </label>
        <span className="pn-view" role="group" aria-label={L("Görünüm", "View")}>
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}>{L("Kartlar", "Cards")}</button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>{L("Karşılaştır", "Compare")}</button>
        </span>
        <button type="button" className="pn-addlink" aria-expanded={adding} onClick={() => setAdding(!adding)}>
          <UiIcon name="plus" size={13} />
          {L("Link ekle", "Add a link")}
        </button>
      </header>
      {adding && <LinkForm tripId={tripId} onDone={() => setAdding(false)} />}
      <nav className="pn-cats" role="tablist" aria-label={L("Ne", "What")}>
        {PANO_CATS.filter((c) => c === "all" || counts.cats[c] > 0).map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} data-cat={c} onClick={() => setCat(c)}>
            {c === "liked" ? <UiIcon name="heart" size={14} /> : null}
            {panoCatLabel(c)} <i>{counts.cats[c]}</i>
          </button>
        ))}
      </nav>
      <div className="pn-tools">
        <span className="pn-seg" role="group" aria-label={L("Duruma göre", "By state")}>
          {(["all", "open", "plan"] as PanoState[]).map((s) => (
            <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(s)}>
              {s === "all" ? L("Hepsi", "All") : s === "open" ? L("Karar bekleyen", "To decide") : L("Planda", "On the plan")} <b>{counts.states[s]}</b>
            </button>
          ))}
        </span>
        <span className="pn-sp" />
        <label className="pn-sort">
          {L("Sırala", "Sort")}
          <select value={sort} onChange={(e) => setSort(e.target.value as PanoSort)}>
            {SORTS.map(([v, label]) => (
              <option key={v} value={v}>
                {label()}
              </option>
            ))}
          </select>
        </label>
      </div>
      {view === "table" && !grouped ? (
        <p className="pn-empty">{L("Karşılaştırma bir ihtiyaç içinde anlamlı: üstten Uçuş ya da Konaklama'yı seç.", "Comparing makes sense within one need: pick Flights or Stays above.")}</p>
      ) : !shown.length ? (
        <p className="pn-empty">
          {state === "plan"
            ? L("Bu süzgeçte plana konmuş bir şey yok.", "Nothing here is on the plan yet.")
            : state === "open"
              ? L("Burada karar bekleyen yok; hepsi planda.", "Nothing here waits for a decision.")
              : entries.length
                ? L("Burada kayıt yok.", "Nothing saved here.")
                : L("Henüz kayıt yok. Eklentiyle bir sayfa kaydet ya da sohbette bir link bırak; hepsi burada birikir.", "Nothing saved yet. Save a page with the extension or drop a link in the chat; it all gathers here.")}
        </p>
      ) : grouped ? (
        panoGroups(shown).map((g) => (
          <section key={g.group} id={groupDomId(g.group)} className={`pn-group${focus === g.group ? " focus" : ""}`}>
            <div className="pn-gh">
              <b>{needTitleOf(g.entries[0].item)}</b>
              <span className="pn-gn">{L(`${g.entries.length} seçenek`, `${g.entries.length} option${g.entries.length === 1 ? "" : "s"}`)}</span>
              <span className="pn-sp" />
              {g.chosen ? (
                <button type="button" className={`pn-gp${g.chosen.inPlan === "booked" ? " booked" : ""}`} onClick={() => onShow(g.chosen!.item.id)}>
                  <UiIcon name="check" size={13} />
                  {g.chosen.inPlan === "booked" ? L("Rezerve", "Booked") : L("Seçildi", "Chosen")}: {g.chosen.item.name} · {L("Plan'da gör", "See on the plan")} →
                </button>
              ) : g.entries.length > 1 ? (
                <span className="pn-gw">{L("Karar bekliyor", "To decide")}</span>
              ) : null}
              {g.entries.length > 1 && (
                <button type="button" className="pn-cmp" onClick={() => onCompare(g.group)}>
                  {L("Karşılaştır", "Compare")}
                </button>
              )}
            </div>
            {view === "table" && g.entries.length > 1 ? (
              <PanoTable entries={g.entries} decisions={decisions} />
            ) : (
              <div className="pn-grid">{g.entries.map((e) => card(e, false, g.entries))}</div>
            )}
          </section>
        ))
      ) : (
        <div className="pn-grid">{shown.map((e) => card(e, true, entries.filter((x) => x.group === e.group)))}</div>
      )}
    </section>
  );
}

/** "+ Link ekle": a link pasted here goes into this trip, read and placed like one sent in the chat. */
function LinkForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (await addLinks(text, { tripId, source: "board" })) return onDone();
    setError(L("Bu bir link gibi görünmüyor (https://… ile başlamalı).", "That doesn't look like a link (it should start with https://…)."));
  };
  return (
    <form className="pn-linkform" onSubmit={(e) => (e.preventDefault(), void submit())}>
      <input type="text" inputMode="url" autoFocus value={text} onChange={(e) => (setText(e.target.value), setError(null))} placeholder={L("Bir link yapıştır: Booking, Airbnb, bir uçuş, bir Reel…", "Paste a link: Booking, Airbnb, a flight, a Reel…")}
        aria-label={L("Link", "Link")} onKeyDown={(e) => e.key === "Escape" && onDone()} />
      <button type="submit" className="pn-linkgo" disabled={!text.trim()}>{L("Ekle", "Add")}</button>
      <button type="button" className="pn-linkno" onClick={onDone}>{L("Vazgeç", "Cancel")}</button>
      {error && <p className="pn-linkerr" role="alert">{error}</p>}
    </form>
  );
}

/**
 * "Karşılaştır" (v11 table view): one need's options side by side — fit, then the same rows for everyone (price,
 * rating, where, from), then what the traveller asked for (✓ ✗ ?), then what only that one has; the best of a row
 * marked; "+ Plana koy" at the foot.
 */
function PanoTable({ entries, decisions }: { entries: PanoEntry[]; decisions: Decisions | null }) {
  const rows = entries.map((e) => ({ e, facts: cardFacts(e.item, decisions?.byGroup.get(e.group), decisions?.ctx) }));
  const bestOf = (vals: (number | null)[], mode: "min" | "max") => {
    const nums = vals.filter((v): v is number => v != null);
    if (nums.length < 2) return vals.map(() => false);
    const v = mode === "min" ? Math.min(...nums) : Math.max(...nums);
    return vals.map((x) => x === v);
  };
  const scoreBest = bestOf(rows.map((r) => r.e.score), "max");
  const priceBest = bestOf(rows.map((r) => (r.e.item.price.amount != null && r.e.item.price.amount > 0 ? r.e.item.price.amount : null)), "min");
  const rateBest = bestOf(rows.map((r) => r.e.item.rating.value), "max");
  const needKeys = [...new Map(rows.flatMap((r) => r.facts.needs.map((n) => [n.key, n.label] as const))).entries()];
  const mark = { yes: "✓", no: "✗", unknown: "?" } as const;
  const line = (label: string, cells: (string | null)[], best?: boolean[]) => (
    <tr>
      <th scope="row">{label}</th>
      {cells.map((c, i) => (
        <td key={rows[i].e.item.id} className={best?.[i] ? "best" : undefined}>{c ?? "—"}</td>
      ))}
    </tr>
  );
  const part = (label: string) => (
    <tr className="pn-tpart">
      <th colSpan={rows.length + 1} scope="colgroup">{label}</th>
    </tr>
  );
  return (
    <div className="pn-tablewrap">
      <table className="pn-table">
        <thead>
          <tr>
            <th />
            {rows.map(({ e }) => (
              <th key={e.item.id} scope="col">
                <span className="pn-tn">{e.item.name}</span>
                <small>{isAiOption(e.item) ? L("AI önerisi", "AI pick") : e.item.addedBy ? L(`${e.item.addedBy} kaydetti`, `${e.item.addedBy} saved it`) : L("Sen kaydettin", "You saved it")}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {line(L("Uyum", "Fit"), rows.map((r) => (r.e.score != null ? String(r.e.score) : null)), scoreBest)}
          {part(L("Herkes için · her seçenekte aynı satırlar", "For everyone · the same rows for each"))}
          {line(L("Fiyat", "Price"), rows.map((r) => r.facts.price?.text ?? null), priceBest)}
          {line(L("Puan", "Rating"), rows.map((r) => (r.e.item.rating.value != null ? String(r.e.item.rating.value).replace(".", ",") : null)), rateBest)}
          {line(L("Nerede", "Where"), rows.map((r) => r.e.item.location.area ?? r.e.item.city))}
          {line(L("Kaynak", "From"), rows.map((r) => r.facts.source?.label ?? null))}
          {needKeys.length > 0 && part(L("Senin şartların · tercihlerinden", "What you asked for"))}
          {needKeys.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {rows.map(({ e, facts }) => {
                const n = facts.needs.find((x) => x.key === key);
                return (
                  <td key={e.item.id} className={n ? `need-${n.state}` : undefined} title={n?.text}>
                    {n ? mark[n.state] : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {part(L("Yorumlardan · yalnız bunda olanlar", "From the reviews · only this one has"))}
          {line(L("Artılar", "Pros"), rows.map((r) => r.facts.pros.filter((p) => p.unique).map((p) => p.text).join(" · ") || null))}
          <tr className="pn-tfoot">
            <th />
            {rows.map(({ e }) => (
              <td key={e.item.id}>
                {e.inPlan ? (
                  <span className="pn-tin">✓ {e.inPlan === "booked" ? L("Rezerve", "Booked") : L("Planda", "On the plan")}</span>
                ) : (
                  <button type="button" className="pn-put" onClick={() => void chooseItem(e.item, entries.map((x) => x.item))}>+ {L("Plana koy", "Add to plan")}</button>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const groupDomId = (group: string) => `pn-g-${group.replace(/[^\w-]/g, "_")}`;

function PanoCard({ entry, showNeed, siblings, decisions, onShow, onCompare }: {
  entry: PanoEntry;
  showNeed: boolean;
  siblings: PanoEntry[];
  decisions: Decisions | null;
  onShow: (itemId: string) => void;
  onCompare: (group: string) => void;
}) {
  const { item } = entry;
  const myName = useMyName();
  const photoOf = usePhotoOf();
  const me = myName || "me";
  const kind = cardKind(item);
  const decision = decisions?.byGroup.get(entry.group);
  const facts = cardFacts(item, decision, decisions?.ctx);
  const likers = likersOf(item);
  const liked = likers.some((n) => sameName(n, me));
  // Önerim: first in its need's comparison; En ucuz: the lowest price among two or more.
  const best = siblings.length > 1 && decision?.winner?.item.id === item.id;
  const prices = siblings.map((s) => s.item.price.amount).filter((p): p is number => p != null && p > 0);
  const cheapest = !best && siblings.length > 1 && item.price.amount != null && item.price.amount === Math.min(...prices);
  const meta = [item.provider, item.location.area ?? item.city, item.rating.value != null ? String(item.rating.value).replace(".", ",") : null].filter(Boolean).join(" · ");
  const who = isAiOption(item) ? "ai" : item.addedBy;
  return (
    <article className={`pn-card${entry.inPlan ? ` in-${entry.inPlan}` : ""}`} id={`pn-${item.id}`} aria-label={item.name} style={{ "--c": cardKindColor(kind) } as React.CSSProperties}>
      <div className="pn-img">
        <FallbackImg src={item.imageUrl} className="pn-photo" fallback={<span className="pn-art"><KindIcon kind={kind} size={56} /></span>} />
        {(best || cheapest) && <span className="pn-badge">{best ? L("Önerim", "My pick") : L("En ucuz", "Cheapest")}</span>}
        <button type="button" className={`pn-heart${liked ? " on" : ""}`} aria-pressed={liked} aria-label={liked ? L(`${item.name}: beğeniyi geri al`, `${item.name}: unlike`) : L(`${item.name}: beğen`, `${item.name}: like`)}
          onClick={() => void toggleLike(item, me)}>
          <UiIcon name="heart" size={16} />
        </button>
        {entry.score != null && (
          <span className="pn-score" title={L("Tercihlerinize uyum (100 üzerinden)", "Fit with your preferences (out of 100)")}>
            {Math.round(entry.score)}
            <small>{L("uyum", "fit")}</small>
          </span>
        )}
        {entry.inPlan && (
          <span className={`pn-rib ${entry.inPlan}`}>
            <UiIcon name="check" size={12} />
            {entry.inPlan === "booked" ? L("Rezerve", "Booked") : L("Planda", "On the plan")}
          </span>
        )}
      </div>
      <div className="pn-bd">
        {showNeed && (
          <span className="pn-need">
            <KindIcon kind={kind} size={13} />
            {needTitleOf(item)}
          </span>
        )}
        <h3 title={item.name}>{item.name}</h3>
        {meta && <p className="pn-meta">{meta}</p>}
      </div>
      <div className="pn-act">
        <span className="pn-price">
          {facts.price ? (
            <>
              <b>{facts.price.text}</b> {facts.price.label}
            </>
          ) : null}
        </span>
        {entry.inPlan ? (
          <button type="button" className={`pn-goplan ${entry.inPlan}`} onClick={() => onShow(item.id)}>
            {L("Plan'da gör", "See on the plan")} →
          </button>
        ) : (
          <button type="button" className="pn-put" onClick={() => void chooseItem(item, siblings.map((s) => s.item))}>
            + {L("Plana koy", "Add to plan")}
          </button>
        )}
      </div>
      <div className="pn-ft">
        {who === "ai" ? (
          <span className="pn-who ai">✨ {L("AI önerisi", "AI pick")}</span>
        ) : (
          <span className="pn-who">
            <WhoAvatar name={who ?? (myName || L("Ben", "Me"))} photo={photoOf(who ?? me)} />
            {who ? L(`${who} kaydetti`, `${who} saved it`) : L("Sen kaydettin", "You saved it")}
          </span>
        )}
        {likers.length > 0 && (
          <span className="pn-likes" title={L(`${likers.map((n) => (n === "me" ? "Sen" : n)).join(", ")} beğendi`, `Liked by ${likers.join(", ")}`)}>
            <UiIcon name="heart" size={12} />
            {likers.map((n) => (
              <WhoAvatar key={n} name={n === "me" ? L("Ben", "Me") : n} photo={photoOf(n)} />
            ))}
          </span>
        )}
        {siblings.length > 1 && (
          <button type="button" className="pn-why" onClick={() => onCompare(entry.group)}>
            {L("Karşılaştır", "Compare")}
          </button>
        )}
      </div>
    </article>
  );
}
