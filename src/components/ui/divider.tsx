import { cn } from "@/lib/cn";

/**
 * Text divider — the thin "──────── or ────────" used to separate the social
 * auth button from the credential form on the authentication screens.
 */
export function Divider({
  label = "or",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("my-5 flex items-center gap-4 text-text-quaternary", className)}
      role="separator"
    >
      <span className="h-px flex-1 bg-border-default" aria-hidden="true" />
      <span className="eyebrow text-text-quaternary">{label}</span>
      <span className="h-px flex-1 bg-border-default" aria-hidden="true" />
    </div>
  );
}
