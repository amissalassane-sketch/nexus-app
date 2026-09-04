"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

// ============================================================
// NEXUS — ROUTE READOUT (404)
// The not-found boundary receives no prop telling it *which*
// route was requested, so this component recovers it from the
// address bar. The readout then shows the visitor exactly what
// NEXUS analysed — the personalised core of the 404.
//
// The route cannot change while this page is mounted (any
// navigation unmounts it), so the subscription is a no-op and
// reading through `useSyncExternalStore` (rather than useState
// + effect) keeps the server render and the first client render
// in agreement — the same pattern as the intelligence stage
// capability probe. With JS disabled the placeholder simply
// stays, and nothing on the page depends on it.
// ============================================================

const subscribe = (): (() => void) => () => {};
const getSnapshot = (): string => {
  const { pathname, search } = window.location;
  return pathname + (search || "");
};
const getServerSnapshot = (): string => "—";

export function RouteReadout() {
  const route = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const rows: Array<{ label: string; value: ReactNode }> = [
    {
      label: "Route",
      value: <span className="break-all text-text-primary">{route}</span>,
    },
    {
      label: "Signals",
      value: <span className="text-text-secondary">0 detected</span>,
    },
    {
      label: "Evidence",
      value: <span className="text-text-secondary">none found</span>,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-input border border-border-default bg-bg-surface/70 text-left">
      {/* Severity rail — the same 2px spine the signal cards carry. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[2px] bg-danger/70"
      />

      <div className="border-b border-border-subtle px-4 py-2.5 pl-5">
        <p className="eyebrow text-text-quaternary">Route intelligence</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 px-4 py-3.5 pl-5 font-mono text-mono sm:gap-x-8">
        {rows.map((row) => (
          <div key={row.label} className="col-span-2 grid grid-cols-subgrid">
            <dt className="uppercase tracking-[0.06em] text-text-quaternary">
              {row.label}
            </dt>
            <dd className="min-w-0">{row.value}</dd>
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-subgrid items-center">
          <dt className="uppercase tracking-[0.06em] text-text-quaternary">
            Verdict
          </dt>
          <dd>
            <Badge tone="danger">No signal</Badge>
          </dd>
        </div>
      </dl>
    </div>
  );
}
