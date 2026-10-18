// Pano > Belgeler (C5, plan v83; the Belgeler tab of 0.34.6 moved here): the trip's files by kind, each on its card ("Kartı göster"
// closes the window and goes to the card), a booking with none yet ("+ Ekle"), a plan waiting for its file, a file on no card
// ("Karta bağla", the cards by section), and "Belge ekle" at the end (read, then put on its card). A file opens in a tab; × sends it
// to the trash with the 8-second "Geri al". The files stay on this computer.
import { useEffect, useMemo, useRef, useState } from "react";
import { planSectionOfItem, SECTION_ORDER } from "../../../lib/categories";
import { onChanged } from "../../../lib/db";
import { DOC_ACCEPT, getDoc, linkDoc, listDocMeta, takeDoc } from "../../../lib/docs";
import { L, locale } from "../../../lib/i18n";
import { cardLabel, docGroupLabel, docRowsOf, type DocRow, type DocRowGroup } from "../../../lib/panoDocs";
import type { DocMeta, Item } from "../../../lib/types";
import type { Undoable } from "../../../lib/undoables";
import { addTripFiles } from "../../capture";
import { DocPickButton, openDoc } from "../../cards/DocAccess";
import { UiIcon } from "../../cards/Silhouettes";
import { SECTION_META } from "../../plan/sectionMeta";

const DOC_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
    <path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6" />
  </svg>
);

/** The trip's files, kept fresh on every change (null until read). */
export function useDocList(tripId: string): DocMeta[] | null {
  const [docs, setDocs] = useState<DocMeta[] | null>(null);
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
  return docs;
}

/** Belgeler's rows from the trip's files and its cards (the side menu counts them too). */
export function useDocRows(tripId: string, items: Item[], inherited: ReadonlyMap<string, readonly string[]>): DocRowGroup[] | null {
  const docs = useDocList(tripId);
  return useMemo(() => (docs ? docRowsOf(docs, items, inherited) : null), [docs, items, inherited]);
}

/** A picture's own small preview; a PDF's icon. */
function Thumb({ doc }: { doc: DocMeta | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const picture = Boolean(doc?.type.startsWith("image/"));
  useEffect(() => {
    if (!doc || !picture) return;
    let made: string | null = null;
    let alive = true;
    void getDoc(doc.id).then((full) => {
      if (!alive || !full) return;
      made = URL.createObjectURL(full.blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [doc?.id, picture]);
  return <span className="q-dic">{url ? <img src={url} alt="" /> : DOC_ICON}</span>;
}

const STATE_WORD = {
  ok: () => L("Karta bağlı", "On its card"),
  wait: () => L("Bekleniyor", "To come"),
  add: () => L("Belge eklenmedi", "No file yet"),
  link: () => L("Bir karta bağla", "Link it to a card"),
} as const;

/** "Karta bağla": the trip's cards by section; picking one puts the file on it. */
function LinkPicker({ doc, items }: { doc: DocMeta; items: Item[] }) {
  const live = items
    .filter((i) => i.status !== "dismissed")
    .sort((a, b) => SECTION_ORDER.indexOf(planSectionOfItem(a)) - SECTION_ORDER.indexOf(planSectionOfItem(b)) || a.name.localeCompare(b.name, locale()));
  const bySection = SECTION_ORDER.map((s) => ({ s, list: live.filter((i) => planSectionOfItem(i) === s) })).filter((x) => x.list.length);
  return (
    <select className="q-dgo" aria-label={L(`${doc.name}: karta bağla`, `${doc.name}: link to a card`)} value="" onChange={(e) => e.target.value && void linkDoc(doc.id, e.target.value)}>
      <option value="">{L("Karta bağla", "Link to a card")}</option>
      {bySection.map(({ s, list }) => (
        <optgroup key={s} label={SECTION_META[s].label()}>
          {list.map((i) => (
            <option key={i.id} value={i.id}>
              {cardLabel(i)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function Row({ row, items, onShow, offer }: { row: DocRow; items: Item[]; onShow: (itemId: string) => void; offer: (u: Undoable) => void }) {
  const { doc, item } = row;
  const action =
    row.state === "ok" && item ? (
      <button type="button" className="q-dgo" onClick={() => onShow(item.id)}>
        {L("Kartı göster ›", "Show the card ›")}
      </button>
    ) : row.state === "link" && doc ? (
      <LinkPicker doc={doc} items={items} />
    ) : row.state === "add" && item ? (
      <DocPickButton item={item} className="q-dgo" title={L(`${item.name}: bileti ya da onayı ekle (PDF, görsel)`, `${item.name}: add its ticket or confirmation (PDF, image)`)}>
        + {L("Ekle", "Add")}
      </DocPickButton>
    ) : (
      <span />
    );
  return (
    <div className="q-d1" role="group" data-state={row.state} data-doc-id={doc?.id} aria-label={row.name}>
      <Thumb doc={doc} />
      <span className="q-dm">
        <b title={row.name}>
          {doc ? (
            <button type="button" onClick={() => void openDoc(doc.id)} title={L("Belgeyi aç", "Open the document")}>
              {row.name}
            </button>
          ) : (
            row.name
          )}
        </b>
        <small>{row.sub}</small>
      </span>
      <span className={`q-dst ${row.state}`}>{STATE_WORD[row.state]()}</span>
      {action}
      {doc ? (
        <button type="button" className="q-dx" aria-label={L(`${doc.name}: sil`, `${doc.name}: delete`)} title={L("Sil", "Delete")}
          onClick={() => void takeDoc(doc.id).then((taken) => taken && offer({ kind: "doc", doc: taken }))}>
          <UiIcon name="x" size={12} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

/** "Belge ekle": pick or drop files; each is kept, read and put on its card (capture.addTripFiles), else it waits under Bağlanmamış. */
function AddFiles({ tripId }: { tripId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const take = async (files: File[]) => {
    if (!files.length) return;
    setErrors([]);
    const out = await addTripFiles(tripId, files, "board");
    setErrors(out.filter((e) => !e.logged).map((e) => e.text));
  };
  return (
    <>
      <button type="button" className={`q-d1 drop${over ? " over" : ""}`} onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), e.stopPropagation(), setOver(true))} onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          void take([...e.dataTransfer.files]);
        }}>
        <span className="q-dic" aria-hidden>+</span>
        <span className="q-dm">
          <b>{L("Belge ekle", "Add a document")}</b>
          <small>{L("PDF ya da görsel. AI hangi karta ait olduğunu bulur; bulamazsa Bağlanmamış'ta durur.", "A PDF or an image. The AI finds the card it belongs to; if it can't, it waits under Not linked.")}</small>
        </span>
      </button>
      <input ref={input} type="file" accept={DOC_ACCEPT} multiple hidden onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        void take(files);
      }} />
      {errors.map((t) => (
        <p key={t} className="q-derr" role="alert">{t}</p>
      ))}
    </>
  );
}

export function PanoDocs({ tripId, groups, items, onShow, offer }: {
  tripId: string;
  groups: DocRowGroup[] | null;
  items: Item[];
  onShow: (itemId: string) => void;
  offer: (u: Undoable) => void;
}) {
  if (!groups) return null;
  return (
    <div className="q-docs">
      {groups.length === 0 && (
        <p className="q-pempty">
          {L(
            "Henüz belge yok. Bir PDF'i ya da bilet görselini sohbete bırak: okuyup doğru karta koyarım, burada da durur.",
            "No documents yet. Drop a PDF or a ticket picture in the chat: I'll read it and put it on the right card, and it stays here.",
          )}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.id} className="q-dg" data-group={g.id} aria-label={docGroupLabel(g.id)}>
          <b>{docGroupLabel(g.id)}</b>
          {g.rows.map((row) => (
            <Row key={row.key} row={row} items={items} onShow={onShow} offer={offer} />
          ))}
        </section>
      ))}
      <AddFiles tripId={tripId} />
    </div>
  );
}
