// Toolbar popup, tek Kaydet (docs/superpowers/specs/2026-10-29-eklenti-tek-kaydet-design.md, v2 + v3, Emre onayladı
// 2026-10-30): one layout whatever the page. On top the page itself (its icon, its name; a corner mark says a booking's
// confirmation or a search for a planned flight), under it the trips (cover, name, Pano's count, how ready, one button),
// at the bottom at most one second thing ("Sonuçlara + koy", or "AI bağlı değil"). Each press means one thing: a row
// selects that trip, "Kaydet" (or Enter) saves the page there, the count opens the trip, Esc closes. Nothing is saved by
// opening it; reading and saving happen in the service worker (lib/popupWorker.ts): nothing heavy is loaded here.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { openBoard } from "./lib/browser";
import { L, lang, loadLang } from "./lib/i18n";
import { COMPANION_SITES, companionName, type TripPick } from "./lib/companion";
import type { PopupAsk, PopupView } from "./lib/popupWorker";
import type { Ready, ShelfTrip } from "./lib/tripShelf";
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
  const held = useRef(false);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id == null) return setView({ kind: "none" } as PopupView);
      setTabId(tab.id);
      setView((await ask<PopupView>({ type: "popup:view", tabId: tab.id })) ?? ({ kind: "none" } as PopupView));
    });
  }, []);

  const where = view?.where ?? null;
  const page = view?.kind === "page";
  const confirm = page ? (view?.confirm ?? null) : null;
  // (a booking's confirmation, or an address that looks like one, is never an idea for İlham)
  const booking = Boolean(confirm || (page && view?.confirmUrl));
  const idea = view?.what === "idea" && !booking;
  const planned = view?.desk.planned ?? null;
  const fixed = Boolean(planned || view?.desk.candidate);
  const trips = view?.shelf?.trips ?? [];
  // Which trip is selected: a plan row the page belongs to, else the country's remembered trip, else the current one
  // (whereFor); where nothing can be saved, the shelf's first when it is the selected one.
  const selectedId = page ? ((fixed ? view?.pocket?.trip?.id : where?.trip?.id) ?? null) : view?.shelf?.selected ? (trips[0]?.id ?? null) : null;
  // (a page that looks like another trip: that trip right under the selected one, never saved there quietly)
  const like = page && !fixed ? (where?.picks.find((id) => id !== selectedId && where.trips.find((t) => t.id === id)?.match) ?? null) : null;
  const ordered = orderTrips(trips, selectedId, like, fixed ? view?.pocket?.trip ?? null : null);
  const fold = (x: string) => x.toLocaleLowerCase(lang() === "tr" ? "tr" : "en");
  const list = fixed ? ordered.slice(0, 1) : all ? ordered.filter((t) => !q || fold(t.title).includes(fold(q))) : ordered.slice(0, FIRST);
  if (saved?.tripId && !list.some((t) => t.id === saved.tripId)) {
    const t = ordered.find((x) => x.id === saved.tripId);
    if (t) list.push(t);
  }
  const here = view?.here && !taken ? view.here : null;
  const close = () => window.close();
  const boardOf = (id: string | null | undefined) => void openBoard(id ? `#trip=${encodeURIComponent(id)}` : "").then(close);

  async function save(tripId: string | "new") {
    if (tabId == null || busy) return;
    // (opened by itself over a confirmation: this site may not be read yet; Chrome asks once, here, on this press)
    if (view?.access) {
      const granted = await chrome.permissions.request({ origins: [view.access] }).catch(() => false);
      if (!granted) return;
    }
    setBusy(tripId);
    setFailed(false);
    const pick: TripPick = fixed ? {} : tripId === "new" ? { newTrip: true, remember: true } : { tripId, remember: Boolean(where?.country) };
    const r = await ask<Saved>({ type: "popup:save", tabId, pick, idea });
    setBusy(null);
    if (!r) return setFailed(true);
    setTaken(false);
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
    if (tabId == null || fixed || busy || tripId === selectedId) return;
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
      if (e.key === "Escape") return close();
      if (e.key !== "Enter" || !page || !selectedId || saved || busy || (e.target as HTMLElement | null)?.closest?.("button, input")) return;
      e.preventDefault();
      void save(selectedId);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  const mark = booking ? "ticket" : planned ? "plane" : null;
  const showPlus = Boolean(page && view?.site && !view.along && !plusDone && (view.what === "list" || (view.travelSite && !view.alongAsked)));

  let body: ReactNode;
  if (!view) {
    body = (
      <div className="pk-skel tk-pad" aria-label={L("Hazırlanıyor", "Getting ready")}>
        <span />
        <span />
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
          <div className="tk-page">
            <span className="tk-fav" aria-hidden>
              {view.favicon ? <img src={view.favicon} alt="" width={18} height={18} /> : <i>{(companionName(view.site ?? "") || view.sub || view.title).trim().slice(0, 1).toLocaleUpperCase("tr")}</i>}
              {mark && (
                <em className={mark === "ticket" ? "ok" : "acc"}>
                  <Icon name={mark} />
                </em>
              )}
            </span>
            <b title={view.title}>{view.title}</b>
            {mark && <span className="tk-sr">{mark === "ticket" ? [L("Rezervasyon onayı", "Booking confirmation"), confirm?.code].filter(Boolean).join(" · ") : L("Planındaki uçuşun araması", "A search for your planned flight")}</span>}
          </div>
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
          {page && !selectedId && !fixed && trips.length > 0 && <small className="tk-ask">{L("Hangi geziye?", "Which trip?")}</small>}
          {all && ordered.length >= SEARCH_FROM && (
            <input className="tk-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Gezi ara", "Find a trip")} aria-label={L("Gezi ara", "Find a trip")} autoFocus />
          )}
          {list.map((t) => (
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
              onOpen={() => boardOf(t.id)}
              onSave={() => void (saved ? move(t.id) : save(t.id))}
              onUndo={() => void ask({ type: "popup:undo", captureId: saved!.captureId }).then(close)}
              onRemove={() => void ask({ type: "popup:remove", id: `i:${here!.itemId}` }).then((ok) => ok && setTaken(true))}
            />
          ))}
          {page && !trips.length && <p className="tk-none">{L("Henüz gezin yok: bu sayfayla birini başlat.", "No trip yet: start one with this page.")}</p>}
          {failed && (
            <p className="tk-err" role="alert">
              {L("Sayfa okunamadı; bir daha dene ya da sağ tık \"Trip Radar'a kaydet\".", "Couldn't read the page; try again, or right-click \"Save to Trip Radar\".")}
            </p>
          )}
        </div>
        <div className="tk-foot">
          {!fixed && ordered.length > FIRST ? (
            <button type="button" className="btn-link muted" aria-expanded={all} onClick={() => (setAll(!all), setQ(""))}>
              {all ? L("Daha az", "Fewer") : L(`Tümü (${ordered.length})`, `All (${ordered.length})`)}
            </button>
          ) : (
            <span />
          )}
          {!fixed && (
            <button type="button" className="btn-link" disabled={busy != null} onClick={() => (page ? void save("new") : void openBoard("#home").then(close))}>
              {busy === "new" ? L("Kaydediliyor…", "Saving…") : page && where?.country ? L(`+ Yeni gezi: ${where.country}`, `+ New trip: ${where.country}`) : L("+ Yeni gezi", "+ New trip")}
            </button>
          )}
        </div>
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

/** One trip: its cover and name (a press selects it), Pano's count (opens it), how ready, and the row's one button. */
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
  onOpen: () => void;
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
  return (
    <div className={`tk-row${p.selected ? " sel" : ""}${p.savedHere ? " saved" : ""}`}>
      <button type="button" className="tk-pick" onClick={p.onSelect} aria-pressed={p.selected} aria-label={p.selected ? L(`${t.title}, seçili gezi`, `${t.title}, the selected trip`) : L(`${t.title} gezisini seç`, `Select ${t.title}`)}>
        <span className="pk-th tk-th" aria-hidden>
          {t.photo ? <Photo src={t.photo} title={t.title} /> : <img className="tk-art" src={t.art} alt="" />}
        </span>
        <b>{t.title}</b>
      </button>
      <button type="button" className="tk-cnt" onClick={p.onOpen} aria-label={L(`Pano'yu aç: ${count} kayıt`, `Open the board: ${count} saved`)} title={L("Pano'yu aç", "Open the board")}>
        <Icon name="board" />
        {count}
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

type IconName = "check" | "undo" | "retry" | "ext" | "x" | "trash" | "ticket" | "plane" | "board";
const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5 10 17.5 19 7" strokeWidth="2.6" />,
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
  board: (
    <>
      <rect x="3.5" y="3.5" width="7" height="9" rx="2" strokeWidth="2" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="2" strokeWidth="2" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="2" strokeWidth="2" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="2" strokeWidth="2" />
    </>
  ),
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
