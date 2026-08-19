"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanName } from "@/lib/plan-limits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type BillingUpgradeButtonProps = {
  targetPlan: PlanName;
  /** Only workspace owners/admins can start an upgrade (enforced server-side too). */
  canManageBilling?: boolean;
  fullWidth?: boolean;
  label?: string;
};

export function BillingUpgradeButton({
  targetPlan,
  canManageBilling = true,
  fullWidth,
  label,
}: BillingUpgradeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "danger">("info");

  const startUpgrade = async () => {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlan }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    setLoading(false);

    if (response.status === 501 && payload?.error === "PAYMENT_PROVIDER_NOT_CONFIGURED") {
      setTone("info");
      setMessage(
        `Your workspace is ready for ${targetPlan}. Checkout opens as soon as the payment provider is connected.`
      );
      return;
    }

    if (!response.ok) {
      setTone("danger");
      setMessage(payload?.error ?? "Upgrade could not be started.");
      return;
    }

    setTone("info");
    setMessage("Upgrade started.");
    router.refresh();
  };

  return (
    <div className={cn("space-y-2", fullWidth && "w-full")}>
      <Button
        onClick={startUpgrade}
        disabled={loading || !canManageBilling}
        className={cn(fullWidth && "w-full")}
      >
        {loading ? "Starting..." : (label ?? `Upgrade to ${targetPlan}`)}
      </Button>

      {!canManageBilling ? (
        <p className="text-caption text-text-tertiary">
          Only workspace owners and admins can change the plan.
        </p>
      ) : null}

      {message ? (
        <p
          className={cn(
            "text-caption",
            tone === "danger" ? "text-danger" : "text-text-tertiary"
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
