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

export function Pano({ items, decisions, focus, onShow, onBack, onCompare }: {
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
  useEffect(() => {
    if (!focused) return;
    setCat(focused.section);
    setState("all");
    const t = setTimeout(() => document.getElementById(groupDomId(focused.group))?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [focus]);
  const counts = panoCounts(entries);
  const shown = sortEntries(entries.filter((e) => inCat(e, cat) && inState(e, state)), sort);
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
      </header>
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
      {!shown.length ? (
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
            <div className="pn-grid">{g.entries.map((e) => card(e, false, g.entries))}</div>
          </section>
        ))
      ) : (
        <div className="pn-grid">{shown.map((e) => card(e, true, entries.filter((x) => x.group === e.group)))}</div>
      )}
    </section>
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
