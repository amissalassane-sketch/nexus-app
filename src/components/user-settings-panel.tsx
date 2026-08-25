"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  KeyRound,
  Layers,
  LogOut,
  Mail,
  Radar,
  ShieldAlert,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership, canManageBilling } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert, Progress, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import {
  computeProfileCompleteness,
  isValidUsername,
  missingLabel,
} from "@/lib/profile-state";
import { isMissingColumnError } from "@/lib/schema-errors";

type ProfileState = {
  display_name: string;
  username: string;
  bio: string;
  job_title: string;
  avatar_url: string;
};

/**
 * Client wrapper used by the settings page: reads the `?tab=` param so the
 * account menu can deep-link to the exact section it named (Profile,
 * Security, Workspace, Intelligence).
 */
export function SettingsTabLoader({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const initialTab: TabId = (
    ["profile", "account", "workspace", "intelligence"] as const
  ).includes(requested as TabId)
    ? (requested as TabId)
    : "profile";

  return <UserSettingsPanel userId={userId} initialTab={initialTab} />;
}

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

type TabId = "profile" | "account" | "workspace" | "intelligence";

const SECTIONS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <User size={15} strokeWidth={1.75} /> },
  { id: "account", label: "Account", icon: <KeyRound size={15} strokeWidth={1.75} /> },
  { id: "workspace", label: "Workspace", icon: <Layers size={15} strokeWidth={1.75} /> },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: <Radar size={15} strokeWidth={1.75} />,
  },
];

export function UserSettingsPanel({
  userId,
  initialTab = "profile",
}: {
  userId: string;
  /** Section to open first — deep-linked from the account menu. */
  initialTab?: TabId;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ProfileState>({
    display_name: "",
    username: "",
    bio: "",
    job_title: "",
    avatar_url: "",
  });
  const [workspaceName, setWorkspaceName] = useState<string>("Not linked");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<string>("-");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });
  const [workspaceStatus, setWorkspaceStatus] = useState<StatusState>({ type: "idle", message: "" });
  const [tab, setTab] = useState<TabId>(initialTab);

  // Account-menu deep links change ?tab= while the page stays mounted.
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const loadProfile = async () => {
      // Hosted projects that have not applied migration 020 yet lack the
      // `job_title` column — retry on the base columns instead of bricking
      // the page with a raw Postgres error.
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, username, bio, job_title, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (profileError && isMissingColumnError(profileError.message, "job_title")) {
        ({ data: profileData } = await supabase
          .from("profiles")
          .select("display_name, username, bio, avatar_url")
          .eq("id", userId)
          .maybeSingle());
        profileError = null;
      }

      if (profileError) {
        setStatus({
          type: "error",
          message:
            "Your profile could not be loaded. Please try again shortly.",
        });
        setLoading(false);
        return;
      }

      if (profileData) {
        setForm({
          display_name: profileData.display_name ?? "",
          username: profileData.username ?? "",
          bio: profileData.bio ?? "",
          job_title: (profileData as { job_title?: string | null }).job_title ?? "",
          avatar_url: profileData.avatar_url ?? "",
        });
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);

      const { membership } = await getActiveMembership(supabase, userId);

      if (membership) {
        setWorkspaceRole(membership.role);
        setWorkspaceId(membership.workspaceId);

        const { data: workspaceData, error: workspaceError } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", membership.workspaceId)
          .maybeSingle();

        if (!workspaceError && workspaceData) {
          setWorkspaceName(workspaceData.name ?? "Workspace");
        }
      }

      setLoading(false);
    };

    void loadProfile().catch((cause: unknown) => {
      setStatus({
        type: "error",
        message:
          cause instanceof Error
            ? `Could not load your profile: ${cause.message}`
            : "Could not load your profile.",
      });
      setLoading(false);
    });
  }, [supabase, userId]);

  const validate = () => {
    const displayName = form.display_name.trim();
    const username = form.username.trim();
    const bio = form.bio.trim();
    const jobTitle = form.job_title.trim();
    const avatarUrl = form.avatar_url.trim();

    // Profile fields are OPTIONAL (access-first): no field is required to
    // save. We only reject values that are present but malformed.
    if (displayName.length > 120) {
      return "Your name must be 120 characters or fewer.";
    }

    if (username && !isValidUsername(username)) {
      return "Username must be 3-32 characters and may only contain letters, numbers, dots, underscores, and dashes.";
    }

    if (jobTitle.length > 120) {
      return "Job title must be 120 characters or fewer.";
    }

    if (avatarUrl && !/^(https?:\/\/[^\s]+\.[^\s]+|data:image\/[a-z+]+;base64,[^\s]+)$/i.test(avatarUrl)) {
      return "Profile photo must be a valid image link.";
    }

    if (bio.length > 500) {
      return "Bio must be 500 characters or fewer.";
    }

    return "";
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setStatus({ type: "error", message: validationError });
      return;
    }

    setSaving(true);
    setStatus({ type: "idle", message: "" });

    const basePayload = {
      id: userId,
      display_name: form.display_name.trim() || null,
      username: form.username.trim() || null,
      bio: form.bio.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const payload = {
      ...basePayload,
      job_title: form.job_title.trim() || null,
    };

    // `update()` alone reports success even when it matched 0 rows (missing
    // profile row, or a row hidden by RLS), so the UI claimed "saved" while
    // nothing was persisted. `upsert(...).select()` writes the row and returns
    // it, which lets us verify the write actually happened.
    let { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, display_name, username, bio")
      .maybeSingle();

    // Hosted project without migration 020: retry without job_title.
    if (error && isMissingColumnError(error.message, "job_title")) {
      ({ data, error } = await supabase
        .from("profiles")
        .upsert(basePayload, { onConflict: "id" })
        .select("id, display_name, username, bio")
        .maybeSingle());
    }

    setSaving(false);

    if (error) {
      setStatus({
        type: "error",
        message:
          "Your profile could not be saved. Please try again shortly.",
      });
      return;
    }

    if (!data) {
      setStatus({
        type: "error",
        message:
          "Profile could not be saved. Your account may not have permission to update this profile.",
      });
      return;
    }

    setForm((current) => ({
      display_name: data.display_name ?? "",
      username: data.username ?? "",
      bio: data.bio ?? "",
      job_title: current.job_title,
      avatar_url: current.avatar_url,
    }));

    setStatus({ type: "success", message: "Profile updated successfully." });
    router.refresh();
  };

  const handleRenameWorkspace = async () => {
    if (!workspaceId) {
      setWorkspaceStatus({ type: "error", message: "No active workspace." });
      return;
    }
    if (!canManageBilling(workspaceRole)) {
      setWorkspaceStatus({
        type: "error",
        message: "Only owners and admins can rename this workspace.",
      });
      return;
    }

    const name = workspaceName.trim();
    if (!name) {
      setWorkspaceStatus({ type: "error", message: "Workspace name is required." });
      return;
    }

    setSavingWorkspace(true);
    setWorkspaceStatus({ type: "idle", message: "" });

    const { error } = await supabase
      .from("workspaces")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", workspaceId);

    setSavingWorkspace(false);

    if (error) {
      setWorkspaceStatus({ type: "error", message: error.message });
      return;
    }

    setWorkspaceStatus({ type: "success", message: "Workspace renamed." });
    router.refresh();
  };

  const handleSignOutEverywhere = async () => {
    setStatus({ type: "idle", message: "" });
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Fall back to local sign-out if the global scope is unavailable.
      await supabase.auth.signOut();
    }
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Your profile, this workspace, and what NEXUS is allowed to read."
      />

      <div className="grid gap-5 lg:grid-cols-[188px_minmax(0,1fr)]">
        {/* Desktop: a settings sidebar. Mobile: a scrollable row. */}
        <nav
          aria-label="Settings sections"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setTab(section.id)}
              aria-current={tab === section.id ? "page" : undefined}
              className={cn(
                "flex h-8 shrink-0 items-center gap-2.5 rounded-nav border px-2.5 text-[13px] transition-colors duration-150 ease-nexus",
                tab === section.id
                  ? "border-border-subtle bg-accent-ghost-hover font-medium text-text-primary"
                  : "border-transparent text-text-secondary hover:bg-accent-ghost hover:text-text-primary"
              )}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
      {tab === "profile" ? (
        <Card className="p-6">
          <h2 className="text-h2 text-text-primary">Profile</h2>
          <p className="mt-1 text-small text-text-secondary">
            Your NEXUS identity. Everything here is optional — your email is
            your login, and none of these fields ever gate access to NEXUS.
          </p>

          {loading ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {/* Completeness indicator — helpful only, never a gate. */}
              {(() => {
                const completeness = computeProfileCompleteness(
                  form.display_name,
                  form.username,
                  form.avatar_url
                );
                return (
                  <div className="rounded-input border border-border-subtle bg-bg-surface/60 px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-caption font-medium text-text-secondary">
                        Profile
                      </span>
                      <span className="text-caption text-text-tertiary">
                        {completeness.complete
                          ? "Complete"
                          : `${completeness.filled} of ${completeness.total} completed`}
                      </span>
                    </div>
                    <Progress
                      value={completeness.percent}
                      label="Profile completeness"
                      tone={completeness.complete ? "success" : "lavender"}
                      className="mt-2"
                    />
                    {!completeness.complete ? (
                      <p className="mt-1.5 text-caption text-text-quaternary">
                        Missing: {missingLabel(completeness.missing)}
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              <Field label="Full name" htmlFor="settings-display-name">
                <Input
                  id="settings-display-name"
                  value={form.display_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }))
                  }
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </Field>

              <Field
                label="Username"
                htmlFor="settings-username"
                hint="Your NEXUS identity — not your login. 3-32 characters."
              >
                <Input
                  id="settings-username"
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="janedoe"
                  autoComplete="off"
                />
              </Field>

              <Field
                label="Profile photo"
                htmlFor="settings-avatar"
                hint="Optional — a link to an image you host."
              >
                <Input
                  id="settings-avatar"
                  value={form.avatar_url}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      avatar_url: event.target.value,
                    }))
                  }
                  placeholder="https://…"
                  autoComplete="off"
                />
              </Field>

              <Field label="Job title" htmlFor="settings-job-title" hint="Optional">
                <Input
                  id="settings-job-title"
                  value={form.job_title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      job_title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Product lead"
                  autoComplete="off"
                />
              </Field>

              <Field
                label="Bio"
                htmlFor="settings-bio"
                hint={`Optional · ${form.bio.length}/500`}
              >
                <Textarea
                  id="settings-bio"
                  value={form.bio}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bio: event.target.value }))
                  }
                  rows={5}
                  placeholder="Write a short bio"
                />
              </Field>

              {status.type !== "idle" ? (
                <Alert tone={status.type === "success" ? "success" : "danger"}>
                  {status.message}
                </Alert>
              ) : null}

              <Button onClick={handleSave} loading={saving}>
                Save changes
              </Button>
            </div>
          )}
        </Card>
      ) : tab === "account" ? (
        <div className="grid gap-4">
          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">Email</h2>
            <p className="mt-1 text-small text-text-secondary">
              The address used to sign in to NEXUS.
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-row bg-bg-surface px-3.5 py-2.5">
              <span className="flex items-center gap-2.5 text-body text-text-primary">
                <Mail size={15} strokeWidth={1.75} className="text-text-tertiary" />
                {loading ? "…" : email || "Not available"}
              </span>
              <span className="eyebrow text-text-quaternary">
                Managed by your auth provider
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">Sessions</h2>
            <p className="mt-1 text-small text-text-secondary">
              Sign out of every device at once.
            </p>
            <div className="mt-5">
              <Button variant="secondary" onClick={handleSignOutEverywhere}>
                <LogOut size={15} strokeWidth={1.75} />
                Sign out everywhere
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-tertiary" />
              <div>
                <h2 className="text-h2 text-text-primary">Danger zone</h2>
                <p className="mt-1 max-w-[58ch] text-small text-text-secondary">
                  Password changes and account deletion are handled by the auth
                  service and are not exposed here yet. Nothing is simulated in this
                  interface: when the capability exists, the control appears.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : tab === "intelligence" ? (
        <div className="grid gap-4">
          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">What NEXUS reads</h2>
            <p className="mt-1 max-w-[60ch] text-small text-text-secondary">
              NEXUS derives every signal from the work already stored in this
              workspace. It runs on your data, in your session — nothing is sent
              to an external model provider.
            </p>

            <ul className="mt-5 flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
              {[
                ["Tasks", "Status, priority, due dates and completion times"],
                ["Projects", "Status, deadlines, progress and recent changes"],
                ["Goals", "Progress and target dates"],
                ["Activity", "The workspace event log written by the database"],
              ].map(([source, detail]) => (
                <li
                  key={source}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span className="text-body text-text-primary">{source}</span>
                  <span className="max-w-[52%] text-right text-caption text-text-tertiary">
                    {detail}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-caption text-text-tertiary">
              Access is enforced by row-level security in Postgres: NEXUS can only
              read rows this account is already allowed to read.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">Signal thresholds</h2>
            <p className="mt-1 max-w-[60ch] text-small text-text-secondary">
              The rules NEXUS applies when deciding what is worth surfacing.
              These are deterministic — the same workspace always produces the
              same signals.
            </p>

            <dl className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {[
                ["Deadline pressure", "Project due within 7 days with open tasks"],
                ["Drifting", "No change in a project for 10+ days"],
                ["Goal at risk", "Under 80% with 14 days or less remaining"],
                ["Unscheduled", "Over 60% of open tasks without a date"],
              ].map(([rule, threshold]) => (
                <div
                  key={rule}
                  className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2"
                >
                  <dt className="text-caption text-text-secondary">{rule}</dt>
                  <dd className="shrink-0 text-right font-mono text-mono text-text-tertiary">
                    {threshold}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5">
              <Link
                href="/app/intelligence"
                className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary"
              >
                Open Intelligence
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">Workspace</h2>
            <p className="mt-1 text-small text-text-secondary">
              The workspace this account is currently working in.
            </p>

            <dl className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-row bg-bg-surface px-3.5 py-2.5">
                <dt className="text-small text-text-secondary">Role</dt>
                <dd>
                  <Badge>{loading ? "…" : workspaceRole}</Badge>
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-border-subtle pt-5">
              <Field
                label="Workspace name"
                htmlFor="settings-workspace-name"
                hint={
                  canManageBilling(workspaceRole)
                    ? "Only owners and admins can rename the workspace."
                    : "You need the owner or admin role to rename this workspace."
                }
              >
                <Input
                  id="settings-workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  disabled={!canManageBilling(workspaceRole)}
                  placeholder="My Workspace"
                />
              </Field>

              {workspaceStatus.type !== "idle" ? (
                <Alert
                  className="mt-3"
                  tone={workspaceStatus.type === "success" ? "success" : "danger"}
                >
                  {workspaceStatus.message}
                </Alert>
              ) : null}

              <div className="mt-4">
                <Button
                  onClick={handleRenameWorkspace}
                  loading={savingWorkspace}
                  disabled={!canManageBilling(workspaceRole)}
                >
                  Rename workspace
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-h2 text-text-primary">Plan &amp; billing</h2>
                <p className="mt-1 text-small text-text-secondary">
                  Review usage against your plan limits and upgrade when you need more
                  capacity.
                </p>
              </div>
              <CreditCard
                size={18}
                strokeWidth={1.75}
                className="shrink-0 text-text-tertiary"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/settings/billing"
                className="inline-flex h-9 items-center rounded-input border border-border-default px-3.5 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:border-border-strong hover:bg-accent-ghost hover:text-text-primary"
              >
                Usage &amp; billing
              </Link>
              <Link
                href="/upgrade"
                className="inline-flex h-9 items-center rounded-input bg-accent px-3.5 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
              >
                Compare plans
              </Link>
            </div>
          </Card>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
