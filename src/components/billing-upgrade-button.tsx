"use client";

import { useState } from "react";
import type { PlanName } from "@/lib/plan-limits";

type BillingUpgradeButtonProps = {
  targetPlan: PlanName;
};

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
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={startUpgrade}
        disabled={loading}
        className="rounded-md bg-[#F2F1ED] px-3 py-1.5 text-xs font-semibold text-[#0C0C0E] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Starting..." : `Upgrade to ${targetPlan}`}
      </button>
      {message ? <p className="text-xs text-text-tertiary">{message}</p> : null}
    </div>
  );
}
