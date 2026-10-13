// The Pano (v11, docs/mockups/2026-10-08-japonya-web-v11.html, spec 2026-10-08-plan-pano-v11-design.md phase 5):
// every link the trip gathered, as big photo cards to choose from and put on the plan. Tabs by what it is (Tümü,
// a section of the Plan, Beğenilenler); Hepsi · Karar bekleyen · Planda; Sırala. A card: its photo (or its kind's
// mark), Önerim / En ucuz, the heart, its score, "✓ Planda" when it's on the plan; its need, its name (two lines at
// most), one grey line; the price and one button (Plana koy, or Plan'da gör →); who saved it and who liked it.
// A section's tab groups the options by need ("Kyoto · 5 gece · 3 seçenek", "Seçildi: X · Plan'da gör →"). A flight is not a photo card
// (F2): a one-line strip (where it stands, its first plus or minus), then the same small flight card the back of a flight card sets.
import { Fragment, useEffect, useMemo, useState } from "react";
import { bookedAs } from "../../lib/cardView";
import { cardFacts, tripPeople } from "../../lib/cardFacts";
import { flightLeg, ticketPrices, ticketStub } from "../../lib/cardTicket";
import { cardKind, cardKindColor } from "../../lib/cardKinds";
import { L } from "../../lib/i18n";
import { lookWord } from "../../lib/stageWords";
import {
  inCat,
  inState,
  likersOf,
  matchesQuery,
  withLoves,
  PANO_CATS,
  panoCatLabel,
  panoCounts,
  panoEntries,
  needTitleOf,
  needWhenOf,
  forYouOf,
  freshIds,
  seenKey,
  panoRows,
  recordsText,
  sortEntries,
  adderOf,
  savedByText,
  type PanoCat,
  type PanoEntry,
  type PanoGroup,
  type PanoRow,
  type PanoSort,
  type PanoState,
} from "../../lib/pano";
import { sameName } from "../../lib/tripSettings";
import type { Item } from "../../lib/types";
import { chooseItem, toggleLike } from "../actions";
import { addLinks } from "../capture";
import { useShare } from "../Share";
import { BRANDS } from "../../lib/searchLinks";
import { BookedBadge } from "../cards/BookedBadge";
import { FlightOption } from "../cards/FlightOption";
import { illusOf } from "../cards/MediaCard";
import { voteKeyOf } from "../../lib/share/votes";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { SavedFace, usePhotoOf, WhoAvatar } from "../cards/WhoseBadge";
import { FallbackImg } from "../FallbackImg";
import { Mascot } from "../Mascot";
import { useMyName } from "../Profile";
import type { Decisions } from "../useDecisions";

const SORTS: [PanoSort, () => string][] = [
  ["fit", () => L("Bize en uygun", "Best for us")],
  ["cheap", () => L("En ucuz", "Cheapest")],
  ["liked", () => L("En çok beğenilen", "Most liked")],
  ["new", () => L("En yeni eklenen", "Newest")],
];

/** What this device has already seen on the trip's Pano (localStorage, no schema change). */
const seenOnDevice = (tripId: string): Set<string> => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(seenKey(tripId)) ?? "[]"));
  } catch {
    return new Set();
  }
};

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
  // A shared trip: each heart is a "Süper" vote, so the other traveller's hearts show here too (lib/pano withLoves).
  const share = useShare();
  const loved = useMemo(() => (share ? items.map((i) => withLoves(i, share.votes)) : items), [items, share?.votes]);
  const entries = useMemo(() => panoEntries(loved, decisions?.byGroup), [loved, decisions?.byGroup]);
  // "Yeni": what came after the last visit stays marked until this visit ends; the next visit has seen it.
  const [seen] = useState(() => seenOnDevice(tripId));
  const fresh = useMemo(() => freshIds(items, seen), [items, seen]);
  useEffect(() => {
    try {
      localStorage.setItem(seenKey(tripId), JSON.stringify(items.map((i) => i.id)));
    } catch {
      /* the mark just shows again next time */
    }
  }, [tripId, items]);
  const focused = focus ? entries.find((e) => e.group === focus) : undefined;
  const [cat, setCat] = useState<PanoCat>(focused?.section ?? "all");
  const [state, setState] = useState<PanoState>("all");
  const [sort, setSort] = useState<PanoSort>("fit");
  // v11: "Kayıtlarda ara" and "+ Link ekle".
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // v30: a row's own "Karşılaştır" turns that row from cards into a table and back.
  const [tableRows, setTableRows] = useState<Set<string>>(() => new Set());
  const toggleRow = (group: string) => setTableRows((s) => new Set(s.has(group) ? [...s].filter((g) => g !== group) : [...s, group]));
  useEffect(() => {
    if (!focused) return;
    setCat(focused.section);
    setState("all");
    const t = setTimeout(() => document.getElementById(groupDomId(focused.group))?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [focus]);
  const counts = panoCounts(entries);
  const shown = sortEntries(entries.filter((e) => inCat(e, cat) && inState(e, state) && matchesQuery(e, query)), sort);
  const card = (e: PanoEntry, showNeed: boolean, list: PanoEntry[]) => (
    <PanoCard key={e.item.id} entry={e} fresh={fresh.has(e.item.id)} showNeed={showNeed} siblings={list} decisions={decisions} onShow={onShow} onCompare={onCompare} />
  );
  // v30: one row per need ("Kyoto · 5 gece · 3 kayıt"): its header says where it stands and has its own Karşılaştır; the cards scroll sideways.
  const asTable = (g: PanoGroup) => g.entries.length > 1 && tableRows.has(g.group);
  const needView = (g: PanoGroup) => {
    const first = g.entries[0].item;
    const title = needTitleOf(first, g.entries.length);
    const when = needWhenOf(first);
    const forYou = asTable(g) ? null : forYouOf(g.entries, decisions?.byGroup.get(g.group), decisions?.ctx);
    return (
      <section key={g.group} id={groupDomId(g.group)} className={`pn-group${focus === g.group ? " focus" : ""}`}>
        <div className="pn-gh">
          <b title={title}>{title}</b>
          {when && <span className="pn-gn">{when}</span>}
          <span className="pn-sp" />
          {g.chosen ? (
            <button type="button" className={`pn-gp${g.chosen.inPlan === "booked" ? " booked" : ""}`} title={g.chosen.item.name} onClick={() => onShow(g.chosen!.item.id)}>
              {g.chosen.inPlan === "booked" ? <BookedBadge as={bookedAs(g.chosen.item)} small /> : <UiIcon name="check" size={13} />}
              <span className="pn-gpt">
                {g.chosen.inPlan === "booked" ? "" : `${lookWord("chosen")}: `}{g.chosen.item.name}
              </span>
              <span className="pn-gpl">· {L("Plan'da gör", "See on the plan")} →</span>
            </button>
          ) : g.draft ? (
            // F7 (S11): the card's pick is not on the plan; it says "Önerimiz", and the plan shows it.
            <button type="button" className="pn-gp draft" title={g.draft.item.name} onClick={() => onShow(g.draft!.item.id)}>
              <span aria-hidden>✨</span>
              <span className="pn-gpt">{lookWord("draft")}: {g.draft.item.name}</span>
              <span className="pn-gpl">· {L("Plan'da gör", "See on the plan")} →</span>
            </button>
          ) : (
            <span className="pn-gw">{L("Karar bekliyor", "To decide")}</span>
          )}
          {g.entries.length > 1 && (
            <button type="button" className="pn-cmp" aria-pressed={asTable(g)} onClick={() => toggleRow(g.group)}>
              {asTable(g) ? L("Kartlar", "Cards") : L("Karşılaştır", "Compare")}
            </button>
          )}
        </div>
        {forYou && (
          <div className="pn-foryou">
            <b>{L("Senin için", "For you")}: {forYou.lead}</b>
            <span>{forYou.text}</span>
          </div>
        )}
        {asTable(g) ? <PanoTable entries={g.entries} decisions={decisions} /> : <div className="pn-grid pn-strip" data-pit-children="">{g.entries.map((e) => card(e, false, g.entries))}</div>}
      </section>
    );
  };
  // v30: things to do are not alternatives: a row per city (trip order), the inspiration one row; no decision, no Karşılaştır.
  const listView = (key: string, title: string, entries: PanoEntry[]) => (
    <section key={key} className="pn-group pn-sec">
      <div className="pn-gh">
        <b title={title}>{title}</b>
        <span className="pn-gn">{recordsText(entries.length)}</span>
      </div>
      <div className="pn-grid pn-strip" data-pit-children="">{entries.map((e) => card(e, false, entries))}</div>
    </section>
  );
  const rowView = (r: PanoRow) =>
    r.kind === "need"
      ? needView(r.group)
      : r.kind === "city"
        ? listView(r.key, [L("Yapılacaklar", "To do"), r.city].filter(Boolean).join(" · "), r.entries)
        : listView(r.key, panoCatLabel("inspo"), r.entries);
  return (
    <section className="pn" aria-label={L("Pano", "Board")}>
      <header className="pn-head">
        <h2>{L("Pano", "Board")}</h2>
        <span className="pn-n">{recordsText(entries.length)}</span>
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
        <button type="button" className="pn-addlink" aria-expanded={adding} title={L("Link ekle", "Add a link")} onClick={() => setAdding(!adding)}>
          <UiIcon name="plus" size={13} />
          <span className="pn-addlbl">{L("Link ekle", "Add a link")}</span>
        </button>
      </header>
      {adding && <LinkForm tripId={tripId} onDone={() => setAdding(false)} />}
      <div className="pn-body">
      <nav className="pn-cats" role="tablist" aria-orientation="vertical" aria-label={L("Ne", "What")}>
        {PANO_CATS.filter((c) => c === "all" || counts.cats[c] > 0).map((c) => (
          <Fragment key={c}>
            {c === "liked" && <span className="pn-sep" aria-hidden />}
            <button type="button" role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} data-cat={c} title={panoCatLabel(c)} onClick={() => setCat(c)}>
              <CatIcon cat={c} />
              <span className="pn-cl">{panoCatLabel(c)}</span> <i>{counts.cats[c]}</i>
            </button>
          </Fragment>
        ))}
      </nav>
      <div className="pn-main">
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
          {/* (hareket dili) nothing saved yet: the mascot waits; a filter or search that finds nothing: it looks puzzled */}
          {state !== "plan" && state !== "open" && <Mascot size={48} state={entries.length ? "oops" : "sleepy"} className="empty-mascot" />}
          {state === "plan"
            ? L("Bu süzgeçte plana konmuş bir şey yok.", "Nothing here is on the plan yet.")
            : state === "open"
              ? L("Burada karar bekleyen yok; hepsi planda.", "Nothing here waits for a decision.")
              : entries.length
                ? L("Burada kayıt yok.", "Nothing saved here.")
                : L("Henüz kayıt yok. Eklentiyle bir sayfa kaydet ya da sohbette bir link bırak; hepsi burada birikir.", "Nothing saved yet. Save a page with the extension or drop a link in the chat; it all gathers here.")}
        </p>
      ) : cat === "liked" ? (
        <div className="pn-grid" data-pit-children="">{shown.map((e) => card(e, true, entries.filter((x) => x.group === e.group)))}</div>
      ) : (
        panoRows(shown, cat, entries).map(rowView)
      )}
      </div>
      </div>
    </section>
  );
}

/** The left menu's mark for a tab: the Plan's own drawing for its kind, in its colour (Tümü: the board, Beğenilenler: the heart). */
function CatIcon({ cat }: { cat: PanoCat }) {
  if (cat === "all") return <UiIcon name="board" size={17} />;
  if (cat === "liked") return <span className="pn-ci liked"><UiIcon name="heart" size={17} /></span>;
  const kind = cat === "inspo" ? "inspo" : cat === "other" ? "insurance" : cat;
  return (
    <span className="pn-ci" style={{ color: kind === "inspo" ? "#c2255c" : cardKindColor(kind) }}>
      <KindIcon kind={kind} size={17} />
    </span>
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
  const myName = useMyName();
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
                <small>{savedByText(e.item, myName || null)}</small>
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
                  e.inPlan === "booked" ? <BookedBadge as={bookedAs(e.item)} small /> : <span className="pn-tin">✓ {L("Planda", "On the plan")}</span>
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

/** The card's picture when the page gave none: the drawing for its kind (a flight is drawn as its own small card, not a picture). */
function PanoArt({ kind }: { kind: ReturnType<typeof cardKind> }) {
  const art = illusOf(kind);
  return art ? (
    <span className="pn-art pn-illus">
      <img src={`illus/${art}.png`} alt="" />
    </span>
  ) : (
    <span className="pn-art">
      <KindIcon kind={kind} size={56} />
    </span>
  );
}

/** The site's mark before the meta line: its letter on its colour (Booking's B., Airbnb's A). */
function BrandMark({ label }: { label: string }) {
  const key = label.toLocaleLowerCase("en").replace(/\.com$/, "").replace(/[^a-z]/g, "");
  const brand = (BRANDS as Record<string, { color: string; letter: string; name: string } | undefined>)[key];
  return (
    <span className="pn-bm" style={{ background: brand?.color ?? "#475467" }} title={label}>
      {brand?.letter ?? label.charAt(0).toLocaleUpperCase("tr")}
    </span>
  );
}

export const groupDomId = (group: string) => `pn-g-${group.replace(/[^\w-]/g, "_")}`;

function PanoCard({ entry, fresh, showNeed, siblings, decisions, onShow, onCompare }: {
  entry: PanoEntry;
  fresh: boolean;
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
  const people = tripPeople(decisions?.ctx);
  const going = item.guests.adults ?? people;
  const fare = kind === "flight" ? ticketPrices(item, facts.price, people) : null;
  const share = useShare();
  const likers = likersOf(item);
  const liked = likers.some((n) => sameName(n, me) || (share?.me ? sameName(n, share.me) : false));
  // Shared: the heart is my "Süper" vote (2), seen on both computers; my own like is kept in step.
  const voteKey = share?.me ? voteKeyOf(item) : null;
  const heart = () => {
    if (voteKey && share) share.vote(item, liked ? 0 : 2);
    const mineLocal = (item.likedBy ?? []).some((n) => sameName(n, me));
    if (!voteKey || mineLocal === liked) void toggleLike(item, me);
  };
  // Önerim: first in its need's comparison; En ucuz: the lowest price among two or more.
  const best = siblings.length > 1 && decision?.winner?.item.id === item.id;
  const prices = siblings.map((s) => s.item.price.amount).filter((p): p is number => p != null && p > 0);
  const cheapest = !best && siblings.length > 1 && item.price.amount != null && item.price.amount === Math.min(...prices);
  const meta = [item.provider, item.location.area ?? item.city, item.rating.value != null ? String(item.rating.value).replace(".", ",") : null].filter(Boolean).join(" · ");
  const [why, setWhy] = useState(false);
  // F2: a flight is the small flight card under a one-line strip: where it stands, its first plus (else its first minus), its score.
  const flight = kind === "flight";
  const strip = flight ? (
    <div className="pn-strip-l">
      {entry.inPlan === "booked" ? (
        <BookedBadge as="ticket" small />
      ) : entry.inPlan ? (
        <span className="pn-tag on"><UiIcon name="check" size={11} />{L("Planda", "On the plan")}</span>
      ) : entry.draft ? (
        <span className="pn-tag ai"><span aria-hidden>✨ </span>{L("Önerimiz · kartta", "Our pick · on the card")}</span>
      ) : best || cheapest ? (
        <span className={`pn-tag${best ? " ai" : ""}`}>{best ? <span aria-hidden>✨ </span> : null}{best ? L("Önerim", "My pick") : L("En ucuz", "Cheapest")}</span>
      ) : null}
      {facts.pros[0] ? <span className="pn-why1">{facts.pros[0].text}</span> : facts.cons[0] ? <span className="pn-why1 minus">{facts.cons[0].text}</span> : null}
    </div>
  ) : null;
  const action = entry.inPlan || entry.draft ? (
    <button type="button" className={`pn-goplan ${entry.inPlan ?? "draft"}`} onClick={() => onShow(item.id)}>
      {L("Plan'da gör", "See on the plan")} →
    </button>
  ) : (
    <button type="button" className="pn-put" onClick={() => void chooseItem(item, siblings.map((s) => s.item))}>
      + {L("Plana koy", "Add to plan")}
    </button>
  );
  const likeHeart = (
    <button type="button" className={`pn-heart${liked ? " on" : ""}`} aria-pressed={liked} aria-label={liked ? L(`${item.name}: beğeniyi geri al`, `${item.name}: unlike`) : L(`${item.name}: beğen`, `${item.name}: like`)}
      onClick={heart}>
      <UiIcon name="heart" size={16} />
    </button>
  );
  return (
    <article className={`pn-card${flight ? " pn-flt" : ""}${entry.inPlan ? ` in-${entry.inPlan}` : ""}${entry.draft ? " in-draft" : ""}${fresh ? " ar-new" : ""}`} id={`pn-${item.id}`} aria-label={item.name} style={{ "--c": cardKindColor(kind) } as React.CSSProperties}>
      {flight ? (
        <>
          {strip}
          <FlightOption
            className="pn-fo"
            flightNo={item.flight?.flightNumber}
            name={<span title={item.name}>{item.name}</span>}
            leg={flightLeg(item)}
            fare={ticketStub({ look: "chosen", item, prices: fare, fallback: facts.price ? { text: facts.price.text, label: facts.price.label ?? null } : null, people, today: decisions?.ctx.today ?? "" })}
            action={action}
            aside={
              <>
                {entry.score != null && (
                  <span className="pn-fscore num" title={L("Tercihlerinize uyum (100 üzerinden)", "Fit with your preferences (out of 100)")}>
                    <b>{Math.round(entry.score)}</b> {L("uyum", "fit")}
                  </span>
                )}
                {likeHeart}
              </>
            }
            extras={showNeed ? <span className="pn-need"><KindIcon kind={kind} size={13} />{needTitleOf(item)}</span> : null}
          />
        </>
      ) : (
        <>
      <div className="pn-img">
        <FallbackImg src={item.imageUrl} className="pn-photo" fallback={<PanoArt kind={kind} />} />
        {(best || cheapest) && <span className="pn-badge">{best ? L("Önerim", "My pick") : L("En ucuz", "Cheapest")}</span>}
        {likeHeart}
        {entry.score != null && (
          <span className="pn-score" title={L("Tercihlerinize uyum (100 üzerinden)", "Fit with your preferences (out of 100)")}>
            {Math.round(entry.score)}
            <small>{L("uyum", "fit")}</small>
          </span>
        )}
        {entry.inPlan === "booked" ? (
          <span className="pn-rib"><BookedBadge as={bookedAs(entry.item)} small /></span>
        ) : entry.inPlan ? (
          <span className="pn-rib chosen">
            <UiIcon name="check" size={12} />
            {L("Planda", "On the plan")}
          </span>
        ) : (
          entry.draft && (
            <span className="pn-rib draft">
              <span aria-hidden>✨</span>
              {L("Önerimiz · kartta", "Our pick · on the card")}
            </span>
          )
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
        {(meta || facts.source) && (
          <p className="pn-meta">
            {facts.source && <BrandMark label={facts.source.label} />}
            {meta}
          </p>
        )}
      </div>
      <div className="pn-act">
        <span className="pn-price">
          {fare?.each ? (
            // A flight for several: what one pays, large; how many go and the whole sum, small (from the record's count or the trip's, never a fixed two).
            <>
              <b>{fare.each}</b>
              <span className="pn-pl">{L("kişi başı", "per person")}</span>
              <span className="pn-pl">{L(`${going} kişi · ${fare.total}`, `${going} people · ${fare.total}`)}</span>
            </>
          ) : facts.price ? (
            <>
              <b>{facts.price.text}</b>
              {facts.price.label ? <span className="pn-pl">{facts.price.label}</span> : null}
            </>
          ) : null}
        </span>
        {action}
      </div>
        </>
      )}
      <div className="pn-ft">
        <span className={`pn-who${adderOf(item) === "ai" ? " ai" : ""}`}>
          <SavedFace item={item} />
          {savedByText(item, myName || null)}
          {fresh && <b className="pn-new">{L("Yeni", "New")}</b>}
        </span>
        {likers.length > 0 && (
          <span className="pn-likes" title={L(`${likers.map((n) => (n === "me" ? "Sen" : n)).join(", ")} beğendi`, `Liked by ${likers.join(", ")}`)}>
            <UiIcon name="heart" size={12} />
            {likers.map((n) => (
              <WhoAvatar key={n} name={n === "me" ? L("Ben", "Me") : n} photo={photoOf(n)} />
            ))}
          </span>
        )}
        {(facts.pros.length > 0 || facts.cons.length > 0) && (
          <button type="button" className="pn-why" aria-expanded={why} onClick={() => setWhy(!why)}>
            {L("Neden?", "Why?")} <span className="pn-chev" aria-hidden>▾</span>
          </button>
        )}
      </div>
      <div className={`pn-detail${why ? " open" : ""}`} aria-hidden={!why} inert={!why}>
        <div>
          <ul className="pn-whylist">
            {facts.pros.slice(0, 3).map((p) => (
              <li key={`+${p.text}`} className="pro">+ {p.text}</li>
            ))}
            {facts.cons.slice(0, 2).map((c) => (
              <li key={`-${c.text}`} className="con">− {c.text}</li>
            ))}
            {siblings.length > 1 && (
              <li className="cmp">
                <button type="button" onClick={() => onCompare(entry.group)}>{L("Karşılaştır →", "Compare →")}</button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </article>
  );
}
