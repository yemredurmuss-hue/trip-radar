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
import { companionName, companionSiteOf } from "./lib/companion";
import { chooseItem } from "./app/actions";
import { answerHeld, moveToTrip } from "./lib/routing";
import { isDemoTrip } from "./lib/trips";
import type { Item, Trip } from "./lib/types";
import { reloadIfStale } from "./lib/update";

type State =
  | { step: "saving" }
  | { step: "working"; captureId: string }
  | { step: "done"; text: string; tripId: string; itemId?: string }
  /**
   * Read, not added (placeCheck.ts): the same question the trip's chat asks; reason trip (0.39.4): which of the trips it
   * could be (`candidates`, the most likely first), under the button.
   */
  | { step: "held"; captureId: string; text: string; reason: "place" | "travel" | "trip"; newTitle: string; tripTitle: string | null; candidates?: TripPick[] }
  | { step: "skipped" }
  | { step: "error"; text: string }
  | { step: "hint"; text: string };

class HintError extends Error {}

/** A trip as the popup offers it: its name and its dates when set. */
interface TripPick {
  id: string;
  title: string;
  when: string | null;
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
  const site = companionSiteOf(tab?.url);
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

async function captureActiveTab(onDesk: (desk: Desk) => void): Promise<string> {
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
  const bind = desk.candidate ? { forTripId: desk.candidate.tripId } : desk.planned ? { forTripId: desk.planned.tripId, forNeed: desk.planned.forNeed } : {};
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
      .then((captureId) => setState({ step: "working", captureId }))
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
        const candidates = (await Promise.all((held.candidates ?? []).map((id) => d.get("trips", id)))).filter((t): t is Trip => t != null).map(pickOf);
        setState({ step: "held", captureId: capture.id, text: held.question ?? held.item.name, reason: held.reason, newTitle: held.newTitle, tripTitle: trip?.title ?? null, ...(candidates.length ? { candidates } : {}) });
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
      {desk && (desk.candidate || desk.planned) && <DeskBox desk={desk} />}
      {desk?.site && desk.tabId != null && <AlongBox site={desk.site} tabId={desk.tabId} along={desk.along} />}
      {state.step === "saving" && <p>{L("Sayfa kaydediliyor…", "Saving the page…")}</p>}
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
  async function answer(a: "here" | "there" | "new" | "skip", picked?: string) {
    setBusy(true);
    try {
      const tripId = await answerHeld(state.captureId, a, picked);
      if (!tripId) return onDone({ step: "skipped" });
      const d = await db();
      const trip = await d.get("trips", tripId);
      onDone({ step: "done", text: `${trip?.title ?? ""}`, tripId });
    } catch (error) {
      onDone({ step: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }
  // Which trip (two India trips): each one a button, the most likely first and said so, then a new trip, or none.
  if (state.reason === "trip" && state.candidates?.length) {
    return (
      <div className="popup-held">
        <p>{state.text}</p>
        <div className="popup-held-actions">
          {state.candidates.map((t, n) => (
            <button key={t.id} type="button" className="small-btn" disabled={busy} aria-current={n === 0 ? "true" : undefined} onClick={() => void answer("there", t.id)}>
              {n === 0 ? L(`${pickLabel(t)} (en olası)`, `${pickLabel(t)} (most likely)`) : pickLabel(t)}
            </button>
          ))}
          <button type="button" className="small-btn" disabled={busy} onClick={() => void answer("new")}>{L(`Yeni gezi: ${state.newTitle}`, `New trip: ${state.newTitle}`)}</button>
          <button type="button" className="small-btn" disabled={busy} onClick={() => void answer("skip")}>{L("Ekleme", "Don't add")}</button>
        </div>
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
 * Seviye 2, "Sitede benle gel": asked once per site (Chrome asks for that site's permission); allowed, on that site's
 * searches for a planned flight a strip says which row it is for and each result gets a "+". Taken back here.
 */
function AlongBox({ site, tabId, along }: { site: string; tabId: number; along: boolean }) {
  const [on, setOn] = useState(along);
  const [said, setSaid] = useState<string | null>(null);
  const name = companionName(site);
  async function allow() {
    const granted = await chrome.permissions.request({ origins: [site] }).catch(() => false);
    if (!granted) return setSaid(L("İzin verilmedi; yine de simgeye basınca kaydederim.", "Not allowed; pressing the icon still saves the page."));
    setOn(true);
    await chrome.scripting.executeScript({ target: { tabId }, files: ["companion.js"] }).catch(() => undefined);
    setSaid(L(`Artık ${name}'da yanındayım: planındaki uçuşun aramasında şerit ve sonuçlarda + görürsün.`, `I'm with you on ${name} now: on a search for a planned flight you'll see the strip and a + on each result.`));
  }
  async function stop() {
    await chrome.permissions.remove({ origins: [site] }).catch(() => false);
    setOn(false);
    setSaid(L(`${name}'da artık yokum; sayfa yenilenince şerit gider.`, `I've left ${name}; the strip goes when the page reloads.`));
  }
  return (
    <div className="popup-along">
      {on ? (
        <button type="button" className="btn-link" onClick={() => void stop()}>
          {L(`${name}'da benle gelme`, `Stop coming along on ${name}`)}
        </button>
      ) : (
        <>
          <button type="button" className="small-btn" onClick={() => void allow()}>
            {L(`${name}'da benle gel`, `Come along on ${name}`)}
          </button>
          <span className="muted">{L("Yalnız bu sitede, yalnız planındaki bir uçuşun aramasında; + basmadan hiçbir şey kaydedilmez.", "Only on this site, only on a search for a planned flight; nothing is saved until you press +.")}</span>
        </>
      )}
      {said && <span className="popup-desk-said">{said}</span>}
    </div>
  );
}
