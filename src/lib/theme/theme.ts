export type ThemePreference = "dark" | "light" | "system";
export const THEME_KEY = "nexus.theme.v1";
export function parseTheme(value: unknown): ThemePreference { return value === "light" || value === "system" ? value : "dark"; }
export function resolveTheme(value: ThemePreference, prefersDark: boolean): "dark" | "light" {
  return value === "system" ? (prefersDark ? "dark" : "light") : value;
}
// Executed before paint, no user-generated interpolation and no server-side tracking.
export const THEME_BOOTSTRAP = `(function(){try{var p=localStorage.getItem('nexus.theme.v1');var t=p==='light'?'light':p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):'dark';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t}catch(e){}})()`;
