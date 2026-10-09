// A transfer (airport ↔ hotel, hotel change) or a change of city as a transport card on the plan: its way
// of travel drawn, the two ends, where it stands. Opened, the transfer's own body (LegRow's): notes,
// saved options, how to go, "Ayarlandı", and a flight search when going by plane.
import { useLegOpen } from "./legOpen";
import { legCardView, legMenuFor } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import { legItem, withLegChoice, type Leg } from "../../lib/legs";
import { setHidden, updateTrip } from "../actions";
import { kindLabel, LegBody } from "../LegRow";
import { CardFoot, CardShell, type MenuEntry } from "./CardShell";
import { DocAccess } from "./DocAccess";
import { useCardEnv } from "./PlanCard";
import { TransportArt } from "./Silhouettes";
import { TransportCardBody } from "./TransportCard";

export function LegCard({ leg }: { leg: Leg }) {
  const env = useCardEnv();
  // Shared with its empty card: a way picked there keeps it open here.
  const [open, setOpen] = useLegOpen(leg.key);
  const v = legCardView(leg);
  const book = () => void updateTrip(env.tripId, (t) => withLegChoice(t, leg.key, { booked: true }));
  // The transfer's own record (a taxi planned or booked for it): its files and its Sil are here.
  const own = legItem(leg);
  const menu: MenuEntry[] = legMenuFor(leg).map((a) =>
    a === "hide"
      ? { label: L("Gerek yok", "Not needed"), run: () => void setHidden(env.tripId, `leg:${leg.key}`, true, kindLabel()[leg.kind]) }
      : a === "clear"
        ? { label: L("Planı temizle", "Clear the plan"), run: () => void updateTrip(env.tripId, (t) => withLegChoice(t, leg.key, null)) }
        : { label: L("Sil", "Delete"), run: () => own && env.remove(own), danger: true },
  );
  return (
    <CardShell
      kind={v.kind}
      label={v.label}
      ring={v.ring}
      date={formatDateRange(leg.date, null)}
      ariaLabel={v.ariaLabel}
      domId={`leg-${leg.key}`}
      extraClass="pk-leg"
      docs={own ? <DocAccess item={own} docs={env.docsFor(own.id)} /> : undefined}
      menu={menu}
      open={open}
      onToggle={() => setOpen(!open)}
      body={<TransportCardBody face={{ from: v.from, to: v.to, middle: v.middle, rental: false }} title={v.ariaLabel} art={v.kind !== "transport" ? <TransportArt mode={v.kind} /> : null} />}
      foot={<CardFoot view={v.foot} price={null} onAction={book} />}
      detail={
        <div className="pk-detail">
          <LegBody leg={leg} tripId={env.tripId} onOpenItem={env.onOpenItem} onRemove={env.remove} />
          {v.searchUrl && (
            <div className="pk-acts">
              <a href={v.searchUrl} target="_blank" rel="noreferrer">{L("Uçuş ara ↗", "Search flights ↗")}</a>
            </div>
          )}
        </div>
      }
    />
  );
}
