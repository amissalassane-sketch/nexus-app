"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Layers, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { PillTabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type ProfileState = {
  display_name: string;
  username: string;
  bio: string;
};

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

type TabId = "profile" | "workspace";

export function UserSettingsPanel({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ProfileState>({
    display_name: "",
    username: "",
    bio: "",
  });
  const [workspaceName, setWorkspaceName] = useState<string>("Not linked");
  const [workspaceRole, setWorkspaceRole] = useState<string>("-");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });
  const [tab, setTab] = useState<TabId>("profile");

  useEffect(() => {
    const loadProfile = async () => {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, username, bio")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        setStatus({ type: "error", message: profileError.message });
        setLoading(false);
        return;
      }

      if (profileData) {
        setForm({
          display_name: profileData.display_name ?? "",
          username: profileData.username ?? "",
          bio: profileData.bio ?? "",
        });
      }

      const { membership } = await getActiveMembership(supabase, userId);

      if (membership) {
        setWorkspaceRole(membership.role);

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

    void loadProfile();
  }, [supabase, userId]);

  const validate = () => {
    const displayName = form.display_name.trim();
    const username = form.username.trim();
    const bio = form.bio.trim();

    if (!displayName) {
      return "Display name is required.";
    }

    if (username && !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return "Username must be 3-32 characters and may only contain letters, numbers, dots, underscores, and dashes.";
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

    // `update()` alone reports success even when it matched 0 rows (missing
    // profile row, or a row hidden by RLS), so the UI claimed "saved" while
    // nothing was persisted. `upsert(...).select()` writes the row and returns
    // it, which lets us verify the write actually happened.
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: form.display_name.trim(),
          username: form.username.trim() || null,
          bio: form.bio.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id, display_name, username, bio")
      .maybeSingle();

    setSaving(false);

    if (error) {
      setStatus({ type: "error", message: error.message });
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

    setForm({
      display_name: data.display_name ?? "",
      username: data.username ?? "",
      bio: data.bio ?? "",
    });

    setStatus({ type: "success", message: "Profile updated successfully." });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Customize your workspace and preferences."
      />

      <PillTabs
        label="Settings sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: "profile", label: "Profile", icon: <User size={15} strokeWidth={1.75} /> },
          {
            id: "workspace",
            label: "Workspace",
            icon: <Layers size={15} strokeWidth={1.75} />,
          },
        ]}
      />

      {tab === "profile" ? (
        <Card className="max-w-2xl p-6">
          <h2 className="text-h2 text-text-primary">Profile</h2>
          <p className="mt-1 text-small text-text-secondary">
            Update the public profile associated with your account.
          </p>

          {loading ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <Field label="Display name" htmlFor="settings-display-name">
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
                />
              </Field>

              <Field label="Username" htmlFor="settings-username">
                <Input
                  id="settings-username"
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="janedoe"
                />
              </Field>

              <Field
                label="Bio"
                htmlFor="settings-bio"
                hint={`${form.bio.length}/500`}
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

              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid max-w-2xl gap-4">
          <Card className="p-6">
            <h2 className="text-h2 text-text-primary">Workspace</h2>
            <p className="mt-1 text-small text-text-secondary">
              The workspace this account is currently working in.
            </p>

            <dl className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-row bg-bg-surface px-3.5 py-2.5">
                <dt className="text-small text-text-secondary">Current workspace</dt>
                <dd className="truncate text-body-medium text-text-primary">
                  {loading ? "…" : workspaceName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-row bg-bg-surface px-3.5 py-2.5">
                <dt className="text-small text-text-secondary">Role</dt>
                <dd>
                  <Badge>{loading ? "…" : workspaceRole}</Badge>
                </dd>
              </div>
            </dl>
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
                className="inline-flex h-9 items-center rounded-pill border border-border-default px-4 text-button text-text-secondary transition-colors duration-150 ease-nexus hover:bg-accent-ghost hover:text-text-primary"
              >
                Usage &amp; billing
              </Link>
              <Link
                href="/upgrade"
                className="inline-flex h-9 items-center rounded-pill bg-accent px-4 text-button font-medium text-accent-fg transition-colors duration-150 ease-nexus hover:bg-accent-hover"
              >
                Compare plans
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
