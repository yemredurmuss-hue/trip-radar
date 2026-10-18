// The home's backdrop (drawing v2, "A · Rota", 2026-10-09): a calm globe rising from the bottom, a dashed flight route
// across it and a small paper plane gliding along the route (behind the question's box, so it goes out of sight and
// comes back). Drawn in one SVG so everything scales together; with reduced motion the plane is not shown.
export function HomeBackdrop() {
  return (
    <div className="hm-bg" aria-hidden>
      <svg className="hm-bg-svg" viewBox="0 0 1280 760" preserveAspectRatio="xMidYMin slice">
        <defs>
          <radialGradient id="hmGlow" cx="50%" cy="0%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity=".8" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1280" height="760" fill="url(#hmGlow)" />
        <g fill="none" stroke="#5b45e0" strokeOpacity=".12" strokeWidth="1.2">
          <circle cx="640" cy="1060" r="660" />
          <ellipse cx="640" cy="1060" rx="440" ry="660" />
          <ellipse cx="640" cy="1060" rx="220" ry="660" />
          <path d="M640 400V1720" />
          <path d="M60 580Q640 520 1220 580" />
          <path d="M20 660Q640 594 1260 660" />
          <path d="M-10 750Q640 674 1290 750" />
        </g>
        <path id="hmRoute" d="M140 470C420 250 860 230 1140 400" fill="none" stroke="#5b45e0" strokeOpacity=".4" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" />
        <circle cx="140" cy="470" r="5" fill="#5b45e0" fillOpacity=".55" />
        <circle cx="1140" cy="400" r="5" fill="#5b45e0" fillOpacity=".55" />
        <g className="hm-plane" opacity="0">
          <path d="M-10,-6 L11,0 L-10,6 L-5.5,0 Z" fill="#fff" stroke="#5b45e0" strokeOpacity=".7" strokeWidth="1.2" strokeLinejoin="round" />
          <animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
            <mpath href="#hmRoute" />
          </animateMotion>
          <animate attributeName="opacity" values="0;.9;.9;0" keyTimes="0;.06;.94;1" dur="18s" repeatCount="indefinite" />
        </g>
      </svg>
    </div>
  );
}
