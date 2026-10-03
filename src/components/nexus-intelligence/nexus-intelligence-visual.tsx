/** Decorative, lightweight signal-core illustration for the Intelligence hero. */
export function NexusIntelligenceVisual() {
  return (
    <div
      className="nexus-intelligence-visual pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    >
      <div className="nexus-intelligence-visual-art">
        <svg
          viewBox="0 0 760 580"
          fill="none"
          role="presentation"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="nxi-core-aura">
              <stop stopColor="#A998FF" stopOpacity=".2" />
              <stop offset=".48" stopColor="#8370FA" stopOpacity=".08" />
              <stop offset="1" stopColor="#8370FA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nxi-core-fill" cx=".36" cy=".28" r=".8">
              <stop stopColor="#FFF" />
              <stop offset=".45" stopColor="#EAE5FF" />
              <stop offset="1" stopColor="#A394FF" />
            </radialGradient>
            <linearGradient id="nxi-orbit-line" x1=".08" y1=".22" x2=".9" y2=".8">
              <stop stopColor="#8F7CFF" stopOpacity="0" />
              <stop offset=".48" stopColor="#9C8CFF" stopOpacity=".48" />
              <stop offset="1" stopColor="#B7AAFF" stopOpacity=".08" />
            </linearGradient>
          </defs>

          <circle cx="390" cy="290" r="230" fill="url(#nxi-core-aura)" />

          <g stroke="url(#nxi-orbit-line)" strokeWidth="1.2">
            <ellipse cx="390" cy="290" rx="258" ry="92" transform="rotate(-18 390 290)" />
            <ellipse cx="390" cy="290" rx="218" ry="150" transform="rotate(22 390 290)" opacity=".66" />
            <ellipse cx="390" cy="290" rx="280" ry="120" transform="rotate(49 390 290)" opacity=".48" />
          </g>

          <g stroke="#9C8CFF" strokeOpacity=".22" strokeWidth="1">
            <path d="M154 222 260 258 390 290 520 256 621 209" />
            <path d="M226 396 302 341 390 290 493 346 565 405" />
            <path d="M260 258 302 341M520 256 493 346M260 258 493 346M302 341 520 256" />
          </g>

          <g fill="#9C8CFF">
            <circle cx="154" cy="222" r="2.5" opacity=".55" />
            <circle cx="621" cy="209" r="3" opacity=".8" />
            <circle cx="226" cy="396" r="2" opacity=".48" />
            <circle cx="565" cy="405" r="2.5" opacity=".68" />
            <circle cx="260" cy="258" r="3" opacity=".72" />
            <circle cx="520" cy="256" r="2.5" opacity=".58" />
            <circle cx="302" cy="341" r="2" opacity=".52" />
            <circle cx="493" cy="346" r="3" opacity=".7" />
          </g>

          <circle cx="390" cy="290" r="76" fill="url(#nxi-core-aura)" />
          <circle cx="390" cy="290" r="48" fill="url(#nxi-core-fill)" fillOpacity=".82" />
          <circle cx="390" cy="290" r="48" stroke="#9786FF" strokeOpacity=".46" />
          <circle cx="390" cy="290" r="36" stroke="#FFF" strokeOpacity=".72" />
          <path d="m390 266 20 12v24l-20 12-20-12v-24l20-12Z" stroke="#7664E8" strokeOpacity=".5" />
          <path d="M370 278h40m-20-12v48m-20-12 40-24m-40 0 40 24" stroke="#7664E8" strokeOpacity=".42" strokeWidth="1" />
          <circle cx="390" cy="290" r="4" fill="#7664E8" />
        </svg>
      </div>
    </div>
  );
}
