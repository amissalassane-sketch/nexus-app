"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileSummary } from "@/lib/profile";

type ProfileState = {
  display_name: string;
  username: string;
  bio: string;
};

type StatusState = {
  type: "idle" | "success" | "error";
  message: string;
};

export function UserSettingsPanel({ summary }: { summary: ProfileSummary }) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<ProfileState>({
    display_name: summary.displayName,
    username: summary.username ?? "",
    bio: summary.bio ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });

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
      .eq("id", summary.userId);

    setSaving(false);

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setStatus({ type: "success", message: "Profile updated successfully." });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Update the public profile associated with your account.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Display name</label>
            <input
              value={form.display_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, display_name: event.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-white/30"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Username</label>
            <input
              value={form.username}
              onChange={(event) =>
                setForm((current) => ({ ...current, username: event.target.value }))
              }
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
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">Workspace</h2>
        <div className="mt-6 space-y-4 text-sm text-zinc-300">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-zinc-500">Current workspace</div>
            <div className="mt-2 text-lg font-medium text-white">{summary.workspaceName}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-zinc-500">Role</div>
            <div className="mt-2 text-lg font-medium text-white capitalize">
              {summary.role ?? "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
