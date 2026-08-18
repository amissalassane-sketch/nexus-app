import { TopBar } from "@/components/layout/TopBar"
import { Sidebar } from "@/components/layout/Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <TopBar />
      <Sidebar />
      <main className="ml-0 md:ml-[220px] mt-[56px] p-4 md:p-8 max-w-[1240px]">
        {children}
      </main>
    </div>
  )
}
