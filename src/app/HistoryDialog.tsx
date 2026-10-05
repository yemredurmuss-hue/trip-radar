// Geçmiş ve çöp kutusu (0.37, mockup panel 3): what happened on the trip, by day, each row with its way back.
// From the trip's ••• menu. Without a trip (Seyahatlerim) it is the trash of deleted trips.
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestShareSync } from "../lib/browser";
import { listMessages, onChanged } from "../lib/db";
import { buildHistory, filterRows, groupByDay, segmentsOf, timeText, type HiddenInput, type HistoryAction, type HistoryRow, type Segment } from "../lib/history";
import { L } from "../lib/i18n";
import { getPhoto } from "../lib/profile";
import { rpcClient } from "../lib/share/client";
import { changedSinceText, getAllNotices, getUndone, undoSettingsChange, type SettingsNotice, type UndoneMark } from "../lib/share/notices";
import { settingsOf } from "../lib/share/settings";
import { fetchSettingsHistory, type SettingsChange } from "../lib/share/settingsHistory";
import { getShareConfig, isConfigured } from "../lib/share/store";
import { dropTrash, emptyTrash, listTrash, purgeTrash, restoreTrash } from "../lib/trash";
import type { ChatMessage, Item, TrashEntry, TrashKind, Trip } from "../lib/types";
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
const TRIP_KINDS: TrashKind[] = ["item", "doc"];
const TRIPS_ONLY: TrashKind[] = ["trip"];

const errorText = (error: unknown) =>
  L(`Olmadı: ${error instanceof Error ? error.message : String(error)}`, `That didn't work: ${error instanceof Error ? error.message : String(error)}`);

export function HistoryDialog({ trip, items, hidden, onClose, onShow, onOpenTrip }: Props) {
  const share = useShare();
  const tripId = trip?.id ?? null;
  const shareId = trip?.shareId;
  const [local, setLocal] = useState<Local | null>(null);
  const [settings, setSettings] = useState<SettingsChange[] | null>(null);
  const [serverAsked, setServerAsked] = useState(false);
  const [segment, setSegment] = useState<Segment>({ kind: "all" });
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  // My name and photo even when the trip isn't shared (the avatar is my initial, the label "Ben").
  const [own, setOwn] = useState<{ name: string; photo: string | null }>({ name: "", photo: null });

  const load = useCallback(async () => {
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [events, trash, notices, undone] = await Promise.all([
      tripId ? safe(listMessages(tripId), []) : Promise.resolve([]),
      safe(listTrash(tripId ? { tripId, kinds: TRIP_KINDS } : { kinds: TRIPS_ONLY }), []),
      tripId ? safe(getAllNotices(tripId), []) : Promise.resolve([]),
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
    // Old entries go once per opening (not on every change while it's open); the lists read light rows only.
    void purgeTrash()
      .catch(() => 0)
      .then(load);
    return onChanged(() => void load());
  }, [load]);
  useEffect(() => void loadServer(), [loadServer]);
  useEffect(() => {
    void Promise.all([getShareConfig().catch(() => null), getPhoto().catch(() => null)]).then(([c, photo]) => setOwn({ name: c?.name ?? "", photo }));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const me = share?.me || own.name;
  const myPhoto = (me && share?.photos[me]) || own.photo;
  const data = local ?? EMPTY;
  const current = useMemo(() => (trip ? settingsOf(trip) : null), [trip]);
  const rows = useMemo(
    () => buildHistory({ me, settings, notices: data.notices, undone: data.undone, events: data.events, trash: data.trash, hidden: trip ? hidden : [], items, current, now }),
    [me, settings, data, hidden, items, now, trip, current],
  );
  const segments = useMemo(() => (trip ? segmentsOf(rows, share?.state?.members ?? [], me) : []), [trip, rows, share?.state?.members, me]);
  const shown = filterRows(rows, trip ? segment : { kind: "all" });
  const groups = groupByDay(shown, now);
  const segKey = (s: Segment) => (s.kind === "person" ? `person:${s.name}` : s.kind);
  const trashCount = data.trash.length;
  const trashView = !trip || segment.kind === "trash";

  async function attempt(key: string, work: () => Promise<void>) {
    setBusy(key);
    setNote(null);
    try {
      await work();
    } catch (error) {
      setNote({ text: errorText(error), error: true });
    } finally {
      setBusy(null);
    }
  }

  function run(row: HistoryRow, action: HistoryAction) {
    return attempt(row.key, async () => {
      switch (action.kind) {
        case "undo-setting": {
          if (!tripId) return;
          const result = await undoSettingsChange(tripId, { prev: action.prev, next: action.next, fields: action.fields, author: row.who, mark: action.mark }, me);
          if (result.changedSince.length) setNote({ text: changedSinceText(result.changedSince) });
          requestShareSync();
          await load();
          return;
        }
        case "restore-trash": {
          const result = await restoreTrash(action.id);
          const notes = [
            ...(result.detached ? [L("Paylaşımdan ayrı bir kopya olarak geri geldi (aynı paylaşım bu bilgisayarda yine açık).", "It came back as a copy apart from the sharing (the same share is open on this computer again).")] : []),
            ...(result.skipped ? [L(`${result.skipped} kayıt zaten vardı, olduğu gibi bırakıldı.`, `${result.skipped} record(s) were already there and were left as they are.`)] : []),
          ];
          if (notes.length) setNote({ text: notes.join(" ") });
          if (result.entry?.kind === "trip" && !notes.length) onOpenTrip?.(result.entry.tripId);
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
    });
  }

  function purgeOne(row: HistoryRow, id: string) {
    if (!confirm(L(`"${row.text}" kalıcı olarak silinsin mi? Geri getirilemez.`, `Delete "${row.text}" for good? It can't be brought back.`))) return;
    void attempt(`${row.key}:purge`, () => dropTrash(id));
  }

  function emptyAll() {
    if (!confirm(L(`Çöp kutusundaki ${trashCount} şey kalıcı olarak silinsin mi? Geri getirilemez.`, `Delete the ${trashCount} thing(s) in the trash for good? They can't be brought back.`))) return;
    void attempt("empty", async () => {
      await emptyTrash(tripId ? { tripId, kinds: TRIP_KINDS } : { kinds: TRIPS_ONLY });
    });
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
            "Ortak ayarların eski hâlleri henüz sunucuda tutulmuyor; bu bilgisayarda görülenler listeleniyor. Silinen kayıtlar ve belgeleri 30 gün Çöp kutusu'nda durur.",
            "Earlier states of the shared settings aren't kept on the server yet; what this computer saw is listed. Deleted saves and their files stay in the trash for 30 days.",
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
        {note && (
          <p className={`hs-note${note.error ? " err" : ""}`} role={note.error ? "alert" : "status"}>
            {note.text}
          </p>
        )}
        <div className="hs-body">
          {local && !groups.length && <p className="hs-empty">{trashView ? L("Çöp kutusu boş.", "The trash is empty.") : L("Henüz bir şey yok.", "Nothing yet.")}</p>}
          {groups.map((g) => (
            <section key={g.label}>
              <div className="hs-day">{g.label}</div>
              {g.rows.map((row) => (
                <HistoryRowView
                  key={row.key}
                  row={row}
                  avatarName={row.me ? me || L("Ben", "Me") : row.who}
                  photo={row.me ? myPhoto : share?.photos[row.who]}
                  busy={busy === row.key}
                  actionLabel={row.action ? actionLabel(row.action) : null}
                  onAction={() => row.action && void run(row, row.action)}
                  onPurge={row.action?.kind === "restore-trash" ? ((id) => () => purgeOne(row, id))(row.action.id) : null}
                />
              ))}
            </section>
          ))}
        </div>
        <div className="hs-foot-row">
          <p className="hs-foot">{foot}</p>
          {trashView && trashCount > 0 && (
            <button type="button" className="hs-btn danger" disabled={busy === "empty"} onClick={emptyAll}>
              {L("Çöp kutusunu boşalt", "Empty the trash")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryRowView({
  row,
  avatarName,
  photo,
  busy,
  actionLabel,
  onAction,
  onPurge,
}: {
  row: HistoryRow;
  avatarName: string;
  photo?: string | null;
  busy: boolean;
  actionLabel: string | null;
  onAction: () => void;
  onPurge: (() => void) | null;
}) {
  const who = row.me ? L("Ben", "Me") : row.who;
  const undone = row.undone
    ? L(`geri alındı (${row.undone.by || "?"}${row.undone.at ? `, ${timeText(row.undone.at)}` : ""})`, `undone (${row.undone.by || "?"}${row.undone.at ? `, ${timeText(row.undone.at)}` : ""})`)
    : null;
  const sub = [who, ...(row.at != null ? [timeText(row.at)] : []), ...row.how, ...(undone ? [undone] : [])];
  return (
    <div className={`hs-ev${row.undone ? " undone" : ""}`} data-row={row.key}>
      <Avatar name={avatarName} me={row.me} photo={photo} />
      <div className="hs-t">
        {row.verb && <b>{row.verb}:</b>}{" "}
        {row.parts ? <DiffParts lines={row.parts.map((p) => ({ ...p, label: "" }))} labelled={false} /> : row.text}
        <small>{sub.join(" · ")}</small>
      </div>
      {row.undone ? (
        <span className="hs-tag">{L("geri alındı", "undone")}</span>
      ) : (
        <span className="hs-acts">
          {onPurge && (
            <button type="button" className="hs-btn quiet" disabled={busy} onClick={onPurge}>
              {L("Kalıcı sil", "Delete for good")}
            </button>
          )}
          {actionLabel && (
            <button type="button" className={`hs-btn${row.action?.kind === "undo-setting" ? " dark" : ""}`} disabled={busy} onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
