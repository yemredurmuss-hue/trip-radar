// Ayrıntı (K2; plan v82 "Ayrıntı kartı büyütmez, kartın üstünde açılır"; B14 one panel, "Tüm detaylar ›" under it): over the
// frame, never making it taller. For an option, chosen or our pick: what was asked for (✓ ✕), its pluses and minuses, the
// cancellation in full, the fit score and the pick's sentence (C12); for a booking: its code, its hours, its address, what
// was paid and its files, "İptal ettim" and Düzenle. Escape and × close it and the focus goes back to ⓘ.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cardFacts } from "../../../lib/cardFacts";
import { cardWhy } from "../../../lib/cardWhy";
import { choiceOf } from "../../../lib/choice";
import { copyOrSelect } from "../../../lib/copyText";
import type { GroupDecision } from "../../../lib/decision";
import { L } from "../../../lib/i18n";
import { bookedWhen, codeLabel } from "../../../lib/intentFrame";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { cancellationText } from "../../../lib/needs";
import { groupKeyOf } from "../../../lib/plan";
import type { Item } from "../../../lib/types";
import { useCardEnv } from "../../cards/PlanCard";
import { openDoc } from "../../cards/DocAccess";
import { datedLink, TradeLine } from "../../cards/parts";
import { WhyLine } from "../../cards/WhyLine";
import { Ic } from "./icons";

/** A code and its copy button: a click copies it (or selects it where the browser refuses) and says so for a moment. */
export function CopyCode({ value, label, className = "q-code" }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState<"copied" | "selected" | null>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 1600);
    return () => clearTimeout(t);
  }, [done]);
  const select = () => {
    const el = text.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };
  const said = done === "copied" ? L("Kopyalandı", "Copied") : done === "selected" ? L("Seçildi, ⌘C ile kopyala", "Selected, press ⌘C") : null;
  return (
    <span className={className}>
      <span ref={text}>{value}</span>
      <button type="button" className="q-cp" aria-label={said ?? L(`${label} kopyala`, `Copy: ${label}`)} title={said ?? L("Kopyala", "Copy")}
        onClick={(e) => {
          e.stopPropagation();
          void copyOrSelect(value, select).then(setDone);
        }}>
        <Ic name={done === "copied" ? "check" : "copy"} size={12} stroke={2.2} />
      </button>
    </span>
  );
}

/** Escape is the box's own while the focus is in it (or nowhere): a window opened over the plan takes its own Escape. */
export const focusNear = (box: HTMLElement | null): boolean => {
  const at = document.activeElement;
  return !at || at === document.body || Boolean(box?.closest(".q-int")?.contains(at));
};

/** The decision a record is compared in (useDecisions.byGroup), for its pluses and minuses and the pick's sentence. */
export function decisionOf(byGroup: ReadonlyMap<string, GroupDecision> | undefined, item: Item): GroupDecision | undefined {
  for (const d of byGroup?.values() ?? []) if (d.options.some((o) => o.item.id === item.id)) return d;
  return undefined;
}

function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="q-dc">
      <small>{title}</small>
      {children}
    </div>
  );
}

export function DetailLayer({ vm, option, booked, onClose, onAddDoc, footer }: {
  vm: IntentVM;
  option: OptionVM;
  /** A booking: its access, not its comparison. */
  booked: boolean;
  onClose: () => void;
  onAddDoc: () => void;
  /** The layer's own actions (İptal ettim, Düzenle, Belge ekle). */
  footer: ReactNode;
}) {
  const env = useCardEnv();
  const box = useRef<HTMLDivElement>(null);
  const item = option.item;
  /** Shut by its own ×, Escape or one of its ways on: the focus goes back to the frame's ⓘ (else what opened it). */
  const opener = useRef<HTMLElement | null>(null);
  const close = () => {
    const back = box.current?.closest(".q-int")?.querySelector<HTMLElement>(".z-ib") ?? opener.current;
    onClose();
    if (back?.isConnected) back.focus({ preventScroll: true });
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const info = box.current?.closest(".q-int")?.querySelector<HTMLElement>(".z-ib") ?? null;
    box.current?.querySelector<HTMLElement>(".z-dx")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !focusNear(box.current)) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Gone by what one of its buttons did (İptal ettim, a new state): the focus it held is not lost to the page.
      const at = document.activeElement;
      if (info?.isConnected && (!at || at === document.body)) info.focus({ preventScroll: true });
    };
  }, []);
  const decision = decisionOf(env.decisions?.byGroup, item);
  const ctx = env.decisions?.ctx;
  const facts = cardFacts(item, decision, ctx);
  const docs = env.docsFor(item.id);
  const { url: dated } = datedLink(item, decision);
  // B12: the options side by side are the Pano's comparison (the old comparison window is not in this version, C11); a lone
  // option has nothing to be weighed against (its measured criteria are in "Tüm detaylar ›").
  const comparable = !booked && decision != null && decision.options.filter((o) => !o.excluded).length > 1;
  const more = (
    <>
      {comparable && (
        <button type="button" className="q-dact" onClick={() => (close(), env.onPano(groupKeyOf(item)))}>
          {L("Karşılaştır", "Compare")}
        </button>
      )}
      {/* The drawer and the Pano open in place of the layer (one window at a time). */}
      <button type="button" className="q-dact" onClick={() => (close(), env.onOpenItem(item))}>
        {L("Tüm detaylar ›", "All details ›")}
      </button>
      {(dated ?? item.url) && (
        <a className="q-dact" href={dated ?? item.url!} target="_blank" rel="noreferrer">
          {dated ? L("Tarihlerle aç ↗", "Open with dates ↗") : L("Kaydettiğin sayfa ↗", "Your saved page ↗")}
        </a>
      )}
    </>
  );
  let cols: ReactNode;
  if (booked) {
    const a = vm.access;
    const label = a ? codeLabel(a) : null;
    const when = a ? bookedWhen(item, a, vm.kind) : null;
    cols = (
      <>
        <Col title={L("Rezervasyon", "Booking")}>
          {a?.code && label && (
            <span className="q-dr">
              <span>{label}</span>
              <b>
                <CopyCode value={a.code.value} label={label} className="q-cv" />
              </b>
            </span>
          )}
          {when && (
            <span className="q-dr">
              <span>{L("Ne zaman", "When")}</span>
              <b>{when}</b>
            </span>
          )}
          {a?.where && (
            <span className="q-dr">
              <span>{L("Adres", "Address")}</span>
              <b>{a.where}</b>
            </span>
          )}
          {vm.paid && (
            <span className="q-dr">
              <span>{L("Ödenen", "Paid")}</span>
              <b>{vm.paid}</b>
            </span>
          )}
        </Col>
        <Col title={L("Belge", "Documents")}>
          {docs.map((d) => (
            <button key={d.id} type="button" className="q-dl" onClick={() => void openDoc(d.id)}>
              {d.name}
            </button>
          ))}
          <button type="button" className="q-dl" onClick={onAddDoc}>
            + {L("Belge ekle", "Add a document")}
          </button>
        </Col>
      </>
    );
  } else {
    const cancel = cancellationText(item, env.today);
    const choice = decision && ctx && decision.options.filter((o) => !o.excluded).length > 1 ? choiceOf(decision, ctx) : null;
    const ranked = choice?.ranked.find((r) => r.option.item.id === item.id) ?? null;
    const why = cardWhy(item, facts.needs, ctx?.preferences);
    const place = [facts.score != null ? L(`Uyum puanı ${facts.score}/100`, `Fit score ${facts.score}/100`) : null, option.place ? L(`${option.place}. sırada`, `#${option.place}`) : null].filter(Boolean).join(" · ");
    cols = (
      <>
        {(option.checks.length > 0 || why) && (
          <Col title={L("Niyetine uyuyor mu", "Does it fit")}>
            {option.checks.length > 0 && (
              <div className="q-mcs">
                {option.checks.map((c) => (
                  <span key={c.label} className={`q-mc ${c.ok ? "y" : "n"}`} title={c.text}>
                    {c.ok ? "✓" : "✕"} {c.label}
                  </span>
                ))}
              </div>
            )}
            {/* K6: why it's here, in the traveller's own word. */}
            <WhyLine item={item} needs={facts.needs} notes={ctx?.preferences} />
          </Col>
        )}
        {facts.pros.length > 0 && (
          <Col title={L("Artılar", "Pros")}>
            {/* C12: ★ by what touches a priority the traveller gave. */}
            <ul className="q-pl p">
              {facts.pros.slice(0, 4).map((p) => (
                <li key={p.text}>
                  {p.mine && <i className="q-star" title={L("Önceliğine dokunuyor", "Touches your priority")}>★</i>}
                  {p.text}
                </li>
              ))}
            </ul>
          </Col>
        )}
        {facts.cons.length > 0 && (
          <Col title={L("Eksiler", "Cons")}>
            <ul className="q-pl m">
              {facts.cons.slice(0, 4).map((p) => (
                <li key={p.text}>
                  {p.mine && <i className="q-star" title={L("Önceliğine dokunuyor", "Touches your priority")}>★</i>}
                  {p.text}
                </li>
              ))}
            </ul>
          </Col>
        )}
        {(cancel.state !== "unknown" || place || facts.price?.source) && (
          <Col title={L("Koşullar", "Terms")}>
            {cancel.state !== "unknown" && <p>{cancel.text}</p>}
            {place && <p title={L("AI analizi dahil", "AI analysis included")}>{place}</p>}
            {/* D17: the box shows it converted ("≈"); here the price as the page gave it. */}
            {facts.price?.source && <p>{L(`Sayfadaki fiyat: ${facts.price.source}`, `Price on the page: ${facts.price.source}`)}</p>}
          </Col>
        )}
        {(choice?.headline || ranked?.trade) && (
          <Col title={L("Neden?", "Why?")}>
            {/* C12: the pick in a sentence, this one against the next, what to check before choosing. */}
            {choice?.headline && <p className="q-dwhy">{choice.headline}</p>}
            {ranked && <TradeLine ranked={ranked} currency={ctx?.currency ?? "EUR"} className="q-dtrade" />}
            {choice && choice.verify.length > 0 && (
              <ul className="q-dverify" aria-label={L("Seçmeden kontrol et", "Check before choosing")}>
                {choice.verify.map((v) => (
                  <li key={`${v.itemId}:${v.what}`}>
                    <b>{v.name}:</b> {v.what}
                  </li>
                ))}
              </ul>
            )}
          </Col>
        )}
      </>
    );
  }
  return (
    <div className="q-det z-det" ref={box} role="dialog" aria-label={L(`${option.title}: ayrıntı`, `${option.title}: details`)}>
      <button type="button" className="z-dx" aria-label={L("Ayrıntıyı kapat", "Close the details")} onClick={close}>
        <Ic name="x" size={14} stroke={2.4} />
      </button>
      {cols}
      <div className="q-dfoot">
        {footer}
        <span className="q-sp" />
        {more}
      </div>
    </div>
  );
}
