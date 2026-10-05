// The arrival's small pieces: the waiting card in a section, the "Konaklama'ya eklendi · Göster" toast, the
// drop overlay, and the chat's chip under a link or a file. Calm on purpose: one shimmer, short fades, a
// ring that fades; nothing moves under prefers-reduced-motion (the ar- block in app.css).
import { requestProcessing } from "../../lib/browser";
import { stageText, type ChipState } from "../../lib/arrive";
import type { SectionId } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { retryCapture } from "../../lib/process";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { FallbackImg } from "../FallbackImg";
import { dropCapture } from "./intake";

export interface Pending {
  /** The capture's id, or a file's intake id: the card's data-arrive. */
  key: string;
  kind: "link" | "page" | "image" | "file";
  status: "pending" | "processing" | "error";
  section: SectionId | null;
  host: string | null;
  site: string | null;
  title: string | null;
  thumb: string | null;
  error: string | null;
  captureId: string | null;
}

export const faviconOf = (host: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;

/** The site's little icon, else a generic one (a document, a link). */
export function SiteIcon({ host, kind, size = 16 }: { host: string | null; kind?: Pending["kind"]; size?: number }) {
  const generic = <UiIcon name={kind === "file" || kind === "image" ? "doc" : "clip"} size={size} />;
  return host ? <FallbackImg src={faviconOf(host)} className="ar-favimg" fallback={generic} /> : generic;
}

export function PendingCard({ p, elapsed }: { p: Pending; elapsed: number }) {
  const failed = p.status === "error";
  const name = p.host ?? (p.kind === "image" ? L("Ekran görüntüsü", "Screenshot") : p.title ?? L("Belge", "Document"));
  const sub = p.host ? p.title : null;
  const stage = stageText({ status: p.status, kind: p.kind === "link" || p.kind === "page" ? "paste-link" : p.kind }, p.site, p.section, elapsed);
  return (
    <div className={`ar-pending${failed ? " ar-failed" : ""}`} data-arrive={p.key} title={failed ? (p.error ?? undefined) : undefined} role={failed ? undefined : "status"}>
      <span className={`ar-fav${p.thumb ? " ar-has-thumb" : ""}`} aria-hidden>
        {p.thumb ? <img className="ar-thumb" src={p.thumb} alt="" /> : <SiteIcon host={p.host} kind={p.kind} size={18} />}
      </span>
      <span className="ar-main">
        <span className="ar-top">
          <b>{name}</b>
          {sub && <span className="ar-sub">{sub}</span>}
        </span>
        <span className="ar-stage">
          {failed ? (
            <>
              <span className="ar-err">{L("Okunamadı", "Couldn't read it")}</span>
              {p.error && <span className="ar-why">{p.error}</span>}
            </>
          ) : (
            stage
          )}
        </span>
        {!failed && (
          <span className="ar-bar" aria-hidden>
            <i />
          </span>
        )}
      </span>
      {failed && p.captureId && (
        <span className="ar-actions">
          <button type="button" className="ar-btn" onClick={() => void retryCapture(p.captureId!).then(requestProcessing)}>
            {L("Tekrar dene", "Try again")}
          </button>
          <button type="button" className="ar-btn quiet" onClick={() => void dropCapture(p.captureId!)}>
            {L("Kaldır", "Remove")}
          </button>
        </span>
      )}
    </div>
  );
}

/** "Konaklama'ya eklendi: Casa Azul · Göster": a card that landed out of sight. */
export function ArriveToast({ text, onShow, onClose }: { text: string; onShow: () => void; onClose: () => void }) {
  return (
    <div className="ar-toast" role="status" aria-live="polite">
      <span>{text}</span>
      <button type="button" onClick={onShow}>
        {L("Göster", "Show")}
      </button>
      <button type="button" className="ar-toast-x" aria-label={L("Kapat", "Close")} onClick={onClose}>
        <UiIcon name="x" size={14} />
      </button>
    </div>
  );
}

const DROP_KINDS = ["flight", "stay", "train", "activity", "food", "insurance"] as const;

/** Over the board (or the chat) while files or links are dragged over it. */
export function DropOverlay({ rect }: { rect: { top: number; left: number; width: number; height: number } }) {
  return (
    <div className="ar-drop" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden>
      <div className="ar-drop-frame">
        <span className="ar-drop-icons">
          {DROP_KINDS.map((k) => (
            <KindIcon key={k} kind={k} size={20} />
          ))}
        </span>
        <b>{L("Bırak, okuyup doğru yere koyayım", "Drop it, I'll read it and put it in the right place")}</b>
        <span>{L("Link, PDF ya da ekran görüntüsü", "A link, a PDF or a screenshot")}</span>
      </div>
    </div>
  );
}

/** The chip under a link or a file sent in the chat: the site, then where it went (or that it couldn't). */
export function ArriveChip({ host, label, state, onShow, onRetry }: {
  host: string | null;
  /** The site ("airbnb.com"); none for a file, whose bubble already says its name. */
  label: string | null;
  state: ChipState;
  onShow?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className={`ar-chip ar-${state.tone}`} title={state.tone === "error" ? (state.detail ?? undefined) : undefined}>
      <span className="ar-chip-site">
        <SiteIcon host={host} kind={host ? "link" : "file"} size={14} />
        {label && <span>{label}</span>}
      </span>
      {state.tone === "work" && <i className="ar-spin" aria-hidden />}
      <span className="ar-chip-text">{state.tone === "error" ? `⚠ ${state.text}` : state.text}</span>
      {onShow && (
        <button type="button" className="ar-chip-btn" onClick={onShow}>
          {L("göster", "show")}
        </button>
      )}
      {onRetry && (
        <button type="button" className="ar-chip-btn" onClick={onRetry}>
          {L("Tekrar dene", "Try again")}
        </button>
      )}
    </div>
  );
}
