// The start chat (spec §2): the conversation on the left, each question with its quick answers, "Atla" and
// free typing; "Gezin şekilleniyor N/6" on the right with the live preview of the trip and "Oluştur". The code
// asks and answers at once; the model, when there is one, reads a typed message and writes a richer reply in the
// same call (its line replaces the code's when it comes in time), and proposes the route. Every change is kept as
// a draft (startDrafts.ts) until the trip is made.
//
// Revision 2: the chat speaks the language of its first typed message (state.lang: every line is made inside
// withLang, whatever the board's language); a small row says what is going on while waiting ("Düşünüyor…",
// "Yazıyor…"); photos, the route and the rules' suggestions are prepared in the draft while chatting (item 7), so
// "Oluştur" mostly writes what is there; "Oluştur" works once the destination is known.
//
// Revision 3: a message's reading isn't thrown away with a slow reply: the screen stops waiting for the model's
// words after REPLY_MS, but its reading is applied whenever it lands (READ_MS), filling what is still empty. The
// route never holds the chat: a classic circuit is proposed at once for popular countries, the model's refines it
// when it comes; with neither, the chat says it is drawing the route and goes on ("Rotayı çiziyor…" on the ROTA
// row only). "Oluştur" can be pressed whenever the destination is known, also while the model is working: the
// pending reply is dropped (the turn guard) and the best route there is gets built.
import { useEffect, useRef, useState } from "react";
import { L, withLang } from "../../lib/i18n";
import { loadHome } from "../../lib/passport";
import { wouldMake } from "../../lib/startCreate";
import { removeDraft, saveDraft, worthKeeping } from "../../lib/startDrafts";
import { rulesPreview } from "../../lib/startHooks";
import {
  applyAnswer, applyExtracted, applyText, askAgain, budgetChips, budgetWord, canGenerate, checklist, drawingLine, isComplete, knownLines, mergeExtracted,
  missingForGenerate, modelReplyText, NOT_UNDERSTOOD, nextQuestion, onlyEmpty, parseRouteText, parseStartText, photosToFind, preparedRoute, previewOf,
  questionOf, replyText, restoreRoute, routeForGenerate, routeKey, routeToPrepare, rulesKey, saysSomething, singleRoute, skip, totalNights, wantsRouteAdvice,
  whereKey, withPhotos, withPreparedRoute, withTypedLang,
  type Answer, type Extracted, type QuestionId, type StartCtx, type StartRoute, type StartState,
} from "../../lib/startTrip";
import { STYLE_META, STYLES, type BudgetLevel, type StyleId } from "../../lib/tripStyle";
import { ArrowUp, Back, HeroIcon } from "../Icons";
import { Checklist, ChecklistBar, GenerateCard } from "./Checklist";
import { Generating } from "./Generating";
import { findPhotos, modelAvailable, proposeRoute, READ_MS, readAndReply, REPLY_MS, within } from "./model";
import { TripPreview } from "./Preview";
// The suggestions' review as the generating screen's last step, and the rules' preview (registered through startHooks).
import "./registerReview";

interface Props {
  /** The interview to go on with (a new one, or a draft's). */
  initial: StartState;
  /** Said on the home before the chat opened: the first message. */
  firstText?: string;
  /** The home chip pressed ("Yeni gezi planla"): said as the traveller's first line. */
  firstLabel?: string;
  /** Said first by the assistant (links typed with the words were saved: "Linki kaydettim; geri kalanını konuşalım."). */
  firstNote?: string;
  ctx: StartCtx;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

/** What the chat is waiting for: reading a message it couldn't read itself (holds the answers back), writing a line (doesn't). */
type Stage = "thinking" | "writing" | null;

const today = () => new Date().toISOString().slice(0, 10);
const LATE = Symbol("late");

export function StartChat({ initial, firstText, firstLabel, firstNote, ctx, onClose, onCreated }: Props) {
  const [state, setState] = useState(initial);
  const live = useRef(initial);
  const [stage, setStageState] = useState<Stage>(null);
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState<string | null>(null);
  const [phase, setPhaseState] = useState<"chat" | "generating">("chat");
  // Read after every wait: an answer that comes back after "Gezimi oluştur", or after the screen was left, is dropped.
  const phaseNow = useRef<"chat" | "generating">("chat");
  const setPhase = (p: "chat" | "generating") => {
    phaseNow.current = p;
    setPhaseState(p);
  };
  const left = useRef(false);
  const busy = useRef(false);
  /** Each message of the traveller's is a turn: a line still being written for an earlier one is dropped. */
  const turn = useRef(0);
  const stale = () => left.current || phaseNow.current !== "chat";
  const [dayPick, setDayPick] = useState("");
  const [picking, setPicking] = useState<{ styles: StyleId[]; budget: BudgetLevel | null }>({ styles: initial.styles, budget: initial.budget });
  const [dateOpen, setDateOpen] = useState(false);
  const model = useRef<Promise<boolean> | null>(null);
  /** The model's availability once known (false until then: nothing waits for it). */
  const modelOk = useRef(false);
  const home = useRef<Promise<string | null> | null>(null);
  const routeJob = useRef<{ key: string; promise: Promise<StartRoute | null> } | null>(null);
  /** The route key being drawn now (the ROTA row says so). */
  const [drawingKey, setDrawingKeyState] = useState<string | null>(null);
  const drawingRef = useRef<string | null>(null);
  const setDrawingKey = (k: string | null) => {
    drawingRef.current = k;
    setDrawingKeyState(k);
  };
  /** The chat said it is drawing the route (this turn): the proposal is said when it comes. */
  const drawingSaid = useRef(false);
  /** The model's calls on their way: stopped when the screen is left or the trip is made. */
  const inflight = useRef(new Set<AbortController>());
  const photoJob = useRef("");
  const rulesJob = useRef("");
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  if (!model.current) {
    model.current = modelAvailable();
    void model.current.then((ok) => (modelOk.current = ok));
  }
  home.current ??= loadHome().catch(() => null);

  /** In the chat's language (the state as it is now). */
  const T = <R,>(fn: () => R): R => withLang(live.current.lang, fn);

  const saving = useRef<Promise<void>>(Promise.resolve());
  /** The state as it is now (async answers read this, never a stale render's); saved one after another, the last wins. */
  function commit(next: StartState) {
    // Nothing is written once the screen was left or the draft went (no draft comes back as a ghost).
    if (left.current) return;
    live.current = next;
    setState(next);
    saving.current = saving.current.then(() => saveDraft(next)).catch(() => undefined);
  }
  const lineIds = useRef(0);
  const say = (s: StartState, role: "user" | "assistant", line: string): StartState => ({
    ...s,
    messages: [...s.messages, { role, text: line, at: Date.now(), id: `${Date.now().toString(36)}-${++lineIds.current}` }],
    updatedAt: Date.now(),
  });
  /** The line at `at` said again in other words (the model's): the same line (its id kept, so it isn't made anew). */
  const replaceLine = (s: StartState, at: number, line: string): StartState =>
    s.messages[at]?.role === "assistant" ? { ...s, messages: s.messages.map((m, i) => (i === at ? { ...m, text: line } : m)), updatedAt: Date.now() } : s;
  const isLast = (s: StartState, at: number | null) => at != null && at === s.messages.length - 1;

  const setStage = (st: Stage) => {
    busy.current = st === "thinking";
    setStageState(st);
  };
  /** A new message from the traveller: anything still on its way for the last one is dropped. */
  const nextTurn = () => {
    setStage(null);
    drawingSaid.current = false;
    return ++turn.current;
  };
  const track = () => {
    const c = new AbortController();
    inflight.current.add(c);
    return c;
  };
  const stopAll = () => {
    for (const c of inflight.current) c.abort();
    inflight.current.clear();
  };

  // --- the route: one call per place and nights, started as soon as they're settled (item 7); never waited for --

  function startRoute(s: StartState): Promise<StartRoute | null> {
    const key = routeKey(s)!;
    const controller = track();
    const promise = (async () => proposeRoute(s, await model.current!, controller.signal))();
    routeJob.current = { key, promise };
    setDrawingKey(key);
    void promise.then((route) => {
      inflight.current.delete(controller);
      if (drawingRef.current === key) setDrawingKey(null);
      // Stopped (the trip is being made, the screen left): asked again if the chat comes back to it.
      if (controller.signal.aborted) {
        if (routeJob.current?.key === key) routeJob.current = null;
        return;
      }
      if (stale() || !wantsRouteAdvice(s)) return;
      // Kept (a model's answer, or the one stop it fell back to) so the same place and nights never ask again.
      const before = live.current;
      const next = withPreparedRoute(before, key, route);
      commit(next);
      routeArrived(before, next);
    });
    return promise;
  }

  /**
   * The route's proposal came (rev 3): said when the chat said it was drawing it; a classic circuit on screen that
   * the model's refines has its line said again. Nothing is asked again once the route is agreed or the chat moved on.
   */
  function routeArrived(before: StartState, next: StartState) {
    if (nextQuestion(next) !== "route" || !next.route || next.route.confirmed || busy.current) return;
    const at = next.messages.length - 1;
    const last = next.messages[at];
    if (last?.role !== "assistant") return;
    if (!before.route) {
      if (!drawingSaid.current) return;
      drawingSaid.current = false;
      commit(say(next, "assistant", T(() => questionOf(next, "route", ctx).text)));
      return;
    }
    if (before.route === next.route) return;
    const was = T(() => questionOf(before, "route", ctx).text);
    if (last.text.endsWith(was)) commit(replaceLine(next, at, last.text.slice(0, last.text.length - was.length) + T(() => questionOf(next, "route", ctx).text)));
  }

  /**
   * When the route is the question now and there is no proposal yet: the prepared one or the classic circuit at
   * once; with neither, the model's on its way (started now if it wasn't): true, the chat says it's drawing and goes
   * on. Without the model, one stop.
   */
  function routeNow(): boolean {
    const s = live.current;
    if (nextQuestion(s) !== "route" || s.route || s.editingRoute) return false;
    const ready = T(() => restoreRoute(s));
    if (ready.route) {
      commit(ready);
      return false;
    }
    const key = routeKey(s);
    const asked = key && routeJob.current?.key === key && drawingRef.current === key;
    if (key && (asked || (modelOk.current && wantsRouteAdvice(s) && preparedRoute(s) === undefined && !s.guess))) {
      if (!asked) startRoute(s);
      drawingSaid.current = true;
      return true;
    }
    const single = T(() => singleRoute(s));
    if (single) commit({ ...s, route: single });
    return false;
  }

  /** After an answer: the route when it's time for one (never waited for), then the next line. The line's index, or null. */
  function reply(before: StartState, after: StartState, write?: (next: StartState, drawing: boolean) => string): number | null {
    if (stale()) return null;
    // The answer is kept at once (a draft left meanwhile has it).
    if (after !== live.current) commit(after);
    const drawing = routeNow();
    const next = live.current;
    commit(say(next, "assistant", T(() => (write ? write(next, drawing) : replyText(before, next, ctx, drawing)))));
    setPicking({ styles: next.styles, budget: next.budget });
    setPlaceholder(null);
    setDateOpen(false);
    setDayPick("");
    return live.current.messages.length - 1;
  }

  /**
   * A message's reading that came after the reply stopped being waited for (rev 3). Nothing said since: taken as if
   * it came in time, its line said again with what it read. Something said since: only what's still empty is filled,
   * and when that changes the question, the chat says so.
   */
  function lateReading(read: Extracted, code: Extracted, line: string, q: QuestionId | null, mine: number, before: StartState, at: number | null) {
    if (stale()) return;
    const now = live.current;
    if (turn.current === mine && !busy.current) {
      const more = T(() => applyText(now, line, mergeExtracted(code, read), Date.now(), q));
      if (!more.understood) return;
      commit(more.state);
      const drawing = routeNow();
      const after = live.current;
      const words = T(() => replyText(before, after, ctx, drawing));
      commit(isLast(after, at) ? replaceLine(after, at!, words) : say(after, "assistant", words));
      setPicking({ styles: after.styles, budget: after.budget });
      return;
    }
    const fill = onlyEmpty(now, mergeExtracted(code, read));
    if (!saysSomething(fill)) return;
    const asked = nextQuestion(now);
    const next = T(() => applyExtracted(now, fill, Date.now()));
    commit(next);
    if (busy.current || nextQuestion(next) === asked || next.messages.at(-1)?.role !== "assistant") return;
    const drawing = routeNow();
    const after = live.current;
    commit(say(after, "assistant", T(() => replyText(now, after, ctx, drawing))));
    setPicking({ styles: after.styles, budget: after.budget });
  }

  // The first lines: the home's message or chip, then the first question.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    // A draft left right after the traveller's line (before the answer came): its question is asked again.
    if (initial.messages.length) return void (initial.messages.at(-1)?.role === "user" && reply(initial, initial));
    if (firstNote) commit(say(firstText?.trim() ? withTypedLang(initial, firstText) : initial, "assistant", firstNote));
    if (firstText?.trim()) void send(firstText);
    else {
      const start = say(live.current, "user", firstLabel ?? T(() => L("Yeni gezi planla", "Plan a new trip")));
      commit(start);
      reply(start, start);
    }
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [state.messages.length, stage]);

  // The typing box ready on open; the screen left (unmounted): every answer still on its way is dropped and stopped.
  useEffect(() => {
    left.current = false;
    input.current?.focus();
    return () => {
      left.current = true;
      stopAll();
    };
  }, []);

  // Built in the background while chatting (item 7), into the draft only: the photos of the place (and its stops),
  // the route proposal once the place and nights are settled, the rules' suggestions for what would be made.
  useEffect(() => {
    if (phase !== "chat" || left.current) return;
    const s = live.current;
    const rk = routeToPrepare(s);
    if (rk && routeJob.current?.key !== rk) {
      void model.current!.then((ok) => {
        if (ok && !stale() && routeToPrepare(live.current) === rk && routeJob.current?.key !== rk) startRoute(live.current);
      });
    }
    const wk = whereKey(s);
    const missing = photosToFind(s);
    const pk = `${wk}:${missing.join(",")}`;
    if (wk && missing.length && photoJob.current !== pk) {
      photoJob.current = pk;
      void findPhotos(missing, s).then((found) => !left.current && commit(withPhotos(live.current, wk, found)));
    }
    const preview = rulesPreview();
    const key = T(() => rulesKey(s));
    if (preview && key && s.prepared.rules?.key !== key && rulesJob.current !== key) {
      rulesJob.current = key;
      void home.current!.then((h) => {
        const now = live.current;
        if (left.current || T(() => rulesKey(now)) !== key) return;
        let titles: string[] = [];
        try {
          const made = wouldMake(now);
          if (made) titles = T(() => preview(made.trip, made.items, h));
        } catch (error) {
          console.warn("[start] the rules' preview", error);
        }
        commit({ ...live.current, prepared: { ...live.current.prepared, rules: { key, titles } } });
      });
    }
  }, [state, phase]);

  function answer(a: Answer, label: string) {
    if (busy.current || stale()) return;
    nextTurn();
    const before = live.current;
    const asked = say(before, "user", label);
    commit(asked);
    const after = applyAnswer(asked, a, Date.now());
    if (a.q === "route" && a.action === "change") {
      commit(say(after, "assistant", T(() => questionOf(after, "route", ctx).text)));
      return;
    }
    // A quick answer costs no model call: the code's line (with the place's words from the small table).
    reply(before, after);
  }

  function onSkip(q: QuestionId) {
    if (busy.current || stale()) return;
    nextTurn();
    const before = live.current;
    const asked = say(before, "user", T(() => L("Atla", "Skip")));
    reply(before, skip(asked, q, Date.now()));
  }

  async function send(raw = text) {
    const line = raw.trim();
    if (!line || busy.current || stale()) return;
    setText("");
    const mine = nextTurn();
    // The first typed line decides the chat's language (item 1).
    const before = withTypedLang(live.current, line);
    const q = nextQuestion(before);
    const asked = say(before, "user", line);
    commit(asked);
    // The stops typed after "Değiştir": "Ubud 12, Canggu 19".
    // (Typed over a proposal too; anything else typed then goes on as an ordinary message.)
    if (q === "route") {
      const parsed = T(() => parseRouteText(line, totalNights(before) ?? 0));
      if (!("error" in parsed)) return void reply(before, { ...asked, route: parsed.route, editingRoute: false, asking: null });
      if (before.editingRoute || !before.route) return commit(say(asked, "assistant", parsed.error));
    }
    // The code reads it at once, bound to the question it answers (item 2).
    const code = T(() => parseStartText(line, today(), q));
    const first = T(() => applyText(asked, line, code, Date.now(), q));
    const hasModel = await model.current!;
    if (stale() || turn.current !== mine) return;
    if (first.understood) {
      // The code's line now; the model's (one call: its reading and its words) replaces it when it comes in time.
      const predicted = nextQuestion(first.state);
      const controller = hasModel ? track() : null;
      const pending = controller
        ? readAndReply({ text: line, today: today(), pending: q, next: predicted, known: T(() => knownLines(first.state, ctx)), lang: asked.lang }, READ_MS, controller.signal).finally(() =>
            inflight.current.delete(controller),
          )
        : null;
      const at = reply(before, first.state);
      if (!pending || at == null) return;
      setStage("writing");
      // Its words are waited for REPLY_MS at most; its reading is applied whenever it lands (rev 3).
      const got = await within(pending, REPLY_MS, LATE);
      if (turn.current === mine) setStage(null);
      if (got === LATE) {
        void pending.then((late) => late && lateReading(late.read, code, line, q, mine, before, at));
        return;
      }
      if (!got || stale()) return;
      if (turn.current !== mine) return lateReading(got.read, code, line, q, mine, before, at);
      // What the model read that the code missed is added (bound to the same question); then its words.
      const more = T(() => applyText(live.current, line, mergeExtracted(code, got.read), Date.now(), q));
      if (more.understood) commit(more.state);
      // What it added may make the route the question now: the circuit at once, or the chat says it is drawing it.
      const drawing = routeNow();
      const now = live.current;
      if (isLast(now, at)) commit(replaceLine(now, at, T(() => modelReplyText(before, now, ctx, got.reply, predicted, drawing))));
      if (more.understood) setPicking({ styles: now.styles, budget: now.budget });
      return;
    }
    if (!hasModel) return commit(say(live.current, "assistant", T(NOT_UNDERSTOOD)));
    // Nothing the code knows: the model reads it, the traveller waits ("Düşünüyor…").
    setStage("thinking");
    const controller = track();
    const got = await readAndReply({ text: line, today: today(), pending: q, next: q, known: T(() => knownLines(asked, ctx)), lang: asked.lang }, READ_MS, controller.signal);
    inflight.current.delete(controller);
    if (turn.current === mine) setStage(null);
    if (stale() || turn.current !== mine) return;
    const { state: after, understood } = T(() => applyText(live.current, line, mergeExtracted(code, got?.read ?? null), Date.now(), q));
    if (!understood) return commit(say(live.current, "assistant", T(NOT_UNDERSTOOD)));
    reply(before, after, (next, drawing) => modelReplyText(before, next, ctx, got?.reply ?? null, q, drawing));
  }

  function ask(q: QuestionId) {
    nextTurn();
    const next = askAgain(live.current, q, Date.now());
    commit(next);
    // The route's row pressed before a proposal came: the circuit at once, or the chat says it is drawing it.
    const drawing = routeNow();
    const now = live.current;
    commit(say(now, "assistant", T(() => (q === "route" && drawing ? drawingLine() : questionOf(now, q, ctx).text))));
    setPicking({ styles: now.styles, budget: now.budget });
  }

  function generate() {
    // Once; whatever is on its way is dropped (its reply would land on the trip being made) and stopped.
    if (stale() || !canGenerate(live.current)) return;
    nextTurn();
    stopAll();
    const s = live.current;
    const label = T(() => (isComplete(s) ? L("Gezimi oluştur", "Generate my trip") : L("Şimdilik bununla oluştur", "Generate with this for now")));
    // The best route there is (rev 3): the agreed one, the proposal on screen, the classic circuit, or one stop.
    const route = T(() => routeForGenerate(s));
    commit(say({ ...s, route: route ?? s.route, editingRoute: false, asking: null }, "user", label));
    setDrawingKey(null);
    setPhase("generating");
  }

  /** The draft goes (after any save still on its way, so none brings it back). */
  function forget() {
    const id = live.current.id;
    left.current = true;
    saving.current = saving.current.then(() => removeDraft(id)).then(() => undefined, () => undefined);
  }

  function close() {
    if (!worthKeeping(live.current)) forget();
    left.current = true;
    stopAll();
    onClose();
  }

  const lang = state.lang;
  return withLang(lang, () => {
    const q = nextQuestion(state);
    const question = q ? questionOf(state, q, ctx) : null;
    const rows = checklist(state, ctx);
    const ready = canGenerate(state);
    const complete = isComplete(state);
    const preview = previewOf(state, ctx);
    const last = state.messages.at(-1);
    const holding = stage === "thinking";
    // The route being drawn for the place and nights now (rev 3): said on the ROTA row only; its chips wait for it.
    const drawing = Boolean(drawingKey && drawingKey === routeKey(state) && !state.route);
    const showChips = phase === "chat" && !holding && question && last?.role === "assistant" && !(question.id === "route" && drawing && !state.editingRoute);
    const generating = phase === "generating";
    const stageText = stage === "writing" ? L("Yazıyor…", "Writing…") : L("Düşünüyor…", "Thinking…");

    return (
      <div className={`st-screen${generating ? " generating" : ""}`} lang={lang}>
        <section className="st-chat">
          <div className="st-top">
            <button type="button" className="trip-switch" onClick={close} disabled={generating}>
              <Back /> {L("Seyahatlerim", "My trips")}
            </button>
            <div className="st-top-title">{state.where ? L(`${state.where.place} · yeni gezi`, `${state.where.place} · new trip`) : L("Yeni gezi", "New trip")}</div>
          </div>
          {!generating && <ChecklistBar rows={rows} onAsk={ask} ready={ready} complete={complete} onGenerate={generate} disabled={holding} drawing={drawing} lang={lang} />}
          <div className="st-msgs" role="log" aria-live="polite" aria-label={L("Sohbet", "Conversation")}>
            {state.messages.map((m, i) => (
              <div key={m.id ?? `line-${i}`} className={m.role === "user" ? "st-msg-user" : "st-msg-bot"}>
                {m.text}
              </div>
            ))}
            {showChips && question && (
              <div className="st-answers">
                {question.hint && <div className="st-hint">{question.hint}</div>}
                {question.multi ? (
                  <>
                    <div className="st-chips" role="group" aria-label={L("Tarz", "Style")}>
                      {(Object.keys(STYLES) as StyleId[]).map((id) => {
                        const on = picking.styles.includes(id);
                        return (
                          <button key={id} type="button" className={`st-chip st-style${on ? " on" : ""}`} aria-pressed={on}
                            style={on ? { background: STYLE_META[id].bg, color: STYLE_META[id].fg, borderColor: STYLE_META[id].fg } : undefined}
                            onClick={() => setPicking((p) => ({ ...p, styles: on ? p.styles.filter((x) => x !== id) : [...p.styles, id] }))}>
                            <HeroIcon name={STYLE_META[id].icon} size={15} /> {STYLES[id]()}
                          </button>
                        );
                      })}
                    </div>
                    <div className="st-chips" role="group" aria-label={L("Bütçe", "Budget")}>
                      {budgetChips().map(([level, label]) => {
                        const on = picking.budget === level;
                        return (
                          <button key={level} type="button" className={`st-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => setPicking((p) => ({ ...p, budget: on ? null : level }))}>
                            <HeroIcon name="wallet" size={15} /> {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="st-chips">
                      <button type="button" className="st-primary" onClick={() => void answer({ q: "want", ...picking }, withLang(lang, () => [picking.styles.map((id) => STYLES[id]()).join(", "), picking.budget ? budgetWord(picking.budget) : ""].filter(Boolean).join(" · ") || L("Fark etmez", "Anything goes")))}>
                        {L("Tamam", "Done")}
                      </button>
                      <button type="button" className="st-skip" onClick={() => void onSkip(question.id)}>
                        {L("Atla", "Skip")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="st-chips">
                    {question.chips.map((c, i) => (
                      <button key={c.label} type="button" className={`st-chip${i === 0 && (question.id === "from" || question.id === "route") ? " first" : ""}`} onClick={() => void answer(c.answer, c.label)}>
                        {c.label}
                      </button>
                    ))}
                    {question.other && (
                      <button type="button" className="st-chip" onClick={() => (setPlaceholder(withLang(lang, () => (question.id === "from" ? L("Şehrini yaz…", "Type your city…") : L("Yerin adını yaz…", "Type the place…")))), input.current?.focus())}>
                        {L("Başka…", "Other…")}
                      </button>
                    )}
                    {question.id === "day" && (
                      <span className="st-day">
                        <input type="date" className="st-date" aria-label={L("Başlangıç günü", "Start day")} min={today()}
                          value={dayPick || (state.start?.date ?? "")} onChange={(e) => setDayPick(e.target.value)} />
                        <button type="button" className="st-primary" disabled={!(dayPick || state.start?.date)}
                          onClick={() => {
                            const date = dayPick || state.start!.date;
                            void answer({ q: "day", date, part: null }, date.split("-").reverse().join("."));
                          }}>
                          {L("Bu gün", "This day")}
                        </button>
                      </span>
                    )}
                    {question.date && question.id !== "day" &&
                      (dateOpen ? (
                        <input type="date" className="st-date" min={today()} autoFocus aria-label={L("Başlangıç günü", "Start day")}
                          onChange={(e) => e.target.value && void answer({ q: "start", date: e.target.value, approx: false }, e.target.value.split("-").reverse().join("."))} />
                      ) : (
                        <button type="button" className="st-chip" onClick={() => setDateOpen(true)}>
                          📅 {L("Tarih seç", "Pick a date")}
                        </button>
                      ))}
                    {question.id !== "route" || state.editingRoute || !state.route ? (
                      <button type="button" className="st-skip" onClick={() => void onSkip(question.id)}>
                        {L("Atla", "Skip")}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            <div ref={bottom} />
          </div>
          {/* What it is doing now, said as it changes (item 6): its own status region, outside the conversation's log. */}
          <div className="st-status" role="status" aria-live="polite">
            {stage && (
              <div className="st-thinking" data-stage={stage}>
                <span className="st-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="st-stage">{stageText}</span>
              </div>
            )}
          </div>
          <form className="st-composer" onSubmit={(e) => (e.preventDefault(), void send())}>
            <input ref={input} type="text" value={text} disabled={generating} onChange={(e) => setText(e.target.value)}
              placeholder={placeholder ?? L("Ya da kendin yaz…", "Or type it yourself…")} aria-label={L("Mesaj", "Message")} />
            <button type="submit" className="send-btn" disabled={!text.trim() || holding || generating} aria-label={L("Gönder", "Send")}>
              <ArrowUp />
            </button>
          </form>
        </section>
        <aside className="st-side">
          {generating ? (
            <Generating
              state={state}
              onTripId={(tripId) => commit({ ...live.current, tripId })}
              onFinished={(tripId, keep) => {
                // "Yine de aç" before the conversation reached the trip keeps the draft (nothing said is lost).
                if (keep) left.current = true;
                else forget();
                onCreated(tripId);
              }}
              onBack={() => setPhase("chat")}
            />
          ) : (
            <div className="st-side-inner">
              <Checklist rows={rows} onAsk={ask} disabled={holding} drawing={drawing} lang={lang} />
              <GenerateCard ready={ready} complete={complete} missing={missingForGenerate(state)} onGenerate={generate} lang={lang} />
              {preview && <TripPreview preview={preview} place={state.where?.place ?? ""} lang={lang} />}
            </div>
          )}
        </aside>
      </div>
    );
  });
}
