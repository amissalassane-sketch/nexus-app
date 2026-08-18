import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#171717] px-3 py-2 text-[13.5px] text-[#F5F5F5] placeholder:text-[#3A3A3A] focus:border-[rgba(255,255,255,0.16)] focus:outline-none focus:ring-0 disabled:opacity-40",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"
export { Input }
