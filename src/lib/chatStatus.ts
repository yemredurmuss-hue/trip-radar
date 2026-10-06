// What the board chat is doing beyond "Düşünüyor…": a web search running ("Web'de arıyorum…"). A fresh search
// can take 10-30 s and goes on after the reply that asked for it (the traveller can write meanwhile), so the line
// stays as long as any of the trip's searches runs.
export type ChatStatus = "web" | null;

type Listener = (tripId: string, status: ChatStatus) => void;
const listeners = new Set<Listener>();
const running = new Map<string, number>();

/** The trip's chat status now (for a chat opened while a search runs). */
export const chatStatusOf = (tripId: string): ChatStatus => ((running.get(tripId) ?? 0) > 0 ? "web" : null);

function emit(tripId: string) {
  const status = chatStatusOf(tripId);
  for (const l of listeners) l(tripId, status);
}

/** A web search started for the trip's chat. */
export function searchStarted(tripId: string): void {
  running.set(tripId, (running.get(tripId) ?? 0) + 1);
  emit(tripId);
}

/** One of the trip's searches ended (found, failed or gave up). */
export function searchEnded(tripId: string): void {
  const n = (running.get(tripId) ?? 0) - 1;
  if (n > 0) running.set(tripId, n);
  else running.delete(tripId);
  emit(tripId);
}

/** Hears the status of every trip's chat; returns the way to stop. */
export function onChatStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
