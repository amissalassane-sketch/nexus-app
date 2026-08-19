"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

/**
 * NEXUS chart template.
 *
 * This file is a copy-paste template showing how the shadcn `chart`
 * component renders inside the "Pill Atelier Noir" design system. The data
 * below is EXAMPLE data — replace it with real workspace rows when a feature
 * needs it (dashboard, Intelligence, projects, goals, …).
 *
 * Palette (neutral, derived from the NEXUS text ramp — see globals.css):
 *   --chart-1  #f5f5f5  (text-primary)
 *   --chart-2  #b3b3b3
 *   --chart-3  #8f8f8f  (text-secondary)
 *   --chart-4  #5a5a5a  (text-tertiary)
 *   --chart-5  #333333
 *
 * For categorical/status data, the semantic tokens also work as series colors:
 *   --color-success  #7ade9b    --color-warning  #e8c574
 *   --color-danger   #ff7a7a    --color-info     #8aa8ff
 *   --color-lavender #e9e4ff
 */

const weeklyActivity = [
  { day: "Mon", completed: 6 },
  { day: "Tue", completed: 9 },
  { day: "Wed", completed: 7 },
  { day: "Thu", completed: 12 },
  { day: "Fri", completed: 10 },
  { day: "Sat", completed: 4 },
  { day: "Sun", completed: 2 },
]

const statusSplit = [
  { status: "Done", tasks: 12 },
  { status: "Active", tasks: 8 },
  { status: "Backlog", tasks: 5 },
]

const areaConfig = {
  completed: {
    label: "Completed",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const barConfig = {
  tasks: {
    label: "Tasks",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartDemo() {
  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">
          Weekly completion
        </h3>
        <ChartContainer config={areaConfig} className="w-full">
          <AreaChart
            accessibilityLayer
            data={weeklyActivity}
            margin={{ left: -20, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="completed"
              type="natural"
              fill="var(--color-completed)"
              fillOpacity={0.12}
              stroke="var(--color-completed)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ChartContainer>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">
          Tasks by status
        </h3>
        <ChartContainer config={barConfig} className="w-full">
          <BarChart accessibilityLayer data={statusSplit}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="status"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="tasks" fill="var(--color-tasks)" radius={4} />
          </BarChart>
        </ChartContainer>
      </section>
    </div>
  )
}
