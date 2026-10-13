// The one badge a bought or booked plan wears wherever it shows (a card, a day's line, the Board, a tile): a dark
// green capsule with a white tick and the word from stageWords.ts. What the traveller arranged herself ("Ayarlandı")
// is the same capsule in grey. Nothing else says "bought" in green.
import { lookWord, type Look } from "../../lib/stageWords";
import { UiIcon } from "./Silhouettes";

export function BookedBadge({ look = "booked", as, small = false }: { look?: Extract<Look, "booked" | "arranged">; as?: "ticket" | "bought"; small?: boolean }) {
  return (
    <span className={`okt${look === "arranged" ? " set" : ""}${small ? " sm" : ""}`}>
      <i aria-hidden><UiIcon name="check" size={small ? 10 : 12} /></i>
      {lookWord(look, { as })}
    </span>
  );
}
