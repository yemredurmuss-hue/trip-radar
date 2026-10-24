// The small reward (0.47.0, Emre: "bir kategori tamamlanınca minik motion ve minik bir ses; çok küçük, bilinç altına
// işleyecek"): two soft rising notes, about 150 ms, made in the page (no file), quiet. On unless "Küçük sesler" is turned
// off in Settings; never with "Hareketi duraklat" or the system's reduced motion (a quiet board stays quiet).
import { reducedMotion } from "./motion";

export const SOUND_KEY = "trip-radar:sounds";

/** "Küçük sesler" (Settings): on unless turned off, kept in this browser. */
export const soundsOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSounds = (on: boolean): void => {
  try {
    if (on) localStorage.removeItem(SOUND_KEY);
    else localStorage.setItem(SOUND_KEY, "off");
  } catch {
    /* this page only */
  }
};

let audio: AudioContext | null = null;

/** C6 then G6, each a soft sine that fades at once; at most a whisper (gain .05). */
export function chime(): void {
  if (!soundsOn() || reducedMotion()) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t0 = audio.currentTime + 0.01;
    [1046.5, 1568].forEach((hz, n) => {
      const at = t0 + n * 0.075;
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.05, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + 0.18);
    });
  } catch {
    /* no sound here: the tick is enough */
  }
}
