"use client";

import { useEffect, useState } from "react";

/**
 * Shows the platform-correct label for the command palette shortcut.
 * Defaults to ⌘K during SSR / first paint to avoid a hydration mismatch,
 * then corrects to Ctrl K on Windows/Linux once the client is ready.
 */
export function useCommandKeyLabel() {
  const [label, setLabel] = useState("⌘K");

  useEffect(() => {
    // Defer the label switch to a callback so SSR and the first client
    // render agree (⌘K), then correct Windows/Linux without a hydration
    // mismatch.
    const id = setTimeout(() => {
      const platform =
        typeof navigator !== "undefined" ? navigator.platform : "";
      const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
      setLabel(isMac ? "⌘K" : "Ctrl K");
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return label;
}
