// Paylaşım güvenliği on the board (0.37, docs/mockups/2026-10-05-paylasim-guvenligi-v1.png):
//  1. above the tabs, the other traveller's change of the shared settings, until "Tamam": "Geri al" puts it back;
//  2. deleting a shared trip asks first, and says what happens (only this computer, 30 days in the trash).
// The history (3) is HistoryDialog.tsx.
import { useEffect, useState } from "react";
import { requestShareSync } from "../lib/browser";
import { L } from "../lib/i18n";
import { locative } from "../lib/i18nText";
import { timeText } from "../lib/history";
import { dismissNotice, undoNotice, type SettingsNotice } from "../lib/share/notices";
import { changeHeadline, diffSettings, type DiffLine } from "../lib/share/settingsDiff";
import { joinNames } from "../lib/share/votes";
import type { Trip } from "../lib/types";
import { useShare } from "./Share";

/** A round initial (or the profile photo): mine in the board's violet, the others' in rose. */
export function Avatar({ name, me = false, photo }: { name: string; me?: boolean; photo?: string | null }) {
  const initial = [...name.trim()][0]?.toLocaleUpperCase("tr-TR") ?? "?";
  return (
    <span className={`hs-av${me ? " me" : ""}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initial}
    </span>
  );
}

/** "<s>7–18 Ekim</s> → 8–18 Ekim"; with the field's name when the change has several. */
export function DiffParts({ lines, labelled }: { lines: Pick<DiffLine, "label" | "subject" | "before" | "after">[]; labelled: boolean }) {
  return (
    <>
      {lines.map((l, i) => (
        <span key={i} className="hs-part">
          {i > 0 && "; "}
          {labelled && `${l.label}: `}
          {l.subject && `${l.subject} `}
          <s>{l.before}</s> → {l.after}
        </span>
      ))}
    </>
  );
}

const msOf = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

function NoticeRow({ tripId, notice, me, photo }: { tripId: string; notice: SettingsNotice; me: string; photo?: string }) {
  const [busy, setBusy] = useState(false);
  const lines = diffSettings(notice.prev, notice.next);
  if (!lines.length) return null;
  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    void work().finally(() => setBusy(false));
  };
  return (
    <div className="hs-notice" role="status" data-notice={notice.id}>
      <Avatar name={notice.author} photo={photo} />
      <p>
        <b>{changeHeadline(notice.author, notice.fields)}:</b> <DiffParts lines={lines} labelled={new Set(lines.map((l) => l.label)).size > 1} />
        <small>
          {timeText(msOf(notice.at) ?? notice.seenAt)} · {L("senin panona da geldi", "it's on your board too")}
        </small>
      </p>
      <button type="button" className="hs-btn dark" disabled={busy} onClick={() => run(() => undoNotice(tripId, notice, me).then(requestShareSync))}>
        {L("Geri al", "Undo")}
      </button>
      <button type="button" className="hs-btn" disabled={busy} onClick={() => run(() => dismissNotice(tripId, notice.id))}>
        {L("Tamam", "OK")}
      </button>
    </div>
  );
}

/** Panel 1: the other traveller's changes of the shared settings, newest first, above the tabs. */
export function ChangeNotices({ tripId }: { tripId: string }) {
  const share = useShare();
  if (!share?.notices.length) return null;
  return (
    <div className="hs-notices">
      {share.notices.map((n) => (
        <NoticeRow key={n.id} tripId={tripId} notice={n} me={share.me} photo={share.photos[n.author]} />
      ))}
    </div>
  );
}

/** Panel 2: "Porto ve Madeira Gezisi" silinsin mi? — a shared trip goes only from this computer. */
export function DeleteSharedTripDialog({ trip, onCancel, onDelete }: { trip: Trip; onCancel: () => void; onDelete: () => void }) {
  const share = useShare();
  const me = share?.me ?? "";
  const others = (share?.state?.members ?? []).filter((m) => m.trim() && m.trim().toLowerCase() !== me.trim().toLowerCase());
  const names = joinNames(others);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="modal" onClick={onCancel}>
      <div className="hs-dlg" role="alertdialog" aria-modal="true" aria-labelledby="hs-dlg-title" onClick={(e) => e.stopPropagation()}>
        <div className="hs-who">
          <span className="hs-avs">
            {me && <Avatar name={me} me photo={share?.photos[me]} />}
            {others.map((o) => (
              <Avatar key={o} name={o} photo={share?.photos[o]} />
            ))}
          </span>
          {names ? L(`${names} ile paylaşılıyor`, `Shared with ${names}`) : L("Paylaşılıyor", "Shared")}
        </div>
        <h3 id="hs-dlg-title">{L(`"${trip.title}" silinsin mi?`, `Delete "${trip.title}"?`)}</h3>
        <p>
          {names
            ? L(
                `Yalnız senin bilgisayarından silinir. ${locative(names)}ki kopya ve ortak kayıtlar sunucuda kalır.`,
                `It's only deleted from your computer. ${names}'s copy and the shared saves stay on the server.`,
              )
            : L("Yalnız senin bilgisayarından silinir. Ortak kayıtlar sunucuda kalır.", "It's only deleted from your computer. The shared saves stay on the server.")}
        </p>
        <ul>
          <li>
            {L("30 gün ", "It stays in the ")}
            <b>{L("Çöp kutusu", "Trash")}</b>
            {L("'nda durur, tek tıkla geri gelir.", " for 30 days and comes back in one click.")}
          </li>
          <li>{L("Paylaşım senin tarafında durur; istersen kodla yeniden katılırsın.", "Sharing stops on your side; you can join again with the code.")}</li>
        </ul>
        <div className="hs-row">
          <button type="button" className="hs-btn lg" onClick={onCancel} autoFocus>
            {L("Vazgeç", "Cancel")}
          </button>
          <button type="button" className="hs-btn lg red" onClick={onDelete}>
            {L("Sil", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
