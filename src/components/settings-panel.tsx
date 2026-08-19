"use client";

// ============================================================
// NEXUS — SETTINGS (P5: real, not decorative)
// Side nav: Account / Workspace / Preferences / Billing
//  - Account: profile, email change, password change, sessions,
//    danger zone (explained, NOT simulated — future DB change)
//  - Workspace: rename (owner/admin, verified server-side),
//    real member list, plan usage via RPC, invitations = future
//  - Preferences: density (applied live), week start, date format
// ============================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  HardDrive,
  KeyRound,
  LogOut,
  Mail,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileSummary } from "@/lib/profile";
import {
  DEFAULT_PREFERENCES,
  type DateFormat,
  type Density,
  type Preferences,
} from "@/lib/preferences";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, ErrorBox, Field, ProgressBar, TextArea } from "@/components/ui";

type Section = "account" | "workspace" | "preferences";

type MemberRow = {
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
};

type UsageResult = {
  plan: string;
  usage: { projects: number; active_tasks: number; goals: number; members: number };
  limits: { projects: number; active_tasks: number; goals: number; members: number };
};

const SECTIONS: { id: Section; label: string; icon: typeof UserRound }[] = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "workspace", label: "Workspace", icon: HardDrive },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

// Module-level loaders (setState stays behind an await — pitfall #5).
async function loadMembersFor(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ data: MemberRow[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, status")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { data: null, error: error as { message: string } | null };
  }

  // Names are best-effort: profiles may be readable only for oneself.
  const ids = (data as Array<{ user_id: string }>).map((row) => row.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", ids);

  const byId = new Map(
    ((profiles as Array<{ id: string; display_name: string | null; username: string | null }>) ?? []).map(
      (row) => [row.id, row]
    )
  );

  const merged: MemberRow[] = (data as Array<{ user_id: string; role: string; status: string }>).map(
    (row) => ({
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      display_name:
        byId.get(row.user_id)?.display_name ?? byId.get(row.user_id)?.username ?? null,
    })
  );

  return { data: merged, error: null };
}

async function loadUsageFor(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<UsageResult | null> {
  const { data } = await supabase.rpc("get_workspace_usage", { p_workspace_id: workspaceId });
  return (data as UsageResult) ?? null;
}

export function SettingsPanel({
  summary,
  initialPreferences,
}: {
  summary: ProfileSummary;
  /** Parsed from profiles.preferences — null when the column is absent. */
  initialPreferences: Preferences | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const toast = useToast();

  const [section, setSection] = useState<Section>("account");

  // -- Profile -------------------------------------------------
  const [form, setForm] = useState({
    display_name: summary.displayName,
    username: summary.username ?? "",
    bio: summary.bio ?? "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // -- Email / password / sessions -----------------------------
  const [newEmail, setNewEmail] = useState("");
  const [emailWorking, setEmailWorking] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordWorking, setPasswordWorking] = useState(false);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  // -- Workspace -----------------------------------------------
  const canManage = summary.role === "owner" || summary.role === "admin";
  const [workspaceName, setWorkspaceName] = useState(summary.workspaceName ?? "");
  const [renaming, setRenaming] = useState(false);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [membersError, setMembersError] = useState("");
  const [usage, setUsage] = useState<UsageResult | null>(null);

  // -- Preferences ---------------------------------------------
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences ?? DEFAULT_PREFERENCES);
  const [prefsColumnLive, setPrefsColumnLive] = useState(initialPreferences !== null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Density applies LIVE to the whole app (real, not decorative).
  useEffect(() => {
    document.documentElement.dataset.density = prefs.density;
  }, [prefs.density]);

  // Workspace data loads when its section is opened (handler-free,
  // behind awaits, and only once per section).
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  useEffect(() => {
    if (section !== "workspace" || workspaceLoaded || !summary.workspaceId) return;
    const load = async () => {
      const [membersResult, usageResult] = await Promise.all([
        loadMembersFor(supabase, summary.workspaceId!),
        loadUsageFor(supabase, summary.workspaceId!),
      ]);
      if (membersResult.error) setMembersError(membersResult.error.message);
      setMembers(membersResult.data ?? []);
      setUsage(usageResult);
      setWorkspaceLoaded(true);
    };
    void load();
  }, [section, workspaceLoaded, summary.workspaceId, supabase]);

  // -- Handlers -------------------------------------------------

  const saveProfile = async () => {
    const displayName = form.display_name.trim();
    const username = form.username.trim();
    if (!displayName) {
      toast.error("Display name is required.");
      return;
    }
    if (username && !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      toast.error("Username must be 3-32 characters (letters, numbers, dot, underscore, dash).");
      return;
    }

    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        username: username || null,
        bio: form.bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", summary.userId);
    setSavingProfile(false);

    if (error) {
      toast.error(`Profile not saved — ${error.message}`);
      return;
    }
    toast.success("Profile updated.");
    router.refresh();
  };

  const changeEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid new email address.");
      return;
    }
    if (email === summary.email?.toLowerCase()) {
      toast.info("This is already your current email.");
      return;
    }

    setEmailWorking(true);
    const { error } = await supabase.auth.updateUser({ email });
    setEmailWorking(false);

    if (error) {
      toast.error(`Email change not started — ${error.message}`);
      return;
    }
    setNewEmail("");
    toast.success("Confirmation sent to the new address. It activates once you confirm it.");
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("The two passwords do not match.");
      return;
    }

    setPasswordWorking(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordWorking(false);

    if (error) {
      toast.error(`Password not changed — ${error.message}`);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password changed. Other sessions keep the old one until they sign in again.");
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out from ALL devices? You will need to sign in again everywhere.")) {
      return;
    }
    setSigningOutEverywhere(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setSigningOutEverywhere(false);
      toast.error(`Sign out failed — ${error.message}`);
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  const renameWorkspace = async () => {
    const name = workspaceName.trim();
    if (name.length < 2) {
      toast.error("Workspace name must be at least 2 characters.");
      return;
    }

    setRenaming(true);
    const response = await fetch("/api/workspace/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setRenaming(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Rename failed.");
      return;
    }
    toast.success("Workspace renamed.");
    router.refresh();
  };

  const savePrefs = async (next: Preferences) => {
    setPrefs(next); // applies instantly (density is live)
    setSavingPrefs(true);

    const { error } = await supabase
      .from("profiles")
      .update({ preferences: next, updated_at: new Date().toISOString() })
      .eq("id", summary.userId);
    setSavingPrefs(false);

    if (error) {
      const missingColumn = error.message.includes("column") && error.message.includes("exist");
      if (missingColumn) {
        setPrefsColumnLive(false);
        toast.info("Applied for this session. Saved permanently once migration 013 is pushed.");
        return;
      }
      toast.error(`Preferences not saved — ${error.message}`);
      return;
    }
    setPrefsColumnLive(true);
    toast.success("Preferences saved.");
  };

  // -- Render ---------------------------------------------------

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* SIDE NAV */}
      <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3 text-left text-body transition-all duration-[160ms] ease-out lg:w-full ${
                active
                  ? "bg-bg-surface-2 text-text-primary"
                  : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-4 w-[2px] rounded-full transition-all duration-[160ms] ${
                  active ? "bg-volt" : "bg-transparent"
                }`}
              />
              <Icon size={15} strokeWidth={1.75} />
              {item.label}
            </button>
          );
        })}
        <Link
          href="/settings/billing"
          className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3 text-body text-text-secondary transition-all duration-[160ms] ease-out hover:bg-bg-surface hover:text-text-primary lg:w-full"
        >
          <span aria-hidden="true" className="h-4 w-[2px] rounded-full bg-transparent" />
          <CreditCard size={15} strokeWidth={1.75} />
          Billing
        </Link>
      </nav>

      <div className="space-y-6">
        {/* ================= ACCOUNT ================= */}
        {section === "account" ? (
          <>
            <Card>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default bg-bg-surface-2 text-h3 font-semibold text-text-primary">
                  {summary.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-h3 font-semibold text-text-primary">Profile</h2>
                  <p className="text-caption text-text-tertiary">
                    Public identity — @{summary.username ?? "username"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Display name"
                  value={form.display_name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, display_name: event.target.value }))
                  }
                />
                <Field
                  label="Username"
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="janedoe"
                />
              </div>
              <div className="mt-4">
                <TextArea
                  label="Bio"
                  rows={3}
                  value={form.bio}
                  onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                  placeholder="A few words about you (visible to your workspace)"
                />
              </div>
              <div className="mt-4">
                <Button variant="primary" onClick={() => void saveProfile()} disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Mail size={16} strokeWidth={1.75} className="text-text-tertiary" />
                <h2 className="text-h3 font-semibold text-text-primary">Email</h2>
              </div>
              <p className="text-small text-text-secondary">
                Current: <span className="font-mono text-text-primary">{summary.email ?? "—"}</span>
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Field
                  label="New email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="new.address@example.com"
                />
                <Button onClick={() => void changeEmail()} disabled={emailWorking}>
                  {emailWorking ? "Sending…" : "Change email"}
                </Button>
              </div>
              <p className="mt-3 text-caption text-text-quaternary">
                A confirmation is sent to the new address; the change takes effect once confirmed
                (via /auth/callback).
              </p>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <KeyRound size={16} strokeWidth={1.75} className="text-text-tertiary" />
                <h2 className="text-h3 font-semibold text-text-primary">Password</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <Field
                  label="Confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="mt-4">
                <Button onClick={() => void changePassword()} disabled={passwordWorking}>
                  {passwordWorking ? "Changing…" : "Change password"}
                </Button>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Users size={16} strokeWidth={1.75} className="text-text-tertiary" />
                <h2 className="text-h3 font-semibold text-text-primary">Sessions</h2>
              </div>
              <p className="text-small text-text-secondary">
                Signed in on this device. You can revoke every device at once.
              </p>
              <div className="mt-4">
                <Button variant="danger" onClick={() => void signOutEverywhere()} disabled={signingOutEverywhere}>
                  <LogOut size={14} strokeWidth={1.75} />
                  {signingOutEverywhere ? "Signing out…" : "Sign out everywhere"}
                </Button>
              </div>
            </Card>

            <div className="rounded-xl border border-danger-border bg-danger-bg p-5">
              <div className="mb-2 flex items-center gap-2">
                <ShieldAlert size={16} strokeWidth={1.75} className="text-danger-fg" />
                <h2 className="text-h3 font-semibold text-danger-fg">Danger zone</h2>
              </div>
              <p className="text-small text-text-secondary">
                Account deletion requires a server-side RPC (<span className="font-mono">security
                definer</span> + cascade across workspaces, memberships, projects, tasks and goals)
                that does not exist yet — it is a declared FUTURE DATABASE CHANGE. Until it ships,
                NEXUS does not simulate a delete button. To delete your account today: sign out
                everywhere above, then request deletion from the workspace owner channel — your data
                stays yours and intact.
              </p>
            </div>
          </>
        ) : null}

        {/* ================= WORKSPACE ================= */}
        {section === "workspace" ? (
          <>
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} strokeWidth={1.75} className="text-text-tertiary" />
                  <h2 className="text-h3 font-semibold text-text-primary">Workspace</h2>
                </div>
                <Badge tone={canManage ? "volt" : "neutral"}>
                  {summary.role ?? "member"}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Field
                  label="Name"
                  value={workspaceName}
                  disabled={!canManage}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  hint={
                    canManage
                      ? undefined
                      : "Only owners and admins can rename the workspace (verified server-side)."
                  }
                />
                <Button
                  variant="primary"
                  onClick={() => void renameWorkspace()}
                  disabled={!canManage || renaming}
                >
                  {renaming ? "Renaming…" : "Rename"}
                </Button>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Users size={16} strokeWidth={1.75} className="text-text-tertiary" />
                <h2 className="text-h3 font-semibold text-text-primary">Members</h2>
              </div>

              {membersError ? (
                <ErrorBox message={membersError} />
              ) : members === null ? (
                <div className="skeleton min-h-11 w-full rounded-lg" aria-hidden="true" />
              ) : (
                <div className="stagger-list space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-subtle px-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-surface-2 font-mono text-[10px] text-text-primary">
                          {(member.display_name ?? "U").slice(0, 1).toUpperCase()}
                        </div>
                        <span className="truncate text-body text-text-primary">
                          {member.display_name ?? `user-${member.user_id.slice(0, 8)}`}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={member.role === "owner" ? "volt" : "neutral"}>
                          {member.role}
                        </Badge>
                        <Badge tone={member.status === "active" ? "success" : "warning"}>
                          {member.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-caption text-text-quaternary">
                Member invitations need a dedicated table + email flow (FUTURE DATABASE CHANGE) —
                not simulated here.
              </p>
            </Card>

            <Card>
              <h2 className="mb-4 text-h3 font-semibold text-text-primary">Plan usage</h2>
              {usage ? (
                <div className="space-y-4">
                  {(
                    [
                      ["Projects", usage.usage.projects, usage.limits.projects],
                      ["Active tasks", usage.usage.active_tasks, usage.limits.active_tasks],
                      ["Goals", usage.usage.goals, usage.limits.goals],
                      ["Members", usage.usage.members, usage.limits.members],
                    ] as Array<[string, number, number]>
                  ).map(([label, current, limit]) => {
                    const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
                    return (
                      <div key={label}>
                        <div className="mb-1 flex items-center justify-between text-small">
                          <span className="text-text-secondary">{label}</span>
                          <span className="font-mono text-text-primary">
                            {current} / {limit}
                          </span>
                        </div>
                        <ProgressBar value={pct} tone={pct >= 80 ? "warning" : "volt"} />
                      </div>
                    );
                  })}
                  <Link
                    href="/settings/billing"
                    className="inline-flex items-center gap-1.5 text-small text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
                  >
                    Manage plan <CreditCard size={13} strokeWidth={1.75} />
                  </Link>
                </div>
              ) : (
                <div className="skeleton h-24 w-full rounded-lg" aria-hidden="true" />
              )}
            </Card>
          </>
        ) : null}

        {/* ================= PREFERENCES ================= */}
        {section === "preferences" ? (
          <>
            <Card>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} strokeWidth={1.75} className="text-text-tertiary" />
                  <h2 className="text-h3 font-semibold text-text-primary">Display</h2>
                </div>
                {savingPrefs ? (
                  <span className="font-mono text-mono-small text-text-quaternary">SAVING…</span>
                ) : null}
              </div>

              {!prefsColumnLive ? (
                <div className="mb-4 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-small text-warning-fg">
                  The preferences column is not deployed yet (migration 013). Choices apply to this
                  session and will persist once the migration is pushed.
                </div>
              ) : null}

              <div className="space-y-5">
                <div className="flex min-h-11 items-center justify-between gap-4">
                  <div>
                    <div className="text-body text-text-primary">Density</div>
                    <p className="text-caption text-text-tertiary">
                      Compact tightens every list row — applied instantly, app-wide.
                    </p>
                  </div>
                  <div className="flex shrink-0 rounded-md border border-border-default p-0.5">
                    {(["comfortable", "compact"] as Density[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          void savePrefs({ ...prefs, density: option })
                        }
                        aria-pressed={prefs.density === option}
                        className={`min-h-9 rounded px-3 text-button capitalize transition-all duration-[120ms] active:scale-[0.98] ${
                          prefs.density === option
                            ? "bg-bg-surface-3 text-text-primary"
                            : "text-text-tertiary hover:text-text-secondary"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex min-h-11 items-center justify-between gap-4">
                  <div>
                    <div className="text-body text-text-primary">Week starts on Monday</div>
                    <p className="text-caption text-text-tertiary">
                      Used by date grouping; the calendar surface arrives with it.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.weekStartsMonday}
                    onClick={() =>
                      void savePrefs({ ...prefs, weekStartsMonday: !prefs.weekStartsMonday })
                    }
                    className={`relative h-6 w-11 shrink-0 rounded-full border transition-all duration-[160ms] ease-out ${
                      prefs.weekStartsMonday
                        ? "border-volt-border bg-volt-subtle"
                        : "border-border-default bg-bg-surface-3"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-[160ms] ease-out ${
                        prefs.weekStartsMonday ? "left-[22px] bg-volt" : "left-0.5 bg-text-quaternary"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex min-h-11 items-center justify-between gap-4">
                  <div>
                    <div className="text-body text-text-primary">Date format</div>
                    <p className="text-caption text-text-tertiary">
                      Applies to notifications and dated lists.
                    </p>
                  </div>
                  <div className="flex shrink-0 rounded-md border border-border-default p-0.5">
                    {(
                      [
                        ["dmy", "19 Aug 2026"],
                        ["mdy", "Aug 19, 2026"],
                        ["iso", "2026-08-19"],
                      ] as Array<[DateFormat, string]>
                    ).map(([option, sample]) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => void savePrefs({ ...prefs, dateFormat: option })}
                        aria-pressed={prefs.dateFormat === option}
                        className={`min-h-9 rounded px-3 font-mono text-mono-small transition-all duration-[120ms] active:scale-[0.98] ${
                          prefs.dateFormat === option
                            ? "bg-bg-surface-3 text-text-primary"
                            : "text-text-tertiary hover:text-text-secondary"
                        }`}
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
