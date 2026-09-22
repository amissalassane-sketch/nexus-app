export const LOCALES = ["en-US", "en-GB", "fr-BJ", "fr-FR", "en-NG", "en-GH", "ja-JP", "de-DE"] as const;
export type Locale = typeof LOCALES[number];
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
/** Formatting locales are NOT a claim that the entire UI has been translated. */
export const TRANSLATED_UI_LANGUAGES = ["en", "fr"] as const; // regional controls only
