// ============================================================
// NEXUS INTEGRATIONS — CREDENTIAL ENCRYPTION
// ============================================================
// Provider OAuth tokens are sealed with AES-256-GCM before they ever
// touch the database. The key comes from the server environment
// (NEXUS_INTEGRATION_ENCRYPTION_KEY) and is never sent to the client,
// logged, or written anywhere else.
//
// Storage format: base64(iv) : base64(authTag) : base64(ciphertext)
//
// Why encrypt at rest when RLS already scopes the rows? Because this
// application deliberately holds no service-role key: the server reads
// credentials back through the member-scoped Supabase client, which
// means a workspace member could read the same row through the REST
// API. With encryption, that read yields ciphertext. The boundary is
// real, not implied.
// ============================================================

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export type EncryptionKeyResult =
  | { key: Buffer; error: null }
  | { key: null; error: string };

/**
 * Read and validate the server-held encryption key. Accepts either
 * 64 hex characters or 44 base64 characters (the two common ways a
 * 32-byte key is written down). Returns an honest error string so
 * callers can surface "not configured" instead of failing blind.
 */
export function readEncryptionKey(): EncryptionKeyResult {
  const raw = process.env.NEXUS_INTEGRATION_ENCRYPTION_KEY?.trim();

  if (!raw) {
    return {
      key: null,
      error:
        "NEXUS_INTEGRATION_ENCRYPTION_KEY is not set — provider tokens cannot be stored securely, so connections are disabled.",
    };
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return { key: Buffer.from(raw, "hex"), error: null };
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_BYTES && decoded.toString("base64") === raw) {
      return { key: decoded, error: null };
    }
    return {
      key: null,
      error: `NEXUS_INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex or 44 base64 characters); got ${decoded.length} bytes after decoding.`,
    };
  } catch {
    return {
      key: null,
      error: "NEXUS_INTEGRATION_ENCRYPTION_KEY is neither valid hex nor valid base64.",
    };
  }
}

/** True when tokens can be sealed and opened in this deployment. */
export function isCredentialStorageConfigured(): boolean {
  return readEncryptionKey().key !== null;
}

/** Seal a secret. Returns null when no valid key is configured. */
export function encryptSecret(plaintext: string, associatedData?: string): string | null {
  const { key } = readEncryptionKey();
  if (!key) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  if (associatedData) cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Open a sealed secret. Returns null on any failure (wrong key,
 * tampered ciphertext, malformed input) — never a partial value.
 */
export function decryptSecret(sealed: string | null | undefined, associatedData?: string): string | null {
  if (!sealed) return null;

  const { key } = readEncryptionKey();
  if (!key) return null;

  const parts = sealed.split(":");
  if (parts.length !== 3) return null;

  try {
    if (parts.some((part) => Buffer.from(part, "base64").toString("base64") !== part)) return null;
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const ciphertext = Buffer.from(parts[2], "base64");

    if (iv.length !== IV_BYTES || authTag.length !== 16) return null;

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    if (associatedData) decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // GCM auth failure or malformed base64 — treat identically: no secret.
    return null;
  }
}

/** Constant-time comparison for secrets (used by tests). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
