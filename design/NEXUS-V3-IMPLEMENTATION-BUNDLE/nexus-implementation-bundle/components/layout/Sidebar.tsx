// Sidebar V3 - 220px transparente, active pill blanc
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { href: "/tasks", label: "Tasks", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  { href: "/projects", label: "Projects", icon: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" },
  { href: "/goals", label: "Goals", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9 12l2 2 4-4" },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] flex-col bg-transparent px-3 pt-[80px] md:flex">
      {/* Workspace selector */}
      <div className="mb-5 flex h-11 items-center gap-2 rounded-[16px] border border-[rgba(255,255,255,0.06)] bg-[#111111] px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717]">
          <Image src="/logo/nexus.png" alt="ws" width={16} height={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[12.5px] font-[500] leading-[14px] text-[#F5F5F5]">My Workspace</span>
          <span className="font-mono text-[10px] text-[#5A5A5A]">Personal • Free</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <span className="mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#5A5A5A]">Overview</span>
        {nav.map(item => {
          const active = pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-8 items-center gap-[10px] rounded-[10px] px-2 text-[13px] transition-colors",
                active ? "bg-white text-[#0A0A0A] font-[500]" : "text-[#8F8F8F] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F5]"
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} className="shrink-0">
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pb-4">
        <div className="my-2 h-px bg-[rgba(255,255,255,0.06)]" />
        <Link href="/notifications" className="flex h-8 items-center gap-[10px] rounded-[10px] px-2 text-[13px] text-[#8F8F8F] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F5]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-6 9-6 9h18s-6-2-6-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          Notifications
        </Link>
        <Link href="/settings" className="flex h-8 items-center gap-[10px] rounded-[10px] px-2 text-[13px] text-[#8F8F8F] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#F5F5F5]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 009 15a1.65 1.65 0 00-1-1.51V13a2 2 0 014 0v.49c.39.23.77.43 1 1.51z"/></svg>
          Settings
        </Link>
      </div>
    </aside>
  )
}
