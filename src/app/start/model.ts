// The start chat's calls out: the model reading a message and writing the reply in one call, a reply to a quick
// answer, and the route proposal (each with a time limit and every failure falling back to the code's own way:
// the no-key path, spec item 6), and photos from the existing city-image proxy. Every prompt is made in the chat's
// language (withLang) and says so ("Yanıtı Türkçe yaz.").
import { hasActiveKey } from "../../lib/db";
import { imageProxy, pickCityImage } from "../../lib/cityImages";
import { withLang, type Lang } from "../../lib/i18n";
import { getProvider } from "../../lib/llm";
import {
  acceptExtraction, acceptReply, acceptRoute, routePrompt, routeSchema, routeSystem, singleRoute,
  totalNights, turnPrompt, turnSchema, turnSystem, wantsRouteAdvice, type Extracted, type QuestionId, type StartRoute, type StartState,
} from "../../lib/startTrip";

/** A reading the traveller waits for (the code understood nothing). */
export const LIMIT_MS = 25_000;
/** The model's richer line over the code's (shown already): dropped when it comes later than this. */
export const REPLY_MS = 6_000;

export function withTimeout<T>(p: Promise<T>, ms = LIMIT_MS, controller?: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    // Too slow: the request itself is aborted too (it doesn't run on, nor get retried, after its answer is dropped).
    const timer = setTimeout(() => (controller?.abort(), reject(new Error("timeout"))), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/** A model call bounded in time: aborted at the limit; `maxRetries` passed on (0 for the chat's replies). */
async function timed<T>(call: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  return withTimeout(call(controller.signal), ms, controller);
}

/** Whether there's a way to the model (your key, or an invite's AI gate); false on any error. */
export async function modelAvailable(): Promise<boolean> {
  try {
    return await hasActiveKey();
  } catch {
    return false;
  }
}

export interface ModelReply {
  text: string;
  question: string | null;
}

/**
 * One typed message: the model's reading (checked) and its reply (checked), in one call; null on no key, an error,
 * or too slow. The code's reading and lines stand then.
 */
export async function readAndReply(
  a: { text: string; today: string; pending: QuestionId | null; next: QuestionId | null; known: string; lang: Lang },
  ms = LIMIT_MS,
): Promise<{ read: Extracted; reply: ModelReply | null } | null> {
  try {
    const llm = await getProvider();
    const [system, prompt] = withLang(a.lang, () => [turnSystem(), turnPrompt(a)]);
    // A reply is worth its answer only now: no retry after a wait, aborted at the limit.
    const raw = await timed((signal) => llm.generateJson(system, prompt, turnSchema, [], { signal, maxRetries: 0 }), ms);
    return withLang(a.lang, () => ({ read: acceptExtraction(raw, a.today), reply: acceptReply(raw.reply, a.lang) }));
  } catch (error) {
    console.warn("[start] reading the message", error);
    return null;
  }
}

/** A route for the place and length: the model's when it's asked and holds (1–4 stops, the nights add up, never the origin), else one stop. */
export async function proposeRoute(s: StartState, useModel: boolean): Promise<StartRoute | null> {
  const single = withLang(s.lang, () => singleRoute(s));
  const total = totalNights(s);
  if (!useModel || !total || !wantsRouteAdvice(s)) return single;
  try {
    const llm = await getProvider();
    const [system, prompt] = withLang(s.lang, () => [routeSystem(), routePrompt(s)]);
    const raw = await timed((signal) => llm.generateJson(system, prompt, routeSchema, [], { signal }), LIMIT_MS);
    return acceptRoute(raw, total, s.from, s.where?.code ?? null) ?? single;
  } catch (error) {
    console.warn("[start] the route", error);
    return single;
  }
}

/** The photo of each place (the Pexels proxy first, as the hero does): null where none was found or it failed. */
export async function findPhotos(places: string[]): Promise<Record<string, string | null>> {
  const proxy = await imageProxy().catch(() => null);
  const found = await Promise.all(
    places.slice(0, 4).map(async (place) => {
      try {
        return [place, await withTimeout(pickCityImage(place, { proxy }), 8000)] as const;
      } catch {
        return [place, null] as const;
      }
    }),
  );
  return Object.fromEntries(found);
}

/** Up to four photos for the places; the ones not found are left out. */
export async function placePhotos(places: string[]): Promise<{ place: string; url: string }[]> {
  const found = await findPhotos(places);
  return places.flatMap((place) => (found[place] ? [{ place, url: found[place]! }] : []));
}
