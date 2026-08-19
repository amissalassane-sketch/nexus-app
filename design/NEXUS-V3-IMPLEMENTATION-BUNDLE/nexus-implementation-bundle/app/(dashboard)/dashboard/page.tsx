import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-[500] tracking-[-0.03em] text-[#F5F5F5]">Good morning, Alex</h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#5A5A5A]">Monday 12 Aug • 3 tasks need attention</p>
        </div>
        <Button variant="create">New Task</Button>
      </div>

      {/* Focus Block Niveau 1 */}
      <div className="rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#5A5A5A]">Focus Today</span>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex h-11 items-center gap-3 rounded-[10px] px-3 hover:bg-[#171717]">
            <div className="h-2 w-2 rounded-full bg-[#FF7A7A]" />
            <span className="text-[13.5px] text-[#F5F5F5]">Fix payment webhook overdue</span>
            <span className="ml-auto font-mono text-[11px] text-[#5A5A5A]">Today</span>
          </div>
          <div className="flex h-11 items-center gap-3 rounded-[10px] px-3 hover:bg-[#171717]">
            <div className="h-2 w-2 rounded-full bg-[#E8C574]" />
            <span className="text-[13.5px] text-[#F5F5F5]">Launch NEXUS V3 brand guide</span>
            <span className="ml-auto font-mono text-[11px] text-[#5A5A5A]">Tomorrow</span>
          </div>
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex gap-2">
        <span className="inline-flex h-7 items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[#111111] px-3 font-mono text-[11.5px] text-[#8F8F8F]"><b className="mr-1 text-[#F5F5F5]">12</b> tasks active</span>
        <span className="inline-flex h-7 items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[#111111] px-3 font-mono text-[11.5px] text-[#8F8F8F]"><b className="mr-1 text-[#F5F5F5]">4</b> projects</span>
        <span className="inline-flex h-7 items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[#111111] px-3 font-mono text-[11.5px] text-[#8F8F8F]"><b className="mr-1 text-[#F5F5F5]">2</b> goals</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-6">
          <Card>
            <div className="flex justify-between">
              <CardTitle>Active Projects</CardTitle>
              <span className="font-mono text-[11px] text-[#5A5A5A]">Total 12</span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {[
                { name: "Alpha", status: "Ongoing", progress: 70 },
                { name: "Beta", status: "Due Soon", progress: 45 },
                { name: "Gamma", status: "Nov 20", progress: 85 },
              ].map(p => (
                <div key={p.name} className="flex h-12 items-center justify-between rounded-[10px] px-2 hover:bg-[#171717]">
                  <span className="text-[13.5px] text-[#F5F5F5]">{p.name}</span>
                  <Badge>{p.status}</Badge>
                  <div className="h-1 w-20 rounded-full bg-[rgba(255,255,255,0.08)]"><div className="h-1 rounded-full bg-white" style={{ width: `${p.progress}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-6">
          <Card>
            <CardTitle>Tasks Due</CardTitle>
            <div className="mt-3 flex flex-col gap-2">
              <div className="h-9 rounded-[10px] bg-[#171717]" />
              <div className="h-9 rounded-[10px] bg-[#171717]/60" />
              <div className="h-9 rounded-[10px] bg-[#171717]/30" />
            </div>
          </Card>
          <Card>
            <CardTitle>Performance</CardTitle>
            <div className="mt-4 text-[28px] font-[600] tracking-[-0.02em] text-[#F5F5F5]">78% <span className="ml-2 text-[12px] font-[400] text-[#7ADE9B]">+12.4% vs last week</span></div>
          </Card>
        </div>
      </div>
    </div>
  )
}
