"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FileText, GitBranch, MessagesSquare, Search, Webhook, type LucideIcon } from "lucide-react";
import { INTEGRATION_CATALOG, INTEGRATION_CATEGORIES, type IntegrationCategory, type IntegrationDefinition } from "@/lib/integrations/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";

const ICONS: Record<IntegrationCategory, LucideIcon> = {
  calendar: CalendarDays,
  development: GitBranch,
  communication: MessagesSquare,
  documents: FileText,
  automation: Webhook,
};

type Filter = "all" | "connected" | "available" | "coming-soon";

const STATUS_LABEL: Record<IntegrationDefinition["status"], string> = {
  "coming-soon": "Coming soon",
  "not-configured": "Not configured",
};

export function IntegrationHub() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<(typeof INTEGRATION_CATEGORIES)[number]["id"]>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return INTEGRATION_CATALOG.filter((integration) => {
      const matchesQuery = !needle || [integration.name, integration.description, integration.categoryLabel].some((value) => value.toLowerCase().includes(needle));
      const matchesCategory = category === "all" || integration.category === category;
      const matchesFilter =
        filter === "all" ||
        (filter === "connected" && false) ||
        (filter === "available" && integration.available) ||
        (filter === "coming-soon" && integration.status === "coming-soon");
      return matchesQuery && matchesCategory && matchesFilter;
    });
  }, [category, filter, query]);

  const reset = () => {
    setQuery("");
    setFilter("all");
    setCategory("all");
  };

  return (
    <div className="space-y-4">
      <Panel bodyClassName="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search integrations" aria-label="Search integrations" className="pl-8" />
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Integration availability">
            {(["all", "connected", "available", "coming-soon"] as const).map((entry) => (
              <button key={entry} type="button" role="tab" aria-selected={filter === entry} onClick={() => setFilter(entry)} className={cn("h-8 shrink-0 rounded-input px-2.5 text-caption transition-colors", filter === entry ? "bg-accent-ghost-hover text-text-primary" : "text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary")}>{entry === "coming-soon" ? "Coming soon" : entry.charAt(0).toUpperCase() + entry.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto border-t border-border-subtle pt-3" role="tablist" aria-label="Integration categories">
          {INTEGRATION_CATEGORIES.map((entry) => (
            <button key={entry.id} type="button" role="tab" aria-selected={category === entry.id} onClick={() => setCategory(entry.id)} className={cn("h-8 shrink-0 rounded-input border px-2.5 text-caption transition-colors", category === entry.id ? "border-border-strong bg-bg-surface text-text-primary" : "border-transparent text-text-tertiary hover:bg-accent-ghost hover:text-text-secondary")}>{entry.label}</button>
          ))}
        </div>
      </Panel>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState title="No matching integrations" description="Try a different search or reset the filters." action={<Button variant="secondary" size="sm" onClick={reset}>Reset filters</Button>} />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((integration) => <IntegrationCard key={integration.id} integration={integration} />)}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationDefinition }) {
  const Icon = ICONS[integration.category];
  return (
    <article className="group rounded-card border border-border-subtle bg-bg-subtle/70 p-4 transition-[border-color,background-color,transform] duration-200 ease-nexus hover:border-border-default hover:bg-bg-surface hover:-translate-y-px">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary"><Icon size={17} strokeWidth={1.75} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-h3 text-text-primary">{integration.name}</h2><p className="mt-0.5 text-caption text-text-tertiary">{integration.categoryLabel}</p></div>
            <Badge tone="neutral">{STATUS_LABEL[integration.status]}</Badge>
          </div>
          <p className="mt-3 text-small text-text-secondary">{integration.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{integration.capabilities.map((capability) => <span key={capability} className="rounded-pill border border-border-subtle px-2 py-0.5 text-caption text-text-tertiary">{capability}</span>)}</div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3"><span className="text-caption text-text-quaternary">Server connection required</span><Button size="sm" variant="secondary" disabled title="This provider is not configured in this deployment">Coming soon</Button></div>
        </div>
      </div>
    </article>
  );
}
