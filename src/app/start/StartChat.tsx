// The start chat (spec §2): the conversation on the left, each question with its quick answers, "Atla" and
// free typing; "Gezin şekilleniyor N/6" on the right with "Gezimi oluştur". The code asks; the model, when
// there is one, only reads a typed message and proposes the route (model.ts). Every change is kept as a draft
// (startDrafts.ts) until the trip is made.
import { useEffect, useRef, useState } from "react";
import { L } from "../../lib/i18n";
import { removeDraft, saveDraft, worthKeeping } from "../../lib/startDrafts";
import {
  applyAnswer, applyText, askAgain, canGenerate, checklist, mergeExtracted, missingForGenerate, NOT_UNDERSTOOD, nextQuestion,
  parseRouteText, parseStartText, questionOf, replyText, skip, totalNights, type Answer, type QuestionId, type StartCtx, type StartState,
} from "../../lib/startTrip";
import { STYLE_META, STYLES, type BudgetLevel, type StyleId } from "../../lib/tripStyle";
import { ArrowUp, Back, HeroIcon } from "../Icons";
import { Checklist, ChecklistBar, GenerateCard } from "./Checklist";
import { Generating } from "./Generating";
import { modelAvailable, proposeRoute, readMessage } from "./model";

interface Props {
  /** The interview to go on with (a new one, or a draft's). */
  initial: StartState;
  /** Said on the home before the chat opened: the first message. */
  firstText?: string;
  /** The home chip pressed ("Yeni gezi planla"): said as the traveller's first line. */
  firstLabel?: string;
  ctx: StartCtx;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function StartChat({ initial, firstText, firstLabel, ctx, onClose, onCreated }: Props) {
  const [state, setState] = useState(initial);
  const live = useRef(initial);
  const [thinking, setThinking] = useState(false);
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState<string | null>(null);
  const [phase, setPhase] = useState<"chat" | "generating">("chat");
  const [picking, setPicking] = useState<{ styles: StyleId[]; budget: BudgetLevel | null }>({ styles: initial.styles, budget: initial.budget });
  const [dateOpen, setDateOpen] = useState(false);
  const model = useRef<Promise<boolean> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  model.current ??= modelAvailable();

  const saving = useRef<Promise<void>>(Promise.resolve());
  /** The state as it is now (async answers read this, never a stale render's); saved one after another, the last wins. */
  function commit(next: StartState) {
    live.current = next;
    setState(next);
    saving.current = saving.current.then(() => saveDraft(next)).catch(() => undefined);
  }
  const say = (s: StartState, role: "user" | "assistant", line: string): StartState => ({ ...s, messages: [...s.messages, { role, text: line, at: Date.now() }], updatedAt: Date.now() });

  /** After an answer: a route proposed when it's time for one, then the next line. */
  async function reply(before: StartState, after: StartState) {
    let next = after;
    if (nextQuestion(next) === "route" && !next.route) {
      setThinking(true);
      const route = await proposeRoute(next, await model.current!);
      setThinking(false);
      // Nothing else is answered while it thinks (the chips and the send button wait).
      next = { ...after, route };
    }
    commit(say(next, "assistant", replyText(before, next, ctx)));
    setPicking({ styles: next.styles, budget: next.budget });
    setPlaceholder(null);
    setDateOpen(false);
  }

  // The first lines: the home's message or chip, then the first question.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    // A draft left right after the traveller's line (before the answer came): its question is asked again.
    if (initial.messages.length) return void (initial.messages.at(-1)?.role === "user" && reply(initial, initial));
    if (firstText?.trim()) void send(firstText);
    else {
      const start = say(initial, "user", firstLabel ?? L("Yeni gezi planla", "Plan a new trip"));
      commit(start);
      void reply(start, start);
    }
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [state.messages.length, thinking]);

  async function answer(a: Answer, label: string) {
    if (thinking) return;
    const before = live.current;
    const asked = say(before, "user", label);
    commit(asked);
    const after = applyAnswer(asked, a, Date.now());
    if (a.q === "route" && a.action === "change") {
      commit(say(after, "assistant", questionOf(after, "route", ctx).text));
      return;
    }
    await reply(before, after);
  }

  async function onSkip(q: QuestionId) {
    if (thinking) return;
    const before = live.current;
    const asked = say(before, "user", L("Atla", "Skip"));
    await reply(before, skip(asked, q, Date.now()));
  }

  async function send(raw = text) {
    const line = raw.trim();
    if (!line || thinking) return;
    setText("");
    const before = live.current;
    const q = nextQuestion(before);
    const asked = say(before, "user", line);
    commit(asked);
    // The stops typed after "Değiştir": "Ubud 12, Canggu 19".
    // (Typed over a proposal too; anything else typed then goes on as an ordinary message.)
    if (q === "route") {
      const parsed = parseRouteText(line, totalNights(before) ?? 0);
      if (!("error" in parsed)) return reply(before, { ...asked, route: parsed.route, editingRoute: false, asking: null });
      if (before.editingRoute || !before.route) return commit(say(asked, "assistant", parsed.error));
    }
    setThinking(true);
    const code = parseStartText(line, today());
    const read = (await model.current!) ? await readMessage(line, today(), q ? questionOf(before, q, ctx).text : null) : null;
    setThinking(false);
    const { state: after, understood } = applyText(live.current, line, mergeExtracted(code, read), Date.now());
    if (!understood) return commit(say(live.current, "assistant", NOT_UNDERSTOOD()));
    await reply(before, after);
  }

  function ask(q: QuestionId) {
    const before = live.current;
    const next = askAgain(before, q, Date.now());
    commit(say(next, "assistant", questionOf(next, q, ctx).text));
    setPicking({ styles: next.styles, budget: next.budget });
  }

  function generate() {
    if (!canGenerate(live.current)) return;
    commit(say(live.current, "user", L("Gezimi oluştur", "Generate my trip")));
    setPhase("generating");
  }

  /** The draft goes (after any save still on its way, so none brings it back). */
  function forget() {
    const id = live.current.id;
    saving.current = saving.current.then(() => removeDraft(id)).then(() => undefined, () => undefined);
  }

  function close() {
    if (!worthKeeping(live.current)) forget();
    onClose();
  }

  const q = nextQuestion(state);
  const question = q ? questionOf(state, q, ctx) : null;
  const rows = checklist(state, ctx);
  const ready = canGenerate(state);
  const last = state.messages.at(-1);
  const showChips = phase === "chat" && !thinking && question && last?.role === "assistant";
  const generating = phase === "generating";

  return (
    <div className={`st-screen${generating ? " generating" : ""}`}>
      <section className="st-chat">
        <div className="st-top">
          <button type="button" className="trip-switch" onClick={close} disabled={generating}>
            <Back /> {L("Seyahatlerim", "My trips")}
          </button>
          <div className="st-top-title">{state.where ? L(`${state.where.place} · yeni gezi`, `${state.where.place} · new trip`) : L("Yeni gezi", "New trip")}</div>
        </div>
        {!generating && <ChecklistBar rows={rows} onAsk={ask} ready={ready} onGenerate={generate} disabled={thinking} />}
        <div className="st-msgs">
          {state.messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "st-msg-user" : "st-msg-bot"}>
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
                    <button type="button" className="st-primary" onClick={() => void answer({ q: "want", ...picking }, [picking.styles.map((id) => STYLES[id]()).join(", "), picking.budget ? { low: L("Ekonomik", "Budget"), mid: L("Orta bütçe", "Mid-range"), high: L("Lüks bütçe", "Luxury budget") }[picking.budget] : ""].filter(Boolean).join(" · ") || L("Fark etmez", "Anything goes"))}>
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
                    <button type="button" className="st-chip" onClick={() => (setPlaceholder(question.id === "from" ? L("Şehrini yaz…", "Type your city…") : L("Yerin adını yaz…", "Type the place…")), input.current?.focus())}>
                      {L("Başka…", "Other…")}
                    </button>
                  )}
                  {question.date &&
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
          {thinking && (
            <div className="st-thinking">
              <span /> <span /> <span /> {L("Düşünüyorum", "Thinking")}
            </div>
          )}
          <div ref={bottom} />
        </div>
        <form className="st-composer" onSubmit={(e) => (e.preventDefault(), void send())}>
          <input ref={input} type="text" value={text} disabled={generating} onChange={(e) => setText(e.target.value)}
            placeholder={placeholder ?? L("Ya da kendin yaz…", "Or type it yourself…")} aria-label={L("Mesaj", "Message")} />
          <button type="submit" className="send-btn" disabled={!text.trim() || thinking || generating} aria-label={L("Gönder", "Send")}>
            <ArrowUp />
          </button>
        </form>
      </section>
      <aside className="st-side">
        {generating ? (
          <Generating
            state={state}
            myName={ctx.myName}
            onTripId={(tripId) => commit({ ...live.current, tripId })}
            onFinished={(tripId) => {
              forget();
              onCreated(tripId);
            }}
            onBack={() => setPhase("chat")}
          />
        ) : (
          <div className="st-side-inner">
            <Checklist rows={rows} onAsk={ask} disabled={thinking} />
            <GenerateCard ready={ready} missing={missingForGenerate(state)} onGenerate={generate} />
          </div>
        )}
      </aside>
    </div>
  );
}
