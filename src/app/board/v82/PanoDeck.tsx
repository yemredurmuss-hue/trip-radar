// A flight's, a stay's, a way's options on the Pano (onay paketi 2026-10-21, docs/mockups/paket-ucus-konaklama 11: "Pano:
// çekmecenin büyümüş hâli"): the drawer's own cards two by two under a head like the drawer's (who and when, what was asked,
// the weights, Yeni bul, Kartlar/Karşılaştır), and on the right what is decided ("Seçildi: X · Plan'da gör →", "Karar
// bekliyor"). A need booked folds to one line ("Bangkok · 24–27 Mar · 3 gece ✓ Rezerve: Riva Surya · 2 seçenek daha · Aç").
// Karşılaştır sets the same options side by side, a row each (the score, its three parts, the price, the five slots, the
// pros and cons, the hearts, Seç), the best of each row green and the worst amber.
import { Fragment, useState, type ReactNode } from "react";
import { extremes, flightSlots, groupLabel, prosCons, rentalSlots, scoreParts, staySlots, waySlots, weightShares, type CardSlot, type ScoreGroup } from "../../../lib/drawerCard";
import { totalAmount } from "../../../lib/drawerView";
import { L } from "../../../lib/i18n";
import type { OptionVM } from "../../../lib/intents";
import { inView, type PanoNeed, type PanoOption } from "../../../lib/panoBoard";
import { whoGoes } from "../../../lib/tripSettings";
import { useCardEnv } from "../../cards/PlanCard";
import { artOf } from "../../plan/v82/IntentBox";
import { CardOption, drawerHead, familyOf, partsFor, TicketOption } from "../../plan/v82/IntentDrawer";
import { Ic } from "../../plan/v82/icons";
import { PanoCard } from "./PanoGrid";
import { Likes, PickButton } from "./parts";

/** The Pano draws these needs with the drawer's card; the rest keep their own (a row of things to do, an eSIM). */
export const isDeck = (need: PanoNeed): boolean => need.vm != null && !need.multi && (need.section === "flight" || need.section === "stay" || need.section === "transport");

export function PanoDeck({ need: all, filter = "all", initial = "cards", fresh, onReveal, onAsk }: {
  need: PanoNeed;
  filter?: "all" | "mine" | "ai";
  initial?: "cards" | "cmp";
  fresh: ReadonlySet<string>;
  onReveal?: (itemId: string) => void;
  onAsk?: (need: PanoNeed) => void;
}) {
  const need = filter === "all" ? all : { ...all, options: all.options.filter((o) => inView(filter, o)) };
  const env = useCardEnv();
  const vm = need.vm!;
  const people = vm.people ?? Math.max(1, whoGoes({ travellers: env.trip.travellers }).count || 1);
  const { title, sub } = drawerHead(vm, people);
  const family = familyOf(vm);
  const booked = vm.status === "booked";
  const [open, setOpen] = useState(!booked);
  const [mode, setMode] = useState<"cards" | "cmp">(initial);
  const art = artOf(vm.kind, vm.chosen?.item ?? vm.options[0]?.item ?? null);
  // (the chosen one is the intent's `chosen`, not always among its options)
  const byId = new Map([...(vm.chosen ? [vm.chosen] : []), ...vm.options].map((o) => [o.id, o]));
  const chosen = vm.chosen && (vm.status === "chosen" || vm.status === "booked") ? vm.chosen : null;
  const shares = family !== "ticket" ? weightShares(need.options[0] ? partsFor(env.decisions?.byGroup, need.options[0].item) : []) : [];
  const count = need.options.length;
  if (!need.options.length) return null;
  const state = chosen ? (
    <span className={`pd-st ${booked ? "ok" : "sel"}`}>
      ✓ {booked ? L(`Rezerve: ${chosen.title}`, `Booked: ${chosen.title}`) : L(`Seçildi: ${chosen.title}`, `Chosen: ${chosen.title}`)}
      {onReveal && (
        <button type="button" className="pd-go" onClick={() => onReveal(chosen.id)}>
          {L("Plan'da gör", "See on the plan")} <span aria-hidden>→</span>
        </button>
      )}
    </span>
  ) : (
    <span className="pd-st wait">{L("Karar bekliyor", "Waiting for a decision")}</span>
  );
  if (!open) {
    const more = count - 1;
    return (
      <section className="pd pd-fold" data-need={need.key} aria-label={title}>
        <b>{[title, sub.split(" · ")[0]].filter(Boolean).join(" · ")}</b>
        {state}
        <span className="q-sp" />
        {more > 0 && <small>{L(`${more} seçenek daha`, `${more} more option${more > 1 ? "s" : ""}`)}</small>}
        <button type="button" className="pd-open" aria-expanded={false} onClick={() => setOpen(true)}>
          {L("Aç", "Open")} <span aria-hidden>▾</span>
        </button>
      </section>
    );
  }
  const card = (po: PanoOption): ReactNode => {
    const o = byId.get(po.id);
    // (a page a booking closed, a booking cancelled: still one of its options here, on the Pano's own card)
    if (!o) return <PanoCard key={po.id} option={po} need={need} fresh={fresh.has(po.id)} />;
    const pick = <PickButton option={po} need={need} />;
    const parts = partsFor(env.decisions?.byGroup, o.item);
    const props = { o, art, current: po.current != null, why: null, parts, solo: count < 2, onPick: () => undefined, pick };
    return family === "ticket" ? <TicketOption key={o.id} {...props} vm={vm} off={false} /> : <CardOption key={o.id} {...props} typical={null} rental={family === "rental"} />;
  };
  return (
    <section className="pd" data-need={need.key} aria-label={title}>
      <div className="pd-h">
        <span className="pd-t">
          <b>{title}</b>
          <small>{[vm.head.kindWord ?? need.word, sub, L(`${count} seçenek`, `${count} option${count > 1 ? "s" : ""}`)].filter(Boolean).join(" · ")}</small>
        </span>
        {state}
        {booked && (
          <button type="button" className="pd-open" aria-expanded onClick={() => setOpen(false)}>
            {L("Kapat", "Fold")} <span aria-hidden>▴</span>
          </button>
        )}
      </div>
      <div className="pd-c">
        {vm.head.wants.map((w) => (
          <span key={w.label} className={`dr-want${w.must ? " req" : ""}`}>
            {w.label}
          </span>
        ))}
        {shares.length > 0 && (
          <span className="dr-wt">
            <span className="dr-bar" aria-hidden>
              {shares.map((g) => (
                <i key={g.group} className={g.group} style={{ flexGrow: g.share }} />
              ))}
            </span>
            <span className="dr-lg">
              {shares.map((g) => (
                <span key={g.group} className={g.group}>
                  {groupLabel(g.group)} %{g.share}
                </span>
              ))}
            </span>
          </span>
        )}
        <span className="q-sp" />
        {onAsk && (
          <button type="button" className="pd-new" onClick={() => onAsk(need)}>
            <Ic name="search" size={15} /> {L("Yeni bul", "Find more")}
          </button>
        )}
        {count > 1 && (
          <span className="dr-seg pd-seg" role="tablist">
            <button type="button" role="tab" className="dr-tab" aria-selected={mode === "cards"} onClick={() => setMode("cards")}>
              <Ic name="board" size={14} /> {L("Kartlar", "Cards")}
            </button>
            <button type="button" role="tab" className="dr-tab" aria-selected={mode === "cmp"} onClick={() => setMode("cmp")}>
              <Ic name="copy" size={14} /> {L("Karşılaştır", "Compare")}
            </button>
          </span>
        )}
      </div>
      {mode === "cmp" && count > 1 ? <Compare need={need} options={need.options.map((po) => ({ po, o: byId.get(po.id) ?? null }))} people={people} /> : <div className={`pd-cards ${family}`}>{need.options.map(card)}</div>}
    </section>
  );
}

const slotsOf = (family: string, kind: string, o: OptionVM): CardSlot[] =>
  family === "ticket" ? (kind === "flight" ? flightSlots : waySlots)(o.item, o.brand?.label ?? null) : family === "rental" ? rentalSlots(o.item, o.brand?.label ?? null) : staySlots(o.item, o.brand?.label ?? null);

/** The same options side by side: a row each, the best green, the worst amber. */
function Compare({ need, options, people }: { need: PanoNeed; options: { po: PanoOption; o: OptionVM | null }[]; people: number }) {
  const env = useCardEnv();
  const vm = need.vm!;
  const family = familyOf(vm);
  const cols = options.filter((x): x is { po: PanoOption; o: OptionVM } => x.o != null).sort((a, b) => (a.o.place || 99) - (b.o.place || 99));
  const parts = cols.map((c) => scoreParts(partsFor(env.decisions?.byGroup, c.o.item)));
  const weights = weightShares(cols[0] ? partsFor(env.decisions?.byGroup, cols[0].o.item) : []);
  const groups = [...new Set(parts.flatMap((p) => p.map((x) => x.group)))] as ScoreGroup[];
  const slots = cols.map((c) => slotsOf(family, vm.kind, c.o));
  const totals = cols.map((c) => totalAmount(c.o, people, vm.head.nights || null));
  const tone = (set: { best: Set<number>; worst: Set<number> }, i: number) => (set.best.has(i) ? " best" : set.worst.has(i) ? " worst" : "");
  const score = extremes(cols.map((c) => c.o.score));
  const price = extremes(totals, false);
  const row = (label: ReactNode, cells: ReactNode[], key: string) => (
    <Fragment key={key}>
      <span className="pc-l">{label}</span>
      {cells}
    </Fragment>
  );
  const pros = cols.map((c) => prosCons(c.o.item, c.o.topics));
  return (
    <div className="pc" role="table" style={{ "--n": cols.length } as React.CSSProperties}>
      {row(
        null,
        cols.map((c) => (
          <span key={c.o.id} className="pc-hd">
            <img className={c.o.image ? "ph" : "art"} src={c.o.image ?? artOf(vm.kind, c.o.item)} alt="" />
            <b>{c.o.title}</b>
            <small>{c.o.brand?.label ?? c.o.item.provider ?? ""}</small>
          </span>
        )),
        "hd",
      )}
      {row(
        L("Ağırlıklı puan", "Weighted score"),
        cols.map((c, i) => (
          <span key={c.o.id} className={`pc-v${tone(score, i)}`}>
            {c.o.score != null ? (
              <span className={`dr-rank${c.o.place === 1 ? " top" : ""}`}>
                <b>{c.o.score}</b>
                <span>{c.o.place}.</span>
              </span>
            ) : (
              "—"
            )}
          </span>
        )),
        "score",
      )}
      {groups.map((g) => {
        const vals = parts.map((p) => p.find((x) => x.group === g)?.value ?? null);
        const ex = extremes(vals);
        const share = weights.find((w) => w.group === g)?.share;
        return row(
          <span className={`pc-g ${g}`}>
            {groupLabel(g)}
            {share != null ? ` · %${share}` : ""}
          </span>,
          vals.map((v, i) => (
            <span key={cols[i].o.id} className={`pc-v${tone(ex, i)}`}>
              {v ?? "—"}
            </span>
          )),
          `g-${g}`,
        );
      })}
      {row(
        family === "ticket" ? L("Fiyat · toplam", "Price · in all") : L("Gece · toplam", "Night · in all"),
        cols.map((c, i) => (
          <span key={c.o.id} className={`pc-v${tone(price, i)}`}>
            {[c.o.price?.perNight?.split(" / ")[0] ?? c.o.ticket?.each ?? null, c.o.price?.text ?? c.o.ticket?.total ?? null].filter(Boolean).join(" · ") || "—"}
          </span>
        )),
        "price",
      )}
      {(slots[0] ?? []).map((s0, k) =>
        row(
          s0.label,
          slots.map((ss, i) => (
            <span key={cols[i].o.id} className={`pc-v ${ss[k]?.tone === "ok" ? "best" : ss[k]?.tone === "warn" ? "worst" : ss[k]?.tone === "dim" ? "dim" : ""}`}>
              {ss[k]?.value ?? "—"}
            </span>
          )),
          `s-${s0.key}`,
        ),
      )}
      {pros.some((p) => p?.pros.length) &&
        row(
          L("Artılar", "Pros"),
          pros.map((p, i) => (
            <ul key={cols[i].o.id} className="pc-ls up">
              {p?.pros.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )),
          "pros",
        )}
      {pros.some((p) => p?.cons.length) &&
        row(
          L("Eksiler", "Cons"),
          pros.map((p, i) => (
            <ul key={cols[i].o.id} className="pc-ls dn">
              {p?.cons.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )),
          "cons",
        )}
      {row(
        L("Oylar", "Votes"),
        cols.map((c) => (
          <span key={c.o.id} className="pc-v">
            <Likes option={c.po} />
          </span>
        )),
        "votes",
      )}
      {row(
        null,
        cols.map((c) => (
          <span key={c.o.id} className="pc-v pc-pick">
            <PickButton option={c.po} need={need} />
          </span>
        )),
        "pick",
      )}
    </div>
  );
}
