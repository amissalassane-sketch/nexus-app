// ============================================================
// NEXUS — shared guard for global (document-level) keyboard shortcuts.
//
// Any keydown listener attached to `document` fires no matter which
// element has focus, including a plain <input> the person is typing
// into. Without this guard, typing a letter that also happens to be a
// shortcut (or, on AZERTY/European layouts, typing an accented
// character via AltGr — which many browsers report with `ctrlKey` and
// `altKey` both true) can silently steal focus away from whatever the
// person was filling in. Every global shortcut handler must check this
// before acting.
// ============================================================

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}
