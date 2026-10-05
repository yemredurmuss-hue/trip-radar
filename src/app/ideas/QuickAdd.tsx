// "Bir şey yaz…" at the top of Yapılacak şeyler (fikirler-v1 .quick): Enter adds the line — a restaurant when
// it speaks of food, else a to-do — in the trip's city it names (none otherwise). No model call.
import { useState, type FormEvent } from "react";
import { newId } from "../../lib/db";
import { L } from "../../lib/i18n";
import { addIdea } from "../../lib/ideas";
import { IdeaGlyph } from "./IdeaIcons";

export function QuickAdd({ tripId, cities }: { tripId: string; cities: string[] }) {
  const [text, setText] = useState("");
  // The box empties at once, so the next line can be typed while this one is saved; a failure puts it back.
  async function submit(e: FormEvent) {
    e.preventDefault();
    const line = text;
    if (!line.trim()) return;
    setText("");
    try {
      await addIdea(tripId, line, cities, newId());
    } catch (error) {
      setText(line);
      console.warn("idea", error);
    }
  }
  return (
    <form className="fk-quick" onSubmit={submit}>
      <IdeaGlyph name="plus" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={L("Bir şey yaz… ör. Dom Luís köprüsünden gün batımı", "Write something… e.g. Sunset from the Dom Luís bridge")}
        aria-label={L("Bir şey yaz", "Write something")}
      />
    </form>
  );
}
