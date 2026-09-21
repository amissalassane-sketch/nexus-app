/**
 * Resolves the public origin of the running app.
 * Used for Supabase emailRedirectTo (confirmation + password recovery).
 *
 * Prefer NEXT_PUBLIC_SITE_URL in production so the confirmation link
 * never points at an internal host. Fall back to the incoming request.
 */
export function getRequestOrigin(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const originHeader = request.headers.get("origin");
  if (originHeader) return originHeader.replace(/\/$/, "");

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");

  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

/** Only allow in-app relative paths as post-auth redirects. */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  // WHATWG URL parsing strips tabs/newlines; /\t/host would become //host.
  if (/[\u0000-\u0020\u007f]/.test(value)) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}
