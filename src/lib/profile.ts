// Your profile (0.36): the name the others see you by ("Emre"; the same as the sharing name) and, if you like,
// a photo. No account: both stay on this computer, and the photo goes only to the shared trips you're on
// (supabase/profiles.sql), as a 128 px JPEG of about 10 KB.
import { chromeKV, type KV } from "./share/store";

const PHOTO_KEY = "sharePhoto";
export const PHOTO_PX = 128;
export const PHOTO_MAX_CHARS = 60_000;

/** A photo we keep: a JPEG data URL under the server's limit. */
export const isPhoto = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image/jpeg;base64,") && v.length <= PHOTO_MAX_CHARS;

export async function getPhoto(kv: KV = chromeKV): Promise<string | null> {
  const v = await kv.get<string>(PHOTO_KEY);
  return isPhoto(v) ? v : null;
}

export async function savePhoto(photo: string | null, kv: KV = chromeKV): Promise<void> {
  if (photo == null) await kv.remove(PHOTO_KEY);
  else if (isPhoto(photo)) await kv.set(PHOTO_KEY, photo);
  else throw new Error("Bu fotoğraf kullanılamadı.");
}

/** The picked picture, cropped to a centred square and made 128 px JPEG (the board only: it needs a canvas). */
export async function photoFromFile(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bu fotoğraf kullanılamadı.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
  for (const q of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (isPhoto(url)) return url;
  }
  throw new Error("Bu fotoğraf kullanılamadı.");
}
