// What the board chat is doing beyond "Düşünüyor…": the steps of the turn as they're done ("Lizbon otelini fikre
// alıyorum…", each ticked when the next starts; the board changes with each, never all at once at the end), and a web search running ("Web'de arıyorum…"), or the offers'
// sources asked for prices ("Fiyatlara bakıyorum…", find_offers; a first question can take about 10 s). A fresh
// search can take 10-30 s and goes on after the reply that asked for it (the traveller can write meanwhile), so the
// line stays as long as any of the trip's searches runs.
export type ChatStatus = "web" | "offers" | null;
type Work = Exclude<ChatStatus, null>;

type Listener = (tripId: string, status: ChatStatus) => void;
const listeners = new Set<Listener>();
const running = new Map<string, number>();
const keyOf = (tripId: string, work: Work) => `${work}:${tripId}`;

/** The trip's chat status now (for a chat opened while a search runs): a web search first, then prices. */
export const chatStatusOf = (tripId: string): ChatStatus =>
  (running.get(keyOf(tripId, "web")) ?? 0) > 0 ? "web" : (running.get(keyOf(tripId, "offers")) ?? 0) > 0 ? "offers" : null;

function emit(tripId: string) {
  const status = chatStatusOf(tripId);
  for (const l of listeners) l(tripId, status);
}

/** A web search (or a look at the offers' prices) started for the trip's chat. */
export function searchStarted(tripId: string, work: Work = "web"): void {
  const key = keyOf(tripId, work);
  running.set(key, (running.get(key) ?? 0) + 1);
  emit(tripId);
}

/** One of the trip's searches ended (found, failed or gave up). */
export function searchEnded(tripId: string, work: Work = "web"): void {
  const key = keyOf(tripId, work);
  const n = (running.get(key) ?? 0) - 1;
  if (n > 0) running.set(key, n);
  else running.delete(key);
  emit(tripId);
}

/** Hears the status of every trip's chat; returns the way to stop. */
export function onChatStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** One step of the turn the chat is answering, as the traveller reads it; done once the next one starts. */
export interface ChatStep {
  text: string;
  done: boolean;
}
const steps = new Map<string, ChatStep[]>();

/** The steps of the trip's turn so far (empty when it isn't answering, or did nothing yet). */
export const chatStepsOf = (tripId: string): ChatStep[] => steps.get(tripId) ?? [];

/** A step starts ("X fikre alınıyor"): the one before is done. */
export function stepStarted(tripId: string, text: string): void {
  const list = (steps.get(tripId) ?? []).map((s) => ({ ...s, done: true }));
  steps.set(tripId, [...list, { text, done: false }].slice(-12));
  emit(tripId);
}

/** The turn's last step is done (the reply comes next). */
export function stepsDone(tripId: string): void {
  const list = steps.get(tripId);
  if (!list?.length) return;
  steps.set(tripId, list.map((s) => ({ ...s, done: true })));
  emit(tripId);
}

/** The turn ended: its steps go (the reply says what was done). */
export function stepsCleared(tripId: string): void {
  if (!steps.delete(tripId)) return;
  emit(tripId);
}
