// The chat's side of an arrival: a link sent in the chat is shown as the traveller's own bubble with a chip
// under it (the site, a spinner, then "✓ Konaklama'ya eklendi · göster" or "⚠ okunamadı · Tekrar dene"); a
// file dropped or picked gets the same ("📎 poliçe.pdf" → "→ Diğer · Seyahat sigortası"); an event line
// about a record ("✓ Casa Azul kaydedildi → Konaklama") goes to its card when tapped.
import { useEffect, useMemo, useState } from "react";
import { chipState, eventItemName, hostOf, siteOf, type ChipState } from "../../lib/arrive";
import { requestProcessing } from "../../lib/browser";
import { sectionOfItem } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { retryCapture } from "../../lib/process";
import type { Capture, ChatMessage, Item, Trip } from "../../lib/types";
import { SECTION_META } from "../plan/sectionMeta";
import { ArriveChip } from "./ArriveViews";
import { captureById, endIntake, requestReveal, useIntake, type FileIntake, type Intake } from "./intake";

/** A capture as it stands: the open ones from the board, a finished one read back once. Undefined: not known yet. */
function useCaptures(ids: readonly string[], open: Capture[]): (id: string) => Capture | null | undefined {
  const [finished, setFinished] = useState<ReadonlyMap<string, Capture | null>>(() => new Map());
  const byId = useMemo(() => new Map(open.map((c) => [c.id, c])), [open]);
  const key = ids.join(" ");
  useEffect(() => {
    const missing = ids.filter((id) => !byId.has(id) && !finished.has(id));
    if (!missing.length) return;
    let live = true;
    void Promise.all(missing.map(captureById)).then((rows) => {
      if (!live) return;
      // A held capture (placeCheck.ts) isn't settled until it's answered: its chip changes with the answer.
      const settled = missing.flatMap((id, i) => (rows[i] === null || (rows[i]?.status === "done" && !(rows[i]?.held && !rows[i]?.held?.answer)) ? [[id, rows[i]] as const] : []));
      if (settled.length) setFinished((prev) => new Map([...prev, ...settled]));
    });
    return () => {
      live = false;
    };
    // `key` stands for ids; a capture leaving the open list (done, removed) is a change of `byId`.
  }, [key, byId, finished]);
  return (id) => byId.get(id) ?? finished.get(id);
}

type Row = { kind: "msg"; at: number; m: ChatMessage; file?: FileIntake } | { kind: "intake"; at: number; e: Intake };

/**
 * The chat's lines with what was handed to it this session, in time order. A file's chip goes under the
 * "📎 name" line its reading wrote; until that line exists the file is its own bubble.
 */
export function chatRows(messages: ChatMessage[], intake: readonly Intake[], tripId: string): Row[] {
  // A file that failed is said once, by the chat's own line ("📎 … okunamadı", or the error under the box): no chip too.
  const mine = intake.filter((e) => e.source === "chat" && e.tripId === tripId && !(e.kind === "file" && e.state === "error"));
  const attached = new Map<string, FileIntake>();
  const used = new Set<string>();
  for (const e of mine) {
    if (e.kind !== "file" || e.state !== "done") continue;
    const m = messages.find((x) => x.role === "user" && x.text === `📎 ${e.name}` && x.createdAt >= e.at - 1000 && !attached.has(x.id));
    if (m) {
      attached.set(m.id, e);
      used.add(e.id);
    }
  }
  const rows: Row[] = [
    ...messages.map((m): Row => ({ kind: "msg", at: m.createdAt, m, file: attached.get(m.id) })),
    ...mine.filter((e) => !used.has(e.id)).map((e): Row => ({ kind: "intake", at: e.at, e })),
  ];
  return rows.sort((a, b) => a.at - b.at);
}

/** "→ Diğer · Seyahat sağlık sigortası", "→ Belgeler'e eklendi", or that it couldn't be read. */
export function fileChip(e: FileIntake): ChipState {
  if (e.state === "reading") return { tone: "work", text: L("Okunuyor…", "Reading…") };
  if (e.state === "error") return { tone: "error", text: L("Okunamadı", "Couldn't read it"), captureId: null, detail: e.error ?? null };
  if (e.itemId && e.section) {
    // "Diğer (Sigorta, eSIM)" is "Diğer" here: the record's own name follows.
    const where = [SECTION_META[e.section].label().replace(/\s*\(.*\)$/, ""), e.itemName].filter(Boolean).join(" · ");
    return { tone: "done", text: `→ ${where}`, itemId: e.itemId };
  }
  return { tone: "done", text: L("→ Belgeler'e eklendi", "→ Added to Documents"), itemId: null };
}

/** Everything the chat needs to draw its arrivals: the rows, a bubble for a handed thing, a file's chip. */
export function useChatArrivals({ trip, messages, items, trips, openCaptures }: { trip: Trip; messages: ChatMessage[]; items: Item[]; trips: Trip[]; openCaptures: Capture[] }) {
  const intake = useIntake();
  const rows = useMemo(() => chatRows(messages, intake, trip.id), [messages, intake, trip.id]);
  const ids = useMemo(
    () => intake.flatMap((e) => (e.source === "chat" && e.tripId === trip.id && (e.kind === "link" || e.state === "screenshot") && e.captureId ? [e.captureId] : [])),
    [intake, trip.id],
  );
  const capture = useCaptures(ids, openCaptures);
  const tripTitle = (id: string) => trips.find((t) => t.id === id)?.title ?? null;

  /** A capture's chip (a link, or a picture that went the screenshot way). */
  const captureChip = (captureId: string, url: string | null, screenshot: boolean, label: string | null) => {
    const c = capture(captureId);
    const item = c?.itemId ? items.find((i) => i.id === c.itemId) : undefined;
    const state = chipState(c, item ? { id: item.id, tripId: item.tripId, section: sectionOfItem(item) } : null, { tripId: trip.id, site: siteOf(url), tripTitle, screenshot });
    return (
      <ArriveChip
        host={hostOf(url)}
        label={label}
        state={state}
        onShow={state.tone === "done" && state.itemId ? () => requestReveal(state.itemId!) : undefined}
        onRetry={state.tone === "error" && state.captureId ? () => void retryCapture(state.captureId!).then(requestProcessing) : undefined}
      />
    );
  };
  const fileChipView = (e: FileIntake) => {
    if (e.state === "screenshot" && e.captureId) return captureChip(e.captureId, null, true, null);
    const state = fileChip(e);
    return <ArriveChip host={null} label={null} state={state} onShow={state.tone === "done" && state.itemId ? () => requestReveal(state.itemId!) : undefined} />;
  };

  /** A link or a file handed to the chat, as the traveller's own bubble with its chip. */
  const bubble = (e: Intake) =>
    e.kind === "link" ? (
      <div key={e.id} className="ar-sent">
        <div className="msg-user ar-sent-link">{e.url}</div>
        {captureChip(e.captureId, e.url, false, hostOf(e.url) ?? e.url)}
      </div>
    ) : (
      <div key={e.id} className="ar-sent">
        <div className="msg-user">
          {e.thumb && <img className="ar-sent-thumb" src={e.thumb} alt="" />}
          📎 {e.name}
        </div>
        {fileChipView(e)}
      </div>
    );

  /** The record an event line is about, on this trip (the latest of that name, not one ruled out). */
  const eventItem = (m: ChatMessage): Item | null => {
    if (m.role !== "event") return null;
    const name = eventItemName(m.text);
    if (!name) return null;
    const named = items.filter((i) => i.tripId === trip.id && i.name === name && i.status !== "dismissed");
    return named.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  };

  return { rows, bubble, fileChip: fileChipView, eventItem };
}
