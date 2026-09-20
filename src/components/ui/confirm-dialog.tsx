"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none active:scale-[0.97] transition-transform"
          >
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] sm:min-h-[36px] active:scale-[0.97] transition-transform"
          >
            {cancelLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-input border border-danger-border/60 bg-danger-bg/20 px-3.5 py-3 animate-[intelligence-state-in_220ms_var(--ease-nexus)_both]">
        <NexusIcon
          icon={IconAlertTriangle}
          className="mt-0.5 text-danger animate-[intelligence-thinking_1.5s_var(--ease-nexus)_infinite]"
        />
        <p className="text-small text-text-secondary">
          This action cannot be undone. Confirm that you want to continue before it is executed in the workspace.
        </p>
      </div>
    </Modal>
  );
}
