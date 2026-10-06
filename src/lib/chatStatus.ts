// What the board chat is doing while it answers, beyond "Düşünüyor…": the assistant says when a tool's work
// takes a while (a web search: "Web'de arıyorum…"), and the chat shows it in its thinking line.
export type ChatStatus = "web" | null;

type Listener = (tripId: string, status: ChatStatus) => void;
const listeners = new Set<Listener>();

export function setChatStatus(tripId: string, status: ChatStatus): void {
  for (const l of listeners) l(tripId, status);
}

/** Hears the status of every trip's chat; returns the way to stop. */
export function onChatStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
