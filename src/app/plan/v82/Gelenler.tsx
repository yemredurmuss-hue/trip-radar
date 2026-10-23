// Karar Masası, getirme anları (karar 11, "bulamazsak Gelenler'de 'Nereye koyalım?'"): what was brought to this trip and
// read, but whose place we couldn't find (far from the trip's places, or not a trip page), at the Plan's top with the
// chat's own answers. The question stays in the chat too; answered in either, it closes in both (routing.answerHeld).
import { useEffect, useState } from "react";
import { listMessages, listTrips, onChanged } from "../../../lib/db";
import { L } from "../../../lib/i18n";
import type { ChatMessage, Trip } from "../../../lib/types";
import { RoutingLine } from "../../Chat";

export function Gelenler({ tripId }: { tripId: string }) {
  const [waiting, setWaiting] = useState<ChatMessage[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  useEffect(() => {
    let live = true;
    const load = () =>
      void Promise.all([listMessages(tripId), listTrips()]).then(([rows, all]) => {
        if (!live) return;
        setWaiting(rows.filter((m) => m.routing?.kind === "ask" && !m.routing.answer));
        setTrips(all);
      });
    load();
    const off = onChanged(load);
    return () => {
      live = false;
      off();
    };
  }, [tripId]);
  if (!waiting.length) return null;
  return (
    <section className="q-gel" aria-label={L("Gelenler", "Brought in")}>
      <div className="q-gelh">
        <b>{L("Gelenler", "Brought in")}</b>
        <small>{L(`${waiting.length} kayıt · Nereye koyalım?`, `${waiting.length} saved · Where shall we put it?`)}</small>
      </div>
      {waiting.map((m) => m.routing && <RoutingLine key={m.id} m={m} routing={m.routing} trips={trips} />)}
    </section>
  );
}
