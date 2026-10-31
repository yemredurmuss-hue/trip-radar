import { useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { withNextStep } from "../lib/startTrip";
import { ChatBusyError, resumeSearches, sendMessage } from "../lib/assistant";
import { chatCards, quickReplies, type ChatCardVM, type PlanTarget } from "../lib/chatCards";
import { chatPeek } from "../lib/chatPeek";
import { chatStatusOf, chatStepsOf, onChatStatus, type ChatStatus, type ChatStep } from "../lib/chatStatus";
import { L, lang } from "../lib/i18n";
import { reloadIfLangChanged } from "./langSwitch";
import { nameTargets, splitNames, type NameTarget } from "../lib/chatNames";
import { noChangeNote } from "../lib/claims";
import { describeError, errorKind, type ErrorKind } from "../lib/llm";
import { MissingKeyError } from "../lib/llm/types";
import { shownReply } from "../lib/replyText";
import { answerDuplicate, answerHeld, answerStray, RoutingChanged, undoMove } from "../lib/routing";
import type { Capture, ChatMessage, HeldAnswer, Item, RoutingNote, Trip } from "../lib/types";
import { DOC_ACCEPT } from "../lib/docs";
import { DropOverlay } from "./arrive/ArriveViews";
import { useChatArrivals } from "./arrive/ChatArrivals";
import { requestReveal } from "./arrive/intake";
import { droppedLinks, useDropZone } from "./arrive/useDropZone";
import { addLinks, addLinksInLine, addTripFiles, isTripFile } from "./capture";
import { UiIcon } from "./cards/Silhouettes";
import { ChatCard } from "./chat/ChatCard";
import type { PlanLink } from "./chat/planLink";
import { QuickReplies } from "./chat/QuickReplies";
import { useChatDrawer } from "./chat/useChatDrawer";
import { EventFold, FOLD_MIN, foldLabel, foldRuns } from "./ChatFold";
import { replyChoices } from "../lib/chatChoices";
import { ChatOffers } from "./ChatOffers";
import { ArrowUp, Back } from "./Icons";
import { Mascot } from "./Mascot";
import { show } from "./Progress";
import { chatWork, sectionsOfWords } from "../lib/chatSections";
import { sectionAdding, sectionEditing, sectionLooking } from "../lib/looking";
import { DONE_FOR, LONG_WAIT, mascotFace, thinkingLine } from "./thinking";

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
  /** The Plan beside it (TripPanel): its boxes for the reply's cards, "Planda göster" and "Bunu seç" (C34). */
  plan?: PlanLink | null;
}

/**
 * The selected trip's own conversation; every trip has its own chat and context. A reply that put a record on the board
 * carries its card (C34), at most three quick replies sit over the box, and under 860 px it is a drawer from the bottom.
 */
export function Chat({ trip, messages, onBack, items, trips, openCaptures, pending, onPendingTaken, plan }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Art arda yazmak (0.44.2, Emre: "beni bekletmesin"): what's sent while the answer is still coming waits here, shown as
  // its own bubble ("Sırada", ×); once the answer is in, all of it goes as the next turn, together, so the AI reads them all.
  const [queued, setQueued] = useState<string[]>([]);
  const queue = useRef<string[]>([]);
  const answering = useRef(false);
  // What the answer is waiting on beyond thinking: a web search ("Web'de arıyorum…"), prices ("Fiyatlara bakıyorum…").
  // A search can run on after its turn's reply (10-30 s): its line stays while the traveller writes on.
  const [status, setStatus] = useState<ChatStatus>(() => chatStatusOf(trip.id));
  // The turn's steps as they're done ("Lizbon otelini fikre alıyorum…"), the board changing with each.
  const [steps, setSteps] = useState<ChatStep[]>(() => chatStepsOf(trip.id));
  useEffect(() => {
    setStatus(chatStatusOf(trip.id));
    setSteps(chatStepsOf(trip.id));
    const stop = onChatStatus((tripId, s) => {
      if (tripId !== trip.id) return;
      setStatus(s);
      setSteps(chatStepsOf(tripId));
    });
    // Searches that were still running when the board was closed land now (each once).
    void resumeSearches(trip.id).catch(() => undefined);
    return stop;
  }, [trip.id]);
  const [error, setError] = useState<string | null>(null);
  // What the traveller can do about it: "settings" (a key to add or fix) and "offline" get the banner atop the chat, not the line.
  const [errKind, setErrKind] = useState<ErrorKind | null>(null);
  const fail = (e: unknown) => {
    setError(describeError(e));
    setErrKind(errorKind(e));
  };
  const clearError = () => {
    setError(null);
    setErrKind(null);
  };
  // The thinking line's clock (a slow answer says so after LONG_WAIT) and the mascot's smile once the answer is in.
  const thinking = busy || status === "web";
  const [waitedLong, setWaitedLong] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const wasThinking = useRef(false);
  useEffect(() => {
    if (thinking) {
      wasThinking.current = true;
      setJustDone(false);
      setWaitedLong(false);
      const t = setTimeout(() => setWaitedLong(true), LONG_WAIT);
      return () => clearTimeout(t);
    }
    if (!wasThinking.current) return;
    wasThinking.current = false;
    setJustDone(true);
    const t = setTimeout(() => setJustDone(false), DONE_FOR);
    return () => clearTimeout(t);
  }, [thinking]);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // The names of the trip's options in the assistant's replies are buttons that go to their cards (Karar Panosu #9).
  const names = useMemo(() => nameTargets(items, trip.id), [items, trip.id]);
  const visible = messages.filter((m) => m.text.trim() !== "");
  // A web search's late line isn't a reply, nor a change line: the reply before them keeps its chips (lib/chatChoices.ts).
  const choices = busy ? [] : replyChoices(visible);
  // Links and files handed here this session, with their chips (arrive/ChatArrivals.tsx).
  const arrivals = useChatArrivals({ trip, messages: visible, items, trips, openCaptures });
  // C34: the record each turn put on the board or suggested, as the Plan's compact card; the quick replies under it all.
  const link = plan?.tripId === trip.id ? plan : null;
  // A card stays on its reply for the session once its record moves on (taken from the card, it says "Seçildi").
  const kept = useRef<{ tripId: string; cards: Map<string, string> }>({ tripId: trip.id, cards: new Map() });
  if (kept.current.tripId !== trip.id) kept.current = { tripId: trip.id, cards: new Map() };
  const cards = useMemo(() => {
    if (!link) return new Map<string, ChatCardVM>();
    const out = chatCards({ trip, messages, items, collections: link.collections, kept: kept.current.cards });
    for (const [id, card] of out) kept.current.cards.set(id, card.itemId);
    return out;
  }, [link, trip, messages, items]);
  const quick = useMemo(() => (link && !busy ? quickReplies({ trip, messages, cards, collections: link.collections }) : []), [link, trip, messages, cards, busy]);
  // Under 860 px: the drawer, its handle's line the last thing said.
  const drawer = useChatDrawer();
  const bodyId = useId();
  const peek = thinking ? thinkingLine(status, waitedLong ? LONG_WAIT : 0) : chatPeek(messages);
  /** "Planda göster": the drawer shuts (the plan is what's to be seen) and the box comes into view, flashing. */
  const showOnPlan = (target: PlanTarget) => {
    drawer.shut();
    link?.show(target);
  };
  const pickOnPlan = (itemId: string, target: PlanTarget) => {
    drawer.shut();
    link?.pick(itemId, target);
  };
  const cardOf = (id: string) => {
    const card = cards.get(id);
    return card ? <ChatCard card={card} onShow={showOnPlan} onPick={pickOnPlan} /> : null;
  };

  // Block body on purpose: newer Chrome returns a Promise from scrollIntoView, and a value returned
  // from an effect is treated as its cleanup function (React then crashes calling it).
  useEffect(() => {
    // Only the messages' own box scrolls (scrollIntoView moved the whole page too: a board opened from the start chat
    // landed at its bottom, 2026-10-09).
    const box = bottom.current?.closest(".messages");
    if (box) box.scrollTop = box.scrollHeight;
    // Each step of the turn as it comes (it's what the traveller watches while the board changes).
  }, [arrivals.rows.length, busy, steps.length, queued.length]);

  async function submit(value = text) {
    const input = value.trim();
    if (!input) return;
    if (answering.current) {
      queue.current = [...queue.current, input];
      setQueued(queue.current);
      setText("");
      return;
    }
    clearError();
    // A link alone, or links inside a line ("Bu hosteli ekle https://…"): saved as candidates, the line their note; a
    // line that also asks something ("… merkeze yakın mı?") goes on to the chat as well.
    const links = await addLinksInLine(input, { tripId: trip.id, source: "chat" });
    if (links === "links") {
      setText("");
      return;
    }
    setText("");
    answering.current = true;
    setBusy(true);
    // Under 860 px the reply is worth seeing: the drawer opens for it.
    drawer.reveal();
    const langBefore = lang();
    let failed = false;
    try {
      const work = sendMessage(trip.id, input);
      // ("Uçuş ekle": Uçuş's row moves from now until the answer lands, "Ekleniyor"; "kaydır" "Düzenleniyor"; lib/chatSections.ts)
      const store = { add: sectionAdding, edit: sectionEditing, search: sectionLooking }[chatWork(input)];
      for (const section of sectionsOfWords(input)) void store.track(section, work).catch(() => undefined);
      await work;
    } catch (e) {
      failed = true;
      fail(e);
      // (refused before it was saved, the chat still busy or no key yet: the words come back to the box, never lost)
      if (e instanceof ChatBusyError || e instanceof MissingKeyError) setText((t) => t || input);
    } finally {
      answering.current = false;
      setBusy(false);
      // (what was written meanwhile: the next turn, all of it at once)
      const next = queue.current;
      queue.current = [];
      setQueued([]);
      if (next.length) void submit(next.join("\n"));
      // "Türkçeye geç": the reply is saved; the board opens again in the new language, with its "Geri al". Not after
      // an error: the error stays on screen (the language switched is there on the next load all the same).
      else if (!failed) reloadIfLangChanged(trip.id, langBefore);
    }
  }
  const unqueue = (n: number) => {
    queue.current = queue.current.filter((_, i) => i !== n);
    setQueued(queue.current);
  };

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
    clearError();
    try {
      // Each file shows as a bubble with its chip while it's read (arrive/intake).
      const problems = await addTripFiles(trip.id, files, "chat");
      const unshown = problems.filter((p) => !p.logged);
      if (unshown.length) setError(unshown.map((p) => p.text).join(" "));
    } catch (e) {
      fail(e);
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
    <section className={`chat${drawer.open ? " open" : ""}`} {...drop.handlers}>
      {drop.rect && <DropOverlay rect={drop.rect} />}
      <div className="chat-top">
        <button className="trip-switch" onClick={onBack}>
          <Back /> {L("Seyahatlerim", "My trips")}
        </button>
        <div className="chat-title">
          {/* The assistant's mascot, in its seat; the opening takes a copy for its flight (opening.ts). */}
          <span className="mascot-seat" data-mascot-seat>
            <Mascot state={mascotFace({ working: thinking, justDone: justDone && !error, error: error != null })} />
          </span>
          {L("Asistan", "Assistant")}
        </div>
        <div className="muted chat-sub">{L(`${trip.title} için`, `For ${trip.title}`)}</div>
      </div>
      {/* Wide: the column's own parts (display: contents). Under 860 px: the drawer from the bottom (chat.css). */}
      <div className="c-sheet" ref={drawer.sheet} onKeyDown={drawer.onKeyDown}>
        {/* The drawer's handle: under 860 px only (the column needs none, and its line would be the chat's words twice). */}
        {drawer.narrow && (
          <button
            type="button"
            ref={drawer.handle}
            className="c-handle"
            aria-expanded={drawer.open}
            aria-controls={bodyId}
            aria-label={drawer.open ? L("Sohbeti kapat", "Close the chat") : L("Sohbeti aç", "Open the chat")}
            onClick={drawer.toggle}
          >
            <i aria-hidden />
            <span className="c-hl">{L("Asistan", "Assistant")}</span>
            {peek && <small className="c-hs">{peek}</small>}
          </button>
        )}
        {/* (hareket dili) "Asistana bağlanamadım · Ayarlar'a git": comes down from the top for what the traveller can fix; it goes once acted on. */}
        {error && errKind && (
          <div className={`chat-banner ${errKind}`} role="alert">
            <Mascot state="oops" size={30} />
            <span>
              <b>{errKind === "settings" ? L("Asistana bağlanamadım.", "I couldn't reach the assistant.") : L("İnternete bağlanamadım.", "I couldn't get online.")}</b> {error}
            </span>
            {errKind === "settings" && (
              <button
                type="button"
                className="small-btn"
                onClick={() => {
                  clearError();
                  location.hash = "#settings";
                }}
              >
                {L("Ayarlar'a git", "Go to Settings")}
              </button>
            )}
          </div>
        )}

        <div className="messages" id={bodyId} ref={drawer.body} tabIndex={-1} aria-label={L("Sohbet", "Chat")}>
          {arrivals.rows.length === 0 && (
            <div className="muted c-empty">
              {L(
                'Seçeneklerini kaydettikçe burada birlikte karar veririz. Bütçeni, neyin önemli olduğunu ya da "hangisi daha iyi?" diye sorabilirsin.',
                'Save your options and we\'ll decide here together. Tell me your budget, what matters to you, or ask "which one is better?"',
              )}
            </div>
          )}
          {foldRows(arrivals.rows, (row) => {
            if (row.kind === "intake") return arrivals.bubble(row.e);
            const m = row.m;
            // A capture that went to the trip of its place, or the question about one (placeCheck.ts).
            if (m.routing) return <RoutingLine key={m.id} m={m} routing={m.routing} trips={trips} />;
            // An event line about a record ("✓ Casa Azul kaydedildi → Konaklama") carries its record's card (C34); without
            // one (the Plan not drawn yet), the line itself goes to the card.
            const about = arrivals.eventItem(m);
            if (about) {
              const card = cardOf(m.id);
              return card ? (
                <div key={m.id} className="c-ev">
                  <div className="msg-event">{m.text}</div>
                  {card}
                </div>
              ) : (
                <button key={m.id} type="button" className="msg-event ar-ev" title={L("Panoda göster", "Show on the board")} onClick={() => requestReveal(about.id)}>
                  {m.text}
                </button>
              );
            }
            const line = (
              <div key={m.id} className={`msg-${m.role}`} data-who={m.role === "assistant" ? L("Asistan", "Assistant") : undefined}>
                {/* A reply stored before the filter (the raw trip state as the answer) is cleaned here too. */}
                <RichText text={m.role === "assistant" ? withNextStep(shownReply(m.text), link?.next) : m.text} links={m.role === "assistant" ? m.webSources : undefined} names={m.role === "assistant" ? names : undefined} />
                {/* A change said with no tool that made it (claims.ts): on screen only, never in the model's history. */}
                {m.role === "assistant" && m.unbacked && <p className="msg-note">{noChangeNote()}</p>}
                {/* find_offers: the real offers it found, as cards with "Ekle". */}
                {m.role === "assistant" && m.offers && <ChatOffers m={m} />}
                {/* C34: the record this turn put on the board or suggested. */}
                {m.role === "assistant" && cardOf(m.id)}
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
          {busy && steps.length > 0 && (
            <ul className="chat-steps" aria-live="polite">
              {steps.map((s, i) => (
                <li key={i} className={s.done ? "done" : "now"}>
                  <span aria-hidden>{s.done ? "✓" : "•"}</span> {s.text}
                </li>
              ))}
            </ul>
          )}
          {thinking && (
            <div className="thinking">
              <span className="th-dots" aria-hidden><i /><i /><i /></span>
              <span key={thinkingLine(status, waitedLong ? LONG_WAIT : 0)} className="th-line">{thinkingLine(status, waitedLong ? LONG_WAIT : 0)}</span>
            </div>
          )}
          {queued.map((q, n) => (
            <div key={`${n}:${q}`} className="msg-user msg-queued">
              <RichText text={q} />
              <span className="msg-q">
                {L("Sırada · cevap bitince gider", "Queued · goes once the answer is in")}
                <button type="button" className="btn-link" aria-label={L("Sıradan çıkar", "Take it out of the queue")} onClick={() => unqueue(n)}>
                  ×
                </button>
              </span>
            </div>
          ))}
          {error && !errKind && <div className="chat-error" role="alert">{error}</div>}
          <div ref={bottom} />
        </div>

        {/* C34: at most three quick replies over the box; a tap is sent as if typed. */}
        <QuickReplies replies={quick} busy={busy} onAsk={(q) => void submit(q)} />

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
            aria-label={L("Asistana yaz", "Write to the assistant")}
            placeholder={L("Bir link bırak, görsel yapıştır veya yaz…", "Drop a link, paste an image or type…")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
          />
          <button type="submit" className="send-btn" disabled={!text.trim()} aria-label={busy ? L("Sıraya ekle", "Add to the queue") : L("Gönder", "Send")}>
            <ArrowUp />
          </button>
        </form>
      </div>
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
  } else if (routing.kind === "duplicate") {
    // The same thing saved again (0.36.55): merged; kept so, or kept apart.
    actions = routing.answer ? (
      <span className="muted">{routing.answer === "separate" ? L("Ayrı tutuldu", "Kept apart") : L("Birleşik kaldı", "Kept merged")}</span>
    ) : (
      <>
        <button type="button" className="small-btn" disabled={busy} onClick={() => void act(() => answerDuplicate(m.id, "merge"))}>
          {L("Birleşik kalsın", "Keep merged")}
        </button>
        <button type="button" className="small-btn" disabled={busy} onClick={() => void act(() => answerDuplicate(m.id, "separate"))}>
          {L("Ayrı tut", "Keep apart")}
        </button>
      </>
    );
  } else if (routing.answer) {
    const went = title(routing.answeredTripId);
    actions = <span className="muted">{routing.answer === "skip" || !went ? L("Eklenmedi", "Not added") : L(`→ ${went} gezisine eklendi`, `→ Added to ${went}`)}</span>;
  } else {
    const answer = (a: HeldAnswer, picked?: string) => () => void act(() => answerHeld(routing.captureId, a, picked));
    const there = title(routing.toTripId ?? undefined);
    // Which trip (saved from the toolbar with two that could be it, 0.39.4): each one, the most likely first, or a new one.
    const picks = (routing.candidates ?? []).filter((id) => title(id));
    actions =
      routing.reason === "trip" && picks.length ? (
        <>
          {picks.map((id) => (
            <button key={id} type="button" className="small-btn" disabled={busy} onClick={answer("there", id)}>{L(`${title(id)} gezisine ekle`, `Add to ${title(id)}`)}</button>
          ))}
          <button type="button" className="small-btn" disabled={busy} onClick={answer("new")}>{L(`Yeni gezi: ${routing.newTitle}`, `New trip: ${routing.newTitle}`)}</button>
          <button type="button" className="btn-link" disabled={busy} onClick={answer("skip")}>{L("Ekleme", "Don't add")}</button>
        </>
      ) : routing.reason === "place" ? (
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
    <div className={`msg-route${(routing.kind === "ask" && !routing.answer) || (routing.kind === "stray" && routing.entries.some((e) => !e.answer)) || (routing.kind === "duplicate" && !routing.answer) ? " ask" : ""}`} data-routing={routing.kind}>
      <div>{m.text}</div>
      <div className="msg-route-actions">{actions}</div>
      {problem && <div className="chat-error">{problem}</div>}
    </div>
  );
}

/** The card of an option the assistant named: on the Pano if that is what is open, else on the Plan (its section opens); it glows once there. */
function goToOption(id: string) {
  const onPano = document.getElementById(`pn-${id}`);
  if (onPano && onPano.offsetParent) show(onPano);
  else requestReveal(id);
}

/** The model's light formatting: **bold** is shown bold, [site](https://…) as a link (a web search's "Kaynak:"), the names of the trip's options as buttons to their cards, everything else as plain text. */
function RichText({ text, links, names }: { text: string; links?: string[]; names?: NameTarget[] }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <b key={i}>
            <Named text={part} names={names} />
          </b>
        ) : (
          <Links key={i} text={part} allowed={links ?? []} names={names} />
        ),
      )}
    </>
  );
}

/** Plain words with the names of the trip's options in them as small buttons ("Jardim Stay ↗"). */
function Named({ text, names }: { text: string; names?: NameTarget[] }) {
  if (!names?.length) return <>{text}</>;
  const pieces = splitNames(text, names);
  if (pieces.length === 1 && typeof pieces[0] === "string") return <>{text}</>;
  return (
    <>
      {pieces.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <button key={i} type="button" className="chat-ref" title={L("Kartta göster", "Show the card")} onClick={() => goToOption(p.id)}>
            {p.text}
          </button>
        ),
      )}
    </>
  );
}

/** [site](https://…): a link only when it's one of that reply's web sources; any other, its host as plain text. */
function Links({ text, allowed, names }: { text: string; allowed: string[]; names?: NameTarget[] }) {
  const parts = text.split(/\[([^\]\n]{1,80})\]\((https:\/\/[^\s)]+)\)/g);
  if (parts.length === 1) return <Named text={text} names={names} />;
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    out.push(<Named key={`t${i}`} text={parts[i]} names={names} />);
    if (i + 2 < parts.length) {
      const url = parts[i + 2];
      out.push(
        allowed.includes(url) ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            {parts[i + 1]}
          </a>
        ) : (
          hostOf(url)
        ),
      );
    }
  }
  return <>{out}</>;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

type ArrivalRow = ReturnType<typeof useChatArrivals>["rows"][number];

/**
 * The rows drawn in order, a run of plain change lines folded into one ("12 değişiklik ▾"). A line that went to a card
 * (its own button), a routing note, a file's line and everything said by a person stay as they are.
 */
function foldRows(all: ArrivalRow[], render: (row: ArrivalRow) => ReactNode): ReactNode[] {
  // P8 (F29): the same question asked again ("… birleştirdim. Ayrı mı tutayım?" on a second save) is shown once, the last.
  const asked = (row: ArrivalRow) => (row.kind === "msg" && row.m.role === "event" && row.m.routing ? row.m.text : null);
  const rows = all.filter((row, i) => {
    const q = asked(row);
    return !q || !all.slice(i + 1).some((later) => asked(later) === q);
  });
  // The start's interview, moved into the trip's chat, folds under one line: the spine said back is what's seen first
  // (omurga 2026-10-31, Emre: "yukarıdakiler kafa karıştırıyor").
  const isStart = (row: ArrivalRow) => row.kind === "msg" && row.m.start === true;
  const starts = rows.filter(isStart);
  const head: ReactNode[] =
    starts.length >= FOLD_MIN
      ? [
          <EventFold key="start-fold" icon="💬" count={starts.length} label={L(`Başlangıç sohbeti · ${starts.length} mesaj`, `How it started · ${starts.length} messages`)}>
            {starts.map(render)}
          </EventFold>,
        ]
      : starts.map(render);
  const rest = starts.length ? rows.filter((row) => !isStart(row)) : rows;
  return [...head, ...foldRuns(rest, (row) => row.kind === "msg" && row.m.role === "event" && !row.m.routing && !row.file).map((g) =>
    "fold" in g ? (
      <EventFold key={`fold-${g.fold[0].kind === "msg" ? g.fold[0].m.id : ""}`} count={g.fold.length} label={foldLabel(g.fold.map((r) => (r.kind === "msg" ? r.m.text : "")))}>
        {g.fold.map(render)}
      </EventFold>
    ) : (
      render(g.row)
    ),
  )];
}
