import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { sendMessage } from "../lib/assistant";
import { L, lang } from "../lib/i18n";
import { reloadIfLangChanged } from "./langSwitch";
import { noChangeNote } from "../lib/claims";
import { describeError } from "../lib/llm";
import { shownReply } from "../lib/replyText";
import { answerHeld, answerStray, RoutingChanged, undoMove } from "../lib/routing";
import type { Capture, ChatMessage, HeldAnswer, Item, RoutingNote, Trip } from "../lib/types";
import { DOC_ACCEPT } from "../lib/docs";
import { DropOverlay } from "./arrive/ArriveViews";
import { useChatArrivals } from "./arrive/ChatArrivals";
import { requestReveal } from "./arrive/intake";
import { droppedLinks, useDropZone } from "./arrive/useDropZone";
import { addLinks, addTripFiles, isTripFile } from "./capture";
import { UiIcon } from "./cards/Silhouettes";
import { ArrowUp, Back } from "./Icons";

interface Props {
  trip: Trip;
  messages: ChatMessage[];
  onBack: () => void;
  /** Every trip's records, the trips and the captures being read: for the chips under links and files. */
  items: Item[];
  trips: Trip[];
  openCaptures: Capture[];
  /** A line handed over from the home ("Porto'da bir otel daha" for this trip): sent as if typed here, once. */
  pending?: { id: string; text: string } | null;
  onPendingTaken?: (id: string) => void;
}

/** The selected trip's own conversation; every trip has its own chat and context. */
export function Chat({ trip, messages, onBack, items, trips, openCaptures, pending, onPendingTaken }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const visible = messages.filter((m) => m.text.trim() !== "");
  const last = visible.at(-1);
  const choices = last?.role === "assistant" && !busy ? last.choices : [];
  // Links and files handed here this session, with their chips (arrive/ChatArrivals.tsx).
  const arrivals = useChatArrivals({ trip, messages: visible, items, trips, openCaptures });

  // Block body on purpose: newer Chrome returns a Promise from scrollIntoView, and a value returned
  // from an effect is treated as its cleanup function (React then crashes calling it).
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [arrivals.rows.length, busy]);

  async function submit(value = text) {
    const input = value.trim();
    if (!input || busy) return;
    setError(null);
    if (await addLinks(input, { tripId: trip.id, source: "chat" })) {
      setText("");
      return;
    }
    setText("");
    setBusy(true);
    const langBefore = lang();
    let failed = false;
    try {
      await sendMessage(trip.id, input);
    } catch (e) {
      failed = true;
      setError(describeError(e));
    } finally {
      setBusy(false);
      // "Türkçeye geç": the reply is saved; the board opens again in the new language, with its "Geri al". Not after
      // an error: the error stays on screen (the language switched is there on the next load all the same).
      if (!failed) reloadIfLangChanged(trip.id, langBefore);
    }
  }

  // A line handed over from the home goes through submit() like a typed one (busy, "Düşünüyor…", the language reload).
  const taken = useRef<string | null>(null);
  useEffect(() => {
    if (!pending || busy || taken.current === pending.id) return;
    taken.current = pending.id;
    onPendingTaken?.(pending.id);
    void submit(pending.text);
  });

  /** PDFs and pictures (0.34.6): kept in Belgeler and read; a page's screenshot goes the old way. */
  async function addFiles(files: File[]) {
    if (!files.length) return;
    setError(null);
    try {
      // Each file shows as a bubble with its chip while it's read (arrive/intake).
      const problems = await addTripFiles(trip.id, files, "chat");
      const unshown = problems.filter((p) => !p.logged);
      if (unshown.length) setError(unshown.map((p) => p.text).join(" "));
    } catch (e) {
      setError(describeError(e));
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.some(isTripFile)) {
      e.preventDefault();
      void addFiles(files);
    }
  }

  // Files or links dragged over the chat: a calm overlay, then read like a paste or a pick.
  const drop = useDropZone<HTMLElement>((dt) => {
    if (dt.files.length) return void addFiles(Array.from(dt.files));
    const links = droppedLinks(dt);
    if (links) void addLinks(links, { tripId: trip.id, source: "chat" });
  });
  const dragging = drop.rect != null;

  return (
    <section className="chat" {...drop.handlers}>
      {drop.rect && <DropOverlay rect={drop.rect} />}
      <div className="chat-top">
        <button className="trip-switch" onClick={onBack}>
          <Back /> {L("Seyahatlerim", "My trips")}
        </button>
        <div className="chat-title">{L("Asistan", "Assistant")}</div>
        <div className="muted chat-sub">{L(`${trip.title} için`, `For ${trip.title}`)}</div>
      </div>

      <div className="messages">
        {arrivals.rows.length === 0 && (
          <div className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
            {L(
              'Seçeneklerini kaydettikçe burada birlikte karar veririz. Bütçeni, neyin önemli olduğunu ya da "hangisi daha iyi?" diye sorabilirsin.',
              'Save your options and we\'ll decide here together. Tell me your budget, what matters to you, or ask "which one is better?"',
            )}
          </div>
        )}
        {arrivals.rows.map((row) => {
          if (row.kind === "intake") return arrivals.bubble(row.e);
          const m = row.m;
          // A capture that went to the trip of its place, or the question about one (placeCheck.ts).
          if (m.routing) return <RoutingLine key={m.id} m={m} routing={m.routing} trips={trips} />;
          // An event line about a record goes to its card ("✓ Casa Azul kaydedildi → Konaklama").
          const about = arrivals.eventItem(m);
          if (about) {
            return (
              <button key={m.id} type="button" className="msg-event ar-ev" title={L("Panoda göster", "Show on the board")} onClick={() => requestReveal(about.id)}>
                {m.text}
              </button>
            );
          }
          const line = (
            <div key={m.id} className={`msg-${m.role}`}>
              {/* A reply stored before the filter (the raw trip state as the answer) is cleaned here too. */}
              <RichText text={m.role === "assistant" ? shownReply(m.text) : m.text} />
              {/* A change said with no tool that made it (claims.ts): on screen only, never in the model's history. */}
              {m.role === "assistant" && m.unbacked && <p className="msg-note">{noChangeNote()}</p>}
            </div>
          );
          return row.file ? (
            <div key={m.id} className="ar-sent">
              {line}
              {arrivals.fileChip(row.file)}
            </div>
          ) : (
            line
          );
        })}
        {choices.length > 0 && (
          <div className="choices">
            {choices.map((c, i) => (
              <button key={c} className={i === 0 ? "btn-primary" : "btn-link"} onClick={() => void submit(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        {busy && <div className="thinking">{L("Düşünüyor…", "Thinking…")}</div>}
        {error && <div className="chat-error">{error}</div>}
        <div ref={bottom} />
      </div>

      <form className={`composer${dragging ? " drag" : ""}`} onSubmit={(e) => (e.preventDefault(), void submit())}>
        <button type="button" className="icon-btn" title={L("Belge ya da görsel ekle (PDF, PNG, JPG)", "Add a document or picture (PDF, PNG, JPG)")}
          aria-label={L("Belge ya da görsel ekle", "Add a document or picture")} onClick={() => fileInput.current?.click()}>
          <UiIcon name="clip" size={18} />
        </button>
        <input
          type="file"
          accept={`${DOC_ACCEPT},image/*`}
          multiple
          hidden
          ref={fileInput}
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          type="text"
          placeholder={L("Bir link bırak, görsel yapıştır veya yaz…", "Drop a link, paste an image or type…")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
        />
        <button type="submit" className="send-btn" disabled={!text.trim() || busy} aria-label={L("Gönder", "Send")}>
          <ArrowUp />
        </button>
      </form>
    </section>
  );
}

/** Opens a trip by its address (App follows #trip=…); the same address again still opens it. */
function openTrip(id: string) {
  const hash = `#trip=${id}`;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}

/**
 * "↪ Nusa Penida … Bali gezine eklendi · Aç · Geri al", or the question about a capture that wasn't added
 * ("Bu yer Endonezya'da, gezin Portekiz'de. Nereye ekleyeyim?") with its answers; once answered, what was done.
 */
export function RoutingLine({ m, routing, trips }: { m: ChatMessage; routing: RoutingNote; trips: Trip[] }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const title = (id: string | undefined) => trips.find((t) => t.id === id)?.title ?? null;
  async function act(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (e) {
      setProblem(e instanceof RoutingChanged ? e.message : describeError(e));
    } finally {
      setBusy(false);
    }
  }
  let actions: ReactNode = null;
  if (routing.kind === "moved") {
    const there = title(routing.toTripId);
    actions = routing.undoneAt ? (
      <span className="muted">{routing.far ? L("Geri alındı · bu geziye eklendi, bir güne konmadı", "Taken back · added to this trip, on no day") : L("Geri alındı · bu geziye eklendi", "Taken back · added to this trip")}</span>
    ) : (
      <>
        {there && (
          <button type="button" className="btn-link" onClick={() => openTrip(routing.toTripId)}>
            {L("Aç", "Open")}
          </button>
        )}
        {!routing.merged && (
          <button type="button" className="btn-link" disabled={busy} onClick={() => void act(() => undoMove(m.id))}>
            {L("Geri al", "Undo")}
          </button>
        )}
      </>
    );
  } else if (routing.kind === "stray") {
    const done = { move: L("taşındı", "moved"), keep: L("burada kalıyor", "stays here"), remove: L("plandan çıkarıldı", "taken off the plan") };
    actions = (
      <ul className="msg-route-strays">
        {routing.entries.map((e) => {
          const there = title(e.toTripId ?? undefined);
          const answer = (a: "move" | "keep" | "remove") => () => void act(() => answerStray(m.id, e.itemId, a));
          return (
            <li key={e.itemId} data-stray={e.itemId}>
              <span className="msg-route-name">{e.name} ({e.country})</span>
              {e.answer ? (
                <span className="muted">{done[e.answer]}</span>
              ) : (
                <>
                  {there && <button type="button" className="small-btn" disabled={busy} onClick={answer("move")}>{L(`${there} gezisine taşı`, `Move to ${there}`)}</button>}
                  <button type="button" className="small-btn" disabled={busy} onClick={answer("keep")}>{L("Burada kalsın", "Keep it here")}</button>
                  <button type="button" className="btn-link" disabled={busy} onClick={answer("remove")}>{L("Plandan çıkar", "Take off the plan")}</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  } else if (routing.answer) {
    const went = title(routing.answeredTripId);
    actions = <span className="muted">{routing.answer === "skip" || !went ? L("Eklenmedi", "Not added") : L(`→ ${went} gezisine eklendi`, `→ Added to ${went}`)}</span>;
  } else {
    const answer = (a: HeldAnswer) => () => void act(() => answerHeld(routing.captureId, a));
    const there = title(routing.toTripId ?? undefined);
    actions =
      routing.reason === "place" ? (
        <>
          <button type="button" className="small-btn" disabled={busy} onClick={answer("here")}>{L("Bu geziye yine de ekle", "Add to this trip anyway")}</button>
          {there ? (
            <button type="button" className="small-btn" disabled={busy} onClick={answer("there")}>{L(`${there} gezisine ekle`, `Add to ${there}`)}</button>
          ) : (
            <button type="button" className="small-btn" disabled={busy} onClick={answer("new")}>{L(`Yeni gezi: ${routing.newTitle}`, `New trip: ${routing.newTitle}`)}</button>
          )}
          <button type="button" className="btn-link" disabled={busy} onClick={answer("skip")}>{L("Ekleme", "Don't add")}</button>
        </>
      ) : (
        <>
          <button type="button" className="small-btn" disabled={busy} onClick={answer("here")}>{L("Yine de ekle", "Add it anyway")}</button>
          <button type="button" className="btn-link" disabled={busy} onClick={answer("skip")}>{L("Ekleme", "Don't add")}</button>
        </>
      );
  }
  return (
    <div className={`msg-route${(routing.kind === "ask" && !routing.answer) || (routing.kind === "stray" && routing.entries.some((e) => !e.answer)) ? " ask" : ""}`} data-routing={routing.kind}>
      <div>{m.text}</div>
      <div className="msg-route-actions">{actions}</div>
      {problem && <div className="chat-error">{problem}</div>}
    </div>
  );
}

/** The model's light formatting: **bold** is shown bold, everything else as plain text. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}
