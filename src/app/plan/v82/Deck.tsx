// Karar bekliyor (plan v13, spec 2026-10-21 K80–K81, K84): the options gathered for a need, shown as a count in the card,
// never listed there (they open beside the plan, IntentDrawer). A stay's is a deck of its pictures with the count; a
// flight keeps its boarding pass, the count circled in the middle of the route with the days, the cheapest and the
// shortest under it; a boat, a train, a bus their timetable's first rows. Under it "Sana en uygun" names our pick or the
// first, and the foot holds the range and "Seçenekleri gör".
import { L } from "../../../lib/i18n";
import { optionDay, optionDays, totalAmount } from "../../../lib/drawerView";
import { shortDay } from "../../../lib/ideas";
import type { IntentVM, OptionVM } from "../../../lib/intents";
import { formatPrice } from "../../../lib/items";
import { rowFace, ticketFace } from "../../../lib/ticketFrame";
import { Ic, type IconName } from "./icons";

const MODE_ICON: Readonly<Record<string, IconName>> = { ferry: "ship", train: "train", bus: "bus", transfer: "car", car: "car", pass: "train" };

export function Deck({ vm, all, art, people, onOpen }: { vm: IntentVM; all: OptionVM[]; art: string; people: number; onOpen: () => void }) {
  const best = all.find((o) => o.ours) ?? all[0] ?? null;
  const nights = vm.head.nights ?? null;
  const mine = all.filter((o) => o.source?.kind !== "ai").length;
  const count = Math.max(vm.optionCount, all.length);
  const ticket = vm.frame === "ticket";
  const mode = vm.ticket?.mode ?? null;
  // The options' own prices, in their one money (the most common): a stay's by the night as its card says it, a ticket's
  // for everyone going; with none priced, the estimate, its unit said (review: never a nightly figure read as a total).
  const priced = all.filter((o) => o.item.price?.amount != null);
  const tally = new Map<string, number>();
  for (const o of priced) tally.set(o.item.price!.currency ?? "EUR", (tally.get(o.item.price!.currency ?? "EUR") ?? 0) + 1);
  const currency = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "EUR";
  const nightly = (o: OptionVM): number | null => {
    const p = o.item.price!;
    if (p.scope === "per_night") return p.amount;
    if (p.scope === "total" || p.scope === "unknown") return nights ? Math.round(p.amount! / nights) : null;
    return null;
  };
  const amounts = priced.filter((o) => (o.item.price!.currency ?? "EUR") === currency).map((o) => (ticket ? totalAmount(o, people, nights) : nightly(o))).filter((n): n is number => n != null);
  const lo = amounts.length ? Math.min(...amounts) : null;
  const hi = amounts.length ? Math.max(...amounts) : null;
  const span = lo != null && hi != null && lo !== hi;
  const range = lo != null ? (span ? `${formatPrice(lo, currency)}–${formatPrice(hi!, currency).replace(/^[^\d]*/, "")}` : formatPrice(lo, currency)) : (vm.estimate?.label ?? null);
  const caption =
    lo != null
      ? ticket
        ? span ? L(`${people} kişi · seçeneklerin aralığı`, `${people} people · the options' range`) : L(`${people} kişi toplam`, `${people} people in all`)
        : span ? L("gecelik · seçeneklerin aralığı", "a night · the options' range") : L("gecelik", "a night")
      : vm.estimate?.unit === "night" ? L("tahmini · gecelik", "estimate · a night") : vm.estimate?.unit === "person" ? L("tahmini · kişi başı", "estimate · each") : L("tahmini", "estimate");
  const checks = best ? best.checks : [];
  const met = checks.filter((c) => c.ok).length;
  let media;
  if (!ticket || mode === "car") {
    // Our pick in front, two more behind it.
    const shown = [...all.filter((o) => o !== best).slice(0, 2), ...(best ? [best] : [])];
    media = (
      <div className="z-deck">
        <span className="z-fan" aria-hidden>
          {shown.map((o) => (
            <span key={o.id}>
              <img className={o.image ? "ph" : "art"} src={o.image ?? art} alt="" />
            </span>
          ))}
        </span>
        <span className="z-big">
          <b>{count}</b>
          <span>{L("seçenek birikti", "options gathered")}</span>
          <small>
            <em><Ic name="bookmark" size={12} /> {L(`${mine} senin`, `${mine} yours`)}</em>
            <em><Ic name="spark" size={12} /> {L(`${all.length - mine} AI`, `${all.length - mine} AI`)}</em>
          </small>
        </span>
      </div>
    );
  } else if (mode === "flight" || mode === null) {
    const face = ticketFace(vm, null);
    const days = optionDays(all, people, nights);
    const short = all.filter((o) => o.item.metrics?.durationMinutes != null).sort((a, b) => a.item.metrics!.durationMinutes! - b.item.metrics!.durationMinutes!)[0] ?? null;
    const early = all.map((o) => rowFace(o, vm.kind).dep).filter((t): t is string => Boolean(t)).sort()[0] ?? null;
    const line = days.length > 1
      ? [L(`${days.length} farklı gün`, `${days.length} different days`), lo != null ? L(`en ucuz ${formatPrice(lo, currency)}`, `from ${formatPrice(lo, currency)}`) : null, short ? L(`en kısa ${rowFace(short, vm.kind).duration}`, `shortest ${rowFace(short, vm.kind).duration}`) : null]
      : [early ? L(`en erken ${early}`, `earliest ${early}`) : null, lo != null && all.length > 1 ? L(`en ucuz ${formatPrice(lo, currency)}`, `from ${formatPrice(lo, currency)}`) : null];
    const end = (e: typeof face extends null ? never : NonNullable<typeof face>["from"], right = false) =>
      e ? (
        <span className={`q-tm big q-city${right ? " r" : ""}`}>
          <b>{e.place && e.place.length <= 4 ? e.place : e.city}</b>
          <small>{e.place && e.place.length <= 4 ? e.city : (e.place ?? "")}</small>
        </span>
      ) : (
        <span className={`q-tm big q-city${right ? " r" : ""}`} />
      );
    media = (
      <div className="z-tm z-d1">
        <div className="q-route z-route">
          {end(face?.from ?? null)}
          <span className="z-n7m">
            <i aria-hidden />
            <span className="z-n7">
              <b>{count}</b>
              <span>{L("uçuş", "flights")}</span>
            </span>
          </span>
          {end(face?.to ?? null, true)}
        </div>
        <p className="z-dkl">{line.filter(Boolean).join(" · ")}</p>
      </div>
    );
  } else {
    const rows = [...(best ? [best] : []), ...all.filter((o) => o !== best)].slice(0, 3);
    media = (
      <div className="z-deck z-tt">
        <span className="z-big">
          <img className="z-dimg" src={`illus/${vm.ticket?.art ?? "otobus"}.png`} alt="" />
          <b>{count}</b>
          <span>{L("sefer birikti", "departures gathered")}</span>
        </span>
        <span className="z-brd" aria-label={L("Seferler", "Departures")}>
          {rows.map((o) => {
            const f = rowFace(o, vm.kind);
            const d = optionDay(o);
            return (
              <span key={o.id} className="z-br">
                <i aria-hidden>
                  <Ic name={MODE_ICON[mode ?? "train"] ?? "train"} size={13} />
                </i>
                <b>{f.dep ?? "–"}</b>
                <em>{d ? shortDay(d) : ""}</em>
                <strong>{totalAmount(o, people, nights) != null ? formatPrice(totalAmount(o, people, nights)!, currency) : (f.price?.text ?? "")}</strong>
              </span>
            );
          })}
        </span>
      </div>
    );
  }
  return (
    <div className={`z-f z13 dk${ticket ? " z-tk" : " z-c"}`} data-mode={mode ?? undefined}>
      <div className="z-m z-tap" onClick={onOpen}>
        {media}
      </div>
      <div className="z-i z-tap" onClick={onOpen}>
        {best ? (
          <>
            <small className="z-l0">{L("Sana en uygun", "Best for you")}</small>
            <span className="z-t z-best">
              {ticket ? [rowFace(best, vm.kind).name, optionDay(best) ? shortDay(optionDay(best)!) : null, rowFace(best, vm.kind).dep].filter(Boolean).join(" · ") : best.title}
              {checks.length > 0 && <em className={`z-meet${met === checks.length ? "" : " part"}`}>{L(` · ${met}/${checks.length} istek`, ` · ${met}/${checks.length} asks`)}</em>}
            </span>
          </>
        ) : (
          <span className="z-t">{L("Seçenekler", "Options")}</span>
        )}
      </div>
      <div className="z-s">
        <div className="z-top">
          {range && (
            <span className="q-pr big">
              <b>{range}</b>
              <small>{caption}</small>
            </span>
          )}
        </div>
        <div className="z-bt">
          <button type="button" className="q-pick q-take q-see" onClick={onOpen}>
            {L("Seçenekleri gör", "See the options")}
          </button>
        </div>
      </div>
    </div>
  );
}
