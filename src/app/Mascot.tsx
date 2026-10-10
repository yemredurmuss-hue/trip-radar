// The assistant's mascot, "İlk küre · güler yüzlü" (docs/mockups/sihirli-acilis): a violet ball with a smile, a small yellow star and two
// eyes. Six states, each drawn by CSS on its eyes and body: idle (blinks every few seconds), wink (the right eye), work (a gentle bob, the
// eyes look left and right), done (the eyes become two small happy arcs), oops (small round eyes, a flat mouth, a dim star, the head tilted:
// something didn't work), sleepy (closed eyes, slow breathing, a small "z": nothing here yet). The chat's seat shows it at 34 px; the
// opening flies a copy; empty screens and the big errors show it too (docs/mockups/hareket).
import { useId } from "react";

export type MascotState = "idle" | "wink" | "work" | "done" | "oops" | "sleepy";

export function Mascot({ state = "idle", size = 34, className = "" }: { state?: MascotState; size?: number; className?: string }) {
  const gradient = `${useId().replace(/:/g, "")}-og`;
  return (
    <span className={`ms-wrap${className ? ` ${className}` : ""}`} data-state={state} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} className="ms" aria-hidden>
        <defs>
          <radialGradient id={gradient} cx="38%" cy="32%" r="70%">
            <stop offset="0" stopColor="#c9bcff" />
            <stop offset=".55" stopColor="#7b62f0" />
            <stop offset="1" stopColor="#4a33c9" />
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="18" fill={`url(#${gradient})`} />
        <circle cx="17.5" cy="17" r="4.2" fill="#fff" opacity=".55" />
        <path className="smile" d="M19.2 31.2q4.8 3.2 9.6 0" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        <path className="star" d="M38.5 5.5l1.4 3.6L43.8 10.6l-3.9 1.5L38.5 15.8l-1.4-3.7L33.2 10.6l3.9-1.5z" fill="#ffd36b" />
        <g className="eyes">
          <ellipse className="eye l" cx="19" cy="24.5" rx="2.2" ry="3" fill="#fff" />
          <ellipse className="eye r" cx="29" cy="24.5" rx="2.2" ry="3" fill="#fff" />
        </g>
        <path className="happy" d="M16.4 25.5q2.6 -3.4 5.2 0" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        <path className="happy" d="M26.4 25.5q2.6 -3.4 5.2 0" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        {state === "oops" && (
          <g className="oops">
            <circle cx="19" cy="25" r="2" fill="#fff" />
            <circle cx="29" cy="25" r="2" fill="#fff" />
            <path d="M20 32.5q4 -2.6 8 0" stroke="#fff" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          </g>
        )}
        {state === "sleepy" && (
          <g className="sleepy">
            <path d="M16.6 25q2.4 1.6 4.8 0M26.6 25q2.4 1.6 4.8 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M21.5 31.5q2.5 1.2 5 0" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <text className="zz" x="35" y="12" fontSize="9" fontWeight="800" fill="#8b74ff" fontFamily="sans-serif">z</text>
          </g>
        )}
      </svg>
    </span>
  );
}
