/** JSON API payloads must be objects, not null, arrays or primitives. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SyntaxError("Expected a JSON object");
  }
  return value as Record<string, unknown>;
}
