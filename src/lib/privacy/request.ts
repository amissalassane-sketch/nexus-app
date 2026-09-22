/** No forwarded host trust: an explicitly configured public origin or the request origin only. */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") throw new Error("ORIGIN_NOT_ALLOWED");
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error("ORIGIN_NOT_ALLOWED"); }
  if (parsed.origin !== origin || !["https:", "http:"].includes(parsed.protocol)) throw new Error("ORIGIN_NOT_ALLOWED");
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && process.env.NODE_ENV === "production") {
    if (new URL(configured).origin !== origin) throw new Error("ORIGIN_NOT_ALLOWED");
    return;
  }
  // Next can normalize Request.url to an internal host behind a proxy. The
  // actual Host must still equal Origin.host; never trust x-forwarded-host.
  // Browsers cannot forge Host on a credentialed cross-site request.
  const sameRequestOrigin = new URL(request.url).origin === origin;
  const sameHost = request.headers.get("host") === parsed.host && (parsed.protocol === "https:" || process.env.NODE_ENV !== "production");
  if (!sameRequestOrigin && !sameHost) throw new Error("ORIGIN_NOT_ALLOWED");
}
export async function readSmallJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw new Error("JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("JSON_REQUIRED");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("JSON_OBJECT_REQUIRED");
  return data as Record<string, unknown>;
}
