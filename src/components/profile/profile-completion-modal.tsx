"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserRound, ImagePlus, Loader2 } from "lucide-react";
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
          <motion.button
            type="button"
            onClick={onClose}
            disabled={saving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-white/50 border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/70 transition-colors disabled:opacity-40"
          >
            Not now
          </motion.button>
          <motion.button
            type="submit"
            form="profile-completion-form"
            disabled={saving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="inline-flex h-9 flex-1 sm:flex-none items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : null}
            {saving ? "Saving…" : "Save profile"}
          </motion.button>
        </>
      }
    >
      <form id="profile-completion-form" onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Progress indicator */}
        <div className="flex items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <UserRound size={14} strokeWidth={1.75} className="shrink-0 text-white/30" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-white/40">
            {completeness.complete
              ? "Profile complete. Ready to go."
              : `${completeness.filled} of ${completeness.total} completed${
                  missingLabel(completeness.missing) ? `. Missing ${missingLabel(completeness.missing).toLowerCase()}` : ""
                }`}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="profile-completion-name" className="text-[11.5px] font-medium text-white/50">
              Full name
            </label>
            <span className="text-[11.5px] text-white/25">required</span>
          </div>
          <input
            id="profile-completion-name"
            name="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
            className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-2.5 px-4 text-[13.5px] focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="profile-completion-username" className="text-[11.5px] font-medium text-white/50">
              Username
            </label>
            <span className="text-[11.5px] text-white/25">required</span>
          </div>
          <p className="text-[11.5px] text-white/30">
            Your NEXUS identity, not your login. 3–32 letters, numbers, dots, underscores or dashes.
          </p>
          <div className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-[1px] transition-all duration-200 focus-within:border-white/30 focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.06)]">
            <span className="pl-4 font-mono text-[11.5px] text-white/25" aria-hidden="true">
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
              className="h-[42px] w-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-completion-avatar" className="text-[11.5px] font-medium text-white/50">
            Profile photo <span className="text-white/25">· Optional</span>
          </label>
          <p className="text-[11.5px] text-white/30">
            A link to an image you host. Leave it empty and NEXUS uses your initial.
          </p>
          <div className="relative">
            <ImagePlus
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
            />
            <input
              id="profile-completion-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
              autoComplete="off"
              className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-2.5 pl-9 pr-4 text-[13.5px] focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-completion-job" className="text-[11.5px] font-medium text-white/50">
            Job title <span className="text-white/25">· Optional</span>
          </label>
          <input
            id="profile-completion-job"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="e.g. Product lead"
            autoComplete="off"
            className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-full py-2.5 px-4 text-[13.5px] focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-completion-bio" className="text-[11.5px] font-medium text-white/50">
            Bio <span className="text-white/25">· Optional · {bio.length}/500</span>
          </label>
          <textarea
            id="profile-completion-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="A short line about what you work on"
            className="w-full backdrop-blur-[1px] text-white bg-white/[0.03] border border-white/10 rounded-2xl py-2.5 px-4 text-[13.5px] focus:outline-none focus:border-white/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] transition-all duration-200 disabled:opacity-50 placeholder:text-white/25 resize-none"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-400/90 text-center" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
