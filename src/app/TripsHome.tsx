import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { requestProcessing } from "../lib/browser";
import { countdown, countdownText } from "../lib/countdown";
import { initials } from "../lib/heroInfo";
import { L, withLang } from "../lib/i18n";
import { formatDateRange, tripDateRange } from "../lib/items";
import { retryCapture } from "../lib/process";
import { listDrafts, onDraftsChanged, removeDraft, saveDraft } from "../lib/startDrafts";
import { checklist, dative, detectLang, progressOf, splitLinks, tripNamedIn, type StartCtx, type StartMode, type StartState } from "../lib/startTrip";
import { creditLine, creditOf } from "../lib/cityImages";
import { tripCardPhoto, tripCardPlaces } from "../lib/tripBrief";
import { isDemoTrip } from "../lib/trips";
import { getSettings, listMessages, onChanged } from "../lib/db";
import type { Capture, ChatMessage, Item, Settings, Trip } from "../lib/types";
import { RoutingLine } from "./Chat";
import { UiIcon } from "./cards/Silhouettes";
import { addImages, addLinks } from "./capture";
import { FallbackImg } from "./FallbackImg";
import { HeroIcon, type HeroIconName } from "./Icons";
import { useMyPhoto, usePeoplePhotos } from "./Profile";
import { JoinShared } from "./Share";
import { joinTr } from "./TripPanel";

/** What opens the start chat: a mode (the chips), what was typed, or a draft to go on with. */
export interface StartLaunch {
  mode: StartMode;
  text?: string;
  label?: string;
  /** Said first by the assistant (links typed with the words were saved). */
  note?: string;
  draft?: StartState;
}

interface Props {
  trips: Trip[];
  items: Item[];
  openCaptures: Capture[];
  onOpen: (tripId: string) => void;
  onDemo: () => void;
  onSettings: () => void;
  /** The start chat (spec 2026-10-06 §2). */
  onStart: (launch: StartLaunch) => void;
  /** "Porto'da bir otel daha" said for a trip there is: that trip opens and its chat gets the line. */
  onAddToTrip: (tripId: string, text: string) => void;
  ctx: StartCtx;
  menu: React.ReactNode;
}

const MODES: { mode: StartMode | "join"; icon: HeroIconName; label: () => string }[] = [
  { mode: "plan", icon: "sparkle", label: () => L("Yeni gezi planla", "Create a new trip") },
  { mode: "inspire", icon: "globe", label: () => L("Bana ilham ver", "Inspire me where to go") },
  { mode: "road", icon: "car", label: () => L("Yol gezisi", "Plan a road trip") },
  { mode: "lastminute", icon: "clock", label: () => L("Son dakika kaçamağı", "A last-minute escape") },
  { mode: "join", icon: "users", label: () => L("Paylaşılan geziye katıl", "Join a shared trip") },
];

/** The people's own colours (v11: Emre violet, Sabine teal), then the rest of the set, the same name the same colour. */
const FACES = ["#5b45e0", "#1d8577", "#c0256b", "#b5761c", "#2563c9", "#5d8a1c"];
const faceColour = (name: string, order: string[]) => FACES[Math.max(0, order.indexOf(name)) % FACES.length];

/** A face: the photo when there is one, else the initials on the person's colour. */
function Face({ name, photo, colour, size = 30 }: { name: string; photo: string | null; colour: string; size?: number }) {
  return (
    <span className="hm-face" style={{ width: size, height: size, background: photo ? undefined : colour, fontSize: Math.round(size * 0.4) }} title={name}>
      {photo ? <img src={photo} alt="" /> : initials(name) || <HeroIcon name="user" size={Math.round(size * 0.55)} />}
    </span>
  );
}

/** "Claude Sonnet 5.5", "Gemini 3 Flash": the model in words for the corner card. */
function modelName(s: Settings): string {
  const id = s.provider === "gemini" ? s.geminiModel : s.model;
  const words = id
    .replace(/-preview$|-\d{8}$/g, "")
    .split("-")
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
  // "5 5" → "5.5"; "4 5" → "4.5"
  return words.join(" ").replace(/(\d) (\d)\b/g, "$1.$2");
}

/**
 * "Seyahatlerim" (Layla-style home, spec §2; v11 look, 2026-10-09): the app frame with its top bar, a big question and
 * one box on the left, the traveller's corner on the right (who they are, who they travel with, how many trips and
 * bookings, which AI), the trips below as v11 cards. A link, a file or a pasted screenshot is read and sorted into its
 * trip as before; typed words start a trip by chat (or, when they name a trip there is, ask which). A half-done
 * interview waits as a dashed draft card.
 */
export function TripsHome({ trips, items, openCaptures, onOpen, onDemo, onSettings, onStart, onAddToTrip, ctx, menu }: Props) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ask, setAsk] = useState<{ trip: Trip; text: string } | null>(null);
  const [drafts, setDrafts] = useState<StartState[]>([]);
  const [removed, setRemoved] = useState<StartState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const myPhoto = useMyPhoto();
  const peoplePhoto = usePeoplePhotos();
  const working = openCaptures.filter((c) => c.status !== "error");
  const failed = openCaptures.filter((c) => c.status === "error");
  const ordered = [...trips].sort((a, b) => Number(isDemoTrip(a)) - Number(isDemoTrip(b)) || b.updatedAt - a.updatedAt);

  useEffect(() => {
    const load = () => void listDrafts().then(setDrafts);
    load();
    return onDraftsChanged(load);
  }, []);
  useEffect(() => {
    const load = () => void getSettings().then(setSettings, () => setSettings(null));
    load();
    const changed = () => load();
    chrome.storage?.onChanged?.addListener(changed);
    return () => chrome.storage?.onChanged?.removeListener(changed);
  }, []);
  // Bekleyen kayıtlar: a page asked about when there was no trip to ask in (placeCheck.ts: lines of no trip, "").
  const [waiting, setWaiting] = useState<ChatMessage[]>([]);
  useEffect(() => {
    const load = () => void listMessages("").then((rows) => setWaiting(rows.filter((m) => m.routing?.kind === "ask" && !m.routing.answer)));
    load();
    return onChanged(load);
  }, []);
  // "Taslak silindi · Geri al" for a few seconds.
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(t);
  }, [removed]);

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void addImages(files);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addImages(Array.from(e.dataTransfer.files));
  }

  async function submit(mode: StartMode = "plan", label?: string) {
    const typed = text.trim();
    // Links: read and sorted into their trips, as always; words typed with them go on to the conversation.
    const { links, words } = splitLinks(typed);
    if (links.length && (await addLinks(links.join(" ")))) {
      setText("");
      if (!words) return;
    }
    const said = links.length ? words : typed;
    // Said in the language the words are written in: the chat goes on in it (revision 2, item 1).
    const note = links.length && said ? withLang(detectLang(said), () => L("Linki kaydettim; geri kalanını konuşalım.", "I've saved the link; let's talk about the rest.")) : undefined;
    if (!said) return onStart({ mode, label });
    const named = mode === "plan" ? tripNamedIn(said, trips, items) : null;
    if (named) return setAsk({ trip: named.trip, text: said });
    setText("");
    onStart({ mode, text: said, label, note });
  }

  // Who they travel with: every name on their trips but their own, the most frequent first.
  const me = ctx.myName?.trim() || null;
  const companions = (() => {
    const count = new Map<string, number>();
    for (const t of trips) for (const n of t.travellers?.names ?? []) if (n.trim() && n.trim().toLocaleLowerCase() !== me?.toLocaleLowerCase()) count.set(n.trim(), (count.get(n.trim()) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  })();
  // The faces' colours follow this order (me first); my face without a name is the person icon.
  const people = [me ?? "", ...companions];
  const real = trips.filter((t) => !isDemoTrip(t));
  const booked = items.filter((i) => i.status === "booked" && real.some((t) => t.id === i.tripId)).length;
  const today = ctx.today;
  const next = real
    .map((t) => ({ t, range: t.confirmedDates ?? tripDateRange(items.filter((i) => i.tripId === t.id && i.status !== "dismissed")) }))
    .filter((x) => x.range && x.range.end >= today)
    .sort((a, b) => a.range!.start.localeCompare(b.range!.start))[0];
  const nextIn = next ? countdownText(countdown(next.range, today)) : null;

  return (
    <div className="home st-home hm" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div className="hm-frame">
        <header className="hm-bar">
          <span className="hm-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z" fill="currentColor" />
            </svg>
            <span className="st-brand">Trip Radar</span>
          </span>
          <span className="hm-bar-sp" />
          <button type="button" className="hm-me" onClick={onSettings} title={L("Profil ve ayarlar", "Profile and settings")}>
            <Face name={people[0]} photo={myPhoto} colour={FACES[0]} size={30} />
            <span className="hm-me-name">{me ?? L("Profilin", "Your profile")}</span>
          </button>
          <div className="home-menu">{menu}</div>
        </header>

        <section className="hm-hero">
          <div className="hm-ask">
            <h1 className="st-hello">
              {me ? <span className="hm-hi">{L(`Merhaba ${me},`, `Hey ${me},`)}</span> : null}
              {me ? L("sıradaki gezi nereye?", "where are we going next?") : L("Sıradaki gezi nereye?", "Where are we going next?")}
            </h1>
            {waiting.length > 0 && (
              <section className="home-waiting" aria-label={L("Bekleyen kayıtlar", "Waiting saves")}>
                <div className="home-waiting-h">{L("Bekleyen kayıtlar", "Waiting saves")}</div>
                {waiting.map((m) => m.routing && <RoutingLine key={m.id} m={m} routing={m.routing} trips={trips} />)}
              </section>
            )}
            <form
              className={`st-prompt${dragging ? " drag" : ""}`}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <textarea
                value={text}
                rows={2}
                aria-label={L("Gezi kutusu", "Trip box")}
                placeholder={L("Bali'ye 3 hafta, Sabine'yle… ya da bir link yapıştır", "Three weeks in Bali with Sabine… or paste a link")}
                onChange={(e) => {
                  setText(e.target.value);
                  setAsk(null);
                }}
                onPaste={onPaste}
                onKeyDown={(e) => {
                  // Enter sends; never while an input method is still composing (Japanese, Chinese, Korean…).
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="st-prompt-foot">
                <button type="button" className="st-clip" aria-label={L("Ekran görüntüsü ekle", "Add a screenshot")} title={L("Ekran görüntüsü ekle", "Add a screenshot")} onClick={() => fileInput.current?.click()}>
                  <UiIcon name="clip" size={18} />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void addImages(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
                <span className="st-prompt-hint">{L("Kiminle, ne zaman, nasıl bir gezi: ne kadar anlatırsan plan o kadar hazır gelir.", "Who with, when, what kind of trip: the more you say, the readier the plan.")}</span>
                <button className="st-go" type="submit">
                  {L("Planlamaya başla", "Start planning")} <span aria-hidden>↗</span>
                </button>
              </div>
            </form>
            {ask && (
              <div className="st-ask" role="group" aria-label={L("Hangi gezi?", "Which trip?")}>
                <span>{L(`${dative(ask.trip.title)} mi ekleyeyim, yeni gezi mi?`, `Add it to ${ask.trip.title}, or a new trip?`)}</span>
                <button type="button" className="st-primary" onClick={() => (setAsk(null), setText(""), onAddToTrip(ask.trip.id, ask.text))}>
                  {L(`${dative(ask.trip.title)} ekle`, `Add to ${ask.trip.title}`)}
                </button>
                <button type="button" className="st-chip" onClick={() => (setAsk(null), setText(""), onStart({ mode: "plan", text: ask.text }))}>
                  {L("Yeni gezi", "New trip")}
                </button>
              </div>
            )}
            <div className="st-starts">
              {MODES.map((m) => (
                <button key={m.mode} type="button" className="st-start" onClick={() => (m.mode === "join" ? setJoining(true) : void submit(m.mode, m.label()))}>
                  <HeroIcon name={m.icon} size={16} /> {m.label()}
                </button>
              ))}
            </div>
            {joining && (
              <div className="st-join">
                <JoinShared startOpen onJoined={onOpen} onCancel={() => setJoining(false)} />
              </div>
            )}
          </div>

          <aside className="hm-corner" aria-label={L("Senin köşen", "Your corner")}>
            <div className="hm-corner-me">
              <Face name={people[0]} photo={myPhoto} colour={FACES[0]} size={48} />
              <div>
                <div className="hm-corner-name">{me ?? L("Adını ekle", "Add your name")}</div>
                <button type="button" className="hm-link" onClick={onSettings}>
                  {me ? L("Profil ve ayarlar", "Profile and settings") : L("Profilini kur ›", "Set up your profile ›")}
                </button>
              </div>
            </div>
            <div className="hm-corner-block">
              <div className="hm-corner-h">{L("Yol arkadaşların", "Who you travel with")}</div>
              {companions.length ? (
                <div className="hm-people">
                  {companions.slice(0, 5).map((n) => (
                    <span key={n} className="hm-person">
                      <Face name={n} photo={peoplePhoto(n)} colour={faceColour(n, people)} size={28} />
                      <span>{n}</span>
                    </span>
                  ))}
                  {companions.length > 5 && <span className="hm-more">+{companions.length - 5}</span>}
                </div>
              ) : (
                <p className="hm-quiet">{L("Birlikte gittiklerin gezilerinden buraya gelir.", "The people on your trips show up here.")}</p>
              )}
            </div>
            <div className="hm-corner-block hm-stats">
              <div>
                <b>{real.length}</b>
                <span>{L("gezi", real.length === 1 ? "trip" : "trips")}</span>
              </div>
              <div>
                <b>{booked}</b>
                <span>{L("rezervasyon", booked === 1 ? "booking" : "bookings")}</span>
              </div>
              <div>
                <b>{drafts.length}</b>
                <span>{L("taslak", drafts.length === 1 ? "draft" : "drafts")}</span>
              </div>
            </div>
            {next && nextIn && (
              <button type="button" className="hm-corner-block hm-next" onClick={() => onOpen(next.t.id)}>
                <span className="hm-corner-h">{L("Sıradaki gezin", "Your next trip")}</span>
                <span className="hm-next-line">
                  <b>{next.t.title}</b>
                  <span className="hm-pill">{nextIn}</span>
                </span>
              </button>
            )}
            {settings && (
              <div className="hm-corner-block hm-ai">
                <HeroIcon name="spark" size={16} />
                <span>
                  {(settings.provider === "gemini" ? settings.geminiKey : settings.apiKey) ? L("Asistan: ", "Assistant: ") : L("Asistan bağlı değil · ", "No assistant yet · ")}
                  {(settings.provider === "gemini" ? settings.geminiKey : settings.apiKey) ? <b>{modelName(settings)}</b> : null}
                </span>
                <button type="button" className="hm-link" onClick={onSettings}>
                  {L("Değiştir", "Change")}
                </button>
              </div>
            )}
          </aside>
        </section>
      </div>

      {(working.length > 0 || failed.length > 0) && (
        <div className="errors">
          {working.length > 0 && <div className="muted">
              {L(`${working.length} kayıt işleniyor…`, `Processing ${working.length} save${working.length === 1 ? "" : "s"}…`)}
            </div>}
          {failed.map((c) => (
            <div key={c.id}>
              <span className="error-text" title={c.error ?? ""}>
                <span className="err">⚠ {c.title || c.url || L("Ekran görüntüsü", "Screenshot")}</span>
                <span className="muted">
                  {" · "}
                  {c.error}
                </span>
              </span>
              <button
                className="small-btn"
                onClick={async () => {
                  await retryCapture(c.id);
                  requestProcessing();
                }}
              >
                {L("Tekrar dene", "Try again")}
              </button>
            </div>
          ))}
        </div>
      )}

      {trips.length === 0 && drafts.length === 0 ? (
        <div className="trips-empty">
          <h2>{L("İlk seçeneğini kaydet", "Save your first option")}</h2>
          <ol>
            <li>
              <a href="#settings" onClick={onSettings}>
                {L("Ücretsiz Gemini anahtarını bağla", "Connect a free Gemini key")}
              </a>{" "}
              {L("(1 dakika, kart gerekmez).", "(1 minute, no card needed).")}
            </li>
            <li>
              {L(
                "Bir otel, uçuş, etkinlik ya da eSIM sayfasındayken araç çubuğundaki Trip Radar simgesine tıkla (veya Alt+Shift+S).",
                "On a hotel, flight, activity or eSIM page, click the Trip Radar icon in the toolbar (or Alt+Shift+S).",
              )}
            </li>
            <li>
              {L(
                "Gezi kendiliğinden oluşur: aynı yer ve yakın tarihler aynı geziye, başka yer ya da uzak tarih yeni geziye.",
                "Trips sort themselves: the same place and close dates join one trip, another place or far-off dates start a new one.",
              )}
            </li>
          </ol>
          <button className="btn-link" style={{ fontSize: 15, marginTop: 12 }} onClick={onDemo}>
            {L("Örnek geziyi yükle →", "Load the sample trip →")}
          </button>
        </div>
      ) : (
        <section className="hm-trips">
          <div className="hm-trips-h">
            <h2 className="st-section">{L("Seyahatlerim", "My trips")}</h2>
            <span className="hm-count">{trips.length + drafts.length}</span>
          </div>
          <div className="trip-grid">
            {drafts.map((d) => {
              const p = progressOf(checklist(d, ctx));
              return (
                <div key={d.id} className="st-draft">
                  <button type="button" className="st-draft-open" onClick={() => onStart({ mode: d.mode, draft: d })}>
                    <div className="st-draft-top">
                      <span className="hm-stage hm-stage-search">{L("Taslak", "Draft")}</span>
                      <span className="st-draft-place">{d.where?.place ?? L("Yeni gezi", "New trip")}</span>
                    </div>
                    <div className="trip-card-body">
                      <div className="trip-card-title">{d.where?.place ?? L("Yeni gezi", "New trip")}</div>
                      <div className="hm-bar-line" aria-hidden>
                        <i style={{ width: `${(p.done / Math.max(1, p.total)) * 100}%` }} className="hm-seg-lav" />
                      </div>
                      <div className="muted">{L(`${p.done}/${p.total} bilgi · yarıda kaldı`, `${p.done}/${p.total} answers · left halfway`)}</div>
                      <div className="st-draft-go">{L("Taslak · Devam et", "Draft · Continue")} →</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="st-draft-x"
                    aria-label={L("Taslağı sil", "Delete the draft")}
                    onClick={() => void removeDraft(d.id).then((gone) => gone && setRemoved(gone))}
                  >
                    <UiIcon name="x" size={14} />
                  </button>
                </div>
              );
            })}
            {ordered.map((trip) => {
              const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
              const range = trip.confirmedDates ?? tripDateRange(own);
              // Where it stays and does things: not the home the flight back lands in, nor an eSIM's country.
              const cities = tripCardPlaces(own);
              const nBooked = own.filter((i) => i.status === "booked").length;
              const nChosen = own.filter((i) => i.status === "chosen").length;
              const nSaved = own.length - nBooked - nChosen;
              // The photo its board's hero shows, as stored (none fetched from the list); the gradient without one.
              const image = tripCardPhoto(trip, own);
              // Too small for the credit line: who took it on hover ("Fotoğraf: Ana Lima / Unsplash"); the board's hero links it.
              const credit = creditOf(image, trip.photoCredits);
              const line = credit ? creditLine(credit) : null;
              const photoBy = line ? `${line.label} ${[line.by?.text, line.source.text].filter(Boolean).join(" / ")}` : undefined;
              const when = countdownText(countdown(range, today));
              const names = trip.travellers?.names?.filter((n) => n.trim()) ?? [];
              const total = Math.max(1, own.length);
              return (
                <button key={trip.id} className="trip-card" onClick={() => onOpen(trip.id)}>
                  <span className="trip-card-pic">
                    <FallbackImg className="trip-card-img" src={image} title={photoBy} fallback={<span className="trip-card-img" />} />
                    {cities.length > 0 && (
                      <span className="hm-tabs" aria-hidden>
                        {cities.slice(0, 3).map((c, i) => (
                          <span key={c} className={i === 0 ? "on" : ""}>
                            {c}
                          </span>
                        ))}
                      </span>
                    )}
                    {when && <span className="hm-pill hm-pill-on">{when}</span>}
                  </span>
                  <span className="trip-card-body">
                    <span className="trip-card-title">
                      {trip.title}
                      {isDemoTrip(trip) && <span className="badge">{L("Örnek", "Sample")}</span>}
                      {trip.shareId && <span className="badge">{L("Paylaşılan", "Shared")}</span>}
                    </span>
                    <span className="hm-when">
                      <HeroIcon name="cal" size={15} />
                      {[range ? formatDateRange(range.start, range.end) : null, cities.length ? joinTr(cities) : null].filter(Boolean).join(" · ") ||
                        L("Tarih ve yer kaydettikçe netleşir", "Dates and places fill in as you save")}
                    </span>
                    <span className="hm-bar-line" aria-hidden>
                      <i className="hm-seg-book" style={{ width: `${(nBooked / total) * 100}%` }} />
                      <i className="hm-seg-plan" style={{ width: `${(nChosen / total) * 100}%` }} />
                    </span>
                    <span className="trip-card-meta">
                      <span className="hm-stages">
                        <span><i className="hm-dot hm-dot-book" />{L(`${nBooked} rezerve`, `${nBooked} booked`)}</span>
                        <span><i className="hm-dot hm-dot-plan" />{L(`${nChosen} seçildi`, `${nChosen} chosen`)}</span>
                        <span><i className="hm-dot" />{L(`${nSaved} kayıt`, `${nSaved} saved`)}</span>
                      </span>
                      {names.length > 0 && (
                        <span className="hm-faces" title={names.join(", ")}>
                          {names.slice(0, 3).map((n) => (
                            <Face key={n} name={n} photo={n === me ? myPhoto : peoplePhoto(n)} colour={faceColour(n, people)} size={24} />
                          ))}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {removed && (
        <div className="pk-undo" role="status" aria-live="polite">
          <span>{L("Taslak silindi", "Draft deleted")}</span>
          <button type="button" onClick={() => void saveDraft(removed).then(() => setRemoved(null))}>
            {L("Geri al", "Undo")}
          </button>
        </div>
      )}
    </div>
  );
}
