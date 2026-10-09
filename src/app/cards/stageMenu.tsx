// A card's ••• by its stage (spec 2026-10-06-asamalar-design.md, lifecycle.ts): Düzenle, Ele, and by where it
// stands Değiştir (a plan back to its options; a booking only once the old one is said cancelled), Belge ekle,
// İptal ettim (the booking kept, ruled out with the day, its need to find again; "Geri al" brings it back), Sil.
// A booking, or one with its file, is only deleted after asking (deleteLevel): "İptal ettim" is the way out of a
// booking, not Sil. Shared by the Plan's cards and the stays' cards.
// v11 (2026-10-08-plan-pano-v11-design.md): the hover × is "Gerek yok" (hidden under Gizlenenler, as it stood,
// "Geri al"), never a delete; on a booking it asks "İptal ettin mi?" first. The questions are the board's own
// window, not the browser's confirm().
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { menuFor } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { deleteLevel, stageOf, type Stage } from "../../lib/lifecycle";
import type { Item } from "../../lib/types";
import { cancelBooking, setItemStatus, setNotNeeded } from "../actions";
import { useShare } from "../Share";
import type { MenuEntry } from "./CardShell";
import { useDocPick } from "./DocAccess";
import { useCardEnv } from "./PlanCard";

/** Bought, held or gone by: × asks before it takes it off the plan. */
const BOOKED: readonly Stage[] = ["booked", "ready", "used"];

interface Ask {
  title: string;
  text: string;
  ok: string;
  run: () => void;
}

export function useStageMenu(item: Item): { menu: MenuEntry[]; remove: () => void; hide: () => void; change: () => void; cancel: () => void; booked: boolean; field: ReactNode } {
  const env = useCardEnv();
  const shared = !!useShare();
  const docs = env.docsFor(item.id).length;
  const stage = stageOf(item, { docs });
  const booked = BOOKED.includes(stage);
  const { pick, field } = useDocPick(item);
  const [ask, setAsk] = useState<Ask | null>(null);

  const remove = () => {
    const level = deleteLevel(stage, { shared });
    if (level.level === "confirm") return setAsk({ title: item.name, text: level.text ?? "", ok: L("Yine de sil", "Delete anyway"), run: () => env.remove(item) });
    env.remove(item);
  };
  const cancel = () => void cancelBooking(item).then(env.offer);
  // The ×: a booking asks first ("İptal ettim, kaldır" cancels it, its file stays); anything else is not needed, at once.
  const hide = () => {
    if (!booked) return void setNotNeeded(item).then(env.offer);
    setAsk({
      title: L("Bu rezervasyon onaylı", "This booking is confirmed"),
      text: docs
        ? L(`${item.name} rezerve ve belgesi var. Kaldırmadan önce: iptal ettin mi? Belgesi Belgeler sekmesinde kalır.`, `${item.name} is booked and has its file. Before taking it off: did you cancel it? The file stays in Documents.`)
        : L(`${item.name} rezerve. Kaldırmadan önce: iptal ettin mi?`, `${item.name} is booked. Before taking it off: did you cancel it?`),
      ok: L("İptal ettim, kaldır", "I cancelled it, take it off"),
      run: cancel,
    });
  };
  const change = () => {
    if (item.status !== "booked") return void setItemStatus(item, "saved");
    // A booking is changed by cancelling it first: then its need is to find again.
    setAsk({
      title: L("Değiştirmeden önce", "Before changing"),
      text: L(
        `${item.name}: eskisini iptal ettin mi? İptal etmediysen iki rezervasyonun olur. "İptal ettim" dersen iptal edildi olarak işaretlenir, yerine yenisini ararsın.`,
        `${item.name}: did you cancel the old one? If not, you'd hold two bookings. "I cancelled it" marks it cancelled and you look for a new one.`,
      ),
      ok: L("İptal ettim, değiştir", "I cancelled it, change"),
      run: cancel,
    });
  };

  const menu: MenuEntry[] = menuFor(item, { docs }).map((a) => {
    switch (a) {
      case "edit":
        return { label: L("Düzenle", "Edit"), run: () => env.edit(item) };
      case "dismiss":
        return { label: L("Çıkar", "Rule out"), run: () => void setItemStatus(item, "dismissed") };
      case "change":
        return { label: L("Değiştir", "Change"), run: change };
      case "addDoc":
        return { label: L("Belge ekle", "Add a document"), run: pick };
      case "cancel":
        return { label: L("İptal ettim", "I cancelled it"), run: cancel };
      case "delete":
        return { label: L("Sil", "Delete"), run: remove, danger: true };
    }
  });
  return {
    menu,
    remove,
    hide,
    change,
    cancel,
    booked,
    field: (
      <>
        {field}
        {ask && <AskWindow ask={ask} onClose={() => setAsk(null)} />}
      </>
    ),
  };
}

/** The board's own question window (the share safety dialog's look): Vazgeç, and the one red answer. */
function AskWindow({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="modal" onClick={(e) => (e.stopPropagation(), onClose())}>
      <div className="hs-dlg ask-dlg" role="alertdialog" aria-modal="true" aria-labelledby="ask-dlg-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="ask-dlg-title">{ask.title}</h3>
        <p>{ask.text}</p>
        <div className="hs-row">
          <button type="button" className="hs-btn lg" onClick={onClose} autoFocus>
            {L("Vazgeç", "Cancel")}
          </button>
          <button type="button" className="hs-btn lg red" onClick={() => (onClose(), ask.run())}>
            {ask.ok}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
