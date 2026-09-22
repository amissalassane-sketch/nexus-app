import { createHash, randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, safeEqual } from "./crypto";

const TTL_MS = 600_000;
const BINDING = "nexus-oauth-attempt-v1";
export type OAuthAttempt = {
  state: string;
  providerId: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  expiresAt: number;
  codeVerifier?: string;
};

/** The nonce is public; identity, workspace and verifier are authenticated inside the cookie. */
export function createOAuthAttempt(input: Omit<OAuthAttempt, "expiresAt" | "codeVerifier">, pkce: boolean, now = Date.now()) {
  const codeVerifier = pkce ? randomBytes(32).toString("base64url") : undefined;
  const attempt: OAuthAttempt = { ...input, codeVerifier, expiresAt: now + TTL_MS };
  const cookie = encryptSecret(JSON.stringify(attempt), BINDING);
  if (!cookie) throw new Error("OAUTH_STORAGE_NOT_CONFIGURED");
  return { cookie, codeChallenge: codeVerifier ? createHash("sha256").update(codeVerifier).digest("base64url") : null };
}

export function validateOAuthAttempt(cookie: string | undefined, expected: {
  state: string | null; providerId: string; userId: string; workspaceId: string; redirectUri: string;
}, now = Date.now()): OAuthAttempt | null {
  const plain = decryptSecret(cookie, BINDING);
  if (!plain || !expected.state) return null;
  try {
    const value = JSON.parse(plain) as OAuthAttempt;
    if (!value || typeof value.state !== "string" || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + TTL_MS) return null;
    if (!safeEqual(value.state, expected.state)) return null;
    if (["providerId", "userId", "workspaceId", "redirectUri"].some((key) => value[key as keyof OAuthAttempt] !== expected[key as keyof typeof expected])) return null;
    return value;
  } catch { return null; }
}

/** Never derive the OAuth redirect from an untrusted Origin/forwarded header. */
export function integrationOrigin(requestUrl: string): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    const url = new URL(raw || requestUrl);
    if (url.username || url.password || (raw && (url.pathname !== "/" || url.search || url.hash))) return null;
    if (process.env.NODE_ENV === "production" && (!raw || url.protocol !== "https:")) return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch { return null; }
}
