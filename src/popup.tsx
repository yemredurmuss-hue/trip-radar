// Toolbar popup, tek bakış (0.45.0, tuval "Benle gezen eklenti" 15–16, Emre onayladı): one card at a time, the one the
// moment asks for, picked in this order: what was just done (✓ Eklendi · Geri al), a booking's confirmation on the page,
// a save that couldn't be read a moment ago, which trip (the first time; a page that looks like another trip), the page
// itself (a place's own page, a list, an idea for İlham, already in the deck), else the trip's next thing to do. Each card:
// a picture or a sign, one sentence, one big button; under it one quiet line (Pano's "Biriktirdiklerim", "Panoyu aç").
// The trip is a small chip on top. Nothing is saved by opening it; reading and saving happen in the service worker
// (lib/popupWorker.ts): nothing heavy is loaded here.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { openBoard } from "./lib/browser";
import { L, lang, loadLang } from "./lib/i18n";
import { COMPANION_SITES, companionName, deckWord, siteKindOf, type CompanionWhere, type TripPick } from "./lib/companion";
import { clearPriceBadge, type PriceBadge } from "./lib/priceBadge";
import type { PopupAsk, PopupView } from "./lib/popupWorker";
import { reloadIfStale } from "./lib/update";

const ask = <T,>(m: PopupAsk): Promise<T | null> =>
  new Promise((done) => {
    try {
      chrome.runtime.sendMessage(m, (r: T | null) => done(chrome.runtime.lastError ? null : (r ?? null)));
    } catch {
      done(null);
    }
  });

type Trip = CompanionWhere["trips"][number];
type Saved = { captureId: string; tripId: string | null; tripTitle: string | null; deck: string };

/** "Seç" on the plan is a decision to make from here. */
const actWord = (act: string): string => (act === L("Seç", "Pick") ? L("Karar ver", "Decide") : act);

function Popup() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [view, setView] = useState<PopupView | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [failed, setFailed] = useState(false);
  // (put aside for this opening: "Bu değil" on a confirmation, "Bu sayfaya geç" past a failure, "Şimdilik yalnız bu sayfa")
  const [skip, setSkip] = useState<ReadonlySet<"confirm" | "failed" | "along">>(() => new Set());
  const skipIt = (k: "confirm" | "failed" | "along") => setSkip((s) => new Set(s).add(k));

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id == null) return setView({ kind: "none" } as PopupView);
      setTabId(tab.id);
      setView((await ask<PopupView>({ type: "popup:view", tabId: tab.id })) ?? ({ kind: "none" } as PopupView));
    });
  }, []);

  const where = view?.where ?? null;
  const page = view?.kind === "page";
  const idea = view?.what === "idea";
  const list = view?.what === "list";
  const deck = idea ? L("İlham", "Inspiration") : deckWord(list ? siteKindOf(view?.site ?? "") : view?.what === "page" ? "any" : ((view?.what as Parameters<typeof deckWord>[0]) ?? "any"));
  const fixed = Boolean(view?.desk.planned || view?.desk.candidate);
  const trip = view?.desk.planned ? { id: null, title: view.desk.planned.title } : (where?.trip ?? (page ? null : view?.pocket?.trip ? { id: view.pocket.trip.id, title: view.pocket.trip.title } : null));
  const mustPick = Boolean(page && !fixed && !where?.trip && where?.trips.length);
  const boardOf = (id: string | null | undefined) => void openBoard(id ? `#trip=${encodeURIComponent(id)}` : "").then(() => window.close());
  const tripId = (where?.trip?.id ?? view?.pocket?.trip?.id) || null;

  async function save(pick: TripPick = {}) {
    if (tabId == null || busy) return;
    setBusy(true);
    const r = await ask<Saved>({ type: "popup:save", tabId, pick, idea });
    setBusy(false);
    if (!r) return setFailed(true);
    setSaved(r);
  }
  /** The chip, or the first question: what this page and the next go to. */
  async function choose(pick: TripPick) {
    if (tabId == null) return;
    setBusy(true);
    const v = await ask<PopupView>({ type: "popup:current", tabId, ...pick });
    setBusy(false);
    setChoosing(false);
    if (v) setView(v);
  }
  // "Bu listeden seç": the results' "+" become ticks on the page (the switch asked first, when it's off).
  async function select() {
    if (tabId == null || !view?.site) return;
    if (!view.along) {
      const granted = await chrome.permissions.request({ origins: view.travelSite ? [...COMPANION_SITES] : [view.site] }).catch(() => false);
      if (!granted) return;
      await chrome.scripting.executeScript({ target: { tabId }, files: ["companion.js"] }).catch(() => undefined);
    }
    await chrome.tabs.sendMessage(tabId, { type: "desk:select" }).catch(() => undefined);
    window.close();
  }
  async function along() {
    if (tabId == null || !view?.site) return;
    void ask({ type: "popup:along-asked" });
    const granted = await chrome.permissions.request({ origins: [...COMPANION_SITES] }).catch(() => false);
    if (granted) await chrome.scripting.executeScript({ target: { tabId }, files: ["companion.js"] }).catch(() => undefined);
    skipIt("along");
  }

  // Enter does the card's one thing (the trip known); Escape closes.
  const card = view && !saved && !choosing ? cardKind(view, { mustPick, skip }) : null;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Enter" && card === "page" && !busy) {
        e.preventDefault();
        void save();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  const mine = view?.glance?.mine ?? null;
  // (the line under a card: Pano's count and the board; a card's own words when it has them; no key, said instead of the count)
  const quiet = (left?: ReactNode, right?: ReactNode) =>
    left === undefined && right === undefined && view && !view.key ? (
      <div className="tb-quiet warn">
        <span>{L("AI bağlı değil · kayıtlar bekler", "AI not connected · saves wait")}</span>
        <button type="button" className="btn-link" onClick={() => void openBoard("#settings").then(() => window.close())}>
          {L("Bağla", "Connect")}
        </button>
      </div>
    ) : (
      <div className="tb-quiet">
        {left ?? (mine != null ? <span>{L("Biriktirdiklerim", "Saved by us")} <b>{mine}</b></span> : <span />)}
        {right ?? (
          <button type="button" className="btn-link" onClick={() => boardOf(tripId)}>
            {L("Panoyu aç ↗", "Open the board ↗")}
          </button>
        )}
      </div>
    );

  let body: ReactNode = null;
  if (!view) {
    body = (
      <div className="pk-skel" aria-label={L("Hazırlanıyor", "Getting ready")}>
        <span />
        <span />
      </div>
    );
  } else if (saved) {
    body = <Done saved={saved} where={where} onSaved={setSaved} />;
  } else if (choosing && where) {
    body = <Picker where={where} busy={busy} onPick={(p) => void choose(p)} onCancel={() => setChoosing(false)} />;
  } else if (card === "confirm" && view.confirm) {
    const c = view.confirm;
    body = (
      <>
        <div className="tb-main">
          <div className="tb-conf">
            <b>✓ {L("Rezervasyon onayı buldum", "Found a booking confirmation")}</b>
            <span>{c.name ?? view.title}</span>
            <span>
              {L("Onay kodu", "Confirmation")} <code>{c.code}</code>
              {c.paid ? L(` · ${c.paid} ödendi`, ` · ${c.paid} paid`) : ""}
            </span>
          </div>
          <Say title={trip ? L(`${trip.title} gezisine rezervasyon olarak kaydedeyim mi?`, `Save it to ${trip.title} as a booking?`) : L("Rezervasyon olarak kaydedeyim mi?", "Save it as a booking?")} sub={L("Kaydedince okurum: plan satırı alındı olur, sayfa belgesi olarak eklenir.", "Once saved I read it: its row on the plan turns booked, the page kept as its document.")} />
          <button type="button" className="tb-go ok" disabled={busy} onClick={() => (mustPick ? setChoosing(true) : void save())}>
            {busy ? L("Kaydediliyor…", "Saving…") : L("Evet, kaydet", "Yes, save it")}
          </button>
        </div>
        {quiet(
          where?.trips.length ? (
            <button type="button" className="btn-link muted" onClick={() => setChoosing(true)}>
              {L("Başka gezi", "Another trip")}
            </button>
          ) : (
            <span />
          ),
          <button type="button" className="btn-link" onClick={() => skipIt("confirm")}>
            {L("Bu değil", "Not this")}
          </button>,
        )}
      </>
    );
  } else if (card === "failed" && view.failed) {
    const f = view.failed;
    body = (
      <>
        <div className="tb-main">
          <Sign tone="bad">↻</Sign>
          <Say title={L(`${f.title} okunamadı`, `Couldn't read ${f.title}`)} sub={L("Kayıt duruyor; bir daha okuyayım.", "The save is kept; I'll read it again.")} />
          <button type="button" className="tb-go" onClick={() => void ask({ type: "popup:retry", id: f.id }).then(() => window.close())}>
            {L("Tekrar dene", "Try again")}
          </button>
        </div>
        {quiet(
          undefined,
          page ? (
            <button type="button" className="btn-link" onClick={() => skipIt("failed")}>
              {L("Bu sayfaya geç", "Go on to this page")}
            </button>
          ) : undefined,
        )}
      </>
    );
  } else if (card === "first" && where) {
    // Hangi gezi için topluyorsun (a bir kez): what's picked is the trip of this page and the next ones.
    body = (
      <>
        <div className="tb-main">
          <Say title={L("Hangi gezi için topluyorsun?", "Which trip are you collecting for?")} sub={L("Bir kez sorarım; sonra hep oraya.", "I ask once; then everything goes there.")} />
          <Tiles where={where} busy={busy} onPick={(p) => void choose(p)} />
        </div>
        {quiet(<span>{L("Sonra üstteki çipten değişir", "The chip on top changes it later")}</span>, <span />)}
      </>
    );
  } else if (card === "other" && where) {
    // Başka geziye benziyor: never saved quietly to the trip being collected for; the trip that fits first.
    const current = view.pocket?.trip ?? null;
    const opts = [...where.picks.map((id) => where.trips.find((t) => t.id === id)).filter((t): t is Trip => Boolean(t))];
    if (current && !opts.some((t) => t.id === current.id)) {
      const t = where.trips.find((x) => x.id === current.id);
      if (t) opts.push(t);
    }
    body = (
      <>
        <div className="tb-main">
          <Say title={where.country ? L(`Bu sayfa ${where.country} için`, `This page is for ${where.country}`) : L("Bu sayfa hangi geziye?", "Which trip is this page for?")} sub={current ? L(`Şu an ${current.title} için topluyorsun. Nereye kaydedeyim?`, `You're collecting for ${current.title}. Where shall I save it?`) : L("Nereye kaydedeyim?", "Where shall I save it?")} />
          <div className="tb-opts">
            {opts.slice(0, 3).map((t, n) => (
              <button key={t.id} type="button" className={`tb-opt${n === 0 && t.match ? " best" : ""}`} disabled={busy} onClick={() => void save({ tripId: t.id, remember: Boolean(where.country) })}>
                <Cover photos={t.photos} title={t.title} />
                <span>
                  <b>{t.title}</b>
                  <small>{[t.when, t.match && where.country ? L("tutuyor", "fits") : null].filter(Boolean).join(" · ") || L("tarihsiz", "no dates")}</small>
                </span>
                {n === 0 && t.match && <em>{L("önerim", "my pick")}</em>}
              </button>
            ))}
            <button type="button" className="btn-link tb-new" disabled={busy} onClick={() => void save({ newTrip: true, remember: true })}>
              {where.country ? L(`+ Yeni gezi: ${where.country}`, `+ New trip: ${where.country}`) : L("+ Yeni gezi", "+ New trip")}
            </button>
          </div>
        </div>
        {quiet(<span>{L("Seçtiğin bundan sonra şu anki gezi olur", "What you pick is the trip from now on")}</span>, <span />)}
      </>
    );
  } else if (card === "along" && view.site) {
    body = (
      <>
        <div className="tb-main">
          <Sign tone="warn">+</Sign>
          <Say title={L(`${companionName(view.site)}'da kartlara + koyayım mı?`, `Put a + on ${companionName(view.site)}'s results?`)} sub={L("Tek izin, 30 kadar seyahat sitesi. Basmadan hiçbir şey kaydedilmez.", "One permission, some 30 travel sites. Nothing is saved until you press.")} />
          <button type="button" className="tb-go" onClick={() => void along()}>
            {L("Evet, yanımda ol", "Yes, come along")}
          </button>
        </div>
        {quiet(
          <span>{L("Şimdilik yalnız bu sayfa", "Just this page for now")}</span>,
          <button type="button" className="btn-link" onClick={() => (void ask({ type: "popup:along-asked" }), skipIt("along"))}>
            {L("Ekle", "Add")}
          </button>,
        )}
      </>
    );
  } else if (card === "saved") {
    body = (
      <>
        <div className="tb-main">
          {view.hero ? <Hero src={view.hero} small /> : <Sign tone="ok">✓</Sign>}
          <Say title={L(`${view.title} zaten destende`, `${view.title} is in your deck already`)} sub={where?.trip ? L(`${where.trip.title} · ${deck}`, `${where.trip.title} · ${deck}`) : null} />
          <button type="button" className="tb-go" onClick={() => boardOf(where?.trip?.id ?? tripId)}>
            {L("Panoda karşılaştır", "Compare on the board")}
          </button>
        </div>
        {quiet(
          <span>{L("Fiyatı düşerse haber veririm", "I'll tell you if the price drops")}</span>,
          <button type="button" className="btn-link" disabled={busy} onClick={() => void save()}>
            {L("Fiyatı yenile", "Refresh the price")}
          </button>,
        )}
      </>
    );
  } else if (card === "list") {
    body = (
      <>
        <div className="tb-main">
          <Sign tone="acc">☰</Sign>
          <Say title={view.title} sub={L("Beğendiklerini işaretle, hepsini birden ekle", "Tick the ones you like, add them all at once")} />
          <button type="button" className="tb-go" onClick={() => void select()}>
            {L("Bu listeden seç", "Pick from this list")}
          </button>
        </div>
        {quiet(<span>{L("ya da kartlardaki +", "or the + on the results")}</span>)}
      </>
    );
  } else if (card === "idea" || card === "page") {
    body = (
      <>
        <div className="tb-main">
          {view.hero ? <Hero src={view.hero} video={view.video} /> : <Sign tone={idea ? "mute" : "acc"}>{idea ? "✎" : "+"}</Sign>}
          <Say title={view.title} sub={view.sub || null} />
          {view.desk.candidate && tabId != null && <DeskBox tabId={tabId} c={view.desk.candidate} />}
          {view.desk.planned && <small className="pk-line">{L(`Bu arama planında · ${view.desk.planned.from} ✈ ${view.desk.planned.to} · destende ${view.desk.planned.count}`, `On the plan · ${view.desk.planned.from} ✈ ${view.desk.planned.to} · ${view.desk.planned.count} in the deck`)}</small>}
          <button type="button" className="tb-go" disabled={busy} onClick={() => void save()}>
            {busy ? L("Ekleniyor…", "Adding…") : idea ? L("+ İlham'a ekle", "+ Add to Inspiration") : !trip && !view.desk.candidate ? L("+ Yeni gezi aç ve ekle", "+ Start a trip and add") : L(`+ ${deck} destesine ekle`, `+ Add to ${deck}`)}
            {!busy && <kbd>Enter</kbd>}
          </button>
          {failed && <p className="warning">{L("Sayfa okunamadı; bir daha dene ya da sağ tık \"Trip Radar'a ekle\".", "Couldn't read the page; try again, or right-click \"Add to Trip Radar\".")}</p>}
        </div>
        {quiet()}
      </>
    );
  } else {
    // Nothing to add here (a new tab, the board): the trip's next thing to do, else where it stands.
    const next = view.glance?.next ?? null;
    const t = view.pocket?.trip ?? null;
    body = next ? (
      <>
        <div className="tb-main">
          <Sign tone="warn">!</Sign>
          <Say eyebrow={L("Sıradaki", "Next")} title={next.act === L("Seç", "Pick") ? L(`${next.text} karar bekliyor`, `${next.text} waits for a decision`) : next.text} sub={next.sub} />
          <button type="button" className="tb-go" onClick={() => boardOf(t?.id)}>
            {actWord(next.act)}
          </button>
        </div>
        {quiet(<span>{view.kind === "board" ? L("Burası pano", "This is the board") : L("Bu sayfa eklenemez", "This page can't be added")}</span>)}
      </>
    ) : t ? (
      <>
        <div className="tb-main">
          <Cover photos={t.photo ? [t.photo] : []} title={t.title} big />
          <Say title={t.title} sub={mine != null ? L(`Biriktirdiklerim ${mine}`, `${mine} saved`) : t.when} />
          <button type="button" className="tb-go" onClick={() => boardOf(t.id)}>
            {L("Panoyu aç", "Open the board")}
          </button>
        </div>
        {quiet(<span>{view.kind === "board" ? L("Burası pano", "This is the board") : L("Bir otel, uçuş ya da tur sayfasında simgeye bas", "Click the icon on a hotel, flight or tour page")}</span>, <span />)}
      </>
    ) : (
      <div className="tb-main">
        <Say title={view.kind === "board" ? L("Burası pano", "This is the board") : L("Bir otel, uçuş ya da tur sayfasında simgeye bas", "Click the icon on a hotel, flight or tour page")} sub={view.kind === "board" ? L("Bir otel, uçuş ya da tur sayfasında simgeye bas; o sayfa buraya eklenir.", "Click the icon on a hotel, flight or tour page; that page gets added here.") : L("O sayfayı gezinin destesine eklerim.", "I'll add that page to your trip's deck.")} />
      </div>
    );
  }

  const chip = view && !saved && card !== "first" ? (trip ?? (page ? null : view.pocket?.trip ? { title: view.pocket.trip.title } : null)) : null;
  return (
    <div className="popup-card tb">
      {view?.price && !saved && <PriceBox badge={view.price} />}
      <div className="tb-top">
        {chip || (page && where?.trips.length && !saved) ? (
          <button type="button" className="tb-chip" disabled={fixed || !where?.trips.length || choosing} onClick={() => setChoosing(true)} aria-label={L("Gezi değiştir", "Change the trip")}>
            <Cover photos={where?.trips.find((x) => x.title === chip?.title)?.photos ?? (view?.pocket?.trip?.photo ? [view.pocket.trip.photo] : [])} title={chip?.title ?? "?"} />
            {chip?.title ?? L("Gezi seç", "Pick a trip")}
            {!fixed && where?.trips.length ? <em aria-hidden>▾</em> : null}
          </button>
        ) : (
          <span className="tb-brand">Trip Radar</span>
        )}
        <button type="button" className="tb-x" aria-label={L("Kapat", "Close")} onClick={() => window.close()}>
          ×
        </button>
      </div>
      {body}
    </div>
  );
}

type CardKind = "confirm" | "failed" | "first" | "other" | "along" | "saved" | "list" | "idea" | "page" | "rest";

/** Which card, top down; the first that holds. */
function cardKind(v: PopupView, at: { mustPick: boolean; skip: ReadonlySet<string> }): CardKind {
  const page = v.kind === "page";
  if (page && v.confirm && !at.skip.has("confirm")) return "confirm";
  if (v.failed && !at.skip.has("failed")) return "failed";
  if (!page) return "rest";
  if (at.mustPick && v.what !== "list") return v.fresh ? "first" : "other";
  if (v.where?.saved) return "saved";
  if (v.what === "list") return "list";
  if (v.travelSite && !v.along && !v.alongAsked && !at.skip.has("along")) return "along";
  return v.what === "idea" ? "idea" : "page";
}

function Say({ title, sub, eyebrow = null }: { title: string; sub: string | null; eyebrow?: string | null }) {
  return (
    <div className="tb-say">
      {eyebrow && <small className="tb-eye">{eyebrow}</small>}
      <b>{title}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

function Sign({ tone, children }: { tone: "ok" | "bad" | "warn" | "acc" | "mute"; children: ReactNode }) {
  return (
    <span className={`tb-sign ${tone}`} aria-hidden>
      {children}
    </span>
  );
}

/** The page's own picture (og:image), big; a video's with its play mark. None it can't load: nothing. */
function Hero({ src, video = false, small = false }: { src: string; video?: boolean; small?: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <span className={`tb-hero${small ? " small" : ""}${video ? " video" : ""}`}>
      <img src={src} alt="" referrerPolicy="no-referrer" decoding="async" onError={() => setGone(true)} />
    </span>
  );
}

/** "Hangi gezi için topluyorsun?": the three most likely as covers, then a new one. */
function Tiles({ where, busy, onPick }: { where: CompanionWhere; busy: boolean; onPick: (p: TripPick) => void }) {
  const picks = [...where.picks, ...where.trips.map((t) => t.id)].filter((id, n, all) => all.indexOf(id) === n).slice(0, 3).map((id) => where.trips.find((t) => t.id === id)).filter((t): t is Trip => Boolean(t));
  return (
    <>
      <div className="pk-qp">
        {picks.map((t, n) => (
          <button key={t.id} type="button" className={n === 0 ? "best" : undefined} disabled={busy} onClick={() => onPick({ tripId: t.id })}>
            <Cover photos={t.photos} title={t.title} big />
            <b>{t.title}</b>
            <span>{t.when ?? L("tarihsiz", "no dates")}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-link tb-new" disabled={busy} onClick={() => onPick({ newTrip: true })}>
        {where.country ? L(`+ Yeni gezi: ${where.country}`, `+ New trip: ${where.country}`) : L("+ Yeni gezi", "+ New trip")}
      </button>
    </>
  );
}

/** Added: "✓ Eklendi", where it went, "Geri al"; a wrong trip "Değiştir". It closes itself. */
function Done({ saved, where, onSaved }: { saved: Saved; where: CompanionWhere | null; onSaved: (s: Saved) => void }) {
  const held = useRef(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (moving) return;
    const t = setTimeout(() => !held.current && window.close(), 2000);
    return () => clearTimeout(t);
  }, [moving, saved]);
  if (moving && where) {
    return (
      <Picker
        where={{ ...where, trips: where.trips.filter((t) => t.id !== saved.tripId), picks: where.picks.filter((id) => id !== saved.tripId) }}
        busy={busy}
        noNew
        onCancel={() => setMoving(false)}
        onPick={(p) => {
          setBusy(true);
          void ask<{ tripId: string; tripTitle: string | null }>({ type: "popup:move", captureId: saved.captureId, pick: p }).then((r) => {
            setBusy(false);
            setMoving(false);
            if (r) onSaved({ ...saved, tripId: r.tripId, tripTitle: r.tripTitle });
          });
        }}
      />
    );
  }
  return (
    <div onMouseEnter={() => (held.current = true)}>
      <div className="tb-main pk-done">
        <span className="pk-fly" aria-hidden />
        <Sign tone="ok">✓</Sign>
        <Say title={L("Eklendi", "Added")} sub={[saved.tripTitle, saved.deck, L("okunuyor", "being read")].filter(Boolean).join(" · ")} />
        <button type="button" className="tb-go ghost" onClick={() => void ask({ type: "popup:undo", captureId: saved.captureId }).then(() => window.close())}>
          {L("Geri al", "Undo")}
        </button>
      </div>
      {where && where.trips.length > 1 && (
        <div className="tb-quiet">
          <span>{L("Yanlış gezi mi?", "Wrong trip?")}</span>
          <button type="button" className="btn-link" onClick={() => ((held.current = true), setMoving(true))}>
            {L("Değiştir", "Change")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Hangi geziye (Pinterest's picker): the three most likely with their covers, then every trip, then a new one. A press saves. */
function Picker({ where, busy, onPick, onCancel = null, noNew = false }: { where: CompanionWhere; busy: boolean; onPick: (p: TripPick) => void; onCancel?: (() => void) | null; noNew?: boolean }) {
  const [remember, setRemember] = useState(true);
  const picks = where.picks.map((id) => where.trips.find((t) => t.id === id)).filter((t): t is Trip => Boolean(t));
  const rest = where.trips.filter((t) => !picks.includes(t));
  const words = (t: Trip) => [t.when, t.match ? where.country : null].filter(Boolean).join(" · ") || L("tarihsiz", "no dates");
  const go = (p: TripPick) => onPick({ ...p, remember: Boolean(where.country) && remember });
  return (
    <div className="pk-pick">
      <p>{L("Hangi geziye?", "Which trip?")}</p>
      {picks.length > 0 && (
        <>
          <small className="muted">{L("Önerilen", "Suggested")}</small>
          <div className="pk-qp">
            {picks.map((t, n) => (
              <button key={t.id} type="button" className={n === 0 ? "best" : undefined} disabled={busy} onClick={() => go({ tripId: t.id })}>
                <Cover photos={t.photos} title={t.title} big />
                <b>{t.title}</b>
                <span>{words(t)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {rest.length > 0 && <small className="muted">{L("Tüm geziler", "All trips")}</small>}
      {rest.map((t) => (
        <button key={t.id} type="button" className="pk-ln" disabled={busy} onClick={() => go({ tripId: t.id })}>
          <Cover photos={t.photos} title={t.title} />
          <span>
            <b>{t.title}</b>
            <span>{words(t)}</span>
          </span>
        </button>
      ))}
      {!noNew && (
        <button type="button" className="pk-ln new" disabled={busy} onClick={() => go({ newTrip: true })}>
          <span className="pk-th">+</span>
          <span>
            <b>{where.country ? L(`Yeni gezi: ${where.country}`, `New trip: ${where.country}`) : L("Yeni gezi", "New trip")}</b>
          </span>
        </button>
      )}
      {onCancel && (
        <button type="button" className="btn-link pk-sel" onClick={onCancel}>
          {L("Vazgeç", "Cancel")}
        </button>
      )}
      {where.country && !noNew && (
        <label className="popup-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {L(`${where.country} için bundan sonra sormadan buraya`, `${where.country} goes there from now on`)}
        </label>
      )}
    </div>
  );
}

/** A trip's cover (Pinterest's board cover): its photo and its last two saved; its first letter without. Loaded only here. */
function Cover({ photos, title, big = false }: { photos: string[]; title: string; big?: boolean }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = photos.filter((p) => !failed.has(p)).slice(0, big ? 3 : 1);
  return (
    <span className={big ? "pk-cv" : "pk-th"} aria-hidden>
      {shown.length ? shown.map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed((f) => new Set(f).add(src))} />) : <i>{title.slice(0, 1).toLocaleUpperCase("tr")}</i>}
    </span>
  );
}

/** Fiyat izleme: the drop the icon's badge stands for, said again with its plan a press away; seen, the badge goes. */
function PriceBox({ badge }: { badge: PriceBadge }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <div className="popup-price">
      <small>{badge.title}</small>
      <b>{badge.said}</b>
      <span className="popup-held-actions">
        <button type="button" className="small-btn" onClick={() => void openBoard(`#trip=${encodeURIComponent(badge.tripId)}`).then(() => clearPriceBadge())}>
          {L("Planı aç", "Open the plan")}
        </button>
        <button type="button" className="btn-link" onClick={() => void clearPriceBadge().then(() => setShown(false))}>
          {L("Tamam", "OK")}
        </button>
      </span>
    </div>
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
