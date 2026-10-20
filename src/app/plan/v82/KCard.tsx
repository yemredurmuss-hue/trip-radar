// One card of a city's rows (plan v82 "etkinlik ve yapılacaklar", the prototype's `kcard`, mk82.css `.z-k`; 0.38.8 Emre's
// option A): the picture on top at 4:3, about two thirds of the card, its badges small chips on it (the source or the site,
// "Gezinin sebebi", a place's word top left; the tools top right), under it three fixed lines: the name over two lines,
// whole (three when narrow; it edits where it stands, C2), one grey line, and the foot. Its height follows its width, the
// same in every state. A bought ticket keeps its size (v80): a small green "✓ Bilet alındı" chip on the picture's foot (the
// photo stays whole), the day and the meeting place (to the map) for the grey line, the code
// to copy and "Bileti aç" for the foot, ⓘ opening Ayrıntı over the card (the files added there). What's on the plan has
// × "Plandan çıkar" (E §2.6: it fades, 180 ms) and ⋯: ↻ another in its place for a ticket (C26), Yaptım, Haritada aç, taşı
// and Daha fazla öner for a place (C20). An idea's foot is "+ Plana koy"; a place on the plan gets its day there ("Gün
// ver ›"). "Gezinin sebebi" pins the trip's own ticket (C26). Planında's last row is filled with unseen cells (none while
// it's empty: its head says so); more than the row holds: "+n Pano'da".
// 0.39.10: every card of Etkinlik ve turlar is the approved three-across card (docs/mockups/etkinlik-karti-uclu): one word
// on the photo top left, the source at its foot, one grey line of facts, the day over the price big on the foot's left and
// one button on its right ("+ Plana koy", "Rezerve et ↗", "✓ Aldım", "Bileti aç"); "Aldım" is in ⋯ when the button is another.
import { useEffect, useState, type ReactNode } from "react";
import { cardFacts } from "../../../lib/cardFacts";
import { askLike, askOther, eventPicture, moreLabel, pictureChips, placePhotoCredit, placeRatingLine, type KCardVM, type KDeal } from "../../../lib/collectionCards";
import { L } from "../../../lib/i18n";
import type { AccessVM, IntentVM, OptionVM } from "../../../lib/intents";
import { moveToBookings, setDone, setIdeaDay, setPrep } from "../../../lib/ideas";
import type { Plan } from "../../../lib/plan";
import { findPlace, knownPlace, placeLookupKey, type PlaceFound } from "../../../lib/placeSuggest";
import { sightRating } from "../../../lib/citySights";
import { citySights } from "../../../lib/offerSources";
import type { Item, Suggestion } from "../../../lib/types";
import { setItemStatus, setNotNeeded } from "../../actions";
import type { MenuEntry } from "../../cards/CardShell";
import { openDoc, useDocPick } from "../../cards/DocAccess";
import { Editable, InlineEdit, useInlineEdit } from "../../cards/InlineEdit";
import { NAME_IN_PLACE } from "../../../lib/inlineEdit";
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

/** The card's frame: its picture (its chips on it) over its three lines, the same size whatever it holds. */
export function KCard({ className, k, label, pic, title, l2, foot, extra, attrs }: {
  className: string;
  /** Its key in the row (data-k): the flight to Planında (putFly) finds where it went by it. */
  k: string;
  label: string;
  pic: ReactNode;
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

/**
 * The picture's chips (option A; collectionCards.pictureChips says which): who put it there, its site or "Gezinin sebebi"
 * top left, clear of the tools; on its foot "✓ Bilet alındı" (`band`) and a place's word.
 */
function Chips({ card, band }: { card: KCardVM; band?: ReactNode }) {
  const chips = pictureChips(card);
  const top = chips.flatMap((c) =>
    c.kind === "reason"
      ? [
          <span key="r" className="q-src rsn">
            <Ic name="spark" size={11} stroke={2.4} />
            {L("Gezinin sebebi", "The reason for the trip")}
          </span>,
        ]
      : c.kind === "source"
        ? [
            <span key="s" className={`q-src ${c.tone}${c.mark ? " site" : ""}`}>
              {c.mark ? <Mark color={c.mark.color} letter={c.mark.letter} small /> : c.initial && <i>{c.initial}</i>}
              {c.text}
            </span>,
          ]
        : c.kind === "site"
          ? [<BrandChip key="b" brand={c.brand} />]
          : [],
  );
  const tag = chips.find((c) => c.kind === "tag");
  return (
    <>
      {top.length > 0 && <span className="z-kc">{top}</span>}
      {(band || tag) && (
        <span className="z-kd">
          {band}
          {tag && <span className="z-tagc">{tag.text}</span>}
        </span>
      )}
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

/**
 * An Etkinlik card's picture (0.39.10, the approved three-across card, docs/mockups/etkinlik-karti-uclu): its photo (else
 * the drawing, small on cream), one word top left, the source at its foot, the tools top right.
 */
function EventPic({ card, tools, photo }: { card: KCardVM; tools?: ReactNode; photo?: ReactNode }) {
  const { word, source } = eventPicture(card);
  return (
    <>
      {photo ?? <Picture card={card} />}
      {word && (
        <span className="z-kc">
          <span className={`z-kpick ${word.tone}`}>{word.text}</span>
        </span>
      )}
      {source && (
        <span className="z-kd">
          <span className="z-ksrc">{source}</span>
        </span>
      )}
      {tools && <span className="z-kt">{tools}</span>}
    </>
  );
}

/** An Etkinlik card's foot, left (as drawn): its day (else "kişi başı") small over its price big; "Fiyat yok" for an idea with none. */
function PriceBlock({ deal, none }: { deal: Pick<KDeal, "price" | "per" | "when"> | null; none?: boolean }) {
  const when = deal?.when ?? null;
  const per = deal?.per ?? true;
  const price = deal?.price ?? null;
  if (!when && !price && !none) return <span className="z-kpr" />;
  return (
    <span className="z-kpr">
      {when ? <small className="z-kwhen">{when}</small> : price && per ? <small>{L("kişi başı", "per person")}</small> : null}
      {price ? (
        <b>
          {price}
          {when && per && <i>{L(" kişi başı", " per person")}</i>}
        </b>
      ) : none ? (
        <b className="z-knone">{L("Fiyat yok", "No price")}</b>
      ) : null}
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
  // C2: the name edits where it stands (a press on it, as the live card's did; a page's own value comes back from its hint);
  // the record opens from ⋯ "Tüm detaylar". 0.39.0: not drawn (inlineEdit.NAME_IN_PLACE), except on a card just added.
  const name = <Editable field="name">{card.title}</Editable>;
  // 0.39.0: "Adını değiştir" isn't drawn (NAME_IN_PLACE; Emre: the chat corrects it); the entry stays for when it is.
  const renameEntry: MenuEntry = { label: L("Adını değiştir", "Rename"), run: () => edit?.go("name") };
  const rename: MenuEntry[] = NAME_IN_PLACE ? [renameEntry] : [];
  const details: MenuEntry = { label: L("Tüm detaylar", "All details"), run: () => env.onOpenItem(item) };
  const onMap: MenuEntry[] = card.map ? [{ label: L("Haritada aç", "Open on the map"), run: () => openUrl(card.map!) }] : [];
  const notNeeded: MenuEntry = { label: L("Gerek yok", "Not needed"), run: () => leave(() => void setNotNeeded(item).then(env.offer)), danger: true, sep: true };
  const stageRest = stage.menu.filter((m) => m.id !== "change" && m.label !== L("Çıkar", "Rule out"));

  // 0.39.10: an Etkinlik card on the plan has one button ("Rezerve et ↗" on its page, a file's "Bileti aç", else "✓ Aldım");
  // "Aldım" steps into ⋯ when the button is another.
  const gotIt = () => void setItemStatus(item, "booked");
  const reserve = event && (card.state === "planned" || card.state === "wanted") && (docs.length > 0 || !!card.page || (card.state === "wanted" && !!search));
  let menu: MenuEntry[];
  if (event) {
    menu = [
      ...(reserve ? [{ label: `✓ ${L("Aldım", "Got it")}`, run: gotIt }] : []),
      // C26: another in this one's place (the chat looks), where the live card's ↻ was.
      ...(card.state === "planned" && env.ask ? [{ label: `↻ ${L("Yerine başkasını öner", "Suggest another in its place")}`, run: () => env.ask!(askOther(card.title)) }] : []),
      ...rename,
      ...onMap,
      details,
      ...stageRest,
      ...(card.state === "booked" ? [] : [notNeeded]),
    ];
  } else if (card.family === "note") {
    menu = [{ label: L("Düzenle", "Edit"), run: () => env.edit(item) }, ...rename, { label: L("Hazırlık'a taşı", "Move to Prep"), run: () => void setPrep(item, true) }, { label: L("Sil", "Delete"), run: () => env.remove(item), danger: true, sep: true }];
  } else {
    const done = card.state === "done";
    const booked = card.state === "booked";
    menu = [
      // C20: the live tile's ••• (Yaptım, Haritada aç, Adını değiştir, a table, Günden çıkar, taşı), and Daha fazla öner.
      { label: done ? (food ? L("Gidilmedi olarak geri al", "Mark as not been") : L("Yapılmadı olarak geri al", "Mark as not done")) : food ? L("Gittim", "Been there") : L("Yaptım", "Done it"), run: () => void setDone(item, !done) },
      ...onMap,
      ...rename,
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
    <button type="button" className="q-open" onClick={() => void openDoc(docs[0].id)} title={docs[0].name} aria-label={event ? (card.brand ? L(`${card.brand.label} biletini aç`, `Open the ${card.brand.label} ticket`) : L("Bileti aç", "Open the ticket")) : L(`${card.title}: belgeyi aç`, `${card.title}: open the document`)}>
      <Ic name="clip" size={13} stroke={2.2} />
      <span>{event ? L("Bileti aç", "Open ticket") : L("Aç", "Open")}</span>
    </button>
  ) : event || card.access?.code ? (
    // v81: the file is added in Ayrıntı too; here it's one quiet line beside the code ("📎 Bilet ekle"), not a box.
    <button type="button" className="q-doc add" onClick={doc.pick} aria-label={event ? L("Bileti ekle", "Add the ticket") : L(`${card.title}: belgeyi ekle`, `${card.title}: add the document`)}>
      <Ic name="clip" size={12} stroke={2.2} />
      <span>{event ? L("Bilet ekle", "Add ticket") : L("Belge ekle", "Add document")}</span>
    </button>
  ) : plan ? (
    <DayGive item={item} plan={plan} />
  ) : null;

  if (event) {
    const deal = card.deal ?? null;
    const site = card.brand?.label;
    let main: ReactNode = null;
    // (the record's own line is its day and price, which the foot says now)
    let l2e: ReactNode = <DealFacts deal={deal} fallback={null} />;
    if (card.state === "idea") main = <PutButton title={card.title} onPut={() => onPut(item)} />;
    else if (card.state === "booked") {
      // A bought ticket (v81, kept): its code to copy and the meeting place on the grey line, "Bileti aç" (else "Bilet ekle").
      const a = card.access;
      if (a?.code || a?.where)
        l2e = (
          <span className="q-acc z-kacc">
            {a.code && <CopyCode value={a.code.value} label={a.code.label} className="q-code z-kcode" />}
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
      main = docButton;
    } else if (docs.length) main = docButton;
    else if (card.page && card.state === "planned")
      main = (
        <a className="z-kgo" href={card.page} target="_blank" rel="noopener noreferrer" title={site ? L(`${site} sitesinde aç`, `Open on ${site}`) : L("Sayfasında aç", "Open its page")}>
          {L("Rezerve et", "Book")} ↗
        </a>
      );
    else if (card.state === "wanted" && search)
      main = (
        <a className="z-kgo" href={search.url} target="_blank" rel="noopener noreferrer" title={L(`${search.name}'da ara · yeni sekmede açılır`, `Search ${search.name} · opens in a new tab`)}>
          {L(`${search.name}'da ara`, `Search ${search.name}`)} ↗
        </a>
      );
    else
      main = (
        <button type="button" className="z-kgo" onClick={gotIt}>
          <Ic name="check" size={13} stroke={2.6} /> {L("Aldım", "Got it")}
        </button>
      );
    return (
      <KCard
        className={`q-card z-ko ${where}${look}${leaving ? " leaving" : ""}`}
        k={card.key}
        label={card.title}
        attrs={{ "data-item-id": item.id, "data-st": card.state }}
        pic={<EventPic card={card} tools={tools} />}
        title={name}
        l2={l2e}
        foot={
          <>
            <PriceBlock deal={deal} none={card.state === "idea"} />
            {main}
          </>
        }
        extra={
          <>
            {detailNode}
            {stage.field}
            {doc.field}
          </>
        }
      />
    );
  }

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
            <Chips
              card={card}
              band={
                card.state === "booked" && (
                  <span className="q-vband">
                    <Ic name="check" size={12} stroke={3} />
                    {event ? L("Bilet alındı", "Ticket bought") : L("Rezervasyon", "Booked")}
                  </span>
                )
              }
            />
            <span className="z-kt">{tools}</span>
          </>
        }
        title={name}
        l2={l2}
        foot={foot}
        extra={
          <>
            {detailNode}
            {stage.field}
            {doc.field}
          </>
        }
      />
    </>
  );
}

/**
 * A place's photo, rating and Maps page, asked once a card shows (placeSuggest.findPlace): Google Maps, else the place in
 * its city's Google sights (photo and rating, spec 2026-10-19 SerpApi item 3), else its Wikipedia page's photo; null
 * while none is found.
 */
function usePlaceFound(s: Suggestion | null, on: boolean): PlaceFound | null {
  const key = s && on ? placeLookupKey(s) : "";
  const city = (on && s?.payload?.city?.trim()) || null;
  const [found, setFound] = useState<{ key: string; place: PlaceFound | null } | null>(null);
  useEffect(() => {
    if (!key || !s || knownPlace(s) !== undefined) return;
    let live = true;
    void findPlace(s, { sights: city ? () => citySights(city) : undefined }).then((place) => live && setFound({ key, place }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the place, by its key and city
  }, [key, city]);
  if (!key || !s) return null;
  return found?.key === key ? found.place : (knownPlace(s) ?? null);
}

/**
 * A suggestion to add (the chat's, a rule's): ✨, why, "+ Plana koy", × Gerek yok. A place to see or eat at shows its
 * own photo (else the drawing), its word on the picture, its name over two lines (never cut in a word), Google Maps' rating
 * and reviews when Maps gave them, and "Haritada aç" (the place's own Maps page once found); put on the plan, the record
 * keeps the photo and that page.
 */
export function SuggestCard({ card, onPut, onDismiss }: { card: KCardVM; onPut: (photo: string | null, map: string | null) => void; onDismiss: () => void }) {
  const place = card.family !== "event";
  if (!place) return <EventSuggestCard card={card} onPut={() => onPut(null, null)} onDismiss={onDismiss} />;
  return <PlaceSuggestCard card={card} onPut={onPut} onDismiss={onDismiss} />;
}

/**
 * An AI idea for Etkinlik (0.39.10, the approved card's "fotoğrafsız fikir"): "AI fikri" on its drawing, its why for the
 * grey line, "Fiyat yok" beside "+ Plana koy" (a model's idea has no price), × Gerek yok.
 */
function EventSuggestCard({ card, onPut, onDismiss }: { card: KCardVM; onPut: () => void; onDismiss: () => void }) {
  return (
    <KCard
      className="q-card q-opt sugg z-ko"
      k={card.key}
      label={card.title}
      attrs={{ "data-suggestion": card.suggestion?.key }}
      pic={
        <EventPic
          card={card}
          tools={
            <button type="button" className="q-rm" aria-label={L(`${card.title}: gerek yok`, `${card.title}: not needed`)} title={L("Gerek yok", "Not needed")} onClick={onDismiss}>
              <Ic name="x" size={12} stroke={2.6} />
            </button>
          }
        />
      }
      title={<span className="z-tn">{card.title}</span>}
      l2={card.line}
      foot={
        <>
          <PriceBlock deal={null} none={card.canPut} />
          {card.canPut && <PutButton title={card.title} onPut={onPut} />}
        </>
      }
    />
  );
}

function PlaceSuggestCard({ card, onPut, onDismiss }: { card: KCardVM; onPut: (photo: string | null, map: string | null) => void; onDismiss: () => void }) {
  // A sight from Google has its photo and rating already; any other place is looked up (Maps, its city's sights, Wikipedia).
  const found = usePlaceFound(card.suggestion, !card.photo);
  const photo = found?.photo ?? null;
  const shown = photo ? { ...card, photo: photo.url } : card;
  // Maps' own page for the place once it's found there; else the card's Maps search.
  const map = found?.map ?? card.map;
  // The rating is drawn once: Google's sights' (no review count) on the picture, Maps' with its reviews in the grey line.
  const rating = card.rating ?? (found?.sight ? sightRating(found.rating) : null);
  const credit = found ? placePhotoCredit(found.credit, found.photoBy) : card.photo ? placePhotoCredit("Google") : undefined;
  return (
    <KCard
      className="q-tile q-opt sugg z-kplace"
      k={card.key}
      label={card.title}
      attrs={{ "data-suggestion": card.suggestion?.key }}
      pic={
        <>
          <FallbackImg className="ph" src={shown.photo} fallback={<img className="art" src={card.art} alt="" />} title={credit} />
          <Chips card={card} />
          {rating && (
            <span className="z-prate" title={L("Google puanı", "Google rating")}>
              {rating}
            </span>
          )}
          <span className="z-kt">
            <button type="button" className="q-rm" aria-label={L(`${card.title}: gerek yok`, `${card.title}: not needed`)} title={L("Gerek yok", "Not needed")} onClick={onDismiss}>
              <Ic name="x" size={12} stroke={2.6} />
            </button>
          </span>
        </>
      }
      title={<span className="z-tn">{card.title}</span>}
      l2={placeRatingLine(card.line, found?.sight ? null : found?.rating, found?.reviews)}
      foot={
        map ? (
          <span className="q-act">
            {card.canPut && <PutButton title={card.title} onPut={() => onPut(photo?.url ?? card.photo ?? null, found?.map ?? null)} />}
            <a className="z-kmap" href={map} target="_blank" rel="noopener noreferrer" data-map="" aria-label={L(`${card.title}: haritada aç`, `${card.title}: open on the map`)} title={L("Haritada aç", "Open on the map")}>
              <Ic name="pin" size={14} stroke={2.2} />
              {!card.canPut && <span>{L("Haritada aç", "Open on the map")}</span>}
            </a>
          </span>
        ) : card.canPut ? (
          <PutButton title={card.title} onPut={() => onPut(null, null)} />
        ) : null
      }
    />
  );
}

/**
 * An Etkinlik card's grey line (0.39.9, every card of the row since 0.39.10): ★ its rating (its reviews), how long, free
 * cancellation, a saved ticket's own words after them; none of these, the card's own line.
 */
function DealFacts({ deal, fallback }: { deal: KDeal | null; fallback: string | null }) {
  const loc = L("tr-TR", "en-GB");
  const parts: ReactNode[] = [];
  if (!deal) return <>{fallback}</>;
  if (deal.rating != null)
    parts.push(
      <span key="r" className="z-kst">
        <Ic name="star" size={12} />
        {deal.rating.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        {deal.reviews != null && <small>({deal.reviews.toLocaleString(loc)})</small>}
      </span>,
    );
  if (deal.duration) parts.push(<span key="d">{deal.duration}</span>);
  if (deal.free) parts.push(<span key="f" className="z-kfree">{L("Ücretsiz iptal", "Free cancellation")}</span>);
  if (deal.note) parts.push(<span key="n" className="z-knote">{deal.note}</span>);
  return parts.length ? <span className="z-kfacts">{parts}</span> : <>{fallback}</>;
}

/**
 * A tour the connected source offers for the city (0.39.9, Emre: Viator's own card as the model, three across): the
 * source's pick in a word top left, the source at the picture's foot; its name over two lines (its page), one line of
 * rating, length and free cancellation; the price a person big beside "+ Plana koy". A city's event (no deal) keeps the
 * plain card.
 */
export function OfferCard({ card, onPut }: { card: KCardVM; onPut: () => void }) {
  const deal = card.deal;
  if (deal) {
    const source = pictureChips(card).find((c) => c.kind === "source");
    return (
      <KCard
        className="q-card q-opt z-ko"
        k={card.key}
        label={card.title}
        attrs={{ "data-offer": card.offer?.id }}
        pic={<EventPic card={card} />}
        title={
          card.page ? (
            <a className="z-tb" href={card.page} target="_blank" rel="noopener noreferrer">
              {card.title}
            </a>
          ) : (
            <span className="z-tn">{card.title}</span>
          )
        }
        l2={<DealFacts deal={deal} fallback={card.line} />}
        foot={
          <>
            <PriceBlock deal={deal} />
            <PutButton title={card.title} onPut={onPut} />
          </>
        }
      />
    );
  }
  // A city's event (Google Events): the same card, its day and hour where a price would be, its place for the grey line.
  const o = card.offer;
  return (
    <KCard
      className="q-card q-opt z-ko"
      k={card.key}
      label={card.title}
      attrs={{ "data-offer": o?.id }}
      pic={<EventPic card={card} />}
      title={
        card.page ? (
          <a className="z-tb" href={card.page} target="_blank" rel="noopener noreferrer">
            {card.title}
          </a>
        ) : (
          <span className="z-tn">{card.title}</span>
        )
      }
      l2={o ? (o.meta ?? null) : card.line}
      foot={
        <>
          <PriceBlock deal={o?.why ? { price: null, when: o.why } : null} />
          <PutButton title={card.title} onPut={onPut} />
        </>
      }
    />
  );
}

/**
 * Planında's last row filled to four with cells held unseen beside its cards. With nothing on the plan there are none: the
 * head's line says so (Emre, 19 Ekim).
 */
export function EmptySlots({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="z-k z-k0 off" data-slot="" aria-hidden />
      ))}
    </>
  );
}

/**
 * "+n Pano'da": the rest of a row, the Pano opened on this city's intent. Not drawn since 0.38.9 (four cards, the rest
 * waiting; the way to the Pano is the head's count); kept, as nothing designed is deleted.
 */
export function MoreTile({ n, title, onOpen }: { n: number; title: string; onOpen: () => void }) {
  return (
    <button type="button" className="z-k z-more q-pano" aria-label={moreLabel(n, title)} onClick={onOpen}>
      <b>+{n}</b>
      <small>{L("Pano'da", "on the Board")}</small>
    </button>
  );
}
