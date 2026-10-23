// Toolbar popup (0.43.0, tuval "Benle gezen eklenti" 8 · Simgeye basınca): it opens at once and saves nothing by itself.
// It says what the page is and where it would go ("Portekiz · Konaklama ▾"), and "Desteye ekle" (or Enter) saves it; a
// page of a trip not known yet asks which one (a press on a trip both picks and saves). Reading the page, its screenshot
// and the save happen in the service worker (lib/popupWorker.ts): nothing heavy is loaded here.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { openBoard } from "./lib/browser";
import { L, lang, loadLang } from "./lib/i18n";
import { COMPANION_SITES, companionName, deckWord, siteKindOf, type CompanionWhere, type TripPick } from "./lib/companion";
import { clearPriceBadge, type PriceBadge } from "./lib/priceBadge";
import type { PopupAsk, PopupView } from "./lib/popupWorker";
import type { Pocket, PocketRow } from "./lib/pocket";
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

function Popup() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [view, setView] = useState<PopupView | null>(null);
  const [pocket, setPocket] = useState<Pocket | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id == null) return setView({ kind: "none" } as PopupView);
      setTabId(tab.id);
      const v = (await ask<PopupView>({ type: "popup:view", tabId: tab.id })) ?? ({ kind: "none" } as PopupView);
      setView(v);
      setPocket(v.pocket ?? null);
    });
  }, []);

  const where = view?.where ?? null;
  const idea = view?.what === "idea";
  const list = view?.what === "list";
  const deck = idea ? L("Fikirler", "Ideas") : deckWord(list ? siteKindOf(view?.site ?? "") : view?.what === "page" ? "any" : ((view?.what as Parameters<typeof deckWord>[0]) ?? "any"));
  const target = view?.desk.planned ? { title: view.desk.planned.title } : view?.desk.candidate ? null : (where?.trip ?? null);
  const mustPick = Boolean(view?.kind === "page" && !view.desk.planned && !view.desk.candidate && !where?.trip && where?.trips.length);
  const canPick = Boolean(view?.kind === "page" && view.what !== "list" && !view.desk.planned && !view.desk.candidate && where?.trips.length);
  const reload = (tripId: string | null = pocket?.trip?.id ?? null) => void ask<Pocket>({ type: "popup:pocket", tripId }).then((p) => p && setPocket(p));

  async function save(pick: TripPick = {}, inView = false) {
    if (tabId == null || busy) return;
    setBusy(true);
    const r = await ask<Saved>({ type: "popup:save", tabId, pick, idea, inView });
    setBusy(false);
    if (!r) return setFailed(true);
    setSaved(r);
    reload(r.tripId);
  }

  // "Sonuçlardan seç" on a list: the results' "+" become ticks on the page (the switch asked first, when it's off).
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

  // Enter adds (the trip known); Escape closes.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Enter" && view?.kind === "page" && !list && !mustPick && !picking && !saved && !where?.saved) {
        e.preventDefault();
        void save();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  const tripTitle = pocket?.trip?.title ?? target?.title ?? null;
  return (
    <div className="popup-card pk2">
      <div className="popup-title">Trip Radar</div>
      {view?.price && <PriceBox badge={view.price} />}
      {!view ? (
        <div className="pk-skel" aria-label={L("Hazırlanıyor", "Getting ready")}>
          <span />
          <span />
        </div>
      ) : saved ? (
        <Done saved={saved} where={where} onSaved={(s) => (setSaved(s), reload(s.tripId))} />
      ) : (
        <>
          {/* (a travel site without the switch: said first, above everything, so the "+" isn't missed; a list asks it on "Sonuçlardan seç") */}
          {view.kind === "page" && view.site && view.travelSite && !view.along && !list && tabId != null && (
            <div className="pk-switch">
              <b>{L("Bu sitede + kapalı", "The + is off on this site")}</b>
              <AlongBox site={view.site} travel tabId={tabId} along={false} />
            </div>
          )}
          <TripHead pocket={pocket} onPick={canPick && !picking ? () => setPicking(true) : null} />
          {view.kind === "board" && <p className="cep-say">{L("Burası pano. Bir otel, uçuş ya da etkinlik sayfasında simgeye bas; o sayfa buraya eklenir.", "This is the board. Click the icon on a hotel, flight or activity page; that page gets added here.")}</p>}
          {view.kind === "none" && <p className="cep-say">{L("Bu sayfa eklenemiyor. Bir otel, uçuş ya da etkinlik sayfasında simgeye bas.", "This page can't be added. Click the icon on a hotel, flight or activity page.")}</p>}
          {view.kind === "page" && (
            <section className="cep-sec">
              <small className="cep-k">{L("Bu sayfa", "This page")}</small>
              <div className="pk-hd">
                <span className="pk-fav" aria-hidden>
                  {companionName(view.site ?? "").slice(0, 1).toLocaleUpperCase("tr")}
                </span>
                <span>
                  <b>{view.title}</b>
                  <small>{view.sub}</small>
                </span>
              </div>
              {view.desk.candidate && <DeskBox tabId={tabId!} c={view.desk.candidate} />}
              {view.desk.planned && (
                <small className="pk-line">
                  {L(`Bu arama planında · ${view.desk.planned.from} ✈ ${view.desk.planned.to} · destende ${view.desk.planned.count}`, `On the plan · ${view.desk.planned.from} ✈ ${view.desk.planned.to} · ${view.desk.planned.count} in the deck`)}
                </small>
              )}
              {where?.saved && !picking ? (
                <>
                  <div className="pk-in">✓ {where.trip ? L(`${where.trip.title} · ${deck} destesinde`, `In ${where.trip.title} · ${deck}`) : L("Bu sayfa planında", "This page is on your plan")}</div>
                  <button type="button" className="pk-go ghost" disabled={busy} onClick={() => void save()}>
                    {L("Fiyatı yenile", "Refresh the price")}
                  </button>
                </>
              ) : (mustPick && !list) || picking ? (
                <Picker where={where!} busy={busy} onPick={(p) => void save(p)} onCancel={mustPick ? null : () => setPicking(false)} />
              ) : list ? (
                <>
                  {/* (a list is never one record: its results are picked, or what's in view is read) */}
                  <button type="button" className="pk-go" onClick={() => void select()}>
                    {L("Sonuçlardan seç", "Pick from the results")}
                  </button>
                  <small className="muted cep-note">{L("Listenin tamamı kaydedilmez: her sonucun + düğmesine bas ya da işaretleyip hepsini ekle.", "The whole list isn't saved: press a result's +, or tick several and add them.")}</small>
                  <button type="button" className="btn-link pk-sel" disabled={busy} onClick={() => void save({}, true)}>
                    {busy ? L("Ekleniyor…", "Adding…") : L("Ekrandakileri ekle", "Add what's on screen")}
                  </button>
                </>
              ) : (
                <button type="button" className="pk-go" disabled={busy} onClick={() => void save()}>
                  {busy ? L("Ekleniyor…", "Adding…") : idea ? L("+ Fikir olarak ekle", "+ Add as an idea") : !target && !view.desk.candidate ? L("+ Yeni gezi aç ve ekle", "+ Start a trip and add") : L(`+ ${deck} destesine ekle`, `+ Add to ${deck}`)}
                  {!busy && <kbd>Enter</kbd>}
                </button>
              )}
              {failed && <p className="warning">{L("Sayfa okunamadı; bir daha dene ya da sağ tık \"Trip Radar'a ekle\".", "Couldn't read the page; try again, or right-click \"Add to Trip Radar\".")}</p>}
            </section>
          )}
          <Recent pocket={pocket} onChanged={() => reload()} />
          <KeyLine pocket={pocket} />
          {view.kind === "page" && view.site && tabId != null && !(view.travelSite && !view.along) && <AlongBox site={view.site} travel={view.travelSite} tabId={tabId} along={view.along} />}
          <Foot tripId={pocket?.trip?.id ?? where?.trip?.id ?? null} title={tripTitle} />
        </>
      )}
    </div>
  );
}

/** The pocket's top: the trip it is (its cover, its days, how many on it); ▾ picks another for this page. */
function TripHead({ pocket, onPick }: { pocket: Pocket | null; onPick: (() => void) | null }) {
  const t = pocket?.trip;
  if (!t) return null;
  const inner = (
    <>
      <Cover photos={t.photo ? [t.photo] : []} title={t.title} />
      <span>
        <b>{t.title}</b>
        <small>{[t.when, L(`${t.count} kayıt`, `${t.count} saved`)].filter(Boolean).join(" · ")}</small>
      </span>
      {onPick && <em aria-hidden>▾</em>}
    </>
  );
  return onPick ? (
    <button type="button" className="cep-trip" onClick={onPick} aria-label={L(`${t.title}; başka gezi seç`, `${t.title}; pick another trip`)}>
      {inner}
    </button>
  ) : (
    <div className="cep-trip">{inner}</div>
  );
}

const STATE_WORD: Record<PocketRow["state"], () => string> = {
  in: () => L("destede", "in the deck"),
  reading: () => L("okunuyor", "being read"),
  failed: () => L("okunamadı", "couldn't read"),
};

/** Son eklenenler: the trip's last five, how each stands; × takes a wrong one back, "tekrar" reads a failed one again. */
function Recent({ pocket, onChanged }: { pocket: Pocket | null; onChanged: () => void }) {
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const rows = (pocket?.rows ?? []).filter((r) => !gone.has(r.id));
  if (!rows.length) return null;
  const act = (type: "popup:remove" | "popup:retry", id: string) => {
    if (type === "popup:remove") setGone((g) => new Set(g).add(id));
    void ask({ type, id }).then(onChanged);
  };
  return (
    <section className="cep-sec">
      <small className="cep-k">{L("Son eklenenler", "Added last")}</small>
      {rows.map((r) => (
        <div key={r.id} className="cep-row">
          <Cover photos={r.photo ? [r.photo] : []} title={r.title} />
          <span>
            <b>{r.title}</b>
            <small>{r.sub}</small>
          </span>
          <em className={`cep-st ${r.state}`}>{STATE_WORD[r.state]()}</em>
          {r.state === "failed" && (
            <button type="button" className="btn-link" onClick={() => act("popup:retry", r.id)}>
              {L("tekrar", "retry")}
            </button>
          )}
          <button type="button" className="cep-x" aria-label={L(`${r.title} kaldır`, `Remove ${r.title}`)} title={L("Kaldır", "Remove")} onClick={() => act("popup:remove", r.id)}>
            ×
          </button>
        </div>
      ))}
    </section>
  );
}

/** No key: saving goes on, the saves wait here; one line says how many and where to connect it. */
function KeyLine({ pocket }: { pocket: Pocket | null }) {
  if (!pocket || pocket.key) return null;
  return (
    <p className="cep-key">
      {pocket.waiting ? L(`AI bağlı değil: ${pocket.waiting} kayıt bekliyor, toplamaya devam.`, `AI not connected: ${pocket.waiting} saves waiting, keep collecting.`) : L("AI bağlı değil: eklediklerin bu bilgisayarda bekler.", "AI not connected: what you add waits on this computer.")}{" "}
      <button type="button" className="btn-link" onClick={() => void openBoard("#settings")}>
        {L("Anahtarı bağla", "Connect the key")}
      </button>
    </p>
  );
}

/** Git: the trip's board (its open tab if there is one), and every trip. */
function Foot({ tripId, title }: { tripId: string | null; title: string | null }) {
  return (
    <div className="cep-foot">
      <button type="button" className="btn-link" onClick={() => void openBoard(tripId ? `#trip=${encodeURIComponent(tripId)}` : "").then(() => window.close())}>
        {title ? L(`${title} panosunu aç ↗`, `Open the ${title} board ↗`) : L("Planı aç ↗", "Open the plan ↗")}
      </button>
      {tripId && (
        <button type="button" className="btn-link muted" onClick={() => void openBoard("").then(() => window.close())}>
          {L("Tüm geziler", "All trips")}
        </button>
      )}
    </div>
  );
}

/** Added: the page's small picture lands in its trip ("hop"), "✓ Eklendi · Değiştir · Geri al"; the popup closes itself. */
function Done({ saved, where, onSaved }: { saved: Saved; where: CompanionWhere | null; onSaved: (s: Saved) => void }) {
  const held = useRef(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (moving) return;
    const t = setTimeout(() => !held.current && window.close(), 1800);
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
    <div className="pk-done" onMouseEnter={() => (held.current = true)}>
      <span className="pk-fly" aria-hidden />
      <b>✓ {saved.tripTitle ? L(`Eklendi · ${saved.tripTitle} · ${saved.deck}`, `Added · ${saved.tripTitle} · ${saved.deck}`) : L("Eklendi", "Added")}</b>
      <span className="muted">{L("Okunuyor; pencereyi kapatabilirsin.", "Being read; you can close this.")}</span>
      <span className="popup-held-actions">
        {where && where.trips.length > 1 && (
          <button type="button" className="small-btn" onClick={() => ((held.current = true), setMoving(true))}>
            {L("Değiştir", "Change")}
          </button>
        )}
        <button type="button" className="small-btn" onClick={() => void ask({ type: "popup:undo", captureId: saved.captureId }).then(() => window.close())}>
          {L("Geri al", "Undo")}
        </button>
      </span>
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

/** "Sitede benle gel": on a travel site one switch for all of them; on any other site, that site alone. */
function AlongBox({ site, travel, tabId, along }: { site: string; travel: boolean; tabId: number; along: boolean }) {
  const [on, setOn] = useState(along);
  const [said, setSaid] = useState<string | null>(null);
  const name = companionName(site);
  const origins = travel ? [...COMPANION_SITES] : [site];
  async function allow() {
    const granted = await chrome.permissions.request({ origins }).catch(() => false);
    if (!granted) return setSaid(L("İzin verilmedi; yine de simgeye basınca kaydederim.", "Not allowed; pressing the icon still saves the page."));
    setOn(true);
    await chrome.scripting.executeScript({ target: { tabId }, files: ["companion.js"] }).catch(() => undefined);
    setSaid(travel ? L("Artık seyahat sitelerinde yanındayım: sonuçlarda +, bir yerin sayfasında \"Desteye ekle\".", "I'm with you on travel sites now: a + on results, \"Add to the deck\" on a place's page.") : L(`Artık ${name}'da da yanındayım.`, `I'm with you on ${name} too now.`));
  }
  async function stop() {
    await chrome.permissions.remove({ origins }).catch(() => false);
    setOn(false);
    setSaid(travel ? L("Seyahat sitelerinde artık yokum.", "I've left the travel sites.") : L(`${name}'da artık yokum.`, `I've left ${name}.`));
  }
  return (
    <div className="popup-along">
      {on ? (
        <button type="button" className="btn-link" onClick={() => void stop()}>
          {travel ? L("Seyahat sitelerinde benle gelme", "Stop coming along on travel sites") : L(`${name}'da benle gelme`, `Stop coming along on ${name}`)}
        </button>
      ) : travel ? (
        <>
          <button type="button" className="small-btn" onClick={() => void allow()}>
            {L("Seyahat sitelerinde benle gel", "Come along on travel sites")}
          </button>
          <span className="muted">{L("30 kadar seyahat sitesi, tek izinle. + basmadan hiçbir şey kaydedilmez.", "Some 30 travel sites, one permission. Nothing is saved until you press +.")}</span>
        </>
      ) : (
        <button type="button" className="btn-link" onClick={() => void allow()}>
          {L(`${name}'da da benle gel`, `Come along on ${name} too`)}
        </button>
      )}
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
