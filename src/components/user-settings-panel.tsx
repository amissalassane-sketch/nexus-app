"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileState = {
  display_name: string;
  username: string;
  bio: string;
};

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

export function UserSettingsPanel({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ProfileState>({ display_name: "", username: "", bio: "" });
  const [workspaceName, setWorkspaceName] = useState<string>("Not linked");
  const [workspaceRole, setWorkspaceRole] = useState<string>("-");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });

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

      const { data: membershipData, error: membershipError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!membershipError && membershipData && membershipData[0]) {
        const workspaceId = membershipData[0].workspace_id;
        setWorkspaceRole(membershipData[0].role ?? "member");

        const { data: workspaceData, error: workspaceError } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", workspaceId)
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

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim(),
        username: form.username.trim() || null,
        bio: form.bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setStatus({ type: "success", message: "Profile updated successfully." });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-zinc-500">Update the public profile associated with your account.</p>

        {loading ? (
          <div className="mt-6 text-sm text-zinc-500">Loading profile...</div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Display name</label>
              <input
                value={form.display_name}
                onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">Username</label>
              <input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                placeholder="janedoe"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">Bio</label>
              <textarea
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
                placeholder="Write a short bio"
              />
            </div>

            {status.type !== "idle" ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  status.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                    : "border-red-500/30 bg-red-500/5 text-red-300"
                }`}
              >
                {status.message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">Workspace</h2>
        <div className="mt-6 space-y-4 text-sm text-zinc-300">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-zinc-500">Current workspace</div>
            <div className="mt-2 text-lg font-medium text-white">{workspaceName}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-zinc-500">Role</div>
            <div className="mt-2 text-lg font-medium text-white">{workspaceRole}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
