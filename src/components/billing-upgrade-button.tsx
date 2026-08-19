"use client";

import { useState } from "react";
import type { PlanName } from "@/lib/plan-limits";

type BillingUpgradeButtonProps = {
  targetPlan: PlanName;
};

// P4: sober disabled state — transparent background, 8% border,
// tertiary text. No heavy gray blocks.
export function BillingUpgradeButton({ targetPlan }: BillingUpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const startUpgrade = async () => {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlan }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    setLoading(false);

    if (response.status === 501 && payload?.error === "PAYMENT_PROVIDER_NOT_CONFIGURED") {
      setMessage("Upgrade flow is ready. FedaPay checkout is not connected yet.");
      return;
    }

    if (!response.ok) {
      setMessage(payload?.error ?? "Upgrade could not be started.");
      return;
    }

    setMessage("Upgrade started.");
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startUpgrade}
        disabled={loading}
        className="w-full rounded-md bg-accent-primary px-3 py-2 text-button font-medium text-accent-primary-fg transition-all duration-[120ms] ease-out hover:bg-accent-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-transparent disabled:text-text-tertiary disabled:active:scale-100"
      >
        {loading ? "Starting…" : `Upgrade to ${targetPlan}`}
      </button>
      {message ? <p className="text-xs leading-4 text-text-tertiary">{message}</p> : null}
    </div>
  );
}
