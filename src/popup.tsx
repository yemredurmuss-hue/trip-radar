// Toolbar popup: opening it IS the save action (activeTab is granted by that click).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { downscale, openBoard, requestProcessing } from "./lib/browser";
import { db, hasActiveKey, onChanged } from "./lib/db";
import { L, lang, loadLang } from "./lib/i18n";
import { CATEGORY_LABELS, formatDateRange } from "./lib/items";
import { collectPage } from "./lib/pagecapture";
import { saveSnapshot } from "./lib/process";
import { planFlightFor, type PlannedFlight } from "./lib/bring";
import { badgeOf, candidateOf, markBuying, type CandidateTab } from "./lib/candidateTabs";
import { flightSearchOf } from "./lib/url";
import { COMPANION_SITES, companionName, companionSiteOf, originOf, type CompanionWhere, type TripPick as SitePick } from "./lib/companion";
import { bindFor, whereFor } from "./lib/companionWorker";
import type { PageSnapshot } from "./lib/pagecapture";
import { chooseItem } from "./app/actions";
import { answerHeld, moveToTrip } from "./lib/routing";
import { countryName, isDemoTrip } from "./lib/trips";
import { placeCodes, titleCodes, tripPlaceCodes } from "./lib/placeCheck";
import type { Item, Trip } from "./lib/types";
import { reloadIfStale } from "./lib/update";
import { clearPriceBadge, priceBadge, type PriceBadge } from "./lib/priceBadge";

type State =
  | { step: "saving" }
  | { step: "working"; captureId: string }
  | { step: "done"; text: string; tripId: string; itemId?: string }
  /**
   * Read, not added (placeCheck.ts): the same question the trip's chat asks; reason trip (0.39.4): which of the trips it
   * could be (`candidates`, the most likely first), under the button.
   */
  | { step: "held"; captureId: string; text: string; reason: "place" | "travel" | "trip"; newTitle: string; tripTitle: string | null; candidates?: TripPick[]; country?: string | null }
  | { step: "pick"; pick: PickFirst }
  | { step: "skipped" }
  | { step: "error"; text: string }
  | { step: "hint"; text: string };

class HintError extends Error {}

/** A trip as the popup offers it: its name and its dates when set. */
interface TripPick {
  id: string;
  title: string;
  when: string | null;
  /** Hangi gezi: it goes to the country of what was saved (its places or its title). */
  match?: boolean;
}
const pickOf = (t: Trip): TripPick => ({ id: t.id, title: t.title, when: t.confirmedDates ? formatDateRange(t.confirmedDates.start, t.confirmedDates.end) : null });
const pickLabel = (t: TripPick) => (t.when ? `${t.title} · ${t.when}` : t.title);

/**
 * Benle gezen eklenti (seviye 1): what the plan knows of this tab before it is saved: a candidate we opened in a tab group
 * ("Aday 2/3"), or a flight search for a planned flight ("Bu arama planında"). Its save then goes into that trip and need.
 */
interface Desk {
  candidate: CandidateTab | null;
  planned: (PlannedFlight & { title: string }) | null;
  tabId: number | null;
  /** Seviye 2: a flight site it may come along on ("https://www.skyscanner.com.tr/*"), and whether it is allowed there. */
  site: string | null;
  along: boolean;
}

async function deskOf(tab: chrome.tabs.Tab | undefined): Promise<Desk> {
  // (a travel site of the list, or any other https page: "Bu sitede de benle gel"; never the extension's own pages)
  const own = new Set<string>((chrome.runtime.getManifest().host_permissions ?? []) as string[]);
  const other = originOf(tab?.url);
  const site = companionSiteOf(tab?.url) ?? (other && !own.has(other) ? other : null);
  const along = site ? await chrome.permissions.contains({ origins: [site] }).catch(() => false) : false;
  const none: Desk = { candidate: null, planned: null, tabId: tab?.id ?? null, site, along };
  if (!tab?.id) return none;
  const candidate = await candidateOf(tab.id).catch(() => null);
  const search = flightSearchOf(tab.url);
  if (!search) return { ...none, candidate };
  const d = await db();
  const planned = planFlightFor(await d.getAll("items"), search);
  const trip = planned ? await d.get("trips", planned.tripId) : undefined;
  return { ...none, candidate, planned: planned && trip ? { ...planned, title: trip.title } : null };
}

/** Read, not saved yet: asked first which trip (Hangi gezi, 0.41.0), saved once picked. */
interface PickFirst {
  where: CompanionWhere;
  snapshot: PageSnapshot;
  screenshot: string | null;
}

async function captureActiveTab(onDesk: (desk: Desk) => void): Promise<string | PickFirst> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const desk = await deskOf(tab);
  onDesk(desk);
  // Our own pages (board, popup-in-a-tab) are extension contexts; their URL is not always visible here.
  const ownTabs = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
  if (ownTabs.some((c) => c.tabId === tab?.id) || tab?.url?.startsWith(chrome.runtime.getURL(""))) {
    throw new HintError(
      L(
        "Burası pano. Bir otel, uçuş, etkinlik veya eSIM sayfası açıp orada simgeye bas; o sayfa buraya eklenir.",
        "This is the board. Open a hotel, flight, activity or eSIM page and click the icon there; that page gets added here.",
      ),
    );
  }
  if (tab?.id == null || !tab.url || !/^https?:/.test(tab.url)) {
    throw new Error(L("Bu sayfa kaydedilemiyor. Bir otel, uçuş veya etkinlik sayfasındayken dene.", "This page can't be saved. Try on a hotel, flight or activity page."));
  }
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPage });
  if (!result?.result) throw new Error(L("Sayfa okunamadı.", "Couldn't read the page."));
  let screenshot: string | null = null;
  try {
    screenshot = await downscale(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 }));
  } catch {
    // Some pages block capture; the page text is still enough.
  }
  let bind: { forTripId?: string; forNeed?: string } = desk.candidate ? { forTripId: desk.candidate.tripId } : desk.planned ? { forTripId: desk.planned.tripId, forNeed: desk.planned.forNeed } : {};
  // Hangi gezi (0.41.0): the page's country read from its address and title (code, no model); its remembered trip takes
  // it at once, else, with trips to choose from, it is asked here first and saved once picked (never into a guess).
  if (!bind.forTripId) {
    const where = await whereFor(tab.url, tab.title ?? "");
    if (where.trip) bind = { forTripId: where.trip.id };
    else if (where.trips.length) return { where, snapshot: result.result, screenshot };
  }
  const capture = await saveSnapshot(result.result, screenshot, bind);
  requestProcessing();
  return capture.id;
}

function Popup() {
  const [state, setState] = useState<State>({ step: "saving" });
  const [hasKey, setHasKey] = useState(true);
  const [desk, setDesk] = useState<Desk | null>(null);

  useEffect(() => {
    void hasActiveKey().then(setHasKey);
    captureActiveTab(setDesk)
      .then((got) => setState(typeof got === "string" ? { step: "working", captureId: got } : { step: "pick", pick: got }))
      .catch((error: unknown) =>
        setState(
          error instanceof HintError
            ? { step: "hint", text: error.message }
            : { step: "error", text: error instanceof Error ? error.message : String(error) },
        ),
      );
  }, []);

  useEffect(() => {
    if (state.step !== "working") return;
    const check = async () => {
      const d = await db();
      const capture = await d.get("captures", state.captureId);
      if (capture?.status === "error") setState({ step: "error", text: capture.error ?? L("İşlenemedi.", "Couldn't process it.") });
      const held = capture?.held;
      // Asked (a record already saved stays on its trip while asked, so it has an itemId too).
      if (capture?.status === "done" && held && !held.answer) {
        const trip = held.tripId ? await d.get("trips", held.tripId) : undefined;
        const codes = placeCodes(held.item);
        const items = held.reason === "trip" ? await d.getAll("items") : [];
        const matches = (t: Trip) => codes.some((c) => tripPlaceCodes(t.id, items).has(c) || titleCodes(t.title).has(c));
        const candidates = (await Promise.all((held.candidates ?? []).map((id) => d.get("trips", id)))).filter((t): t is Trip => t != null).map((t) => ({ ...pickOf(t), match: matches(t) }));
        const country = codes[0] ? countryName(codes[0]) : null;
        setState({ step: "held", captureId: capture.id, text: held.question ?? held.item.name, reason: held.reason, newTitle: held.newTitle, tripTitle: trip?.title ?? null, country, ...(candidates.length ? { candidates } : {}) });
      } else if (capture?.status === "done" && capture.itemId) {
        const item = await d.get("items", capture.itemId);
        const trip = item ? await d.get("trips", item.tripId) : undefined;
        if (item) {
          const where = [trip?.title, CATEGORY_LABELS[item.category], item.city].filter(Boolean).join(" · ");
          setState({ step: "done", text: `${item.name} → ${where}`, tripId: item.tripId, itemId: item.id });
        }
      }
    };
    void check();
    return onChanged(() => void check());
  }, [state]);

  return (
    <div className="popup-card">
      <div className="popup-title">Trip Radar</div>
      <PriceBox />
      {desk && (desk.candidate || desk.planned) && <DeskBox desk={desk} />}
      {desk?.site && desk.tabId != null && <AlongBox site={desk.site} tabId={desk.tabId} along={desk.along} />}
      {state.step === "saving" && <p>{L("Sayfa kaydediliyor…", "Saving the page…")}</p>}
      {state.step === "pick" && <PickTrip pick={state.pick} onSaved={(captureId) => setState({ step: "working", captureId })} />}
      {state.step === "working" && (
        <p>
          {L("✓ Kaydedildi. AI inceliyor…", "✓ Saved. AI is reading it…")}
          <br />
          <span className="muted">{L("Pencereyi kapatabilirsin; arkada devam eder.", "You can close this; it keeps going in the background.")}</span>
        </p>
      )}
      {state.step === "done" && (
        <p>
          ✓ {state.text}
          {state.itemId && <MoveTrip itemId={state.itemId} tripId={state.tripId} onDone={setState} />}
        </p>
      )}
      {state.step === "held" && <HeldQuestion state={state} onDone={setState} />}
      {state.step === "skipped" && <p>{L("Eklenmedi.", "Not added.")}</p>}
      {state.step === "error" && <p className="error">{state.text}</p>}
      {state.step === "hint" && <p>{state.text}</p>}
      {/* Only once something was saved: on the board, an error or "Eklenmedi" nothing is waiting. */}
      {!hasKey && (state.step === "working" || state.step === "done") && <p className="warning">{L("Kayıt duruyor. AI'ın işlemesi için ücretsiz Gemini anahtarını bir kez bağla.", "Saved, but waiting. Connect a free Gemini key once so the AI can read it.")}</p>}
      <button
        className="primary"
        onClick={() => void openBoard(!hasKey ? "#settings" : state.step === "done" ? `#trip=${state.tripId}` : "")}
      >
        {!hasKey ? L("1 dakikalık kurulum", "1-minute setup") : state.step === "done" ? L("Geziyi aç", "Open trip") : L("Panoyu aç", "Open board")}
      </button>
    </div>
  );
}

/**
 * "Başka geziye taşı" beside the done line (0.39.4): the other trips (the latest first), one tap moves the record there
 * (routing.moveToTrip). Folded until asked.
 */
function MoveTrip({ itemId, tripId, onDone }: { itemId: string; tripId: string; onDone: (next: State) => void }) {
  const [others, setOthers] = useState<TripPick[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    const trips = await (await db()).getAll("trips");
    setOthers(trips.filter((t) => t.id !== tripId && !isDemoTrip(t)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6).map(pickOf));
  }
  async function move(to: TripPick) {
    setBusy(true);
    try {
      await moveToTrip(itemId, to.id);
      const item = await (await db()).get("items", itemId);
      onDone({ step: "done", text: `${item?.name ?? ""} → ${to.title}`, tripId: to.id, itemId });
      setOthers(null);
    } catch (error) {
      onDone({ step: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }
  if (!others) {
    return (
      <>
        <br />
        <button type="button" className="btn-link popup-move" onClick={() => void open()}>{L("Başka geziye taşı", "Move to another trip")}</button>
      </>
    );
  }
  return (
    <span className="popup-held-actions">
      {others.length ? others.map((t) => <button key={t.id} type="button" className="small-btn" disabled={busy} onClick={() => void move(t)}>{pickLabel(t)}</button>) : <span className="muted">{L("Başka gezi yok.", "No other trip.")}</span>}
    </span>
  );
}

/** The question the trip's chat asks too; answered here, it's answered there. */
function HeldQuestion({ state, onDone }: { state: Extract<State, { step: "held" }>; onDone: (next: State) => void }) {
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  async function answer(a: "here" | "there" | "new" | "skip", picked?: string) {
    setBusy(true);
    try {
      const tripId = await answerHeld(state.captureId, a, picked, remember);
      if (!tripId) return onDone({ step: "skipped" });
      const d = await db();
      const trip = await d.get("trips", tripId);
      onDone({ step: "done", text: `${trip?.title ?? ""}`, tripId });
    } catch (error) {
      onDone({ step: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }
  // Which trip (Hangi gezi, 0.41.0): the trips of the saved thing's country first (the most likely picked), then the
  // others, a new trip, or none; asked once a country: the answer is remembered unless the switch is turned off.
  if (state.reason === "trip" && state.candidates?.length) {
    const own = state.candidates.filter((t) => t.match);
    const others = state.candidates.filter((t) => !t.match);
    const button = (t: TripPick, first: boolean) => (
      <button key={t.id} type="button" className="small-btn" disabled={busy} aria-current={first ? "true" : undefined} onClick={() => void answer("there", t.id)}>
        {first ? L(`${pickLabel(t)} (en olası)`, `${pickLabel(t)} (most likely)`) : pickLabel(t)}
      </button>
    );
    const fresh = (
      <button type="button" className="small-btn" disabled={busy} onClick={() => void answer("new")}>{L(`Yeni gezi: ${state.newTitle}`, `New trip: ${state.newTitle}`)}</button>
    );
    return (
      <div className="popup-held">
        <p>{state.text}</p>
        {own.length > 0 && state.country && <small className="muted">{L(`${state.country} gezilerin`, `Your trips to ${state.country}`)}</small>}
        <div className="popup-held-actions">
          {own.length ? own.map((t, n) => button(t, n === 0)) : fresh}
        </div>
        {others.length > 0 && <small className="muted">{own.length ? L("Diğerleri", "Others") : L("Ya da", "Or")}</small>}
        <div className="popup-held-actions">
          {others.map((t) => button(t, false))}
          {own.length > 0 && fresh}
          <button type="button" className="small-btn" disabled={busy} onClick={() => void answer("skip")}>{L("Ekleme", "Don't add")}</button>
        </div>
        {state.country && (
          <label className="popup-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {L(`${state.country} için bundan sonra hep buraya koy`, `Put ${state.country} here from now on`)}
          </label>
        )}
      </div>
    );
  }
  // With no trip to ask in, "here" makes the new trip too: only one way to add it.
  const here = state.tripTitle ? (state.reason === "place" ? L(`${state.tripTitle}: yine de ekle`, `${state.tripTitle}: add anyway`) : L("Yine de ekle", "Add it anyway")) : null;
  return (
    <div className="popup-held">
      <p>{state.text}</p>
      <div className="popup-held-actions">
        {here && <button className="small-btn" disabled={busy} onClick={() => void answer("here")}>{here}</button>}
        {(state.reason === "place" || !here) && (
          <button className="small-btn" disabled={busy} onClick={() => void answer("new")}>
            {L(`Yeni gezi: ${state.newTitle}`, `New trip: ${state.newTitle}`)}
          </button>
        )}
        <button className="small-btn" disabled={busy} onClick={() => void answer("skip")}>{L("Ekleme", "Don't add")}</button>
      </div>
    </div>
  );
}

// The language first, so the popup never flashes the wrong one. Files newer than the loaded extension
// (the updater just swapped them) reload it instead of saving: the old version holds the database.
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

/**
 * Benle gezen eklenti (seviye 1): on a candidate's tab, which one it is and the two things to do here; on a search for a
 * planned flight, which row it is for. The page is saved as always (its price refreshed), into that row.
 */
function DeskBox({ desk }: { desk: Desk }) {
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const c = desk.candidate;
  async function decide() {
    if (!c) return;
    setBusy(true);
    try {
      const d = await db();
      const item = await d.get("items", c.itemId);
      if (!item) return setSaid(L("Bu aday artık planda değil.", "This candidate isn't on the plan any more."));
      const same = item.flight?.from && item.flight.to && item.dates.start ? planFlightFor(await d.getAll("items"), { from: item.flight.from, to: item.flight.to, day: item.dates.start }) : null;
      const alternatives = same ? (await Promise.all(same.ids.map((id) => d.get("items", id)))).filter((i): i is Item => i != null) : [];
      await chooseItem(item, alternatives);
      setSaid(L(`✓ Seçtin: ${item.name}. Plan'da açık bilet olarak duruyor; satın alınca "Aldım" de.`, `✓ Chosen: ${item.name}. It waits on the plan as an open ticket; say "Got it" once bought.`));
    } finally {
      setBusy(false);
    }
  }
  async function buyHere() {
    if (desk.tabId == null) return;
    await markBuying(desk.tabId);
    setSaid(L("Satın alınca bu sekmeyi kapat; plan \"Aldın mı?\" diye sorar, bileti de ekleriz.", "Once bought, close this tab; the plan asks \"Did you buy it?\" and we add the ticket."));
  }
  return (
    <div className="popup-desk">
      {c ? (
        <>
          <small>{L(`Aday ${badgeOf(c)} · ${c.route}`, `Candidate ${badgeOf(c)} · ${c.route}`)}</small>
          <b>
            {c.name}
            {c.price ? ` · ${c.price}` : ""}
          </b>
          <span className="popup-held-actions">
            <button type="button" className="small-btn" disabled={busy} onClick={() => void decide()}>
              {L("Buna karar ver", "Go with this one")}
            </button>
            <button type="button" className="small-btn" disabled={busy} onClick={() => void buyHere()}>
              {L("Burada satın al", "Buy it here")}
            </button>
          </span>
        </>
      ) : desk.planned ? (
        <>
          <small>{L(`Bu arama planında · ${desk.planned.title}`, `This search is on the plan · ${desk.planned.title}`)}</small>
          <b>
            {desk.planned.from} ✈ {desk.planned.to} · {formatDateRange(desk.planned.day, null)}
          </b>
          <span className="muted">
            {L(`Destende ${desk.planned.ids.length} seçenek var; bu sayfadaki uçuşlar o desteye girer.`, `Your deck has ${desk.planned.ids.length} option${desk.planned.ids.length === 1 ? "" : "s"}; the flights on this page join it.`)}
          </span>
        </>
      ) : null}
      {said && <span className="popup-desk-said">{said}</span>}
    </div>
  );
}

/**
 * "Sitede benle gel" (0.42.0): on a travel site of the list, one switch for all of them ("Seyahat sitelerinde benle gel",
 * Chrome asks once); on any other site, that site alone ("Bu sitede de benle gel"). Allowed, the strip and each result's
 * "+", and a place's own page its "Desteye ekle". Taken back here, or in Settings.
 */
function AlongBox({ site, tabId, along }: { site: string; tabId: number; along: boolean }) {
  const [on, setOn] = useState(along);
  const [said, setSaid] = useState<string | null>(null);
  const travel = (COMPANION_SITES as readonly string[]).includes(site);
  const name = companionName(site);
  const origins = travel ? [...COMPANION_SITES] : [site];
  async function allow() {
    const granted = await chrome.permissions.request({ origins }).catch(() => false);
    if (!granted) return setSaid(L("İzin verilmedi; yine de simgeye basınca kaydederim.", "Not allowed; pressing the icon still saves the page."));
    setOn(true);
    await chrome.scripting.executeScript({ target: { tabId }, files: ["companion.js"] }).catch(() => undefined);
    setSaid(
      travel
        ? L("Artık seyahat sitelerinde yanındayım: sonuçlarda +, bir otelin ya da turun sayfasında sağ altta \"Desteye ekle\".", "I'm with you on travel sites now: a + on each result, and \"Add to the deck\" at the bottom right of a place's page.")
        : L(`Artık ${name}'da da yanındayım.`, `I'm with you on ${name} too now.`),
    );
  }
  async function stop() {
    await chrome.permissions.remove({ origins }).catch(() => false);
    setOn(false);
    setSaid(travel ? L("Seyahat sitelerinde artık yokum; sayfa yenilenince + gider.", "I've left the travel sites; the + goes when the page reloads.") : L(`${name}'da artık yokum.`, `I've left ${name}.`));
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
          <span className="muted">{L("Booking, Airbnb, Skyscanner, GetYourGuide ve 30 kadar seyahat sitesi, tek izinle. + basmadan hiçbir şey kaydedilmez.", "Booking, Airbnb, Skyscanner, GetYourGuide and some 30 travel sites, with one permission. Nothing is saved until you press +.")}</span>
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

/** Fiyat izleme (0.41.0): the drop the icon's badge stands for, said again with its plan a press away; seen, the badge goes. */
function PriceBox() {
  const [badge, setBadge] = useState<PriceBadge | null>(null);
  useEffect(() => {
    void priceBadge().then(setBadge);
  }, []);
  if (!badge) return null;
  return (
    <div className="popup-price">
      <small>{badge.title}</small>
      <b>{badge.said}</b>
      <span className="popup-held-actions">
        <button type="button" className="small-btn" onClick={() => void openBoard(`#trip=${encodeURIComponent(badge.tripId)}`).then(() => clearPriceBadge())}>
          {L("Planı aç", "Open the plan")}
        </button>
        <button type="button" className="btn-link" onClick={() => void clearPriceBadge().then(() => setBadge(null))}>
          {L("Tamam", "OK")}
        </button>
      </span>
    </div>
  );
}

/**
 * Hangi gezi before the save (0.41.0, board E5): the page's country's trips first, the most likely picked, the others, a
 * new trip for the country; "bundan sonra hep buraya koy" keeps the answer as the country's trip. Nothing is saved until
 * one is pressed.
 */
function PickTrip({ pick, onSaved }: { pick: PickFirst; onSaved: (captureId: string) => void }) {
  const { where } = pick;
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  async function save(p: SitePick) {
    setBusy(true);
    const bind = await bindFor(pick.snapshot.url, pick.snapshot.title, { ...p, remember: Boolean(where.country) && remember });
    const capture = await saveSnapshot(pick.snapshot, pick.screenshot, bind);
    requestProcessing();
    onSaved(capture.id);
  }
  type T = CompanionWhere["trips"][number];
  const picks = where.picks.map((id) => where.trips.find((t) => t.id === id)).filter((t): t is T => Boolean(t));
  const rest = where.trips.filter((t) => !picks.includes(t));
  const words = (t: T) => [t.when, t.match ? where.country : null].filter(Boolean).join(" · ") || L("tarihsiz", "no dates");
  return (
    <div className="pk-pick">
      <p>{L("Hangi geziye?", "Which trip?")}</p>
      {picks.length > 0 && (
        <>
          <small className="muted">{L("Önerilen", "Suggested")}</small>
          <div className="pk-qp">
            {picks.map((t, n) => (
              <button key={t.id} type="button" className={n === 0 ? "best" : undefined} disabled={busy} onClick={() => void save({ tripId: t.id })}>
                <TripCover photos={t.photos} title={t.title} big />
                <b>{t.title}</b>
                <span>{words(t)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {rest.length > 0 && <small className="muted">{L("Tüm geziler", "All trips")}</small>}
      {rest.map((t) => (
        <button key={t.id} type="button" className="pk-ln" disabled={busy} onClick={() => void save({ tripId: t.id })}>
          <TripCover photos={t.photos} title={t.title} />
          <span>
            <b>{t.title}</b>
            <span>{words(t)}</span>
          </span>
        </button>
      ))}
      <button type="button" className="pk-ln new" disabled={busy} onClick={() => void save({ newTrip: true })}>
        <span className="pk-th">+</span>
        <span>
          <b>{where.country ? L(`Yeni gezi: ${where.country}`, `New trip: ${where.country}`) : L("Yeni gezi", "New trip")}</b>
        </span>
      </button>
      {where.country && (
        <label className="popup-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {L(`${where.country} için bundan sonra sormadan buraya`, `${where.country} goes there from now on`)}
        </label>
      )}
    </div>
  );
}

/** A trip's cover in the picker (Pinterest's board cover): its photo and its last two saved; else its first letter. */
function TripCover({ photos, title, big = false }: { photos: string[]; title: string; big?: boolean }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = photos.filter((p) => !failed.has(p)).slice(0, big ? 3 : 1);
  return (
    <span className={big ? "pk-cv" : "pk-th"} aria-hidden>
      {shown.length ? shown.map((src) => <img key={src} src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed((f) => new Set(f).add(src))} />) : <i>{title.slice(0, 1).toLocaleUpperCase("tr")}</i>}
    </span>
  );
}
