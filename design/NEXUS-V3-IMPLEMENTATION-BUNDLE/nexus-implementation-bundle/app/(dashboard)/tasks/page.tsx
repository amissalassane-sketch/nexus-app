import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function TasksPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-[550] tracking-[-0.02em] text-[#F5F5F5]">Tasks <span className="ml-2 font-mono text-[13px] text-[#5A5A5A]">12 active</span></h1>
        <Button variant="create">New Task</Button>
      </div>
      <div className="mt-6 flex gap-2">
        {["All","Today","Overdue","High"].map(f => (
          <button key={f} className="h-7 rounded-full border border-[rgba(255,255,255,0.08)] bg-transparent px-3 font-mono text-[11.5px] text-[#8F8F8F] first:bg-white first:text-black">{f}</button>
        ))}
      </div>
      <div className="mt-4 rounded-[16px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-2">
        {Array.from({ length: 6 }).map((_,i) => (
          <div key={i} className="flex h-[44px] items-center gap-3 rounded-[10px] px-3 hover:bg-[#171717]">
            <div className="h-[18px] w-[18px] rounded-[6px] border border-[rgba(255,255,255,0.16)]" />
            <span className="text-[13.5px] text-[#F5F5F5]">Task #{i+1} – Design NEXUS brand guide</span>
            <Badge variant="default" className="ml-auto">Project Alpha</Badge>
            <span className="font-mono text-[11px] text-[#5A5A5A]">Today</span>
          </div>
        ))}
      </div>
    </div>
  )
}
