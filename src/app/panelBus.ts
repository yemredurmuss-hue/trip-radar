// The trip's ••• menu (App.tsx) lives apart from the panel it acts on (TripPanel.tsx): "Belgeler" and "Planı PDF olarak
// indir" reach the panel through this one event, so the menu needs no state of the panel's.
export type PanelCommand = "docs" | "pdf";

const EVENT = "tr-panel";

export const sendPanel = (command: PanelCommand): void => void window.dispatchEvent(new CustomEvent<PanelCommand>(EVENT, { detail: command }));

/** Listens for the menu's commands; returns the way to stop. */
export function onPanel(run: (command: PanelCommand) => void): () => void {
  const on = (e: Event) => run((e as CustomEvent<PanelCommand>).detail);
  window.addEventListener(EVENT, on);
  return () => window.removeEventListener(EVENT, on);
}
