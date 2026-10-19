// At most three quick replies over the box you write in (C34, z83_build.py quick_html): fit to what is on the table
// (lib/chatCards.ts quickReplies). A tap sends the question to the chat the way a typed line goes.
import { L } from "../../lib/i18n";

export function QuickReplies({ replies, busy, onAsk }: { replies: readonly string[]; busy: boolean; onAsk: (text: string) => void }) {
  if (!replies.length) return null;
  return (
    <div className="c-quick" role="group" aria-label={L("Hızlı yanıtlar", "Quick replies")}>
      {replies.map((q) => (
        <button key={q} type="button" className="c-q" disabled={busy} onClick={() => onAsk(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}
