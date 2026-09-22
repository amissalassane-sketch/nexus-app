"use client";
import { useEffect, useState } from "react";
import { parseTheme, resolveTheme, THEME_KEY, type ThemePreference } from "@/lib/theme/theme";
function apply(preference: ThemePreference) {
  const theme = resolveTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}
function read(): ThemePreference { try { return parseTheme(localStorage.getItem(THEME_KEY)); } catch { return "dark"; } }
export function ThemeSync() {
  useEffect(() => {
    const sync = () => apply(read());
    const media = matchMedia("(prefers-color-scheme: dark)");
    sync(); media.addEventListener("change", sync); window.addEventListener("storage", sync); window.addEventListener("nexus:theme", sync);
    return () => { media.removeEventListener("change", sync); window.removeEventListener("storage", sync); window.removeEventListener("nexus:theme", sync); };
  }, []);
  return null;
}
export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("dark");
  useEffect(() => {
    const sync = () => setPreference(read());
    sync(); window.addEventListener("storage", sync); window.addEventListener("nexus:theme", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("nexus:theme", sync); };
  }, []);
  return <label className="flex items-center gap-3 text-small text-text-secondary">Appearance
    <select aria-label="Appearance" className="min-h-11 rounded-input border border-border-strong bg-bg-surface px-3 text-text-primary" value={preference} onChange={e => {
      const value = parseTheme(e.target.value); setPreference(value);
      try { localStorage.setItem(THEME_KEY, value); window.dispatchEvent(new Event("nexus:theme")); } catch { /* session-only fallback */ }
      apply(value);
    }}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select>
  </label>;
}
