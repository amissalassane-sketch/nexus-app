"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPhotoPlus, IconUser } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { computeProfileCompleteness, isValidUsername, missingLabel } from "@/lib/profile-state";

/**
 * Profile completion modal — optional first-time identity setup.
 *
 * Rules:
 *   - never blocks the dashboard; "Not now" is a first-class path;
 *   - at least name AND username are collected here;
 *   - photo / job title / bio are optional;
 *   - the server (/api/profile) is the source of truth.
 *
 * VISUAL: Matches the NEXUS dark translucent aesthetic — consistent
 * with the auth visual system and the rest of the product.
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
      open
      onClose={onClose}
      title="Complete your profile"
      description="Add your name and username so your NEXUS workspace can recognise you. You can always change these later in Settings."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Not now
          </Button>
          <Button
            type="submit"
            form="profile-completion-form"
            variant="primary"
            loading={saving}
            className="flex-1 sm:flex-none"
          >
            Save profile
          </Button>
        </>
      }
    >
      <form id="profile-completion-form" onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Progress indicator */}
        <div className="flex items-center gap-2.5 rounded-surface border border-border-subtle bg-bg-surface-2 px-3 py-2">
          <NexusIcon icon={IconUser} px={14} className="text-text-tertiary" />
          <p className="min-w-0 flex-1 truncate text-caption text-text-secondary">
            {completeness.complete
              ? "Profile complete. Ready to go."
              : `${completeness.filled} of ${completeness.total} completed${
                  missingLabel(completeness.missing) ? `. Missing ${missingLabel(completeness.missing).toLowerCase()}` : ""
                }`}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="profile-completion-name" className="text-caption font-medium text-text-secondary">
              Full name
            </label>
            <span className="text-caption text-text-tertiary">required</span>
          </div>
          <input
            id="profile-completion-name"
            name="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
            className="h-10 w-full rounded-control border border-border-subtle bg-bg-surface-2 px-3 text-body text-text-primary transition-colors duration-[120ms] hover:border-border-strong focus-visible:border-focus focus-visible:outline-none disabled:opacity-50 placeholder:text-text-tertiary"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="profile-completion-username" className="text-caption font-medium text-text-secondary">
              Username
            </label>
            <span className="text-caption text-text-tertiary">required</span>
          </div>
          <p className="text-caption text-text-tertiary">
            Your NEXUS identity, not your login. 3–32 letters, numbers, dots, underscores or dashes.
          </p>
          <div className="flex h-10 items-center overflow-hidden rounded-control border border-border-subtle bg-bg-surface-2 transition-colors duration-[120ms] focus-within:border-focus">
            <span className="pl-3 mono-meta text-text-tertiary" aria-hidden="true">
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
              className="h-10 w-full min-w-0 flex-1 bg-transparent px-2 text-body text-text-primary placeholder:text-text-tertiary focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-completion-avatar" className="text-caption font-medium text-text-secondary">
            Profile photo <span className="text-text-tertiary">· Optional</span>
          </label>
          <p className="text-caption text-text-tertiary">
            A link to an image you host. Leave it empty and NEXUS uses your initial.
          </p>
          <div className="relative">
            <NexusIcon
              icon={IconPhotoPlus}
              px={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              id="profile-completion-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
              autoComplete="off"
              className="h-10 w-full rounded-control border border-border-subtle bg-bg-surface-2 pl-9 pr-3 text-body text-text-primary transition-colors duration-[120ms] hover:border-border-strong focus-visible:border-focus focus-visible:outline-none disabled:opacity-50 placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-completion-job" className="text-caption font-medium text-text-secondary">
            Job title <span className="text-text-tertiary">· Optional</span>
          </label>
          <input
            id="profile-completion-job"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="e.g. Product lead"
            autoComplete="off"
            className="h-10 w-full rounded-control border border-border-subtle bg-bg-surface-2 px-3 text-body text-text-primary transition-colors duration-[120ms] hover:border-border-strong focus-visible:border-focus focus-visible:outline-none disabled:opacity-50 placeholder:text-text-tertiary"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-completion-bio" className="text-caption font-medium text-text-secondary">
            Bio <span className="text-text-tertiary">· Optional · {bio.length}/500</span>
          </label>
          <textarea
            id="profile-completion-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="A short line about what you work on"
            className="w-full resize-none rounded-surface border border-border-subtle bg-bg-surface-2 px-3 py-2.5 text-body text-text-primary transition-colors duration-[120ms] hover:border-border-strong focus-visible:border-focus focus-visible:outline-none disabled:opacity-50 placeholder:text-text-tertiary"
          />
        </div>

        {error ? (
          <p className="text-center text-small text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
