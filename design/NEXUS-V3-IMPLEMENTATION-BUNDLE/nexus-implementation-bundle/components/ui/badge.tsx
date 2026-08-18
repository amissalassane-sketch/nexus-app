import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full h-[22px] px-2 text-[11px] font-[500] tracking-[0.02em] font-mono border",
  {
    variants: {
      variant: {
        default: "bg-[#232326] text-[#8F8F8F] border-[rgba(255,255,255,0.08)]",
        volt: "bg-[rgba(233,228,255,0.12)] text-[#E9E4FF] border-[rgba(233,228,255,0.24)]",
        success: "bg-[rgba(122,222,155,0.10)] text-[#7ADE9B] border-[rgba(122,222,155,0.20)]",
        warning: "bg-[rgba(232,197,116,0.10)] text-[#E8C574] border-[rgba(232,197,116,0.20)]",
        danger: "bg-[rgba(255,122,122,0.10)] text-[#FF7A7A] border-[rgba(255,122,122,0.20)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }
