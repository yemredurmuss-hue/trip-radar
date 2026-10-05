// The plan cards' pictures, copied from the approved mockups: a line icon per kind (24×24, ulasim-v3
// symbols), a dotted side view per way of travel (400×128, ulasim-v3 SCENES) and a dotted picture for a
// media card without a photo (120×100, etkinlik-v4). The dots are two patterns defined once on the page
// (SilhouetteDefs) in ink, as the approved mockups render them; outlines take the kind's colour.
import type { ReactNode } from "react";
import type { CardKind, TransportMode } from "../../lib/cardKinds";

export function SilhouetteDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", color: "#1d1d1f" }} aria-hidden>
      <defs>
        <pattern id="pk-ht" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.05" fill="currentColor" />
        </pattern>
        <pattern id="pk-ht-s" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".6" fill="currentColor" />
        </pattern>
      </defs>
    </svg>
  );
}

const g = (children: ReactNode, width = 2) => (
  <g fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </g>
);

const KIND_ICONS: Record<CardKind | "home", ReactNode> = {
  flight: <path fill="currentColor" transform="rotate(90 12 12)" d="M21 15.5v-1.8l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.1L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z" />,
  train: g(<><rect x="5" y="3" width="14" height="14" rx="3.5" /><path d="M5 10h14M9 21l1.5-4M15 21l-1.5-4" /><circle cx="9" cy="13.5" r=".9" fill="currentColor" /><circle cx="15" cy="13.5" r=".9" fill="currentColor" /></>),
  bus: g(<><rect x="4" y="3.5" width="16" height="14" rx="3" /><path d="M4 11h16M4 7h16M7 17.5V20M17 17.5V20" /><circle cx="8" cy="14.3" r=".9" fill="currentColor" /><circle cx="16" cy="14.3" r=".9" fill="currentColor" /></>),
  minibus: g(<><path d="M3 16V8.5A2.5 2.5 0 0 1 5.5 6H15l5 5v5H3z" /><path d="M3 12h17M9 6v6M15 6v6" /><circle cx="7" cy="17" r="1.8" fill="currentColor" /><circle cx="16.5" cy="17" r="1.8" fill="currentColor" /></>),
  ferry: g(<><path d="M4 14h16l-2 4H6z" /><path d="M7 14V9h10v5M10 9V6h4v3" /><path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" /></>),
  taxi: g(<><path d="M4 16v-3.5l2-5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5l2 5V16" /><rect x="3" y="12.5" width="18" height="5" rx="1.5" /><path d="M10 3.5h4V6h-4z" fill="currentColor" /><path d="M5 17.5V19M19 17.5V19" /></>),
  car: g(<><path d="M4 16v-3.5l2-5A2 2 0 0 1 7.9 6h8.2a2 2 0 0 1 1.9 1.5l2 5V16" /><rect x="3" y="12.5" width="18" height="5" rx="1.5" /><path d="M5 17.5V19M19 17.5V19" /></>),
  moto: g(<><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path d="M5.5 16 9 10h5l4.5 6M14 10l-1.5-3H10M9 10l3 6h6.5" /></>),
  rv: g(<><path d="M2.5 16V7a2 2 0 0 1 2-2H15a2 2 0 0 1 2 2v2h2l2.5 3.5V16z" /><path d="M6 9h3v3H6zM12 9h2" /><circle cx="7" cy="17" r="1.8" fill="currentColor" /><circle cx="17" cy="17" r="1.8" fill="currentColor" /></>),
  bike: g(<><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path d="M5.5 16 9.5 9h6l3 7M9.5 9 12 16h-6.5M15 6h2.5M8.5 6.5h3" /></>),
  transport: g(<path d="M5 12h14m-6-6 6 6-6 6" />),
  activity: g(<><path d="M3 9.5v-2a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5z" /><path d="M14.5 7.5v2M14.5 11.5v1M14.5 14.5v2" /></>),
  food: g(<path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v5M17 21V3c-2 1-3 4-3 7s1 3 3 3" />),
  esim: g(<><path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><rect x="9" y="11" width="6" height="6" rx="1" /></>),
  insurance: g(<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />),
  note: g(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  // Things to do there are ideas, not ticks (0.35.2): a compass.
  todo: g(<><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" /></>),
  other: g(<><path d="M12 21.5s-7-6-7-11.5a7 7 0 0 1 14 0c0 5.5-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.6" /></>),
  stay: g(<><path d="M3 18v-6.5A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5V18M3 15h18M3 18v2M21 18v2" /><path d="M5 9V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V9" /></>),
  home: g(<><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></>),
};

export function KindIcon({ kind, size = 17, className }: { kind: CardKind | "home"; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {KIND_ICONS[kind]}
    </svg>
  );
}

const UI_ICONS = {
  doc: g(<><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></>),
  clip: g(<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14.5 7" />, 2.2),
  check: g(<path d="m5 12.5 4.5 4.5L19 7.5" />, 3),
  left: g(<path d="m15 5-7 7 7 7" />, 2.4),
  right: g(<path d="m9 5 7 7-7 7" />, 2.4),
  dots: (
    <g fill="currentColor">
      <circle cx="5.5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
    </g>
  ),
  plus: g(<path d="M12 5v14M5 12h14" />, 2.3),
  x: g(<path d="M7 7l10 10M17 7 7 17" />, 2.4),
} as const;

export function UiIcon({ name, size = 16 }: { name: keyof typeof UI_ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {UI_ICONS[name]}
    </svg>
  );
}

// --- the dotted side views (ulasim-v3 SCENES, 400×128) ---------------------------------------------------
const V = (d: string, k: string) => <path key={k} d={d} fill="url(#pk-ht)" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />;
const W = (pts: [number, number][], r = 12) =>
  pts.map(([x, y]) => (
    <g key={`w${x}`}>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke="currentColor" strokeWidth={3} />
      <circle cx={x} cy={y} r={r * 0.4} fill="currentColor" />
    </g>
  ));
const ground = (y = 116) => <path key="ground" d={`M20 ${y}H380`} stroke="currentColor" strokeWidth={1.4} strokeDasharray="2 5" strokeLinecap="round" opacity={0.7} />;
const win = (rects: [number, number, number, number][]) =>
  rects.map(([x, y, w, h]) => <rect key={`r${x}-${y}`} x={x} y={y} width={w} height={h} rx={3} fill="#fff" fillOpacity={0.85} stroke="currentColor" strokeWidth={1.2} />);

const SCENES: Record<TransportMode, () => ReactNode> = {
  flight: () => [
    V("M200 34 232 34 214 10 204 10z", "a"),
    V("M104 56C104 48 116 44 132 44H284C304 44 322 50 330 58 322 66 304 72 284 72H132C116 72 104 66 104 56z", "b"),
    V("M112 48 96 16H112L142 44z", "c"),
    V("M108 56 84 50 94 66z", "d"),
    V("M186 62H238L200 104H182z", "e"),
    win([[150, 52, 8, 7], [166, 52, 8, 7], [182, 52, 8, 7], [246, 52, 8, 7], [262, 52, 8, 7], [282, 52, 8, 7]]),
  ],
  train: () => [
    V("M50 100V52Q50 40 62 40H290Q336 40 356 76L364 100z", "a"),
    win([[70, 52, 30, 18], [112, 52, 30, 18], [154, 52, 30, 18], [196, 52, 30, 18], [238, 52, 30, 18]]),
    <path key="nose" d="M300 52H322Q336 56 344 68" stroke="currentColor" strokeWidth={1.4} fill="none" />,
    W([[90, 104], [118, 104], [260, 104], [288, 104]], 7),
    <path key="rails" d="M20 116H380M20 112H380" stroke="currentColor" strokeWidth={1.2} />,
  ],
  bus: () => [
    V("M70 102V44Q70 34 80 34H314Q326 34 328 46L334 78V102z", "a"),
    win([[84, 46, 34, 26], [126, 46, 34, 26], [168, 46, 34, 26], [210, 46, 34, 26], [252, 46, 34, 26], [294, 46, 26, 26]]),
    W([[118, 104], [292, 104]], 14),
    ground(),
  ],
  minibus: () => [
    V("M104 102V60Q106 44 122 44H246Q260 44 270 56L294 80Q306 82 306 94V102z", "a"),
    win([[118, 54, 30, 20], [156, 54, 30, 20], [194, 54, 30, 20], [232, 54, 26, 20]]),
    <path key="front" d="M266 56 286 78H262V56z" fill="#fff" fillOpacity={0.85} stroke="currentColor" strokeWidth={1.2} />,
    W([[142, 104], [268, 104]], 13),
    ground(),
  ],
  ferry: () => [
    V("M80 86H336L316 110H104z", "a"),
    V("M120 86V66H296V86z", "b"),
    V("M150 66V50H268V66z", "c"),
    V("M232 50V30H252V50z", "d"),
    win([[132, 72, 14, 8], [156, 72, 14, 8], [180, 72, 14, 8], [204, 72, 14, 8], [228, 72, 14, 8], [252, 72, 14, 8], [164, 55, 12, 7], [186, 55, 12, 7], [208, 55, 12, 7]]),
    <path key="sea" d="M40 118c20-6 30 6 50 0s30-6 50 0 30 6 50 0 30-6 50 0 30 6 50 0 30-6 50 0" stroke="currentColor" strokeWidth={1.6} fill="none" />,
  ],
  taxi: () => [
    V("M96 100V84Q96 76 106 74L138 70 160 50Q164 46 172 46H238Q246 46 252 52L276 70 304 74Q316 76 316 88V100z", "a"),
    V("M188 34H222V46H188z", "b"),
    win([[170, 54, 32, 16], [210, 54, 32, 16]]),
    W([[140, 102], [274, 102]], 14),
    ground(),
  ],
  car: () => [
    V("M90 100V80Q90 72 100 70L134 64 156 44Q160 40 168 40H252Q260 40 264 46L280 64 306 68Q320 70 320 84V100z", "a"),
    win([[166, 48, 38, 18], [212, 48, 38, 18]]),
    W([[136, 102], [278, 102]], 15),
    ground(),
  ],
  moto: () => [
    W([[136, 96], [272, 96]], 24),
    V("M146 84 186 62H234L258 74 272 96H236L212 82z", "a"),
    V("M178 56H226V64H178z", "b"),
    <path key="bars" d="M246 62 258 42M252 42H268M150 84 136 96" stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none" />,
    ground(124),
  ],
  rv: () => [
    V("M64 102V40Q64 30 74 30H270Q282 30 284 42V56H300Q314 58 322 72L334 92V102z", "a"),
    win([[82, 44, 36, 22], [128, 44, 22, 46], [160, 44, 36, 22], [206, 44, 36, 22], [290, 62, 24, 18]]),
    W([[110, 104], [286, 104]], 14),
    ground(),
  ],
  bike: () => [
    <circle key="w1" cx="134" cy="88" r="28" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={3} />,
    <circle key="w2" cx="270" cy="88" r="28" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={3} />,
    <path key="frame" d="M134 88 178 52H240L270 88M178 52 206 88H134M206 88 240 52M170 42H194M236 46 246 34 262 34" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    ground(124),
  ],
};

/** The way of travel drawn behind a transport card's middle (`.pk-art`: centred, edges fading out). */
export function TransportArt({ mode }: { mode: TransportMode }) {
  return (
    <svg className="pk-art" viewBox="0 0 400 128" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {SCENES[mode]()}
    </svg>
  );
}

// --- media cards without a photo (etkinlik-v4, 120×100) -------------------------------------------------
const MEDIA = {
  museum: (
    <g fill="url(#pk-ht)" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M10 40 60 12l50 28zM16 90h88v8H16z" />
      <path d="M24 44h12v42H24zM48 44h12v42H48zM72 44h12v42H72zM84 44h12v42H84z" />
    </g>
  ),
  // A ticket stub: notched sides, the tear line, a star on the stub (any activity that isn't a museum).
  ticket: (
    <>
      <path
        d="M20 24H100Q106 24 106 30V42A8 8 0 0 0 106 58V70Q106 76 100 76H20Q14 76 14 70V58A8 8 0 0 0 14 42V30Q14 24 20 24Z"
        fill="url(#pk-ht)" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"
      />
      <path d="M82 28v44" stroke="#fff" strokeWidth={6} />
      <path d="M82 29v42" stroke="currentColor" strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" />
      <circle cx="47" cy="50" r="13" fill="#fff" stroke="currentColor" strokeWidth={1.8} />
      <path d="M47 43L48.8 47.6L53.7 47.8L49.9 50.9L51.1 55.7L47 53L42.9 55.7L44.1 50.9L40.3 47.8L45.2 47.6Z" fill="currentColor" />
    </>
  ),
  esim: (
    <>
      <rect x="38" y="8" width="44" height="84" rx="9" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={2} />
      <rect x="47" y="24" width="26" height="30" rx="3" fill="#fff" stroke="currentColor" strokeWidth={1.6} />
      <path d="M92 34a20 20 0 0 1 0 32M102 26a32 32 0 0 1 0 48M28 34a20 20 0 0 0 0 32M18 26a32 32 0 0 0 0 48" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M60 6 26 18v26c0 22 15 38 34 48 19-10 34-26 34-48V18z" fill="url(#pk-ht)" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M47 48h26M60 35v26" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
      <path d="M47 48h26M60 35v26" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
} as const;

export function MediaSilhouette({ name }: { name: keyof typeof MEDIA }) {
  return (
    <svg className="pk-sil" viewBox="0 0 120 100" aria-hidden>
      {MEDIA[name]}
    </svg>
  );
}
