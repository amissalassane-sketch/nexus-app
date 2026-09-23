"use client";

import { useState, type ComponentPropsWithRef } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { NexusIcon } from "@/components/nexus-icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/** Password field with a keyboard-accessible visibility control. */
export function PasswordInput({
  className,
  visible: controlledVisible,
  onVisibleChange,
  shape = "default",
  ...props
}: Omit<ComponentPropsWithRef<typeof Input>, "type"> & {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  shape?: "default" | "pill";
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const isControlled = controlledVisible !== undefined;
  const visible = isControlled ? controlledVisible : internalVisible;

  const toggle = () => {
    const next = !visible;
    if (isControlled) {
      onVisibleChange?.(next);
    } else {
      setInternalVisible(next);
    }
  };

  return (
    <div className="relative">
      <Input
        {...props}
        shape={shape}
        type={visible ? "text" : "password"}
        className={cn(
          shape === "pill" ? "pr-11 pl-4" : "pr-11",
          className
        )}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={props.disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className={cn(
          "absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-40",
          shape === "pill"
            ? "right-2 rounded-full text-white/40 hover:bg-white/10 hover:text-white/70"
            : "right-1.5 rounded-input text-text-tertiary hover:bg-accent-ghost hover:text-text-primary"
        )}
      >
        {visible ? (
          <NexusIcon icon={IconEyeOff} />
        ) : (
          <NexusIcon icon={IconEye} />
        )}
      </button>
    </div>
  );
}
