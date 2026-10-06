import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { requestProcessing } from "../lib/browser";
import { L, withLang } from "../lib/i18n";
import { formatDateRange, tripDateRange } from "../lib/items";
import { retryCapture } from "../lib/process";
import { listDrafts, onDraftsChanged, removeDraft, saveDraft } from "../lib/startDrafts";
import { checklist, dative, detectLang, progressOf, splitLinks, tripNamedIn, type StartCtx, type StartMode, type StartState } from "../lib/startTrip";
import { isDemoTrip } from "../lib/trips";
import { listMessages, onChanged } from "../lib/db";
import type { Capture, ChatMessage, Item, Trip } from "../lib/types";
import { RoutingLine } from "./Chat";
import { UiIcon } from "./cards/Silhouettes";
import { addImages, addLinks } from "./capture";
import { FallbackImg } from "./FallbackImg";
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

const MODES: { mode: StartMode | "join"; icon: string; label: () => string }[] = [
  { mode: "plan", icon: "✨", label: () => L("Yeni gezi planla", "Create a new trip") },
  { mode: "inspire", icon: "🧭", label: () => L("Bana ilham ver", "Inspire me where to go") },
  { mode: "road", icon: "🚙", label: () => L("Yol gezisi", "Plan a road trip") },
  { mode: "lastminute", icon: "⏱", label: () => L("Son dakika kaçamağı", "A last-minute escape") },
  { mode: "join", icon: "🔗", label: () => L("Paylaşılan geziye katıl", "Join a shared trip") },
];

/**
 * "Seyahatlerim" (Layla-style home, spec §2): one big box. A link, a file or a pasted screenshot is read and
 * sorted into its trip as before; typed words start a trip by chat (or, when they name a trip there is, ask
 * which). Every trip below is its own board + chat; a half-done interview waits as a draft card.
 */
export function TripsHome({ trips, items, openCaptures, onOpen, onDemo, onSettings, onStart, onAddToTrip, ctx, menu }: Props) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ask, setAsk] = useState<{ trip: Trip; text: string } | null>(null);
  const [drafts, setDrafts] = useState<StartState[]>([]);
  const [removed, setRemoved] = useState<StartState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const working = openCaptures.filter((c) => c.status !== "error");
  const failed = openCaptures.filter((c) => c.status === "error");
  const ordered = [...trips].sort((a, b) => Number(isDemoTrip(a)) - Number(isDemoTrip(b)) || b.updatedAt - a.updatedAt);

  useEffect(() => {
    const load = () => void listDrafts().then(setDrafts);
    load();
    return onDraftsChanged(load);
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

  const hello = ctx.myName ? L(`Merhaba ${ctx.myName}, sıradaki gezi nereye?`, `Hey ${ctx.myName}, where are we going next?`) : L("Sıradaki gezi nereye?", "Where are we going next?");

  return (
    <div className="home st-home" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <span className="st-blob st-blob-a" aria-hidden />
      <span className="st-blob st-blob-b" aria-hidden />
      <div className="st-hero">
        <div className="home-top st-hero-top">
          <span className="st-brand">Trip Radar</span>
          <div className="home-menu">{menu}</div>
        </div>
        <h1 className="st-hello">{hello}</h1>
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
            <span className="st-prompt-hint">{L("link, ekran görüntüsü ya da yazı", "a link, a screenshot or words")}</span>
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
              <span aria-hidden>{m.icon}</span> {m.label()}
            </button>
          ))}
        </div>
        {joining && (
          <div className="st-join">
            <JoinShared startOpen onJoined={onOpen} onCancel={() => setJoining(false)} />
          </div>
        )}
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
                  {L(" — ", " · ")}
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
        <>
          <h2 className="st-section">{L("Seyahatlerim", "My trips")}</h2>
          <div className="trip-grid">
            {drafts.map((d) => {
              const p = progressOf(checklist(d, ctx));
              return (
                <div key={d.id} className="st-draft">
                  <button type="button" className="st-draft-open" onClick={() => onStart({ mode: d.mode, draft: d })}>
                    <div className="st-draft-top">
                      <span className="badge">{L("Taslak", "Draft")}</span>
                    </div>
                    <div className="trip-card-body">
                      <div className="trip-card-title">{d.where?.place ?? L("Yeni gezi", "New trip")}</div>
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
                    ×
                  </button>
                </div>
              );
            })}
            {ordered.map((trip) => {
              const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
              const range = trip.confirmedDates ?? tripDateRange(own);
              const cities = [...new Set(own.map((i) => i.city).filter(Boolean) as string[])].slice(0, 3);
              const decided = own.filter((i) => i.status === "chosen" || i.status === "booked").length;
              const image = trip.heroImage ?? own.find((i) => i.imageUrl)?.imageUrl ?? null;
              return (
                <button key={trip.id} className="trip-card" onClick={() => onOpen(trip.id)}>
                  <FallbackImg className="trip-card-img" src={image} fallback={<div className="trip-card-img" />} />
                  <div className="trip-card-body">
                    <div className="trip-card-title">
                      {trip.title}
                      {isDemoTrip(trip) && <span className="badge">{L("Örnek", "Sample")}</span>}
                      {trip.shareId && <span className="badge">{L("Paylaşılan", "Shared")}</span>}
                    </div>
                    <div className="muted">
                      {[range ? formatDateRange(range.start, range.end) : null, cities.length ? joinTr(cities) : null]
                        .filter(Boolean)
                        .join(" · ") || L("Tarih ve yer kaydettikçe netleşir", "Dates and places fill in as you save")}
                    </div>
                    <div className="trip-card-meta">
                      {L(
                        `${own.length} kayıt${decided ? ` · ${decided} karar verildi` : ""}`,
                        `${own.length} save${own.length === 1 ? "" : "s"}${decided ? ` · ${decided} decided` : ""}`,
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
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
