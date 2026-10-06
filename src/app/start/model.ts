// The start chat's calls out: the model reading a message and writing the reply in one call, and the route proposal
// (each with a time limit, every failure falling back to the code's own way: the no-key path, spec item 6), and
// photos from the existing city-image proxy. Every prompt is made in the chat's language (withLang) and says so.
//
// Rev 3: a message's reading and its reply have separate budgets. The reading runs up to READ_MS (it is applied
// whenever it lands, while what it fills is still empty); the screen stops waiting for the reply's words after
// REPLY_MS. Both stop when the screen is left (the caller's signal). The route call is short, never retried, and
// aborted at ROUTE_MS: the classic circuit or one stop stands meanwhile.
import { hasActiveKey } from "../../lib/db";
import { imageProxy, pickCityImage } from "../../lib/cityImages";
import { withLang, type Lang } from "../../lib/i18n";
import { getProvider } from "../../lib/llm";
import {
  acceptExtraction, acceptReply, acceptRoute, photoQuery, routePrompt, routeSchema, routeSystem, singleRoute,
  totalNights, turnPrompt, turnSchema, turnSystem, wantsRouteAdvice, type Extracted, type QuestionId, type StartRoute, type StartState,
} from "../../lib/startTrip";

/** A message's reading: applied whenever it comes within this (the traveller may be waiting for it, "Düşünüyor…"). */
export const READ_MS = 25_000;
/** Kept for older callers: the reading's limit. */
export const LIMIT_MS = READ_MS;
/** The model's richer line over the code's (shown already): not waited for longer than this. */
export const REPLY_MS = 6_000;
/** The route proposal: given up after this (the circuit or one stop stands). */
export const ROUTE_MS = 15_000;

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

/** A model call bounded in time and stopped with the caller's signal (the screen left): aborted at the limit. */
async function timed<T>(call: (signal: AbortSignal) => Promise<T>, ms: number, outer?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  if (outer?.aborted) throw new Error("aborted");
  const stop = () => controller.abort();
  outer?.addEventListener("abort", stop, { once: true });
  try {
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    return await withTimeout(Promise.race([call(controller.signal), aborted]), ms, controller);
  } finally {
    outer?.removeEventListener("abort", stop);
  }
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
 * too slow (`ms`, the reading's budget) or `signal` aborted. The code's reading and lines stand then.
 */
export async function readAndReply(
  // pbPending / pbNext: a trip kind's question answered (with its options) and asked next, in its own words.
  a: { text: string; today: string; pending: QuestionId | null; next: QuestionId | null; known: string; lang: Lang; pbPending?: string | null; pbNext?: string | null },
  ms = READ_MS,
  signal?: AbortSignal,
): Promise<{ read: Extracted; reply: ModelReply | null } | null> {
  try {
    const llm = await getProvider();
    const [system, prompt] = withLang(a.lang, () => [turnSystem(), turnPrompt(a)]);
    // Worth its answer only now: no retry after a wait, aborted at the limit or when the screen is left.
    const raw = await timed((sig) => llm.generateJson(system, prompt, turnSchema, [], { signal: sig, maxRetries: 0 }), ms, signal);
    return withLang(a.lang, () => ({ read: acceptExtraction(raw, a.today), reply: acceptReply(raw.reply, a.lang) }));
  } catch (error) {
    if (!signal?.aborted) console.warn("[start] reading the message", error);
    return null;
  }
}

/** Resolves with the promise's value, or `fallback` once `ms` have passed (the promise runs on). */
export function within<T, F>(p: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      () => (clearTimeout(timer), resolve(fallback)),
    );
  });
}

/**
 * A route for the place and length: the model's when it's asked and holds (1–4 stops, the nights add up, never the
 * origin), else null (the caller keeps the circuit or one stop). One try, ROUTE_MS at most.
 */
export async function proposeRoute(s: StartState, useModel: boolean, signal?: AbortSignal): Promise<StartRoute | null> {
  const single = withLang(s.lang, () => singleRoute(s));
  const total = totalNights(s);
  if (!useModel || !total || !wantsRouteAdvice(s)) return single;
  try {
    const llm = await getProvider();
    const [system, prompt] = withLang(s.lang, () => [routeSystem(), routePrompt(s)]);
    const raw = await timed((sig) => llm.generateJson(system, prompt, routeSchema, [], { signal: sig, maxRetries: 0 }), ROUTE_MS, signal);
    return acceptRoute(raw, total, s.from, s.where?.code ?? null) ?? single;
  } catch (error) {
    if (!signal?.aborted) console.warn("[start] the route", error);
    return single;
  }
}

/** The photo of each place (the Pexels proxy first, as the hero does, asked the rev 3 way): null where none was found or it failed. */
export async function findPhotos(places: string[], s?: Pick<StartState, "where" | "intent">): Promise<Record<string, string | null>> {
  const proxy = await imageProxy().catch(() => null);
  const found = await Promise.all(
    places.slice(0, 4).map(async (place) => {
      try {
        const how = s ? photoQuery(place, s) : { query: place, titles: [] };
        return [place, await withTimeout(pickCityImage(place, { proxy, ...how }), 8000)] as const;
      } catch {
        return [place, null] as const;
      }
    }),
  );
  return Object.fromEntries(found);
}

/** Up to four photos for the places; the ones not found are left out. */
export async function placePhotos(places: string[], s?: Pick<StartState, "where" | "intent">): Promise<{ place: string; url: string }[]> {
  const found = await findPhotos(places, s);
  return places.flatMap((place) => (found[place] ? [{ place, url: found[place]! }] : []));
}
