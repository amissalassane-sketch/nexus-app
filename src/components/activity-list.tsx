import {
  CheckCircle2,
  CircleDot,
  FolderKanban,
  PenLine,
  Plus,
  Radar,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/feedback";

// ============================================================
// NEXUS — ACTIVITY
// Real workspace events, written by database triggers. Human actions and
// NEXUS observations are visually distinct: the intelligence layer gets
// the lavender accent, people get the neutral ramp.
// ============================================================

export type ActivityRow = {
  id: string;
  entity_type: string | null;
  action: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_id?: string | null;
  /** Resolved display name, when the actor's profile is readable. */
  actor?: string | null;
};

const ACTION_ICON: Record<string, LucideIcon> = {
  created: Plus,
  updated: PenLine,
  completed: CheckCircle2,
  deleted: Trash2,
};

const ENTITY_ICON: Record<string, LucideIcon> = {
  project: FolderKanban,
  goal: Target,
  task: CircleDot,
  intelligence: Radar,
};

function iconFor(activity: ActivityRow): LucideIcon {
  const action = (activity.action ?? "").toLowerCase();
  if (ACTION_ICON[action]) return ACTION_ICON[action];
  return ENTITY_ICON[(activity.entity_type ?? "").toLowerCase()] ?? CircleDot;
}

function labelFor(activity: ActivityRow): string {
  const metadata = activity.metadata ?? {};
  if (typeof metadata.title === "string") return metadata.title;
  if (typeof metadata.name === "string") return metadata.name;
  return activity.entity_type ?? "item";
}

/**
 * When the actor is unknown (their profile is not readable under RLS) the
 * sentence switches to the passive voice rather than inventing a name.
 */
function sentenceFor(activity: ActivityRow, passive = false): string {
  const action = (activity.action ?? "changed").toLowerCase();
  const entity = (activity.entity_type ?? "item").toLowerCase();
  const verb =
    action === "created"
      ? "created"
      : action === "completed"
        ? "completed"
        : action === "deleted"
          ? "deleted"
          : "updated";
  return passive ? `${capitalize(entity)} ${verb}:` : `${verb} ${entity}`;
}

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function ActivityList({
  activities,
  unavailable = false,
  compact = false,
  className,
}: {
  activities: ActivityRow[];
  unavailable?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (unavailable) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-small text-text-secondary">
          The workspace activity log could not be read.
        </p>
        <p className="mt-1 text-caption text-text-tertiary">
          Activity is written by the database. Once it is reachable, events
          appear here automatically.
        </p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn(compact ? "p-4" : "p-0", className)}>
        <EmptyState
          title="No activity yet"
          description="Every change to a project, task or goal is recorded here, so you can see what moved without asking anyone."
          icon={<CircleDot size={17} strokeWidth={1.75} />}
        />
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col", className)}>
      {activities.map((activity, index) => {
        const Icon = iconFor(activity);
        const isIntelligence =
          (activity.entity_type ?? "").toLowerCase() === "intelligence";

        return (
          <li
            key={activity.id}
            className="stagger-item flex items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0"
            style={{ animationDelay: `${Math.min(index, 8) * 20}ms` }}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border",
                isIntelligence
                  ? "border-lavender-border bg-lavender-subtle text-lavender"
                  : "border-border-subtle bg-bg-surface text-text-tertiary"
              )}
            >
              <Icon size={12} strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-text-secondary">
                {isIntelligence ? (
                  <span className="font-medium text-lavender">NEXUS</span>
                ) : activity.actor ? (
                  <span className="font-medium text-text-primary">
                    {activity.actor}
                  </span>
                ) : null}
                {isIntelligence || activity.actor ? " " : ""}
                <span>{sentenceFor(activity, !isIntelligence && !activity.actor)}</span>{" "}
                <span className="text-text-primary">{labelFor(activity)}</span>
              </p>
              <p className="eyebrow mt-1 text-text-quaternary">
                {relativeTime(activity.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
