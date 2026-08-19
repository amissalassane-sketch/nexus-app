/**
 * Minimal class name joiner — no extra dependency.
 * Falsy values are dropped, duplicated whitespace is collapsed.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | { [key: string]: unknown }
  | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value && value !== 0) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
      continue;
    }
    if (typeof value === "object") {
      // clsx-style conditional object: { "class": true, "other": false }
      for (const key in value) {
        if (value[key]) out.push(key);
      }
      continue;
    }
    out.push(String(value));
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}
