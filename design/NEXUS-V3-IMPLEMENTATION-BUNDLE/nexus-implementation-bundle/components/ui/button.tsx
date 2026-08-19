import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-140 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        // PRIMARY = PILL WHITE (ressource Create button)
        default: "bg-white text-[#0A0A0A] hover:bg-[#E8E8E8] active:scale-[0.98] rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.24)]",
        // Create variant with badge interne
        create: "bg-white text-[#0A0A0A] pl-[4px] pr-[14px] gap-[10px] rounded-full hover:bg-[#E8E8E8] active:scale-[0.98] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.24)]",
        secondary: "bg-transparent border border-[rgba(255,255,255,0.08)] text-[#8F8F8F] rounded-full hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F5]",
        ghost: "bg-transparent text-[#8F8F8F] rounded-full hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F5]",
        destructive: "bg-transparent text-[#FF7A7A] border border-[rgba(255,122,122,0.16)] rounded-full hover:bg-[rgba(255,122,122,0.10)]",
      },
      size: {
        default: "h-9 px-4 text-[13px]",
        sm: "h-8 px-3 text-[12.5px]",
        lg: "h-11 px-5 text-[13.5px]",
        pill_sm: "h-7 px-3 text-[12px] rounded-full",
        icon: "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  withBadge?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, withBadge, children, ...props }, ref) => {
    const isCreate = variant === "create"
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {isCreate && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EDE8FF] text-[#0A0A0A]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M8 3.5V12.5M3.5 8H12.5" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <span className="tracking-[-0.01em] font-[500]">{children}</span>
      </button>
    )
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
