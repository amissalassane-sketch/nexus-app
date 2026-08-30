"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, ImagePlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { computeProfileCompleteness, isValidUsername, missingLabel } from "@/lib/profile-state";

// ============================================================
// NEXUS — PROFILE COMPLETION MODAL (OPTIONAL)
// The lightweight first-time experience for finishing identity:
// full name, username and an optional photo (plus job title / bio).
//
// Rules that make this safe to show:
//   - never blocks the dashboard; "Not now" is a first-class path;
//   - at least name AND username are collected here, which is exactly
//     what flips profile_complete (see lib/profile-state);
//   - photo / job title / bio are optional and can be added later in
//     Settings → Profile;
//   - the server (/api/profile) is the source of truth for validation
//     and persistence; no raw Supabase message ever reaches the UI.
// ============================================================

/**
 * The form is mounted only while the modal is open, so its state is
 * initialized fresh from the props every time the user opens it — no
 * effect needed to re-prefill.
 */
export function ProfileCompletionModal({
  open,
  onClose,
  initialName,
  initialUsername,
}: {
  open: boolean;
  onClose: () => void;
  initialName: string | null;
  initialUsername?: string;
}) {
  if (!open) return null;
  return (
    <ProfileCompletionForm
      onClose={onClose}
      initialName={initialName}
      initialUsername={initialUsername}
    />
  );
}

function ProfileCompletionForm({
  onClose,
  initialName,
  initialUsername,
}: {
  onClose: () => void;
  initialName: string | null;
  initialUsername?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const completeness = computeProfileCompleteness(displayName, username, avatarUrl);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const name = displayName.trim();
    const handle = username.trim().toLowerCase();

    if (!name) {
      setError("Add your name so NEXUS can recognise you.");
      return;
    }
    if (name.length > 120) {
      setError("Your name must be 120 characters or fewer.");
      return;
    }
    if (!handle) {
      setError("Add a username. It is your NEXUS identity, not your login.");
      return;
    }
    if (!isValidUsername(handle)) {
      setError(
        "Usernames are 3–32 characters: letters, numbers, dots, underscores and dashes."
      );
      return;
    }
    if (avatarUrl.trim() && !/^(https?:\/\/[^\s]+\.[^\s]+|data:image\/[a-z+]+;base64,[^\s]+)$/i.test(avatarUrl.trim())) {
      setError("Profile photo must be a valid image link.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          username: handle,
          avatarUrl: avatarUrl.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(
          payload?.error ??
            "Your profile could not be saved. Please try again shortly."
        );
        return;
      }

      toast("success", "Profile updated", {
        description: "NEXUS now knows who you are.",
      });
      window.dispatchEvent(
        new CustomEvent("nexus:activation", {
          detail: { type: "profile_completed" },
        })
      );
      onClose();
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      // The form only mounts while the modal is open (see the wrapper),
      // so this is always true here.
      open
      onClose={onClose}
      title="Complete your profile"
      description="Add your name and username so your NEXUS workspace can recognise you. You can always change these later in Settings."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Not now
          </Button>
          <Button type="submit" form="profile-completion-form" loading={saving} className="flex-1 sm:flex-none">
            Save profile
          </Button>
        </>
      }
    >
      <form id="profile-completion-form" onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Progress indicator — helpful only, never a gate. */}
        <div className="flex items-center gap-2.5 rounded-input border border-border-subtle bg-bg-subtle/60 px-3 py-2">
          <UserRound size={14} strokeWidth={1.75} className="shrink-0 text-text-tertiary" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-caption text-text-secondary">
            {completeness.complete
              ? "Profile complete. Ready to go."
              : `${completeness.filled} of ${completeness.total} completed${
                  missingLabel(completeness.missing) ? `. Missing ${missingLabel(completeness.missing).toLowerCase()}` : ""
                }`}
          </p>
        </div>

        <Field label="Full name" htmlFor="profile-completion-name" action={<span className="text-caption text-text-quaternary">required</span>}>
          <Input
            id="profile-completion-name"
            name="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </Field>

        <Field
          label="Username"
          htmlFor="profile-completion-username"
          hint="Your NEXUS identity, not your login. 3–32 letters, numbers, dots, underscores or dashes."
          action={<span className="text-caption text-text-quaternary">required</span>}
        >
          <div className="flex items-center overflow-hidden rounded-input border border-border-default bg-bg-surface transition-colors duration-150 ease-nexus focus-within:border-border-focus focus-within:shadow-[0_0_0_3px_rgba(233,228,255,0.14)]">
            <span className="pl-3 font-mono text-mono text-text-quaternary" aria-hidden="true">
              @
            </span>
            <input
              id="profile-completion-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              required
              className="h-10 w-full min-w-0 flex-1 bg-transparent px-2 text-body text-text-primary placeholder:text-text-quaternary focus:outline-none"
            />
          </div>
        </Field>

        <Field
          label="Profile photo"
          htmlFor="profile-completion-avatar"
          hint="Optional. A link to an image you host. Leave it empty and NEXUS uses your initial."
        >
          <div className="relative">
            <ImagePlus
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-quaternary"
            />
            <Input
              id="profile-completion-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
              autoComplete="off"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Job title" htmlFor="profile-completion-job" hint="Optional">
          <Input
            id="profile-completion-job"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="e.g. Product lead"
            autoComplete="off"
          />
        </Field>

        <Field label="Bio" htmlFor="profile-completion-bio" hint={`Optional · ${bio.length}/500`}>
          <Textarea
            id="profile-completion-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="A short line about what you work on"
          />
        </Field>

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Modal>
  );
}
