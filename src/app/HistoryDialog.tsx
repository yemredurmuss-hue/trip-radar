// Geçmiş ve çöp kutusu (0.37, mockup panel 3): what happened on the trip, by day, each row with its way back.
// From the trip's ••• menu. Without a trip (Seyahatlerim) it is the trash of deleted trips.
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestShareSync } from "../lib/browser";
import { listMessages, onChanged } from "../lib/db";
import { buildHistory, filterRows, groupByDay, segmentsOf, timeText, type HiddenInput, type HistoryAction, type HistoryRow, type Segment } from "../lib/history";
import { L } from "../lib/i18n";
import { rpcClient } from "../lib/share/client";
import { getNotices, getUndone, undoSettingsChange, type SettingsNotice, type UndoneMark } from "../lib/share/notices";
import { fetchSettingsHistory, type SettingsChange } from "../lib/share/settingsHistory";
import { getShareConfig, isConfigured } from "../lib/share/store";
import { listTrash, restoreTrash } from "../lib/trash";
import type { ChatMessage, Item, TrashEntry, Trip } from "../lib/types";
import { setHidden, setItemStatus } from "./actions";
import { useShare } from "./Share";
import { Avatar, DiffParts } from "./ShareSafety";

interface Props {
  /** The trip on screen; null: the trash of deleted trips. */
  trip: Trip | null;
  items: Item[];
  hidden: HiddenInput[];
  onClose: () => void;
  /** "Panoda göster": the card on the board. */
  onShow?: (itemId: string) => void;
  /** A deleted trip brought back: open it. */
  onOpenTrip?: (tripId: string) => void;
}

interface Local {
  events: ChatMessage[];
  trash: TrashEntry[];
  notices: SettingsNotice[];
  undone: UndoneMark[];
}

const EMPTY: Local = { events: [], trash: [], notices: [], undone: [] };

export function HistoryDialog({ trip, items, hidden, onClose, onShow, onOpenTrip }: Props) {
  const share = useShare();
  const tripId = trip?.id ?? null;
  const shareId = trip?.shareId;
  const [local, setLocal] = useState<Local | null>(null);
  const [settings, setSettings] = useState<SettingsChange[] | null>(null);
  const [serverAsked, setServerAsked] = useState(false);
  const [segment, setSegment] = useState<Segment>({ kind: "all" });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [events, trash, notices, undone] = await Promise.all([
      tripId ? safe(listMessages(tripId), []) : Promise.resolve([]),
      safe(tripId ? listTrash({ tripId, kind: "item" }) : listTrash({ kind: "trip" }), []),
      tripId ? safe(getNotices(tripId), []) : Promise.resolve([]),
      tripId ? safe(getUndone(tripId), []) : Promise.resolve([]),
    ]);
    setLocal({ events, trash, notices, undone });
    setNow(Date.now());
  }, [tripId]);

  // The server's history: asked when the dialog opens and after a change is taken back. Any failure: none.
  const loadServer = useCallback(async () => {
    if (!shareId) return setServerAsked(true);
    const config = await getShareConfig().catch(() => null);
    setSettings(config && isConfigured(config) ? await fetchSettingsHistory(rpcClient(config), shareId) : null);
    setServerAsked(true);
  }, [shareId]);

  useEffect(() => {
    void load();
    return onChanged(() => void load());
  }, [load]);
  useEffect(() => void loadServer(), [loadServer]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const me = share?.me ?? "";
  const data = local ?? EMPTY;
  const rows = useMemo(
    () => buildHistory({ me, settings, notices: data.notices, undone: data.undone, events: data.events, trash: data.trash, hidden: trip ? hidden : [], items, now }),
    [me, settings, data, hidden, items, now, trip],
  );
  const segments = useMemo(() => (trip ? segmentsOf(rows, share?.state?.members ?? [], me) : []), [trip, rows, share?.state?.members, me]);
  const shown = trip ? filterRows(rows, segment) : rows;
  const groups = groupByDay(shown, now);
  const segKey = (s: Segment) => (s.kind === "person" ? `person:${s.name}` : s.kind);

  async function run(row: HistoryRow, action: HistoryAction) {
    setBusy(row.key);
    setNote(null);
    try {
      switch (action.kind) {
        case "undo-setting":
          if (!tripId) return;
          await undoSettingsChange(tripId, { prev: action.prev, fields: action.fields, author: row.who, mark: action.mark }, me);
          requestShareSync();
          await load();
          return;
        case "restore-trash": {
          const result = await restoreTrash(action.id);
          if (result.skipped) setNote(L(`${result.skipped} kayıt zaten vardı, olduğu gibi bırakıldı.`, `${result.skipped} record(s) were already there and were left as they are.`));
          if (result.entry?.kind === "trip") onOpenTrip?.(result.entry.tripId);
          return;
        }
        case "restore-dismissed":
          return await setItemStatus(action.item, "saved");
        case "unhide":
          if (tripId) await setHidden(tripId, action.key, false, action.label);
          return;
        case "show":
          onClose();
          onShow?.(action.itemId);
          return;
      }
    } finally {
      setBusy(null);
    }
  }

  const actionLabel = (a: HistoryAction) =>
    a.kind === "undo-setting" ? L("Geri al", "Undo") : a.kind === "show" ? L("Panoda göster", "Show on the board") : L("Geri getir", "Bring back");

  const foot = !trip
    ? L("Silinen geziler 30 gün Çöp kutusu'nda durur, sonra kendiliğinden gider.", "Deleted trips stay in the trash for 30 days, then go by themselves.")
    : shareId && serverAsked && settings
      ? L(
          "Ortak ayarların her eski hâli sunucuda saklanır, iki taraf da geri alabilir. Silinen kayıtlar ve belgeleri 30 gün Çöp kutusu'nda durur.",
          "Every earlier state of the shared settings is kept on the server; both of you can take a change back. Deleted saves and their files stay in the trash for 30 days.",
        )
      : shareId && serverAsked
        ? L(
            "Sunucuda ayar geçmişi yok (history.sql kurulmamış ya da bağlantı yok): bu bilgisayarda görülenler listeleniyor. Silinen kayıtlar ve belgeleri 30 gün Çöp kutusu'nda durur.",
            "The server has no settings history (history.sql not set up, or offline): what this computer saw is listed. Deleted saves and their files stay in the trash for 30 days.",
          )
        : L("Silinen kayıtlar ve belgeleri 30 gün Çöp kutusu'nda durur.", "Deleted saves and their files stay in the trash for 30 days.");

  return (
    <div className="modal" onClick={onClose}>
      <div className="hs-hist" role="dialog" aria-modal="true" aria-label={trip ? L("Geçmiş", "History") : L("Çöp kutusu", "Trash")} onClick={(e) => e.stopPropagation()}>
        <div className="hs-hist-h">
          <b>{trip ? L("Geçmiş", "History") : L("Çöp kutusu", "Trash")}</b>
          {segments.length > 0 && (
            <div className="hs-seg" role="tablist" aria-label={L("Kimin", "Whose")}>
              {segments.map((s) => (
                <button
                  key={segKey(s.segment)}
                  type="button"
                  role="tab"
                  aria-selected={segKey(s.segment) === segKey(segment)}
                  className={segKey(s.segment) === segKey(segment) ? "on" : ""}
                  onClick={() => setSegment(s.segment)}
                >
                  {s.count != null ? `${s.label} · ${s.count}` : s.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="hs-close" aria-label={L("Kapat", "Close")} onClick={onClose}>
            ×
          </button>
        </div>
        {note && <p className="hs-note">{note}</p>}
        <div className="hs-body">
          {local && !groups.length && (
            <p className="hs-empty">
              {segment.kind === "trash" || !trip ? L("Çöp kutusu boş.", "The trash is empty.") : L("Henüz bir şey yok.", "Nothing yet.")}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.label}>
              <div className="hs-day">{g.label}</div>
              {g.rows.map((row) => (
                <HistoryRowView
                  key={row.key}
                  row={row}
                  photo={share?.photos[row.me ? me : row.who]}
                  busy={busy === row.key}
                  actionLabel={row.action ? actionLabel(row.action) : null}
                  onAction={() => row.action && void run(row, row.action)}
                />
              ))}
            </section>
          ))}
        </div>
        <p className="hs-foot">{foot}</p>
      </div>
    </div>
  );
}

function HistoryRowView({ row, photo, busy, actionLabel, onAction }: { row: HistoryRow; photo?: string; busy: boolean; actionLabel: string | null; onAction: () => void }) {
  const who = row.me ? L("Ben", "Me") : row.who;
  const undone = row.undone
    ? L(`geri alındı (${row.undone.by || "?"}${row.undone.at ? `, ${timeText(row.undone.at)}` : ""})`, `undone (${row.undone.by || "?"}${row.undone.at ? `, ${timeText(row.undone.at)}` : ""})`)
    : null;
  const sub = [who, ...(row.at != null ? [timeText(row.at)] : []), ...row.how, ...(undone ? [undone] : [])];
  return (
    <div className={`hs-ev${row.undone ? " undone" : ""}`} data-row={row.key}>
      <Avatar name={row.who} me={row.me} photo={photo} />
      <div className="hs-t">
        {row.verb && <b>{row.verb}:</b>}{" "}
        {row.parts ? <DiffParts lines={row.parts.map((p) => ({ ...p, label: "" }))} labelled={false} /> : row.text}
        <small>{sub.join(" · ")}</small>
      </div>
      {row.undone ? (
        <span className="hs-tag">{L("geri alındı", "undone")}</span>
      ) : (
        actionLabel && (
          <button type="button" className={`hs-btn${row.action?.kind === "undo-setting" ? " dark" : ""}`} disabled={busy} onClick={onAction}>
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
