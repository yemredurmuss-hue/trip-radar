// A card's ••• by its stage (spec 2026-10-06-asamalar-design.md, lifecycle.ts): Düzenle, Ele, and by where it
// stands Değiştir (a plan back to its options; a booking only once the old one is said cancelled), Belge ekle,
// İptal ettim (the booking kept, ruled out with the day, its need to find again; "Geri al" brings it back), Sil.
// A booking, or one with its file, is only deleted after asking (deleteLevel): "İptal ettim" is the way out of a
// booking, not Sil. Shared by the Plan's cards and the stays' cards.
import type { ReactNode } from "react";
import { menuFor } from "../../lib/cardView";
import { L } from "../../lib/i18n";
import { deleteLevel, stageOf } from "../../lib/lifecycle";
import type { Item } from "../../lib/types";
import { cancelBooking, setItemStatus } from "../actions";
import { useShare } from "../Share";
import type { MenuEntry } from "./CardShell";
import { useDocPick } from "./DocAccess";
import { useCardEnv } from "./PlanCard";

export function useStageMenu(item: Item): { menu: MenuEntry[]; remove: () => void; field: ReactNode } {
  const env = useCardEnv();
  const shared = !!useShare();
  const docs = env.docsFor(item.id).length;
  const stage = stageOf(item, { docs });
  const { pick, field } = useDocPick(item);

  const remove = () => {
    const level = deleteLevel(stage, { shared });
    if (level.level === "confirm" && !confirm(`${item.name}\n\n${level.text}\n\n${L("Yine de silinsin mi?", "Delete it anyway?")}`)) return;
    env.remove(item);
  };
  const cancel = () => void cancelBooking(item).then(env.offer);
  const change = () => {
    if (item.status !== "booked") return void setItemStatus(item, "saved");
    // A booking is changed by cancelling it first: then its need is to find again.
    const ok = confirm(
      L(
        `${item.name}: eskisini iptal ettin mi? "Tamam" dersen iptal edildi olarak işaretlenir, yerine yenisini ararsın.`,
        `${item.name}: did you cancel the old one? "OK" marks it cancelled and you look for a new one.`,
      ),
    );
    if (ok) cancel();
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
  return { menu, remove, field };
}
