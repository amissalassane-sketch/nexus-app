import { cn } from "@/lib/cn";

// ============================================================
// NEXUS — SLIDE LABEL
// ============================================================
// The presentation half of the slide interaction (the CSS contract lives
// in `globals.css` under SLIDE LABEL). It renders two labels in one
// clipped line box:
//
//   text       what the action is now          ("Open project")
//   hoverText  what it becomes on hover/focus  ("View project")
//
// Accessibility — the reason this is a component and not a copy-pasted
// span: the incoming label is `aria-hidden`. The link or button therefore
// has exactly one accessible name (the real one), it is never announced
// twice, and a screen reader never reads a label that only exists because
// a pointer happens to be over the control.
//
// Motion — the reveal is pure CSS (`transform` on hover, focus-visible and
// nothing else). No JavaScript, no state, no re-render, no client
// boundary: this component is a Server Component and works with JS
// disabled. Reduced motion is handled once, in the stylesheet.
//
// Two ways to use it, both on the canonical Button primitive:
//
//   <ButtonLink href="/signup" variant="slide" hoverText="Start building">
//     Get started
//   </ButtonLink>
//
//   <ButtonLink href="/projects" variant="slide">
//     <SlideLabel text="Open project" hoverText="View project" />
//     <NexusIcon icon={IconArrowRight} />
//   </ButtonLink>
//
// The second form is for composed children (a trailing icon, a counter):
// the label slides, everything else stays still.
// ============================================================

export function SlideLabel({
  text,
  hoverText,
  className,
}: {
  /** The label in the resting state. Also the accessible name. */
  text: string;
  /** The label revealed on hover / keyboard focus. Never announced. */
  hoverText: string;
  className?: string;
}) {
  return (
    <span className={cn("slide-label whitespace-nowrap", className)}>
      <span className="slide-label-inner">
        <span>{text}</span>
        <span className="slide-label-hover" aria-hidden="true">
          {hoverText}
        </span>
      </span>
    </span>
  );
}
