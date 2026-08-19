// Dropdown basé exactement sur ta ressource screenshot
// Radius 16px, bg #171717, border rgba(255,255,255,0.08), items 36px radius 10px, active avec left line blanche

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[240px] rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#171717] p-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.48),0_0_0_1px_rgba(255,255,255,0.06)_inset] animate-[scale-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean; active?: boolean }
>(({ className, inset, active, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex h-9 cursor-pointer select-none items-center gap-[10px] rounded-[10px] px-[10px] text-[13.5px] font-[400] text-[#8F8F8F] outline-none transition-colors duration-120 focus:bg-[rgba(255,255,255,0.06)] focus:text-[#F5F5F5] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F5] data-[disabled]:opacity-40",
      active && "bg-[rgba(255,255,255,0.08)] text-[#F5F5F5] before:absolute before:left-[2px] before:top-1/2 before:-translate-y-1/2 before:h-[14px] before:w-[2px] before:rounded-full before:bg-white before:content-['']",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("my-[6px] mx-2 h-[1px] bg-[rgba(255,255,255,0.06)]", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuGroup }
