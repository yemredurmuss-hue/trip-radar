// The start chat's calls out: the model reading a message and proposing a route (each with a time limit and
// every failure falling back to the code's own way: the no-key path, spec item 6), and photos for the
// generating screen from the existing city-image proxy.
import { hasActiveKey } from "../../lib/db";
import { imageProxy, pickCityImage } from "../../lib/cityImages";
import { getProvider } from "../../lib/llm";
import {
  acceptExtraction, acceptRoute, extractionPrompt, extractionSchema, extractionSystem, routePrompt, routeSchema, routeSystem,
  singleRoute, totalNights, wantsRouteAdvice, type Extracted, type StartRoute, type StartState,
} from "../../lib/startTrip";

const LIMIT_MS = 25_000;

function withTimeout<T>(p: Promise<T>, ms = LIMIT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/** Whether there's a way to the model (your key, or an invite's AI gate); false on any error. */
export async function modelAvailable(): Promise<boolean> {
  try {
    return await hasActiveKey();
  } catch {
    return false;
  }
}

/** The model's reading of one message (checked), or null: no key, an error, too slow. The code's reading stands then. */
export async function readMessage(text: string, today: string, question: string | null): Promise<Extracted | null> {
  try {
    const llm = await getProvider();
    const raw = await withTimeout(llm.generateJson(extractionSystem(), extractionPrompt(text, today, question), extractionSchema));
    return acceptExtraction(raw, today);
  } catch (error) {
    console.warn("[start] reading the message", error);
    return null;
  }
}

/** A route for the place and length: the model's when it's asked and holds (1–4 stops, the nights add up), else one stop. */
export async function proposeRoute(s: StartState, useModel: boolean): Promise<StartRoute | null> {
  const single = singleRoute(s);
  const total = totalNights(s);
  if (!useModel || !total || !wantsRouteAdvice(s)) return single;
  try {
    const llm = await getProvider();
    const raw = await withTimeout(llm.generateJson(routeSystem(), routePrompt(s), routeSchema));
    return acceptRoute(raw, total) ?? single;
  } catch (error) {
    console.warn("[start] the route", error);
    return single;
  }
}

/** Up to four photos for the places (the Pexels proxy first, as the hero does); the ones not found are left out. */
export async function placePhotos(places: string[]): Promise<{ place: string; url: string }[]> {
  const proxy = await imageProxy().catch(() => null);
  const found = await Promise.all(
    places.slice(0, 4).map(async (place) => {
      try {
        const url = await withTimeout(pickCityImage(place, { proxy }), 8000);
        return url ? { place, url } : null;
      } catch {
        return null;
      }
    }),
  );
  return found.filter((x): x is { place: string; url: string } => x != null);
}
