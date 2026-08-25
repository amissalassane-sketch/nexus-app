// ============================================================
// NEXUS — PROFILE STATE MODEL
//
// Profile completeness is a UI-guidance signal ONLY. It never takes
// part in authentication, authorization, RLS or workspace access.
// A user with `profileComplete === false` and an active owner
// membership has exactly the same access to /app as a complete one.
//
// The state model deliberately keeps four independent axes (see the
// access-first architecture):
//
//   authentication  -> Supabase session (auth.getUser)
//   workspace       -> ensurePersonalWorkspace() bootstrap
//   membership      -> workspace_members (owner/admin/member/viewer)
//   profile         -> THIS module: is the identity finished?
//
// "Complete" means the two identity fields exist:
//   full name  AND  username.
// Avatar, job title and bio are optional and only feed the
// "X of 3" progress indicator.
// ============================================================

export type ProfileMissing = "name" | "username";

export type ProfileCompleteness = {
  /** true when full name AND username both exist. Controls UI guidance
   *  (show/hide the completion prompt) — never access. */
  complete: boolean;
  /** Which of the two required identity fields are still missing. */
  missing: ProfileMissing[];
  /** How many of the three shown fields are filled (name, username, photo). */
  filled: number;
  total: number;
  /** Whole-number percentage for progress UI ("67% complete"). */
  percent: number;
};

/**
 * Computes profile completeness from the raw profile fields.
 * Pure and side-effect free so server components and client components
 * always agree on the same number.
 */
export function computeProfileCompleteness(
  displayName: string | null | undefined,
  username: string | null | undefined,
  avatarUrl: string | null | undefined
): ProfileCompleteness {
  const missing: ProfileMissing[] = [];
  if (!displayName?.trim()) missing.push("name");
  if (!username?.trim()) missing.push("username");

  const filled =
    (displayName?.trim() ? 1 : 0) +
    (username?.trim() ? 1 : 0) +
    (avatarUrl?.trim() ? 1 : 0);
  const total = 3;

  return {
    complete: missing.length === 0,
    missing,
    filled,
    total,
    percent: Math.round((filled / total) * 100),
  };
}

/** Human label for the missing-fields hint, e.g. "Username". */
export function missingLabel(missing: ProfileMissing[]): string {
  if (missing.length === 0) return "";
  const labels = missing.map((field) =>
    field === "name" ? "Name" : "Username"
  );
  return labels.join(" and ");
}

/**
 * Validates one username the same way the server does. Kept here so the
 * modal can hint before submit while the API remains the source of truth.
 *
 * The pattern intentionally matches every format the product has ever
 * written (auto-generated `ownerone_123456` rows and the settings editor's
 * dot/dash allowance), so a historical username is never invalidated by a
 * later stricter UI.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
