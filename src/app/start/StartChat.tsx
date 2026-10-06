// The start chat (spec §2): the conversation on the left, each question with its quick answers, "Atla" and
// free typing; "Gezin şekilleniyor N/6" on the right with the live preview of the trip and "Oluştur". The code
// asks and answers at once; the model, when there is one, reads a typed message and writes a richer reply in the
// same call (its line replaces the code's when it comes in time), and proposes the route. Every change is kept as
// a draft (startDrafts.ts) until the trip is made.
//
// Revision 2: the chat speaks the language of its first typed message (state.lang: every line is made inside
// withLang, whatever the board's language); a small row says what is going on while waiting ("Düşünüyor…",
// "Rotayı çiziyor…", "Yazıyor…"); photos, the route and the rules' suggestions are prepared in the draft while
// chatting (item 7), so "Oluştur" mostly writes what is there; "Oluştur" works once the destination is known.
import { useEffect, useRef, useState } from "react";
import { L, withLang } from "../../lib/i18n";
import { loadHome } from "../../lib/passport";
import { wouldMake } from "../../lib/startCreate";
import { removeDraft, saveDraft, worthKeeping } from "../../lib/startDrafts";
import { rulesPreview } from "../../lib/startHooks";
import {
  applyAnswer, applyText, askAgain, canGenerate, checklist, isComplete, knownLines, mergeExtracted, missingForGenerate, modelMayReply, modelReplyText,
  NOT_UNDERSTOOD, nextQuestion, parseRouteText, parseStartText, photosToFind, preparedRoute, previewOf, questionOf, replyText, routeKey, routeToPrepare,
  rulesKey, singleRoute, skip, totalNights, wantsRouteAdvice, whereKey, withPhotos, withPreparedRoute, withTypedLang,
  type Answer, type QuestionId, type StartCtx, type StartRoute, type StartState,
} from "../../lib/startTrip";
import { STYLE_META, STYLES, type BudgetLevel, type StyleId } from "../../lib/tripStyle";
import { ArrowUp, Back, HeroIcon } from "../Icons";
import { Checklist, ChecklistBar, GenerateCard } from "./Checklist";
import { Generating } from "./Generating";
import { findPhotos, LIMIT_MS, modelAvailable, proposeRoute, readAndReply, REPLY_MS, replyTo } from "./model";
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

/** What the chat is waiting for: reading a message, drawing the route (both hold the answers back), writing a line (doesn't). */
type Stage = "thinking" | "route" | "writing" | null;

const today = () => new Date().toISOString().slice(0, 10);

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
  const home = useRef<Promise<string | null> | null>(null);
  const routeJob = useRef<{ key: string; promise: Promise<StartRoute | null> } | null>(null);
  const photoJob = useRef("");
  const rulesJob = useRef("");
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  model.current ??= modelAvailable();
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
  const say = (s: StartState, role: "user" | "assistant", line: string): StartState => ({ ...s, messages: [...s.messages, { role, text: line, at: Date.now() }], updatedAt: Date.now() });
  /** The line at `at` said again in other words (the model's): a new `at`, so it fades in anew. */
  const replaceLine = (s: StartState, at: number, line: string): StartState =>
    s.messages[at]?.role === "assistant" ? { ...s, messages: s.messages.map((m, i) => (i === at ? { ...m, text: line, at: Date.now() } : m)), updatedAt: Date.now() } : s;

  const setStage = (st: Stage) => {
    busy.current = st === "thinking" || st === "route";
    setStageState(st);
  };
  /** A new message from the traveller: anything still on its way for the last one is dropped. */
  const nextTurn = () => {
    setStage(null);
    return ++turn.current;
  };

  // --- the route: one call per place and nights, started as soon as they're settled (item 7) --------------------

  function startRoute(s: StartState): Promise<StartRoute | null> {
    const key = routeKey(s)!;
    const promise = (async () => proposeRoute(s, await model.current!))();
    routeJob.current = { key, promise };
    void promise.then((route) => {
      // Kept (a model's answer, or the one stop it fell back to) so the same place and nights never ask again.
      if (left.current || !wantsRouteAdvice(s)) return;
      commit(withPreparedRoute(live.current, key, route));
    });
    return promise;
  }

  /** The proposal for the place and nights now: kept, on its way, or asked now. */
  async function ensureRoute(s: StartState): Promise<StartRoute | null> {
    const kept = preparedRoute(s);
    if (kept !== undefined) return kept ?? T(() => singleRoute(s));
    const key = routeKey(s);
    const job = key && routeJob.current?.key === key ? routeJob.current.promise : startRoute(s);
    return (await job) ?? T(() => singleRoute(s));
  }

  /** After an answer: a route proposed when it's time for one, then the next line. The line's index, or null. */
  async function reply(before: StartState, after: StartState, write?: (next: StartState) => string): Promise<number | null> {
    if (stale()) return null;
    // The answer is kept at once (a draft left while the route is thought about has it).
    if (after !== live.current) commit(after);
    if (nextQuestion(after) === "route" && !after.route) {
      setStage("route");
      const route = await ensureRoute(after);
      setStage(null);
      if (stale()) return null;
      // The state as it is now, not the one it started from.
      if (!live.current.route) commit({ ...live.current, route });
    }
    const next = live.current;
    commit(say(next, "assistant", T(() => (write ? write(next) : replyText(before, next, ctx)))));
    setPicking({ styles: next.styles, budget: next.budget });
    setPlaceholder(null);
    setDateOpen(false);
    setDayPick("");
    return live.current.messages.length - 1;
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
      void reply(start, start);
    }
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [state.messages.length, stage]);

  // The typing box ready on open; the screen left (unmounted): every answer still on its way is dropped.
  useEffect(() => {
    left.current = false;
    input.current?.focus();
    return () => {
      left.current = true;
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
      void findPhotos(missing).then((found) => !left.current && commit(withPhotos(live.current, wk, found)));
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

  async function answer(a: Answer, label: string) {
    if (busy.current || stale()) return;
    const mine = nextTurn();
    const before = live.current;
    const asked = say(before, "user", label);
    commit(asked);
    const after = applyAnswer(asked, a, Date.now());
    if (a.q === "route" && a.action === "change") {
      commit(say(after, "assistant", T(() => questionOf(after, "route", ctx).text)));
      return;
    }
    const at = await reply(before, after);
    if (at == null || turn.current !== mine) return;
    // The model's words over the code's line, when it may write this one and answers in time.
    const now = live.current;
    if (!(await model.current) || !modelMayReply(before, now)) return;
    if (turn.current !== mine || stale()) return;
    const next = nextQuestion(now);
    setStage("writing");
    const got = await replyTo({ said: label, next, known: T(() => knownLines(now, ctx)), lang: now.lang }, REPLY_MS);
    if (turn.current !== mine) return;
    setStage(null);
    if (!got || stale()) return;
    commit(replaceLine(live.current, at, T(() => modelReplyText(before, live.current, ctx, got, next))));
  }

  async function onSkip(q: QuestionId) {
    if (busy.current || stale()) return;
    nextTurn();
    const before = live.current;
    const asked = say(before, "user", T(() => L("Atla", "Skip")));
    await reply(before, skip(asked, q, Date.now()));
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
      const pending = hasModel
        ? readAndReply({ text: line, today: today(), pending: q, next: predicted, known: T(() => knownLines(first.state, ctx)), lang: asked.lang }, REPLY_MS)
        : null;
      const at = await reply(before, first.state);
      if (!pending || at == null || turn.current !== mine) return;
      setStage("writing");
      const got = await pending;
      if (turn.current !== mine) return;
      setStage(null);
      if (!got || stale()) return;
      // What the model read that the code missed is added (bound to the same question); then its words.
      const more = T(() => applyText(live.current, line, mergeExtracted(code, got.read), Date.now(), q));
      const now = more.understood ? more.state : live.current;
      commit(replaceLine(now, at, T(() => modelReplyText(before, now, ctx, got.reply, predicted))));
      if (more.understood) setPicking({ styles: now.styles, budget: now.budget });
      return;
    }
    if (!hasModel) return commit(say(live.current, "assistant", T(NOT_UNDERSTOOD)));
    // Nothing the code knows: the model reads it, the traveller waits ("Düşünüyor…").
    setStage("thinking");
    const got = await readAndReply({ text: line, today: today(), pending: q, next: q, known: T(() => knownLines(asked, ctx)), lang: asked.lang }, LIMIT_MS);
    setStage(null);
    if (stale() || turn.current !== mine) return;
    const { state: after, understood } = T(() => applyText(live.current, line, mergeExtracted(code, got?.read ?? null), Date.now(), q));
    if (!understood) return commit(say(live.current, "assistant", T(NOT_UNDERSTOOD)));
    await reply(before, after, (next) => modelReplyText(before, next, ctx, got?.reply ?? null, q));
  }

  function ask(q: QuestionId) {
    nextTurn();
    const before = live.current;
    const next = askAgain(before, q, Date.now());
    commit(say(next, "assistant", T(() => questionOf(next, q, ctx).text)));
    setPicking({ styles: next.styles, budget: next.budget });
  }

  function generate() {
    // Once, and never while an answer is on its way (its reply would land on the trip being made).
    if (busy.current || stale() || !canGenerate(live.current)) return;
    nextTurn();
    commit(say(live.current, "user", T(() => (isComplete(live.current) ? L("Gezimi oluştur", "Generate my trip") : L("Şimdilik bununla oluştur", "Generate with this for now")))));
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
    const holding = stage === "thinking" || stage === "route";
    const showChips = phase === "chat" && !holding && question && last?.role === "assistant";
    const generating = phase === "generating";
    const stageText = stage === "route" ? L("Rotayı çiziyor…", "Drawing the route…") : stage === "writing" ? L("Yazıyor…", "Writing…") : L("Düşünüyor…", "Thinking…");

    return (
      <div className={`st-screen${generating ? " generating" : ""}`} lang={lang}>
        <section className="st-chat">
          <div className="st-top">
            <button type="button" className="trip-switch" onClick={close} disabled={generating}>
              <Back /> {L("Seyahatlerim", "My trips")}
            </button>
            <div className="st-top-title">{state.where ? L(`${state.where.place} · yeni gezi`, `${state.where.place} · new trip`) : L("Yeni gezi", "New trip")}</div>
          </div>
          {!generating && <ChecklistBar rows={rows} onAsk={ask} ready={ready} complete={complete} onGenerate={generate} disabled={holding} lang={lang} />}
          <div className="st-msgs" role="log" aria-live="polite" aria-label={L("Sohbet", "Conversation")}>
            {state.messages.map((m, i) => (
              <div key={`${i}:${m.at}`} className={m.role === "user" ? "st-msg-user" : "st-msg-bot"}>
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
                      {([["low", L("Ekonomik", "Budget")], ["mid", L("Orta", "Mid-range")], ["high", L("Lüks", "Luxury")]] as const).map(([level, label]) => {
                        const on = picking.budget === level;
                        return (
                          <button key={level} type="button" className={`st-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => setPicking((p) => ({ ...p, budget: on ? null : level }))}>
                            <HeroIcon name="wallet" size={15} /> {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="st-chips">
                      <button type="button" className="st-primary" onClick={() => void answer({ q: "want", ...picking }, withLang(lang, () => [picking.styles.map((id) => STYLES[id]()).join(", "), picking.budget ? { low: L("Ekonomik", "Budget"), mid: L("Orta bütçe", "Mid-range"), high: L("Lüks bütçe", "Luxury budget") }[picking.budget] : ""].filter(Boolean).join(" · ") || L("Fark etmez", "Anything goes")))}>
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
            {stage && (
              // What it is doing now, said as it changes (item 6): reading, drawing the route, writing.
              <div className="st-thinking" role="status" aria-live="polite" data-stage={stage}>
                <span className="st-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="st-stage">{stageText}</span>
              </div>
            )}
            <div ref={bottom} />
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
              <Checklist rows={rows} onAsk={ask} disabled={holding} lang={lang} />
              <GenerateCard ready={ready} complete={complete} busy={holding} missing={missingForGenerate(state)} onGenerate={generate} lang={lang} />
              {preview && <TripPreview preview={preview} place={state.where?.place ?? ""} lang={lang} />}
            </div>
          )}
        </aside>
      </div>
    );
  });
}
