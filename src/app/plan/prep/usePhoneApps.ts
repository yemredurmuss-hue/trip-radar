// "Telefonuna kur"'s data (0.39.7, lib/phoneApps.ts): the table read once per page from the extension's own file
// (static/data/country-apps.json, kept out of app.js), and the AI's lines asked once per trip and language in the model's
// line after the Bavul ("soon"), kept on the trip (Trip.phone.ai). No key, an error, offline: the table's lines stand alone.
import { useEffect, useState } from "react";
import { contentLang, withLang } from "../../../lib/i18n";
import { getProvider, MissingKeyError, promoteAi, type AiPriority } from "../../../lib/llm";
import { acceptPhoneAi, phoneAiPrompt, phoneAiSchema, phoneAiSystemPrompt, type PhoneAiInput, type PhoneTable } from "../../../lib/phoneApps";
import type { Trip } from "../../../lib/types";
import { updateTrip } from "../../actions";

const fileUrl = (path: string): string => (typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path);

let tablePromise: Promise<PhoneTable | null> | null = null;
/** The table, fetched once per page; null when it can't be read (the row then shows only the AI's and the plan's). */
export function loadPhoneTable(): Promise<PhoneTable | null> {
  tablePromise ??= fetch(fileUrl("data/country-apps.json"))
    .then((r) => (r.ok ? (r.json() as Promise<PhoneTable>) : null))
    .catch(() => null);
  return tablePromise;
}

export function usePhoneTable(): PhoneTable | null {
  const [table, setTable] = useState<PhoneTable | null>(null);
  useEffect(() => {
    let live = true;
    void loadPhoneTable().then((t) => live && setTable(t));
    return () => {
      live = false;
    };
  }, []);
  return table;
}

const asked = new Set<string>();
const phoneKey = (at: string) => `phone:${at}`;

/** Asks the AI's lines once for the trip in the board's language, when its countries are known. */
export function usePhoneAi(trip: Trip, input: PhoneAiInput, ready: boolean, priority: AiPriority = "soon"): void {
  const write = contentLang(trip.lang);
  const has = trip.phone?.ai != null && trip.phone.ai.lang === write;
  useEffect(() => {
    const at = `${trip.id}:${write}`;
    if (has || !ready || trip.demo) return;
    if (asked.has(at)) {
      if (priority === "now") promoteAi(phoneKey(at));
      return;
    }
    asked.add(at);
    void (async () => {
      try {
        const llm = await getProvider({ priority, key: phoneKey(at) });
        const out = await llm.generateJson(withLang(write, phoneAiSystemPrompt), phoneAiPrompt(input), phoneAiSchema);
        const list = acceptPhoneAi(out);
        if (!list) return;
        await updateTrip(trip.id, (t) => (t.phone?.ai?.lang === write ? t : { ...t, phone: { ...t.phone, ai: { lang: write, at: Date.now(), list } } }), { touch: false });
      } catch (error) {
        if (!(error instanceof MissingKeyError)) console.warn("phone apps", error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once per trip and language, when it's ready
  }, [trip.id, has, ready, write, priority]);
}
