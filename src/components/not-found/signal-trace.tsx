// ============================================================
// NEXUS — SIGNAL TRACE (404)
// Decorative seismograph of the route analysis: a few searching
// blips, one strong read attempt, then a flatline — no signal.
// Drawn on with stroke-dashoffset (pathLength=1 keeps the maths
// unitless), with a cursor dot that only starts pulsing once the
// trace has reached it. Pure SVG + the token animation system:
// no JS, no library, and the global prefers-reduced-motion rule
// collapses the draw to its final state.
// ============================================================

export function SignalTrace({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 96"
      fill="none"
      aria-hidden="true"
      className={className}
      role="presentation"
    >
      {/* The trace. pathLength=1 → dasharray 1, dashoffset animates 1→0.
          Amplitudes crescendo (8 → 12 → 18 → 38px) as NEXUS searches the
          route, then the read attempt peaks and the line goes flat. */}
      <path
        d="M0 48 H72 L82 40 L92 56 L100 48 H150 L158 36 L166 52 L172 48 H236 L246 30 L256 62 L264 48 H330 L344 10 L356 78 L366 48 H616"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="animate-trace-draw text-text-tertiary"
      />
      {/* Cursor — waits at the end of the flatline, then pulses. */}
      <circle
        cx="632"
        cy="48"
        r="2.5"
        className="fill-danger animate-[verification-pulse_900ms_var(--ease-nexus)_2.2s_infinite_both]"
      />
    </svg>
  );
}
