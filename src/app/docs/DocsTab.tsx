// Belgeler (spec 0.34.6 §1): every file of the trip — attached to a card or dropped in the chat — on one white
// sheet, grouped Uçuş · Konaklama · Ulaşım · Etkinlik · Sigorta · İnternet · Diğer (the 0.34.4 calm look:
// hairlines, the icon in its colour, no tints). A row: a small picture or a file icon, the name, when it was
// added, the card it belongs to ("Seyahat sağlık sigortası · Allianz →" goes to it on the Plan), open, and ×
// (8 seconds to take it back). A file that belongs to no card offers "Bir karta bağla". Files stay on this
// computer (lib/docs.ts).
import { useEffect, useMemo, useState } from "react";
import { sectionOfItem, SECTION_ORDER } from "../../lib/categories";
import { onChanged } from "../../lib/db";
import { DOC_GROUPS, docGroupOf, getDoc, linkDoc, listDocMeta, sizeText, takeDoc, type DocGroup } from "../../lib/docs";
import { L, locale } from "../../lib/i18n";
import type { DocMeta, Item } from "../../lib/types";
import type { Undoable } from "../../lib/undoables";
import { openDoc } from "../cards/DocAccess";
import { KindIcon, UiIcon } from "../cards/Silhouettes";
import { SECTION_META } from "../plan/sectionMeta";
import type { CardKind } from "../../lib/cardKinds";

const GROUP_META: Record<DocGroup, { icon: CardKind; color: string; label: () => string }> = {
  flight: { icon: "flight", color: "#6a4fe0", label: () => L("Uçuş", "Flights") },
  stay: { icon: "stay", color: "#23998b", label: () => L("Konaklama", "Stays") },
  transport: { icon: "train", color: "#2563c9", label: () => L("Ulaşım", "Getting around") },
  event: { icon: "activity", color: "#a8336f", label: () => L("Etkinlik", "Events") },
  insurance: { icon: "insurance", color: "#0f8a6a", label: () => L("Sigorta", "Insurance") },
  internet: { icon: "esim", color: "#3b6fd1", label: () => L("İnternet", "Internet") },
  other: { icon: "note", color: "#6e6e73", label: () => L("Diğer", "Other") },
};

/** The trip's files, kept fresh on every change. */
function useDocList(tripId: string): DocMeta[] | null {
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

/** "Seyahat sağlık sigortası · Allianz": the card's name, and who it's from when the name doesn't say. */
export const cardLabel = (item: Item): string =>
  item.provider && !item.name.toLocaleLowerCase("tr").includes(item.provider.toLocaleLowerCase("tr")) ? `${item.name} · ${item.provider}` : item.name;

const addedText = (at: number) => new Date(at).toLocaleDateString(locale(), { day: "numeric", month: "short" });

export function DocsTab({ tripId, items, onGo, offer }: {
  tripId: string;
  items: Item[];
  /** To the card on the Plan: its section opens, the page goes to it with a flash. */
  onGo: (itemId: string) => void;
  /** The 8-second "Geri al" for a file deleted here. */
  offer: (u: Undoable) => void;
}) {
  const docs = useDocList(tripId);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const live = useMemo(
    () => items.filter((i) => i.status !== "dismissed").sort((a, b) => SECTION_ORDER.indexOf(sectionOfItem(a)) - SECTION_ORDER.indexOf(sectionOfItem(b)) || a.name.localeCompare(b.name, locale())),
    [items],
  );
  if (!docs) return null;
  const groups = DOC_GROUPS.map((g) => ({ id: g, docs: docs.filter((d) => docGroupOf(d, byId.get(d.itemId)) === g).sort((a, b) => b.addedAt - a.addedAt) })).filter((g) => g.docs.length);
  return (
    <div className="section doc-tab" aria-label={L("Belgeler", "Documents")}>
      <div className="section-head">
        <span>{L("Belgeler", "Documents")}</span>
        <span className="muted">{docs.length ? L(`${docs.length} belge · yalnız bu bilgisayarda`, `${docs.length} file${docs.length === 1 ? "" : "s"} · on this computer only`) : null}</span>
      </div>
      {groups.length === 0 ? (
        <p className="doc-empty">
          {L(
            "Henüz belge yok. Bir PDF'i ya da bilet görselini sohbete bırak: okuyup doğru karta koyarım, burada da durur.",
            "No documents yet. Drop a PDF or a ticket picture in the chat: I'll read it and put it on the right card, and it stays here.",
          )}
        </p>
      ) : (
        <div className="doc-sheet">
          {groups.map((g) => {
            const meta = GROUP_META[g.id];
            return (
              <section key={g.id} className="doc-group" data-group={g.id} style={{ "--c": meta.color } as React.CSSProperties} aria-label={meta.label()}>
                <h3 className="doc-head">
                  <span className="doc-ic" aria-hidden>
                    <KindIcon kind={meta.icon} size={20} />
                  </span>
                  <b>{meta.label()}</b>
                  <span className="doc-count">{g.docs.length}</span>
                </h3>
                <ul className="doc-rows">
                  {g.docs.map((d) => (
                    <DocRow key={d.id} doc={d} item={byId.get(d.itemId) ?? null} live={live} onGo={onGo} offer={offer} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A picture's own small preview; a PDF's icon. */
function Thumb({ doc }: { doc: DocMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  const picture = doc.type.startsWith("image/");
  useEffect(() => {
    if (!picture) return;
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
  }, [doc.id, picture]);
  return <span className="doc-thumb">{url ? <img src={url} alt="" /> : <UiIcon name="doc" size={18} />}</span>;
}

function DocRow({ doc, item, live, onGo, offer }: { doc: DocMeta; item: Item | null; live: Item[]; onGo: (id: string) => void; offer: (u: Undoable) => void }) {
  return (
    <li className="doc-row" aria-label={doc.name} data-doc-id={doc.id}>
      <Thumb doc={doc} />
      <span className="doc-t">
        <button type="button" className="doc-name" onClick={() => void openDoc(doc.id)} title={L("Belgeyi aç", "Open the document")}>
          {doc.name}
        </button>
        <span className="doc-meta">
          {addedText(doc.addedAt)} · {sizeText(doc.size)}
        </span>
      </span>
      <span className="doc-card">
        {item ? (
          <button type="button" className="doc-go" onClick={() => onGo(item.id)} title={L("Kartına git", "Go to its card")}>
            {cardLabel(item)} →
          </button>
        ) : (
          <LinkPicker doc={doc} live={live} />
        )}
      </span>
      <button type="button" className="doc-open" onClick={() => void openDoc(doc.id)}>
        {L("Aç", "Open")}
      </button>
      <button type="button" className="pk-x doc-x" aria-label={L(`${doc.name}: sil`, `${doc.name}: delete`)} title={L("Sil", "Delete")}
        onClick={() => void takeDoc(doc.id).then((taken) => taken && offer({ kind: "doc", doc: taken }))}>
        <UiIcon name="x" size={12} />
      </button>
    </li>
  );
}

/** "Bir karta bağla": the trip's cards by section; picking one links the file to it. */
function LinkPicker({ doc, live }: { doc: DocMeta; live: Item[] }) {
  const bySection = SECTION_ORDER.map((s) => ({ s, list: live.filter((i) => sectionOfItem(i) === s) })).filter((x) => x.list.length);
  return (
    <select className="doc-link" aria-label={L(`${doc.name}: bir karta bağla`, `${doc.name}: link to a card`)} value=""
      onChange={(e) => e.target.value && void linkDoc(doc.id, e.target.value)}>
      <option value="">{L("Bir karta bağla…", "Link to a card…")}</option>
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
