"use client";
import { localDateTimeToUtc } from "@/lib/global/timezone";

// ============================================================
// NEXUS — CALENDAR MANAGER
// ============================================================
// The internal time layer: today / week / agenda views, event
// create-edit-delete, conflict detection and free-slot discovery.
// The Google Calendar integration extends this view with external
// events (referenced, never copied); this component owns NEXUS
// time first so the product works without any provider.

import { useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { createClient } from "@/lib/supabase/client";
import { getActiveMembership } from "@/lib/workspace";
import { cn } from "@/lib/cn";
import { useDataError } from "@/hooks/use-data-error";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/ui/create-button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { PillTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

type Event = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  project_id: string | null;
  task_id: string | null;
};

type ProjectOption = { id: string; name: string };

type View = "today" | "week" | "agenda";

type EventForm = {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location: string;
  project_id: string;
};
const blankForm = (): EventForm => ({
  title: "",
  description: "",
  start_at: "",
  end_at: "",
  location: "",
  project_id: "",
});

/** Calendar arithmetic must preserve local civil days across DST. */
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const formatDay = (date: Date) =>
  new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "2-digit" }).format(date);

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

const formatRange = (start: string, end: string | null) => {
  const startText = formatTime(start);
  if (!end) return startText;
  return `${startText} – ${formatTime(end)}`;
};

/** Overlap in minutes between two time ranges (null end = 1h default). */
function overlapMinutes(a: Event, b: Event): number {
  const aStart = new Date(a.start_at).getTime();
  const aEnd = new Date(a.end_at ?? a.start_at).getTime() + (a.end_at ? 0 : 3_600_000);
  const bStart = new Date(b.start_at).getTime();
  const bEnd = new Date(b.end_at ?? b.start_at).getTime() + (b.end_at ? 0 : 3_600_000);
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  return Math.round(overlap / 60_000);
}

export function CalendarManager({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { error, setError, reportDataError } = useDataError();
  const [view, setView] = useState<View>("today");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(blankForm());
  const [deleting, setDeleting] = useState<Event | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      const { membership } = await getActiveMembership(supabase, userId);
      if (!active || !membership?.workspaceId) {
        setLoading(false);
        return;
      }
      setWorkspaceId(membership.workspaceId);
    })();
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  const fetchEvents = async (workspace: string) => {
    // A 60-day window around today: enough for the week view and the
    // agenda without an unbounded read.
    const now = new Date();
    const from = addDays(now, -7).toISOString();
    const to = addDays(now, 53).toISOString();

    const { data, error: readError } = await supabase
      .from("events")
      .select("id, title, description, start_at, end_at, location, project_id, task_id")
      .eq("workspace_id", workspace)
      .gte("start_at", from)
      .lte("start_at", to)
      .order("start_at", { ascending: true })
      .limit(300);
    if (readError) {
      reportDataError("events.read", readError);
      return;
    }
    setEvents((data ?? []) as Event[]);
    setLoading(false);
  };

  const fetchProjects = async (workspace: string) => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspace)
      .order("name")
      .limit(100);
    setProjects((data ?? []) as ProjectOption[]);
  };

  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      await fetchEvents(workspaceId);
      await fetchProjects(workspaceId);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // ---- views ---------------------------------------------------------

  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const todayEnd = addDays(new Date(todayStart), 1).getTime();

  const weekStart = startOfDay(addDays(now, -now.getDay()));
  const weekEnd = addDays(weekStart, 7).getTime();

  const visible = useMemo(() => {
    if (view === "today") {
      return events.filter((event) => {
        const start = new Date(event.start_at).getTime();
        return start >= todayStart && start < todayEnd;
      });
    }
    if (view === "week") {
      return events.filter((event) => {
        const start = new Date(event.start_at).getTime();
        return start >= weekStart.getTime() && start < weekEnd;
      });
    }
    // Agenda: today forward, soonest first (already ordered by start_at).
    return events.filter((event) => new Date(event.start_at).getTime() >= todayStart);
  }, [events, view, todayStart, todayEnd, weekStart, weekEnd]);

  const conflicts = useMemo(() => {
    const found: { a: Event; b: Event; minutes: number }[] = [];
    const list = [...visible];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const minutes = overlapMinutes(list[i], list[j]);
        if (minutes > 0) {
          found.push({ a: list[i], b: list[j], minutes });
        }
      }
    }
    return found;
  }, [visible]);

  /** Free working-hour windows today (08:00–18:00), ≥30 minutes. */
  const freeWindowsToday = useMemo(() => {
    const busy = events
      .filter((event) => {
        const start = new Date(event.start_at).getTime();
        return start >= todayStart && start < todayEnd;
      })
      .map((event) => ({
        start: new Date(event.start_at).getTime(),
        end: new Date(event.end_at ?? event.start_at).getTime() + (event.end_at ? 0 : 3_600_000),
      }))
      .sort((a, b) => a.start - b.start);

    const dayStart = todayStart + 8 * 3_600_000;
    const dayEnd = todayStart + 18 * 3_600_000;
    const windows: { start: Date; end: Date; minutes: number }[] = [];

    let cursor = dayStart;
    for (const interval of busy) {
      if (interval.start > cursor) {
        pushWindow(windows, cursor, Math.min(interval.start, dayEnd));
      }
      if (interval.end > cursor) cursor = interval.end;
    }
    pushWindow(windows, cursor, dayEnd);
    return windows;
  }, [events, todayStart, todayEnd]);

  // ---- mutations ------------------------------------------------------

  const openCreate = (date?: Date) => {
    setEditingId(null);
    const start = date ?? new Date(now.getTime() + 3_600_000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 3_600_000);
    setForm({
      ...blankForm(),
      start_at: toLocalInput(start),
      end_at: toLocalInput(end),
    });
    setError("");
    setFormOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditingId(event.id);
    setError("");
    setForm({
      title: event.title,
      description: event.description ?? "",
      start_at: toLocalInput(new Date(event.start_at)),
      end_at: event.end_at ? toLocalInput(new Date(event.end_at)) : "",
      location: event.location ?? "",
      project_id: event.project_id ?? "",
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!workspaceId || !form.title.trim() || !form.start_at) return;
    const sourceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let startIso: string;
    let endIso: string | null;
    try {
      startIso = localDateTimeToUtc(form.start_at, sourceTimezone);
      endIso = form.end_at ? localDateTimeToUtc(form.end_at, sourceTimezone) : null;
    } catch {
      setError(`This time is invalid or ambiguous in ${sourceTimezone} (daylight-saving transition). Choose an unambiguous time.`);
      return;
    }
    setSaving(true);

    if (endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setSaving(false);
      setError("The end time is before the start time.");
      return;
    }

    const payload = {
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_at: startIso,
      source_timezone: sourceTimezone,
      end_at: endIso,
      location: form.location.trim() || null,
      project_id: form.project_id || null,
      created_by: userId,
    };

    const response = editingId
      ? await supabase
          .from("events")
          .update(payload)
          .eq("id", editingId)
          .eq("workspace_id", workspaceId)
      : await supabase.from("events").insert(payload);

    setSaving(false);
    if (response.error) {
      reportDataError("events.write", response.error);
      return;
    }

    setFormOpen(false);
    toast("success", editingId ? "Event updated" : "Event created");
    await fetchEvents(workspaceId);
  };

  const remove = async (event: Event) => {
    if (!workspaceId) return;
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id)
      .eq("workspace_id", workspaceId);
    setDeleting(null);
    if (deleteError) {
      reportDataError("events.delete", deleteError);
      return;
    }
    toast("success", "Event deleted");
    await fetchEvents(workspaceId);
  };

  // ---- week grid ------------------------------------------------------

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  return (
    <div className="page-enter">
      <PageHeader
        title="Calendar"
        count={loading ? undefined : `${visible.length} ${view === "today" ? "today" : view}`}
        description="Your time, connected to your work. NEXUS detects conflicts, shows free windows, and lets Intelligence answer “when can I do this?”"
        actions={<CreateButton label="Create event" onClick={() => openCreate()} />}
      />

      {error ? <Alert tone="danger" title="Calendar could not be saved">{error}</Alert> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PillTabs
          label="Calendar view"
          items={[
            { id: "today", label: "Today" },
            { id: "week", label: "Week" },
            { id: "agenda", label: "Agenda" },
          ]}
          value={view}
          onChange={(id) => setView(id as View)}
        />
        <p className="text-caption text-text-tertiary">
          {conflicts.length > 0
            ? `${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""} in this view`
            : "No conflicts in this view"}
        </p>
      </div>

      {loading ? (
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      ) : visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<NexusIcon icon={IconCalendar} size="state" />}
            title={
              view === "today"
                ? "Nothing scheduled today"
                : view === "week"
                  ? "Nothing scheduled this week"
                  : "No upcoming events"
            }
            description="A calendar with no events means NEXUS cannot protect your time yet. Create your first event — or connect Google Calendar from Integrations to bring existing meetings in."
            action={
              <Button size="sm" variant="primary" onClick={() => openCreate()}>
                Create event
              </Button>
            }
          />
        </Panel>
      ) : view === "week" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weekDays.map((day) => {
            const dayStart = startOfDay(day).getTime();
            const dayEvents = events.filter((event) => {
              const start = new Date(event.start_at).getTime();
              return start >= dayStart && start < addDays(new Date(dayStart), 1).getTime();
            });
            const isToday = dayStart === todayStart;
            return (
              <Panel
                key={day.toISOString()}
                className={cn(isToday && "border-border-default")}
                bodyClassName="p-3"
              >
                <div className="flex items-center justify-between">
                  <p className={cn("text-caption", isToday ? "text-text-primary" : "text-text-tertiary")}>
                    {formatDay(day)}
                  </p>
                  {isToday ? <Badge tone="info">Today</Badge> : null}
                </div>
                <div className="mt-2 space-y-2">
                  {dayEvents.length === 0 ? (
                    <p className="text-caption text-text-quaternary">Free</p>
                  ) : (
                    dayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openEdit(event)}
                        className="w-full rounded-input border border-border-subtle bg-bg-surface px-2.5 py-2 text-left transition-colors hover:border-border-default"
                      >
                        <p className="truncate text-caption font-medium text-text-primary">
                          {event.title}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                          {formatRange(event.start_at, event.end_at)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-border-subtle">
            {visible.map((event) => {
              const eventConflicts = conflicts.filter(
                (conflict) => conflict.a.id === event.id || conflict.b.id === event.id
              );
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-small font-medium text-text-primary">
                        {event.title}
                      </p>
                      {eventConflicts.length > 0 ? (
                        <Badge tone="danger">
                          <NexusIcon icon={IconAlertTriangle} className="h-3 w-3" />
                          Conflict
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-text-tertiary">
                      <span className="inline-flex items-center gap-1">
                        <NexusIcon icon={IconClock} className="h-3 w-3" />
                        {view === "agenda"
                          ? `${formatDay(new Date(event.start_at))} · ${formatRange(event.start_at, event.end_at)}`
                          : formatRange(event.start_at, event.end_at)}
                      </span>
                      {event.location ? (
                        <span className="inline-flex items-center gap-1">
                          <NexusIcon icon={IconMapPin} className="h-3 w-3" />
                          {event.location}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pl-0 sm:pl-3">
                    <Button variant="icon" title="Edit event" aria-label={`Edit ${event.title}`} onClick={() => openEdit(event)}>
                      <NexusIcon icon={IconPencil} />
                    </Button>
                    <Button variant="icon" title="Delete event" aria-label={`Delete ${event.title}`} onClick={() => setDeleting(event)}>
                      <NexusIcon icon={IconTrash} className="text-danger-text" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Free windows — answers "when can I actually work?" */}
      {!loading && view === "today" ? (
        <Panel
          title="Free time today"
          description="Working hours 08:00–18:00. Windows of 30 minutes or more."
        >
          {freeWindowsToday.length === 0 ? (
            <p className="text-small text-text-secondary">
              No free window of 30 minutes or more is left today. The day is fully booked —
              consider moving work to tomorrow.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {freeWindowsToday.map((window, index) => (
                <span
                  key={index}
                  className="rounded-pill border border-border-subtle bg-bg-surface px-2.5 py-1 font-mono text-caption text-text-secondary"
                >
                  {formatTime(window.start.toISOString())} – {formatTime(window.end.toISOString())}
                  <span className="ml-1.5 text-text-quaternary">· {window.minutes} min</span>
                </span>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit event" : "Create event"}
        description="Events define when work happens. Intelligence uses them to protect time and detect conflicts."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={saving}
              disabled={!form.title.trim() || !form.start_at}
            >
              {editingId ? "Save event" : "Create event"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" htmlFor="event-title">
            <Input
              id="event-title"
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="Team sync, focus block, deadline…"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts (browser timezone)" htmlFor="event-start">
              <Input
                id="event-start"
                type="datetime-local"
                value={form.start_at}
                onChange={(event) => setForm((f) => ({ ...f, start_at: event.target.value }))}
              />
            </Field>
            <Field label="Ends (same timezone, optional)" htmlFor="event-end">
              <Input
                id="event-end"
                type="datetime-local"
                value={form.end_at}
                onChange={(event) => setForm((f) => ({ ...f, end_at: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Location (optional)" htmlFor="event-location">
            <Input
              id="event-location"
              value={form.location}
              onChange={(event) => setForm((f) => ({ ...f, location: event.target.value }))}
              placeholder="Where this happens"
            />
          </Field>
          <Field label="Project (optional)" htmlFor="event-project">
            <Select
              id="event-project"
              value={form.project_id}
              onChange={(event) => setForm((f) => ({ ...f, project_id: event.target.value }))}
            >
              <option value="">Not linked</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description (optional)" htmlFor="event-description">
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              rows={3}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete “${deleting.title}”` : ""}
        description="This event will be removed for everyone in the workspace. There is no undo."
        confirmLabel="Delete event"
        onConfirm={() => {
          if (deleting) void remove(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/** datetime-local input value from a Date, in the user's local zone. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function pushWindow(
  windows: { start: Date; end: Date; minutes: number }[],
  start: number,
  end: number
): void {
  const minutes = Math.round((end - start) / 60_000);
  if (minutes >= 30 && end > start) {
    windows.push({ start: new Date(start), end: new Date(end), minutes });
  }
}
