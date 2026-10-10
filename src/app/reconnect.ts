// "İnternet yok · 5 sn sonra tekrar deniyorum" (hareket dili, docs/mockups/hareket "Kaydedilemedi, kendi tekrar dener"): while a save
// failed for want of a connection, the board counts down and tries again by itself, waiting a little longer each time, and at once when
// the connection comes back; "Şimdi dene" doesn't wait. Nothing typed or saved is lost: the capture stays in the queue.
import { useEffect, useRef, useState } from "react";
import { requestProcessing } from "../lib/browser";
import { isConnectionError, retryConnectionFailures } from "../lib/process";
import type { Capture } from "../lib/types";

/** Seconds before the next try after `attempt` tries: 5, 10, 20, then every 30. Pure. */
export const retryDelay = (attempt: number) => [5, 10, 20][attempt] ?? 30;
/** How long "Kaydedildi ✓" stays once everything went through (ms). */
export const SAVED_FOR = 2200;

export type Reconnect =
  | { state: "idle" }
  | { state: "waiting"; offline: boolean; seconds: number; count: number; tryNow: () => void }
  /** Sent again, not through yet: the notice stays ("Tekrar deniyorum…") instead of blinking out and back. */
  | { state: "trying" }
  | { state: "saved" };

const online = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

/** What the notice shows for the open captures: counting down while some failed for want of a connection. */
export function useReconnect(captures: Capture[]): Reconnect {
  const failed = captures.filter((c) => c.status === "error" && isConnectionError(c.error));
  const busy = captures.some((c) => c.status === "pending" || c.status === "processing");
  const [isOnline, setOnline] = useState(online);
  const [attempt, setAttempt] = useState(0);
  const [seconds, setSeconds] = useState(retryDelay(0));
  const [saved, setSaved] = useState(false);
  const waited = useRef(false);

  const tryNow = () => {
    setAttempt((a) => a + 1);
    void retryConnectionFailures().then((n) => n && requestProcessing());
  };

  useEffect(() => {
    const on = () => {
      setOnline(true);
      tryNow();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const waiting = failed.length > 0;
  // The countdown: a fresh one after every try; the try itself when it reaches 0.
  useEffect(() => {
    if (!waiting) return;
    waited.current = true;
    setSeconds(retryDelay(attempt));
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [waiting, attempt]);
  useEffect(() => {
    if (waiting && seconds === 0) tryNow();
  }, [waiting, seconds]);

  // All through after a wait: "Kaydedildi ✓" for a moment, then nothing; the next failure counts from 5 again.
  useEffect(() => {
    if (waiting || busy || !waited.current) return;
    waited.current = false;
    setAttempt(0);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), SAVED_FOR);
    return () => clearTimeout(t);
  }, [waiting, busy]);

  if (waiting) return { state: "waiting", offline: !isOnline, seconds, count: failed.length, tryNow };
  if (busy && waited.current) return { state: "trying" };
  return saved ? { state: "saved" } : { state: "idle" };
}
