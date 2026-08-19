// TopBar V3 - basé sur ta ressource: Create pill + Avatar top right
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function TopBar({ user }: { user?: { avatar?: string; name?: string } }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-[56px] items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]/80 px-4 backdrop-blur-[12px]">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-[10px]">
          <Image src="/logo/nexus.png" alt="NEXUS" width={28} height={28} className="h-7 w-7" />
          <span className="text-[13px] font-[600] tracking-[-0.03em] text-[#F5F5F5]">NEXUS</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="create" size="default">Create</Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 overflow-hidden rounded-full border-2 border-[#1C1C1C] bg-[#171717]">
              <Image src={user?.avatar || "/logo/nexus.png"} alt="avatar" width={32} height={32} className="h-full w-full object-cover" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            <DropdownMenuItem active className="gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20a8 8 0 100-16 8 8 0 000 16z"/><path d="M12 14a2 2 0 100-4 2 2 0 000 4z"/></svg>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22a1 1 0 010-2h1a1 1 0 001-1v-1a1 1 0 011-1h1a1 1 0 001-1v-1a1 1 0 011-1h1a1 1 0 001-1v-4a1 1 0 00-1-1h-1a1 1 0 01-1-1v-1a1 1 0 00-1-1h-1a1 1 0 01-1-1v-1a1 1 0 00-1-1h-4a1 1 0 00-1 1v1a1 1 0 01-1 1H9a1 1 0 00-1 1v1a1 1 0 01-1 1H6a1 1 0 00-1 1v4a1 1 0 001 1h1a1 1 0 011 1v1a1 1 0 001 1h1a1 1 0 011 1v1a1 1 0 001 1h1a1 1 0 011 1v1a1 1 0 001 1h1z"/></svg>
              Theme
              <span className="ml-auto text-[#5A5A5A]">›</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 4s0 5-4 9a22 22 0 01-3.95 2z"/></svg>
              Upgrade
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Help center
            </DropdownMenuItem>
            <DropdownMenuItem>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
