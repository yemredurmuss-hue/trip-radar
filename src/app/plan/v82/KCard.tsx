// One card of a city's rows (plan v82 "etkinlik ve yapılacaklar", the prototype's `kcard`, mk82.css `.z-k`): 224 px tall in
// every state, the card's picture (92 px) over four fixed lines: the site's label or the place's word, the name (it edits
// where it stands, C2; a press opens its record), one grey line, and the foot. A bought ticket keeps its size (v80): a
// green "Bilet alındı" band at the picture's foot, the day and the meeting place (to the map) for the grey line, the code
// to copy and "Bileti aç" for the foot, ⓘ opening Ayrıntı over the card (the files added there). What's on the plan has
// × "Plandan çıkar" (E §2.6: it fades, 180 ms) and ⋯: ↻ another in its place for a ticket (C26), Yaptım, Haritada aç, taşı
// and Daha fazla öner for a place (C20). An idea's foot is "+ Plana koy"; a place on the plan gets its day there ("Gün
// ver ›"). "Gezinin sebebi" pins the trip's own ticket (C26). Empty Planında: four slots of the same size; more than the
// row holds: "+n Pano'da".
import { useState, type ReactNode } from "react";
import { cardFacts } from "../../../lib/cardFacts";
import { askLike, askOther, moreLabel, type KCardVM } from "../../../lib/collectionCards";
import { L } from "../../../lib/i18n";
import type { AccessVM, IntentVM, OptionVM } from "../../../lib/intents";
import { moveToBookings, setDone, setIdeaDay, setPrep } from "../../../lib/ideas";
import type { Plan } from "../../../lib/plan";
import type { Item } from "../../../lib/types";
import { setItemStatus, setNotNeeded } from "../../actions";
import type { MenuEntry } from "../../cards/CardShell";
import { openDoc, useDocPick } from "../../cards/DocAccess";
import { Editable, InlineEdit, useInlineEdit } from "../../cards/InlineEdit";
import { useCardEnv } from "../../cards/PlanCard";
import { useStageMenu } from "../../cards/stageMenu";
import { FallbackImg } from "../../FallbackImg";
import { reducedMotion } from "../../motion";
import { CopyCode, DetailLayer } from "./DetailLayer";
import { DayGive } from "./DayGive";
import { Ic, Mark } from "./icons";
import { KMenu } from "./KMenu";
import { BrandChip } from "./OptionCompact";

/** E §2.6: "Plandan çıkar" is quiet, the card fades in 180 ms (and shrinks to 97%) before it goes back to the ideas. */
export const LEAVE_MS = 180;

/** The card's frame: its picture over its four lines, the same size whatever it holds. */
export function KCard({ className, k, label, pic, l1, title, l2, foot, extra, attrs }: {
  className: string;
  /** Its key in the row (data-k): the flight to Planında (putFly) finds where it went by it. */
  k: string;
  label: string;
  pic: ReactNode;
  l1: ReactNode;
  title: ReactNode;
  l2: ReactNode;
  foot: ReactNode;
  /** Over the card: Ayrıntı. */
  extra?: ReactNode;
  attrs?: Record<string, string | undefined>;
}) {
  return (
    <article className={`z-k ${className}`} data-k={k} aria-label={label} data-new={L("Yeni", "New")} {...attrs}>
      <div className="z-kp">{pic}</div>
      <div className="z-kb">
        <span className="z-l1">{l1}</span>
        <h3 className="z-t" title={label}>{title}</h3>
        <span className="z-l2">{l2}</span>
        <div className="z-kf">{foot}</div>
      </div>
      {extra}
    </article>
  );
}

function Picture({ card }: { card: KCardVM }) {
  const art = <img className="art" src={card.art} alt="" />;
  return <FallbackImg className="ph" src={card.photo} fallback={art} />;
}

/** Who put it there, the picture's top-left badge; the trip's own ticket says "Gezinin sebebi" instead. */
function Corner({ card }: { card: KCardVM }) {
  if (card.reason) {
    return (
      <span className="q-src rsn">
        <Ic name="spark" size={11} stroke={2.4} />
        {L("Gezinin sebebi", "The reason for the trip")}
      </span>
    );
  }
  const b = card.badge;
  if (!b || card.state !== "idea") return null;
  return (
    <span className={`q-src ${b.tone}`}>
      {b.initial && <i>{b.initial}</i>}
      {b.text}
    </span>
  );
}

/** The first line: a ticket's site in its colour, a place's word. */
function First({ card, extra }: { card: KCardVM; extra?: ReactNode }) {
  return (
    <>
      {card.family === "event" ? <BrandChip brand={card.brand} /> : card.tag && <span className="z-tagc">{card.tag}</span>}
      {extra}
    </>
  );
}

const PutButton = ({ title, onPut }: { title: string; onPut: () => void }) => (
  <button type="button" className="q-pick ghost" data-put="" title={L(`${title}: plana koy`, `${title}: add to plan`)} onClick={onPut}>
    + {L("Plana koy", "Add to plan")}
  </button>
);

/** A bought ticket's or a booked table's grey line: the day, and the meeting place to the map. */
function Access({ card }: { card: KCardVM }) {
  const a = card.access;
  if (!a) return null;
  return (
    <span className="q-acc">
      {a.when && (
        <span className="q-aw">
          <Ic name="cal" size={12} />
          {a.when}
        </span>
      )}
      {a.where &&
        (a.map ? (
          <a className="q-aw" href={a.map} target="_blank" rel="noopener noreferrer" title={L("Haritada aç", "Open on the map")}>
            <Ic name="pin" size={12} />
            {a.where}
          </a>
        ) : (
          <span className="q-aw">
            <Ic name="pin" size={12} />
            {a.where}
          </span>
        ))}
    </span>
  );
}

export interface RecordCardProps {
  card: KCardVM;
  /** The row's intent (its city, its planned options for Ayrıntı). */
  vm: IntentVM;
  plan: Pick<Plan, "range" | "stayBlocks"> | null;
  /** "+ Kendin ara"'s first site: a place the start opened looks for it there. */
  search: { name: string; color: string; letter: string; url: string } | null;
  onPut: (item: Item) => void;
  onTakeOff: (item: Item) => void;
}

/** A record of the trip in a row: a ticket or a tour, a place, a restaurant, a note. Its name and price edit in place. */
export function RecordCard(props: RecordCardProps) {
  return (
    <InlineEdit item={props.card.item!} only={["name"]}>
      <RecordFace {...props} />
    </InlineEdit>
  );
}

const openUrl = (url: string) => void window.open(url, "_blank", "noopener");

function RecordFace({ card, vm, plan, search, onPut, onTakeOff }: RecordCardProps) {
  const env = useCardEnv();
  const edit = useInlineEdit();
  const item = card.item!;
  const doc = useDocPick(item);
  const stage = useStageMenu(item);
  const [detail, setDetail] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const docs = env.docsFor(item.id);
  const event = card.family === "event";
  const food = card.family === "food";
  const where = card.state === "idea" ? "q-opt" : "q-plan";
  const look = card.state === "booked" ? " done" : card.state === "done" ? " made" : card.state === "wanted" ? " wanted" : card.family === "note" ? " note" : "";
  const leave = (run: () => void) => {
    if (reducedMotion()) return run();
    setLeaving(true);
    setTimeout(run, LEAVE_MS);
  };
  // A place on its day leaves its day too (as the live tile did): taken off the plan, it's an idea again.
  const takeOff = () => leave(() => (card.day && !event ? void setIdeaDay(item, null, null).then(() => onTakeOff(item)) : onTakeOff(item)));
  const name = edit?.open === "name" ? (
    <Editable field="name" />
  ) : (
    <button type="button" className="z-tb" onClick={() => env.onOpenItem(item)} aria-label={L(`${card.title}: tüm detaylar`, `${card.title}: all details`)}>
      {card.title}
    </button>
  );
  const rename: MenuEntry = { label: L("Adını değiştir", "Rename"), run: () => edit?.go("name") };
  const details: MenuEntry = { label: L("Tüm detaylar", "All details"), run: () => env.onOpenItem(item) };
  const onMap: MenuEntry[] = card.map ? [{ label: L("Haritada aç", "Open on the map"), run: () => openUrl(card.map!) }] : [];
  const notNeeded: MenuEntry = { label: L("Gerek yok", "Not needed"), run: () => leave(() => void setNotNeeded(item).then(env.offer)), danger: true, sep: true };
  const stageRest = stage.menu.filter((m) => m.id !== "change" && m.label !== L("Çıkar", "Rule out"));

  let menu: MenuEntry[];
  if (event) {
    menu = [
      // C26: another in this one's place (the chat looks), where the live card's ↻ was.
      ...(card.state === "planned" && env.ask ? [{ label: `↻ ${L("Yerine başkasını öner", "Suggest another in its place")}`, run: () => env.ask!(askOther(card.title)) }] : []),
      rename,
      ...onMap,
      details,
      ...stageRest,
      ...(card.state === "booked" ? [] : [notNeeded]),
    ];
  } else if (card.family === "note") {
    menu = [{ label: L("Düzenle", "Edit"), run: () => env.edit(item) }, rename, { label: L("Hazırlık'a taşı", "Move to Prep"), run: () => void setPrep(item, true) }, { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true, sep: true }];
  } else {
    const done = card.state === "done";
    const booked = card.state === "booked";
    menu = [
      // C20: the live tile's ••• (Yaptım, Haritada aç, Adını değiştir, a table, Günden çıkar, taşı), and Daha fazla öner.
      { label: done ? (food ? L("Gidilmedi olarak geri al", "Mark as not been") : L("Yapılmadı olarak geri al", "Mark as not done")) : food ? L("Gittim", "Been there") : L("Yaptım", "Done it"), run: () => void setDone(item, !done) },
      ...onMap,
      rename,
      ...(card.takesTable || booked ? [{ label: booked ? L("Rezervasyonu geri al", "Mark as not booked") : L("Rezervasyonu yaptım", "I booked it"), run: () => void setItemStatus(item, booked ? "chosen" : "booked") }] : []),
      ...(card.day ? [{ label: L("Günden çıkar", "Take off its day"), run: () => void setIdeaDay(item, null, null) }] : []),
      ...(!food ? [{ label: L("Etkinliklere taşı (bileti var)", "Move to activities (has a ticket)"), run: () => void moveToBookings(item) }] : []),
      ...(!food ? [{ label: L("Hazırlık'a taşı", "Move to Prep"), run: () => void setPrep(item, true) }] : []),
      ...(env.ask ? [{ label: L("Daha fazla öner", "Suggest more"), run: () => env.ask!(askLike(card, vm.head.city)) }] : []),
      ...(booked ? [{ label: L("Belge ekle", "Add a document"), run: doc.pick }] : []),
      { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true, sep: true },
    ];
  }

  // Ayrıntı over a bought ticket (K2, v81): its code, when, where, what was paid, its files and "+ Belge ekle".
  const option: OptionVM | undefined = vm.planned.find((o) => o.id === item.id);
  const paid = card.state === "booked" ? (cardFacts(item, undefined, env.decisions?.ctx).price?.text ?? null) : null;
  const access: AccessVM | null = card.access
    ? {
        code: card.access.code,
        checkIn: null,
        checkOut: null,
        when: card.access.when,
        where: card.access.where,
        doc: { count: docs.length, name: docs[0]?.name ?? null },
        docMissing: false,
        links: { map: card.access.map, host: null, page: item.url },
        primary: docs.length ? "openDoc" : "addDoc",
      }
    : null;
  const detailNode =
    detail && event && option && access ? (
      <DetailLayer
        vm={{ ...vm, kind: "activity", access, paid: paid ? L(`${paid} ödendi`, `${paid} paid`) : null }}
        option={option}
        booked
        onClose={() => setDetail(false)}
        onAddDoc={doc.pick}
        footer={
          <>
            <button type="button" className="q-dact" onClick={stage.cancel}>{L("İptal ettim", "I cancelled it")}</button>
            <button type="button" className="q-dact" onClick={() => void setItemStatus(item, "chosen")}>{L("Rezervasyonu geri al", "Mark as not booked")}</button>
            <button type="button" className="q-dact" onClick={() => env.edit(item)}>{L("Düzenle", "Edit")}</button>
          </>
        }
      />
    ) : null;

  const tools =
    card.state === "booked" && event ? (
      <button type="button" className="z-ib q-inf" aria-label={L(`${card.title}: ayrıntı`, `${card.title}: details`)} aria-expanded={detail} title={L("Ayrıntı", "Details")} onClick={() => setDetail(!detail)}>
        <i>i</i>
      </button>
    ) : (
      <>
        {(card.state === "planned" || card.state === "wanted") && (
          <button type="button" className="q-rm" aria-label={L(`${card.title}: plandan çıkar`, `${card.title}: take off the plan`)} title={L("Plandan çıkar", "Take off the plan")} onClick={takeOff}>
            <Ic name="x" size={12} stroke={2.6} />
          </button>
        )}
        <KMenu entries={menu} label={L(`${card.title}: diğer`, `${card.title}: more`)} />
      </>
    );

  const docButton = docs.length ? (
    <button type="button" className="q-open" onClick={() => void openDoc(docs[0].id)} aria-label={event ? (card.brand ? L(`${card.brand.label} biletini aç`, `Open the ${card.brand.label} ticket`) : L("Bileti aç", "Open the ticket")) : L(`${card.title}: belgeyi aç`, `${card.title}: open the document`)}>
      <Ic name="clip" size={13} stroke={2.2} />
      <span>{event ? L("Bileti aç", "Open ticket") : L("Aç", "Open")}</span>
    </button>
  ) : event || card.access?.code ? (
    // v81: the file is added in Ayrıntı too; here it's one small "Ekle" beside the code.
    <button type="button" className="q-doc add" onClick={doc.pick} aria-label={event ? L("Bileti ekle", "Add the ticket") : L(`${card.title}: belgeyi ekle`, `${card.title}: add the document`)}>
      <Ic name="clip" size={12} stroke={2.2} />
      <span>{L("Ekle", "Add")}</span>
    </button>
  ) : plan ? (
    <DayGive item={item} plan={plan} />
  ) : null;

  let foot: ReactNode;
  let l2: ReactNode = card.line;
  if (card.state === "idea") {
    foot = <PutButton title={card.title} onPut={() => onPut(item)} />;
  } else if (card.state === "booked") {
    l2 = <Access card={card} />;
    foot = (
      <span className="q-act">
        {card.access?.code && <CopyCode value={card.access.code.value} label={card.access.code.label} />}
        {docButton}
      </span>
    );
  } else if (card.state === "wanted") {
    foot = (
      <span className="q-act">
        <button type="button" className="q-got sm" onClick={() => void setItemStatus(item, "booked")}>
          <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
        </button>
        {search && (
          <a className="q-cta sm" href={search.url} target="_blank" rel="noopener noreferrer" title={L(`${search.name}'da ara · yeni sekmede açılır`, `Search ${search.name} · opens in a new tab`)}>
            <Mark color={search.color} letter={search.letter} small />
            <span>{L("Ara", "Search")}</span>
          </a>
        )}
      </span>
    );
  } else if (event) {
    foot = (
      <span className="q-act">
        <button type="button" className="q-got sm" onClick={() => void setItemStatus(item, "booked")}>
          <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
        </button>
        {card.page && (
          <a className="q-cta sm" href={card.page} target="_blank" rel="noopener noreferrer" title={card.brand ? L(`${card.brand.label} sitesinde aç`, `Open on ${card.brand.label}`) : undefined}>
            {card.brand && <Mark color={card.brand.color ?? "#6b6f80"} letter={[...card.brand.label][0] ?? ""} small />}
            <span>{L("Satın al", "Buy")}</span>
          </a>
        )}
      </span>
    );
  } else if (card.family === "note") {
    foot = (
      <button type="button" className="q-day" onClick={() => env.edit(item)}>
        {L("Düzenle", "Edit")}
      </button>
    );
  } else if (card.state === "done") {
    foot = (
      <span className="z-okc">
        <Ic name="check" size={12} stroke={3} /> {food ? L("Gidildi", "Been there") : L("Yapıldı", "Done")}
      </span>
    );
  } else {
    foot = (
      <>
        <span className="z-okc">
          <Ic name="check" size={12} stroke={3} /> {L("Planda", "On the plan")}
        </span>
        {plan && <DayGive item={item} plan={plan} />}
      </>
    );
  }

  return (
    <>
      <KCard
        className={`${event ? "q-card" : "q-tile"} ${where}${look}${leaving ? " leaving" : ""}`}
        k={card.key}
        label={card.title}
        attrs={{ "data-item-id": item.id, "data-st": card.state }}
        pic={
          <>
            <Picture card={card} />
            <Corner card={card} />
            {card.state === "booked" && (
              <span className="q-vband">
                <Ic name="check" size={12} stroke={3} />
                {event ? L("Bilet alındı", "Ticket bought") : L("Rezervasyon", "Booked")}
              </span>
            )}
            <span className="z-kt">{tools}</span>
          </>
        }
        l1={<First card={card} />}
        title={name}
        l2={l2}
        foot={foot}
        extra={detailNode}
      />
      {stage.field}
      {doc.field}
    </>
  );
}

/** A suggestion to add (the chat's, a rule's): ✨, why, "+ Plana koy", × Gerek yok. */
export function SuggestCard({ card, onPut, onDismiss }: { card: KCardVM; onPut: () => void; onDismiss: () => void }) {
  return (
    <KCard
      className={`${card.family === "event" ? "q-card" : "q-tile"} q-opt sugg`}
      k={card.key}
      label={card.title}
      attrs={{ "data-suggestion": card.suggestion?.key }}
      pic={
        <>
          <Picture card={card} />
          <Corner card={card} />
          <span className="z-kt">
            <button type="button" className="q-rm" aria-label={L(`${card.title}: gerek yok`, `${card.title}: not needed`)} title={L("Gerek yok", "Not needed")} onClick={onDismiss}>
              <Ic name="x" size={12} stroke={2.6} />
            </button>
          </span>
        </>
      }
      l1={<First card={card} />}
      title={<span className="z-tn">{card.title}</span>}
      l2={card.line}
      foot={card.canPut ? <PutButton title={card.title} onPut={onPut} /> : null}
    />
  );
}

/** A tour the connected source offers for the city: its page on the name, its price a person, "+ Plana koy". */
export function OfferCard({ card, onPut }: { card: KCardVM; onPut: () => void }) {
  return (
    <KCard
      className="q-card q-opt"
      k={card.key}
      label={card.title}
      attrs={{ "data-offer": card.offer?.id }}
      pic={
        <>
          <Picture card={card} />
          <Corner card={card} />
        </>
      }
      l1={<First card={card} />}
      title={
        card.page ? (
          <a className="z-tb" href={card.page} target="_blank" rel="noopener noreferrer">
            {card.title}
          </a>
        ) : (
          <span className="z-tn">{card.title}</span>
        )
      }
      l2={card.line}
      foot={<PutButton title={card.title} onPut={onPut} />}
    />
  );
}

/**
 * Planında's empty cells: with nothing on the plan the first says so ("Henüz plana koymadın") and the others wait with a
 * faint +; beside cards they hold the cells' places unseen (the flight to Planında lands on the first of them).
 */
export function EmptySlots({ n, empty }: { n: number; empty: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) =>
        empty && i === 0 ? (
          <div key={i} className="z-k z-k0" data-slot="">
            <b>{L("Henüz plana koymadın", "Nothing on your plan yet")}</b>
            <small>{L("Önerilerden “+ Plana koy” ile ekle", "Add one from the suggestions with “+ Add to plan”")}</small>
          </div>
        ) : (
          <div key={i} className={`z-k z-k0 sl${empty ? "" : " off"}`} data-slot="" aria-hidden>
            {empty && <Ic name="plus" size={18} />}
          </div>
        ),
      )}
    </>
  );
}

/** "+n Pano'da": the rest of a row, the Pano opened on this city's intent. */
export function MoreTile({ n, title, onOpen }: { n: number; title: string; onOpen: () => void }) {
  return (
    <button type="button" className="z-k z-more q-pano" aria-label={moreLabel(n, title)} onClick={onOpen}>
      <b>+{n}</b>
      <small>{L("Pano'da", "on the Board")}</small>
    </button>
  );
}
