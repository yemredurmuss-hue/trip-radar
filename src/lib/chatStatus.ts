// What the board chat is doing beyond "Düşünüyor…": a web search running ("Web'de arıyorum…"), or the offers'
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
