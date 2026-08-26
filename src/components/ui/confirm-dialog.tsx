"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// ============================================================
// NEXUS — CONFIRM DIALOG
// The single in-app confirmation surface for destructive or
// irreversible actions (delete, clear…). Renders through the Modal
// system, so on phones it is a safe-area bottom sheet and on desktop
// a centered dialog — never the browser's native `confirm()`.
//
// The business confirmation RULE is unchanged: a destructive mutation
// still requires an explicit, unambiguous human confirmation before
// it is sent to the server. This component only replaces the chrome.
// ============================================================

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
            className="min-h-[44px] flex-1 sm:min-h-[36px] sm:flex-none"
          >
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] sm:min-h-[36px]"
          >
            {cancelLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-input border border-danger-border/60 bg-danger-bg/20 px-3.5 py-3">
        <AlertTriangle
          size={15}
          strokeWidth={1.75}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-danger"
        />
        <p className="text-small text-text-secondary">
          This action cannot be undone. Confirm that you want to continue
          before it is executed in the workspace.
        </p>
      </div>
    </Modal>
  );
}
