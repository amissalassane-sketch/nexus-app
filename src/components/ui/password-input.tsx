"use client";

import { useState, type ComponentPropsWithRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/** Password field with a keyboard-accessible visibility control. */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentPropsWithRef<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        disabled={props.disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-input text-text-tertiary transition-colors hover:bg-accent-ghost hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        {visible ? (
          <EyeOff size={15} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye size={15} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
