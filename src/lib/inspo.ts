// İlham (0.35.3): what was saved to look at, not yet a plan — a Reel, a Pinterest pin, a TikTok, a YouTube
// video, a blog post. It waits at the bottom of the Plan, closed, by city, never counted as work. Put on a day
// it becomes a thing to do; chosen or booked it is a plan. A restaurant stays a restaurant wherever it was
// found, and Maps links are places, not inspiration. Pure.
import { isoDate } from "./items";
import type { Item } from "./types";

export type InspoPlatform = "reels" | "instagram" | "pinterest" | "tiktok" | "youtube" | "blog";

/** The platform a link is from; null for anything else (Maps, a booking site, a page). */
export function inspoPlatform(url: string | null | undefined): InspoPlatform | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return path.startsWith("/reel") ? "reels" : "instagram";
  if (/(^|\.)pinterest\.[a-z.]+$/.test(host) || host === "pin.it") return "pinterest";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) return "youtube";
  if (/blogspot\.|wordpress\.com|medium\.com|substack\.com/.test(host) || /(^|\/)blog(\/|$)/.test(path) || host.startsWith("blog.")) return "blog";
  return null;
}

export const INSPO_LABEL: Record<InspoPlatform, string> = { reels: "Reels", instagram: "Instagram", pinterest: "Pinterest", tiktok: "TikTok", youtube: "YouTube", blog: "Blog" };

/** Saved to look at: from one of those platforms, a thing to see or do (not a meal, a room, a ticket), with no day and not chosen. */
export function isInspiration(item: Item): boolean {
  if (item.category !== "activity" && item.category !== "other") return false;
  if (item.status === "chosen" || item.status === "booked" || item.doneAt) return false;
  if (isoDate(item.dates.start)) return false;
  return inspoPlatform(item.url) != null;
}
