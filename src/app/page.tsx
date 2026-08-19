import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, FolderKanban, Target } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { NexusWordmark } from "@/components/nexus-logo";
import { ButtonLink } from "@/components/ui/button";

const FEATURES = [
  {
    title: "Tasks",
    body: "Capture what needs attention. Priorities, due dates and a focus list — nothing decorative.",
    icon: CheckSquare,
  },
  {
    title: "Projects",
    body: "Group the work that belongs together. Progress is counted from real tasks, not from a slider.",
    icon: FolderKanban,
  },
  {
    title: "Goals",
    body: "Keep outcomes visible next to the work. One workspace, one system.",
    icon: Target,
  },
] as const;

export default async function Home() {
  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-dvh bg-bg-base text-text-primary">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between px-5">
        <NexusWordmark size={28} priority />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Get started
          </ButtonLink>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-5 pb-20 pt-20 text-center sm:pt-28">
        <p className="font-mono text-mono uppercase tracking-[0.12em] text-text-tertiary">
          Personal operating system
        </p>
        <h1 className="mt-4 max-w-[18ch] text-[40px] font-medium leading-[1.05] tracking-[-0.04em] text-text-primary sm:text-[52px]">
          Everything important, connected.
        </h1>
        <p className="mt-5 max-w-[460px] text-body text-text-secondary">
          NEXUS keeps tasks, projects and goals in one quiet workspace.
          Built for operators who want a system, not another board.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/signup" size="lg">
            Create your NEXUS
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            Sign in
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1120px] gap-3 px-5 pb-24 sm:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="rounded-card border border-border-default bg-bg-subtle p-5 text-left"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-input border border-border-default bg-bg-surface text-text-secondary">
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h2 className="text-h3 text-text-primary">{feature.title}</h2>
              <p className="mt-1.5 text-small text-text-secondary">{feature.body}</p>
            </article>
          );
        })}
      </section>

      <footer className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 pb-10 text-caption text-text-tertiary">
        <span className="font-mono uppercase tracking-[0.1em]">Nexus</span>
        <Link href="/login" className="hover:text-text-secondary">
          Already have an account?
        </Link>
      </footer>
    </main>
  );
}
