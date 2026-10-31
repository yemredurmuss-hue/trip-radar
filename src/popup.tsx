// Toolbar popup, tek Kaydet (docs/superpowers/specs/2026-10-29-eklenti-tek-kaydet-design.md, v2 + v3, Emre onayladı
// 2026-10-30; Kaydet penceresi v5, docs/mockups/eklenti-tek-kaydet-v5, 2026-10-31): one layout whatever the page. On top
// a small card of what is saved: its own picture and title (cleaned of the tab's noise, two lines at most), its site and
// kind; a result's "+" or a link right-clicked opens it too, their own card then (lib/popupAsk.ts). Under it the trips
// (cover with Pano's count in its corner, the name with its date small under it, how ready, one button) and "Yeni gezi",
// opened in place to name it. At the bottom at most one second thing ("Sonuçlara + koy", or "AI bağlı değil"). Each
// press means one thing: a row selects that trip, "Kaydet" (or Enter) saves there, the count opens the trip, Esc closes.
// Nothing is saved by opening it; reading and saving happen in the service worker (lib/popupWorker.ts).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { openBoard } from "./lib/browser";
import { L, lang, loadLang } from "./lib/i18n";
import { COMPANION_SITES, companionName, type TripPick } from "./lib/companion";
import type { PopupAsk, PopupView } from "./lib/popupWorker";
import type { Ready, ShelfTrip } from "./lib/tripShelf";
import { splitTripName } from "./lib/saveLabels";
import { reloadIfStale } from "./lib/update";

const ask = <T,>(m: PopupAsk): Promise<T | null> =>
  new Promise((done) => {
    try {
      chrome.runtime.sendMessage(m, (r: T | null) => done(chrome.runtime.lastError ? null : (r ?? null)));
    } catch {
      done(null);
    }
  });

type Saved = { captureId: string; tripId: string | null; tripTitle: string | null; deck: string };
/** Shown at first: the selected trip and two more; "Tümü (N)" opens the rest in place, a search box from six on. */
const FIRST = 3;
const SEARCH_FROM = 6;

function Popup() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [view, setView] = useState<PopupView | null>(null);
  // (the row being saved to, or "new" for a new trip)
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  // ("Çıkar" pressed on the page's card: its row is a plain row again, "Kaydet" saves it anew)
  const [taken, setTaken] = useState(false);
  const [plusDone, setPlusDone] = useState(false);
  // ("Yeni gezi" opened in place: the name being typed)
  const [newName, setNewName] = useState<string | null>(null);
  const held = useRef(false);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id == null) return setView({ kind: "none" } as PopupView);
      setTabId(tab.id);
      // (closed without saving what a "+" or a right-click asked: the page's "+" turns back; lib/popupAsk.ts)
      try {
        chrome.runtime.connect({ name: `popup:${tab.id}` });
      } catch {
        // (no service worker to tell: nothing waits)
      }
      setView((await ask<PopupView>({ type: "popup:view", tabId: tab.id })) ?? ({ kind: "none" } as PopupView));
    });
  }, []);

  const where = view?.where ?? null;
  const page = view?.kind === "page";
  // (what a result's "+" or a right-clicked link asked to save: shown and saved instead of the page)
  const asked = page ? (view?.ask ?? null) : null;
  const confirm = page && !asked ? (view?.confirm ?? null) : null;
  // (a booking's confirmation, or an address that looks like one, is never an idea for İlham)
  const booking = Boolean(confirm || (page && !asked && view?.confirmUrl));
  const idea = view?.what === "idea" && !booking;
  const planned = asked ? null : (view?.desk.planned ?? null);
  const fixed = Boolean(planned || view?.desk.candidate);
  const trips = view?.shelf?.trips ?? [];
  // Which trip is selected: a plan row the page belongs to, else the country's remembered trip, else the current one
  // (whereFor); where nothing can be saved, the shelf's first when it is the selected one.
  const selectedId = page ? ((fixed ? view?.pocket?.trip?.id : where?.trip?.id) ?? null) : view?.shelf?.selected ? (trips[0]?.id ?? null) : null;
  // (a page that looks like another trip: that trip right under the selected one, never saved there quietly)
  const like = page && !fixed ? (where?.picks.find((id) => id !== selectedId && where.trips.find((t) => t.id === id)?.match) ?? null) : null;
  const ordered = orderTrips(trips, selectedId, like, fixed ? view?.pocket?.trip ?? null : null);
  const fold = (x: string) => x.toLocaleLowerCase(lang() === "tr" ? "tr" : "en");
  // (v6: the selected trip in its own box on top, the others under "Başka gezi"; "Tümü" scrolls them in place)
  const top = selectedId ? (ordered.find((t) => t.id === selectedId) ?? null) : null;
  const others = ordered.filter((t) => t !== top);
  const list = fixed ? [] : all ? others.filter((t) => !q || fold(t.title).includes(fold(q))) : others.slice(0, top ? FIRST - 1 : FIRST);
  if (saved?.tripId && saved.tripId !== top?.id && !list.some((t) => t.id === saved.tripId)) {
    const t = ordered.find((x) => x.id === saved.tripId);
    if (t) list.push(t);
  }
  const here = view?.here && !taken && !asked ? view.here : null;
  const close = () => window.close();
  const boardOf = (id: string | null | undefined) => void openBoard(id ? `#trip=${encodeURIComponent(id)}` : "").then(close);

  async function save(tripId: string | "new", title?: string) {
    if (tabId == null || busy) return;
    // (opened by itself over a confirmation: this site may not be read yet; Chrome asks once, here, on this press)
    if (view?.access) {
      const granted = await chrome.permissions.request({ origins: [view.access] }).catch(() => false);
      if (!granted) return;
    }
    setBusy(tripId);
    setFailed(false);
    const pick: TripPick = fixed ? {} : tripId === "new" ? { newTrip: true, remember: true, title: title?.trim() || undefined } : { tripId, remember: Boolean(where?.country) };
    const r = await ask<Saved>({ type: "popup:save", tabId, pick, idea, ask: Boolean(asked) });
    setBusy(null);
    if (!r) return setFailed(true);
    setTaken(false);
    setNewName(null);
    setSaved(r);
  }
  /** "Kaydet" on another trip once saved: the save goes there (the same record, its reading too). */
  async function move(tripId: string) {
    if (!saved || busy) return;
    setBusy(tripId);
    const r = await ask<{ tripId: string; tripTitle: string | null }>({ type: "popup:move", captureId: saved.captureId, pick: { tripId } });
    setBusy(null);
    if (r) setSaved({ ...saved, tripId: r.tripId, tripTitle: r.tripTitle });
  }
  /** A row: that trip is the one this page and the next go to; nothing is saved. */
  async function select(tripId: string) {
    // (the selected trip pressed again: its Pano opens, as its count once did)
    if (tripId === selectedId) return boardOf(tripId);
    if (tabId == null || fixed || busy) return;
    const v = await ask<PopupView>({ type: "popup:current", tabId, tripId, remember: Boolean(page && where?.country) });
    if (v) setView(v);
  }
  // "Sonuçlara + koy": one permission (the travel sites, or this site), then the "+" on this page's results.
  async function plusOnResults() {
    if (tabId == null || !view?.site) return;
    void ask({ type: "popup:along-asked" });
    const granted = await chrome.permissions.request({ origins: view.travelSite ? [...COMPANION_SITES] : [view.site] }).catch(() => false);
    if (granted) await chrome.scripting.executeScript({ target: { tabId }, files: ["companion.js"] }).catch(() => undefined);
    setPlusDone(true);
  }

  // Saved: it closes itself after a moment, unless the mouse is over it (to undo, or to move it).
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => !held.current && close(), 2000);
    return () => clearTimeout(t);
  }, [saved]);
  // Enter saves to the selected trip; Escape closes.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && newName != null) return setNewName(null);
      if (e.key === "Escape") return close();
      if (e.key !== "Enter" || !page || !selectedId || saved || busy || (e.target as HTMLElement | null)?.closest?.("button, input")) return;
      e.preventDefault();
      void save(selectedId);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  const mark = booking ? "ticket" : planned ? "plane" : null;
  const showPlus = Boolean(page && !asked && view?.site && !view.along && !plusDone && (view.what === "list" || (view.travelSite && !view.alongAsked)));

  const row = (t: ShelfTrip) => (
    <TripRow
      key={t.id}
      trip={t}
      selected={t.id === selectedId}
      page={page}
      mark={mark}
      busy={busy === t.id}
      locked={busy != null}
      savedHere={saved?.tripId === t.id}
      afterSave={Boolean(saved)}
      here={here?.tripId === t.id ? here : null}
      onSelect={() => void select(t.id)}
      onSave={() => void (saved ? move(t.id) : save(t.id))}
      onUndo={() => void ask({ type: "popup:undo", captureId: saved!.captureId }).then(close)}
      onRemove={() => void ask({ type: "popup:remove", id: `i:${here!.itemId}` }).then((ok) => ok && setTaken(true))}
    />
  );

  let body: ReactNode;
  if (!view) {
    body = (
      <div className="tk-skel" role="status" aria-label={L("Hazırlanıyor", "Getting ready")}>
        <div className="tk-it">
          <span className="tk-pic">
            <Sketch />
          </span>
          <span className="tk-bars">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="tk-trips">
          {[0, 1, 2].map((n) => (
            <div key={n} className="tk-row">
              <span className="tk-sk-th" />
              <span className="tk-bars">
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (!trips.length && !page) {
    body = (
      <div className="tb-main tb-empty">
        <img src="illus/ucus.png" alt="" width={132} />
        <div className="tb-say">
          <b>{L("İlk gezini başlat", "Start your first trip")}</b>
          <span>{L("Nereye gitmek istediğini yaz; otel, uçuş ve tur sayfalarında simgeye basınca onları da buraya kaydederim.", "Say where you'd like to go; on a hotel, flight or tour page, press the icon and I'll save it here too.")}</span>
        </div>
        <button type="button" className="tb-go" onClick={() => void openBoard("#home").then(close)}>
          {L("+ Yeni gezi", "+ New trip")}
        </button>
      </div>
    );
  } else {
    body = (
      <>
        {page && (
          <Preview
            photo={asked ? asked.photo : view.photo}
            // (a result on this page: the site's own icon; a flight's, the plane; a link to elsewhere: its site's letter)
            favicon={asked?.kind === "link" ? null : view.favicon}
            plane={Boolean(asked?.flight)}
            letter={((asked?.kind === "link" ? asked.sub : null) || companionName(view.site ?? "") || view.sub || view.title).trim().slice(0, 1).toLocaleUpperCase("tr")}
            title={asked ? asked.title : view.title}
            sub={asked ? asked.sub : view.sub}
            mark={mark}
            savedTo={saved ? (saved.tripTitle ?? "") : null}
          >
            {mark && <span className="tk-sr">{mark === "ticket" ? [L("Rezervasyon onayı", "Booking confirmation"), confirm?.code].filter(Boolean).join(" · ") : L("Planındaki uçuşun araması", "A search for your planned flight")}</span>}
          </Preview>
        )}
        {page && typeof navigator !== "undefined" && navigator.onLine === false && (
          <p className="tk-off">
            <Icon name="offline" />
            {L("İnternet yok. Kaydederim, bağlanınca okunur.", "No internet. I'll save it; it's read once you're back online.")}
          </p>
        )}
        {page && view.desk.candidate && tabId != null && (
          <div className="tk-pad">
            <DeskBox tabId={tabId} c={view.desk.candidate} />
          </div>
        )}
        {view.failed && (
          <div className="tk-warn" role="alert">
            <span>{L(`${view.failed.title} okunamadı`, `Couldn't read ${view.failed.title}`)}</span>
            <IconButton name="retry" label={L("Tekrar dene", "Try again")} onClick={() => void ask({ type: "popup:retry", id: view.failed!.id }).then(close)} />
          </div>
        )}
        <div className={`tk-trips${page && !selectedId && !fixed ? " ask" : ""}`} onMouseEnter={() => (held.current = true)}>
          {page && !selectedId && !fixed && !saved && trips.length > 0 && <small className="tk-ask">{L("Hangi geziye?", "Which trip?")}</small>}
          {top && row(top)}
          {top && !fixed && (list.length > 0 || all) && <small className="tk-ask">{L("Başka gezi", "Another trip")}</small>}
          {all && others.length >= SEARCH_FROM && (
            <input className="tk-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Gezi ara", "Find a trip")} aria-label={L("Gezi ara", "Find a trip")} autoFocus />
          )}
          <div className={all ? "tk-scroll" : "tk-list"}>
            {list.map(row)}
            {!fixed && !saved && (
              <NewTrip
                open={newName != null}
                value={newName ?? ""}
                busy={busy === "new"}
                locked={busy != null}
                onOpen={() => (page ? setNewName(where?.country ?? "") : void openBoard("#home").then(close))}
                onChange={setNewName}
                onCancel={() => setNewName(null)}
                onCreate={() => void save("new", newName ?? "")}
              />
            )}
          </div>
          {page && !trips.length && <p className="tk-none">{L("Henüz gezin yok: bu sayfayla birini başlat.", "No trip yet: start one with this page.")}</p>}
          {failed && (
            <p className="tk-err" role="alert">
              {L("Sayfa okunamadı; bir daha dene ya da sağ tık \"Trip Radar'a kaydet\".", "Couldn't read the page; try again, or right-click \"Save to Trip Radar\".")}
            </p>
          )}
        </div>
        {!fixed && ordered.length > FIRST && (
          <div className={`tk-foot${all ? " open" : ""}`}>
            <button type="button" className="btn-link" aria-expanded={all} onClick={() => (setAll(!all), setQ(""))}>
              {all ? L("Daha az", "Fewer") : L(`Tümü (${ordered.length})`, `All (${ordered.length})`)}
            </button>
            {all && <small>{L(`${ordered.length} gezi`, `${ordered.length} trips`)}</small>}
          </div>
        )}
        {!view.key ? (
          <div className="tk-alt warn">
            <span>{L("AI bağlı değil · kayıtlar bekler", "AI not connected · saves wait")}</span>
            <button type="button" className="btn-link" onClick={() => void openBoard("#settings").then(close)}>
              {L("Bağla", "Connect")}
            </button>
          </div>
        ) : showPlus ? (
          <div className="tk-alt">
            <span>{L("Sonuçlara + koy", "Put a + on the results")}</span>
            <button type="button" className="tk-sw" role="switch" aria-checked={false} aria-label={L("Sonuçlara + koy", "Put a + on the results")} onClick={() => void plusOnResults()} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="popup-card tb tk" onMouseEnter={() => saved && (held.current = true)}>
      <div className="tb-app">
        <button type="button" className="tb-brand" onClick={() => boardOf(selectedId)} aria-label={L("Trip Radar'ı aç", "Open Trip Radar")}>
          <img src="icons/icon-32.png" alt="" width={18} height={18} />
          Trip Radar
        </button>
        <IconButton name="ext" label={L("Uygulamayı aç", "Open the app")} onClick={() => boardOf(selectedId)} />
        <IconButton name="x" label={L("Kapat", "Close")} onClick={close} />
      </div>
      {body}
    </div>
  );
}

/** The selected trip first, then the one the page looks like, then the others as the shelf has them (by their dates). */
export function orderTrips(trips: readonly ShelfTrip[], selectedId: string | null, like: string | null, fixedTrip: { id: string; title: string; photo: string | null } | null): ShelfTrip[] {
  const out = [...trips];
  if (fixedTrip && !out.some((t) => t.id === fixedTrip.id)) out.unshift({ id: fixedTrip.id, title: fixedTrip.title, photo: fixedTrip.photo, art: "illus/ucus.png", when: null, countdown: null, ready: null, mine: 0 });
  const rank = (t: ShelfTrip) => (t.id === selectedId ? 0 : t.id === like ? 1 : 2);
  return out.map((t, n) => ({ t, n })).sort((a, b) => rank(a.t) - rank(b.t) || a.n - b.n).map((x) => x.t);
}

/** One trip: cover, name, its date and Pano's count (a press selects it; the selected one's opens its Pano), how ready, its one button. */
function TripRow(p: {
  trip: ShelfTrip;
  selected: boolean;
  page: boolean;
  mark: "ticket" | "plane" | null;
  busy: boolean;
  locked: boolean;
  savedHere: boolean;
  afterSave: boolean;
  here: { removable: boolean } | null;
  onSelect: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRemove: () => void;
}) {
  const t = p.trip;
  const count = t.mine + (p.savedHere ? 1 : 0);
  let end: ReactNode = null;
  if (p.page && p.savedHere) {
    end = (
      <>
        <span className="tk-state" role="status">
          <Icon name="check" />
          {L("Kaydedildi", "Saved")}
        </span>
        <IconButton name="undo" label={L("Geri al", "Undo")} onClick={p.onUndo} />
      </>
    );
  } else if (p.page && p.here && !p.afterSave) {
    end = (
      <>
        <span className="tk-in" role="img" aria-label={L("Bu sayfa bu gezide", "This page is in this trip")}>
          <Icon name="check" />
        </span>
        <span className="tk-more">
          <IconButton name="retry" label={L("Fiyatı yenile", "Refresh the price")} onClick={p.onSave} disabled={p.locked} />
          {p.here.removable && <IconButton name="trash" label={L("Çıkar", "Remove")} onClick={p.onRemove} disabled={p.locked} />}
        </span>
      </>
    );
  } else if (p.page) {
    end = (
      <button type="button" className={`tk-save${p.selected ? "" : " ghost"}${p.mark === "ticket" ? " ok" : ""}`} disabled={p.locked} onClick={p.onSave} title={p.mark === "ticket" ? L("Rezervasyon olarak kaydet", "Save as a booking") : p.afterSave ? L("Kaydı buraya taşı", "Move the save here") : undefined}>
        {p.busy ? "···" : (
          <>
            {p.mark && <Icon name={p.mark} />}
            {L("Kaydet", "Save")}
          </>
        )}
      </button>
    );
  }
  // (a date written into the name goes under it, small: "Patagonya Gezisi · Şubat 2027"; the trip's own dates first)
  const label = splitTripName(t.title);
  const date = t.when ?? label.date;
  // (Pano's count in words beside the date: "Şub 2027 · 7 kayıt"; never a badge, never beside the ring's number)
  const sub = [date, count > 0 ? L(`${count} kayıt`, `${count} saved`) : null].filter(Boolean).join(" · ");
  return (
    <div className={`tk-row${p.selected ? " sel" : ""}${p.savedHere ? " saved" : ""}`}>
      <button type="button" className="tk-pick" onClick={p.onSelect} aria-pressed={p.selected} aria-label={p.selected ? L(`${t.title}, seçili gezi: Pano'yu aç`, `${t.title}, the selected trip: open its board`) : L(`${t.title} gezisini seç`, `Select ${t.title}`)}>
        <span className="pk-th tk-th" aria-hidden>
          {t.photo ? <Photo src={t.photo} title={t.title} /> : <img className="tk-art" src={t.art} alt="" />}
        </span>
        <span className="tk-nm">
          <b>{label.name}</b>
          {sub && <small>{sub}</small>}
        </span>
      </button>
      {/* (saved: the row says so in words, the name keeps its room) */}
      {p.savedHere ? null : t.ready && !t.ready.fresh ? <Ring ready={t.ready} /> : <span className="tk-ring-gap" />}
      {end && <span className="tk-end">{end}</span>}
    </div>
  );
}

function Photo({ src, title }: { src: string; title: string }) {
  const [gone, setGone] = useState(false);
  return gone ? <i>{title.slice(0, 1).toLocaleUpperCase("tr")}</i> : <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setGone(true)} />;
}

/**
 * What is saved, on top: its own picture (the drawing stays under it, shimmering, until it has come; none: the site's
 * icon), its title in two lines at most (all of it on hover), its site and kind; saved, where it went.
 */
function Preview(p: { photo: string | null; favicon: string | null; plane?: boolean; letter: string; title: string; sub: string; mark: "ticket" | "plane" | null; savedTo: string | null; children?: ReactNode }) {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const photo = p.photo && !gone ? p.photo : null;
  return (
    <div className={`tk-it${p.savedTo != null ? " ok" : ""}`}>
      <span className={`tk-pic${photo && !shown ? " wait" : ""}${photo ? "" : " plain"}`} aria-hidden>
        {photo ? (
          <>
            <Sketch />
            <img src={photo} alt="" decoding="async" referrerPolicy="no-referrer" className={shown ? "in" : ""} onLoad={() => setShown(true)} onError={() => setGone(true)} />
          </>
        ) : p.plane ? (
          <span className="tk-kind">
            <Icon name="plane" />
          </span>
        ) : p.favicon ? (
          <img className="tk-fv" src={p.favicon} alt="" width={22} height={22} />
        ) : (
          <i>{p.letter}</i>
        )}
        {p.savedTo != null && (
          <span className="tk-done">
            <Icon name="check" />
          </span>
        )}
        {p.mark && p.savedTo == null && (
          <em className={p.mark === "ticket" ? "ok" : "acc"}>
            <Icon name={p.mark} />
          </em>
        )}
      </span>
      <span className="tk-ix">
        <b title={p.title}>{p.title}</b>
        <small>
          {p.savedTo != null ? (
            <em>
              <Icon name="check" />
              {p.savedTo ? L(`Kaydedildi · ${p.savedTo}`, `Saved · ${p.savedTo}`) : L("Kaydedildi", "Saved")}
            </em>
          ) : (
            p.sub
          )}
        </small>
      </span>
      {p.children}
    </div>
  );
}

/** The drawing that stands in for a picture not come yet (a slow page, no internet): hills, a sun, a plane. */
function Sketch() {
  return (
    <svg className="tk-sketch" viewBox="0 0 88 58" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="88" height="58" fill="#efecf7" />
      <circle cx="58" cy="14" r="6" fill="#f8f6fd" />
      <path d="M0 45 16 28l10 7 14-20 11 14 12-9 25 18v20H0z" fill="#d9d3ee" />
      <path d="M0 52 22 40l14 6 18-9 34 13v8H0z" fill="#cdc6e6" />
      <path d="m14 13 9 2 5-4 1.5 1-3 4.5 5 1.5-1 1.5-5.5-.5-3 4-1.5-.5 1-4.5-7.5-3.5z" fill="#b3aad8" />
    </svg>
  );
}

/** "Yeni gezi", the list's last row: opened in place to name it (the page's country offered), then made and saved there. */
function NewTrip(p: { open: boolean; value: string; busy: boolean; locked: boolean; onOpen: () => void; onChange: (v: string) => void; onCancel: () => void; onCreate: () => void }) {
  if (!p.open) {
    return (
      <div className="tk-row tk-new">
        <button type="button" className="tk-pick" onClick={p.onOpen} disabled={p.locked}>
          <span className="tk-th tk-plus" aria-hidden>
            <Icon name="plus" />
          </span>
          <span className="tk-nm">
            <b>{L("Yeni gezi", "New trip")}</b>
          </span>
        </button>
      </div>
    );
  }
  return (
    <div className="tk-row tk-new open">
      <span className="tk-th tk-plus" aria-hidden>
        <Icon name="plus" />
      </span>
      <form
        className="tk-nf"
        onSubmit={(e) => {
          e.preventDefault();
          if (!p.locked) p.onCreate();
        }}
      >
        <input className="tk-name" value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={L("Gezinin adı", "The trip's name")} aria-label={L("Gezinin adı", "The trip's name")} maxLength={60} autoFocus />
        <span className="tk-nf-row">
          <button type="button" className="btn-link" onClick={p.onCancel}>
            {L("Vazgeç", "Cancel")}
          </button>
          <button type="submit" className="tk-save" disabled={p.locked}>
            {p.busy ? "···" : (
              <>
                <Icon name="plus" />
                {L("Oluştur ve kaydet", "Create and save")}
              </>
            )}
          </button>
        </span>
      </form>
    </div>
  );
}

/** How ready, as the trip's page says it: booked dark green over planned light green, the share inside. */
function Ring({ ready }: { ready: Ready }) {
  const size = 32, stroke = 3.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const arc = (pct: number, cls: string) => (pct > 0 ? <circle className={cls} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} /> : null);
  return (
    <span className="ts-ring tk-ring" style={{ width: size, height: size }} role="img" aria-label={L(`%${ready.plan} hazır, %${ready.booked} alındı`, `${ready.plan}% ready, ${ready.booked}% booked`)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="tk" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {arc(ready.plan, "pl")}
        {arc(ready.booked, "bk")}
      </svg>
      <b>{ready.plan}</b>
    </span>
  );
}

type IconName = "check" | "undo" | "retry" | "ext" | "x" | "trash" | "ticket" | "plane" | "plus" | "offline";
const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5 10 17.5 19 7" strokeWidth="2.6" />,
  plus: <path d="M12 5v14M5 12h14" strokeWidth="2.6" />,
  offline: (
    <>
      <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" strokeWidth="2" />
      <path d="M4 3l16 18" strokeWidth="2" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  retry: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  ext: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeWidth="2" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" strokeWidth="2" />,
  ticket: (
    <>
      <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" strokeWidth="2" />
      <path d="M14 6v12" strokeWidth="2" strokeDasharray="2 2" />
    </>
  ),
  plane: <path d="M21 15.5 13.5 11V5.2a1.5 1.5 0 0 0-3 0V11L3 15.5v1.8l7.5-2.2v4l-2 1.4V22l3.5-1 3.5 1v-1.5l-2-1.4v-4l7.5 2.2z" fill="currentColor" stroke="none" />,
};

/** One line family for every sign (no typed characters); its name is said on hover and to a screen reader. */
function Icon({ name }: { name: IconName }) {
  return (
    <svg className="tk-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

function IconButton({ name, label, onClick, disabled = false }: { name: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="tk-ib" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon name={name} />
    </button>
  );
}

/** Benle gezen eklenti (seviye 1): on a candidate's tab, which one it is and the two things to do here. */
function DeskBox({ tabId, c }: { tabId: number; c: NonNullable<PopupView["desk"]["candidate"]> }) {
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="popup-desk">
      <small>{L(`Aday ${c.badge} · ${c.route}`, `Candidate ${c.badge} · ${c.route}`)}</small>
      <b>
        {c.name}
        {c.price ? ` · ${c.price}` : ""}
      </b>
      <span className="popup-held-actions">
        <button
          type="button"
          className="small-btn"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void ask<string>({ type: "popup:decide", tabId }).then((name) => {
              setBusy(false);
              setSaid(name ? L(`✓ Seçtin: ${name}. Satın alınca "Aldım" de.`, `✓ Chosen: ${name}. Say "Got it" once bought.`) : L("Bu aday artık planda değil.", "This candidate isn't on the plan any more."));
            });
          }}
        >
          {L("Buna karar ver", "Go with this one")}
        </button>
        <button type="button" className="small-btn" disabled={busy} onClick={() => void ask({ type: "popup:buy", tabId }).then(() => setSaid(L("Satın alınca bu sekmeyi kapat; plan \"Aldın mı?\" diye sorar.", "Once bought, close this tab; the plan asks \"Did you buy it?\".")))}>
          {L("Burada satın al", "Buy it here")}
        </button>
      </span>
      {said && <span className="popup-desk-said">{said}</span>}
    </div>
  );
}

// The language first, so the popup never flashes the wrong one. Files newer than the loaded extension
// (the updater just swapped them) reload it instead: the old version holds the database.
void Promise.all([loadLang(), reloadIfStale(null)]).then(([, updating]) => {
  document.documentElement.lang = lang();
  createRoot(document.getElementById("root")!).render(
    updating ? (
      <div className="popup-card">
        <div className="popup-title">Trip Radar</div>
        <p>{L("Güncelleniyor… Birkaç saniye sonra tekrar dene.", "Updating… Try again in a few seconds.")}</p>
      </div>
    ) : (
      <Popup />
    ),
  );
});
