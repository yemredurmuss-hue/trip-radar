// A card's files (top right, etkinlik-v4): a white pill with the first file's name (+N) that opens it, or a
// faint paper clip that picks one. Several files open a small list; the opened card lists them too (so a
// single file can be deleted). Files stay on this computer (see lib/docs.ts).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { onChanged } from "../../lib/db";
import { addDoc, DOC_ACCEPT, docPill, getDoc, listDocMeta, needsDoc, sizeText, takeDoc } from "../../lib/docs";
import { L } from "../../lib/i18n";
import { revokeTracked, trackObjectUrl } from "../../lib/objectUrls";
import type { DocMeta, Item } from "../../lib/types";
import { UiIcon } from "./Silhouettes";

// The opened files' URLs live as long as the board (see lib/objectUrls).
if (typeof window !== "undefined") window.addEventListener("pagehide", () => void revokeTracked());

/** Opens a stored file in a new tab (the browser shows PDFs and pictures itself). */
export async function openDoc(id: string): Promise<void> {
  const doc = await getDoc(id);
  if (!doc) return;
  window.open(trackObjectUrl(URL.createObjectURL(doc.blob)), "_blank", "noopener");
}

export function DocPickButton({ item, className, title, children }: { item: Pick<Item, "id" | "tripId">; className?: string; title?: string; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={className} title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); setError(null); input.current?.click(); }}>
        {children}
      </button>
      <input ref={input} className="pk-file" type="file" accept={DOC_ACCEPT} multiple hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          for (const file of files) {
            try {
              await addDoc(item, file);
            } catch (err) {
              setError((err as Error).message);
            }
          }
        }} />
      {error && <span className="pk-doc-error" role="alert">{error}</span>}
    </>
  );
}

/** Each file: its name and size, open, delete. */
export function DocList({ docs }: { docs: DocMeta[] }) {
  return (
    <ul className="pk-docrows" aria-label={L("Belgeler", "Documents")}>
      {docs.map((d) => (
        <li key={d.id}>
          <span className="name">{d.name}</span>
          <span className="size">{sizeText(d.size)}</span>
          <button type="button" onClick={() => void openDoc(d.id)}>{L("Aç", "Open")}</button>
          <button type="button" className="danger" title={L("Çöp kutusuna gider, 30 gün geri getirilebilir", "Goes to the trash; it can be brought back for 30 days")} onClick={() => void takeDoc(d.id)}>{L("Sil", "Delete")}</button>
        </li>
      ))}
    </ul>
  );
}

/**
 * No file yet: a faint paper clip; on a booking with no ticket or confirmation (0.35.11) a small amber
 * "Belge eksik" instead, which picks the file just the same.
 */
export function DocAccess({ item, docs }: { item: Item; docs: DocMeta[] }) {
  const [list, setList] = useState(false);
  useEffect(() => {
    if (!list) return;
    const close = () => setList(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [list]);
  const pill = docPill(docs);
  if (!pill && needsDoc(item)) {
    return (
      <DocPickButton item={item} className="pk-docmiss" title={L("Rezerve edildi ama bileti ya da onayı yok: ekle (PDF, görsel)", "Booked, but no ticket or confirmation: add it (PDF, image)")}>
        <UiIcon name="clip" size={14} />
        {L("Belge eksik", "No document")}
      </DocPickButton>
    );
  }
  if (!pill) {
    return (
      <DocPickButton item={item} className="pk-ib pk-clip" title={L("Belge ekle (PDF, görsel)", "Add a document (PDF, image)")}>
        <UiIcon name="clip" size={16} />
      </DocPickButton>
    );
  }
  return (
    <span className="pk-docs">
      <button type="button" className="pk-docpill" title={docs.length === 1 ? L("Belgeyi aç", "Open the document") : L("Belgeler", "Documents")}
        onClick={(e) => { e.stopPropagation(); if (docs.length === 1) void openDoc(docs[0].id); else setList(!list); }}>
        <UiIcon name="doc" size={15} />
        <span>{pill.name}</span>
        {pill.more > 0 && <b>+{pill.more}</b>}
      </button>
      {list && (
        <div className="pk-doclist" onClick={(e) => e.stopPropagation()}>
          <DocList docs={docs} />
          <DocPickButton item={item} className="link-btn">{L("Belge ekle", "Add a document")}</DocPickButton>
        </div>
      )}
    </span>
  );
}

/** A trip's files by card (its own and those of the plans it replaced), kept fresh on every change. */
export function useTripDocs(tripId: string, inherited: Map<string, string[]>): (itemId: string) => DocMeta[] {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => void listDocMeta(tripId).then((d) => alive && setDocs(d));
    load();
    const off = onChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, [tripId]);
  return useCallback(
    (itemId: string) => {
      const ids = [itemId, ...(inherited.get(itemId) ?? [])];
      return docs.filter((d) => ids.includes(d.itemId));
    },
    [docs, inherited],
  );
}
