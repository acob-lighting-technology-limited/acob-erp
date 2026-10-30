"use client"

import { useEffect, useState } from "react"
import { CalendarClock, Bell, Search, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { formatWATDate } from "@/lib/utils/date"
import { SERIES_CREATED_EVENT, type SeriesCreated } from "@/lib/tasks/series-client"

/**
 * The summary after a recurring task is set up: what was created, when its
 * first task appears, where to find it, and how to change it later. Mounted
 * once in the root layout and opened by showSeriesCreated().
 */
export function SeriesCreatedDialog() {
  const [result, setResult] = useState<SeriesCreated | null>(null)

  useEffect(() => {
    const open = (event: Event) => setResult((event as CustomEvent<SeriesCreated>).detail)
    window.addEventListener(SERIES_CREATED_EVENT, open)
    return () => window.removeEventListener(SERIES_CREATED_EVENT, open)
  }, [])

  if (!result) return null

  const due = result.firstDue ? formatWATDate(result.firstDue) : null
  const several = result.assigneeNames.length > 1
  const people = result.assigneeNames.join(", ") || "The assignee"

  const steps = [
    {
      icon: CalendarClock,
      title: "When the task appears",
      body:
        result.firstRepeats > 0
          ? `The first task is in the task list now${due ? `, due ${due}` : ""}.`
          : result.firstCreated && due
            ? `The first task is created on ${formatWATDate(result.firstCreated)}, ahead of its due date of ${due}. Until then it shows as "Scheduled" in the task list.`
            : `The first task is created ahead of its due date. Until then it shows as "Scheduled" in the task list.`,
      extra: "Every later one is created automatically, the same way. Nobody needs to create it again.",
    },
    {
      icon: Bell,
      title: "Who is told",
      body:
        (several ? `${people} each get their own copy every time. ` : "") +
        (result.frequency === "working_daily"
          ? `${several ? "Each is" : `${people} is`} notified about the first task only, so a daily task does not send a notification every day.`
          : `${several ? "Each is" : `${people} is`} notified when each task is created.`),
    },
    {
      icon: Search,
      title: "Where to find it",
      body: 'Tasks → Recurring lists every recurring task. In the task list, each one carries a "Repeats" label you can click.',
    },
    {
      icon: Settings2,
      title: "Changing it later",
      body: "Open it from the Recurring tab to reassign it, pause it (for leave, say) or end it. To change the schedule itself, end it and create a new one.",
    },
  ]

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => !open && setResult(null)}
      title="Recurring task set up"
      description={several ? `Set up for ${result.assigneeNames.length} people.` : undefined}
      desktopClassName="max-w-lg"
    >
      <div className="space-y-4 text-sm">
        <dl className="bg-muted/30 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border p-3 text-xs">
          <dt className="text-muted-foreground">Task</dt>
          <dd className="font-medium">{result.title}</dd>
          <dt className="text-muted-foreground">Assigned to</dt>
          <dd>{people}</dd>
          <dt className="text-muted-foreground">Repeats</dt>
          <dd>{result.scheduleLabel || "—"}</dd>
          <dt className="text-muted-foreground">First due</dt>
          <dd>{due ?? "—"}</dd>
          <dt className="text-muted-foreground">Ends</dt>
          <dd>{result.endDate ? formatWATDate(result.endDate) : "Never"}</dd>
        </dl>

        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.title} className="flex gap-3">
              <step.icon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold">{step.title}</p>
                <p className="text-muted-foreground text-xs">{step.body}</p>
                {step.extra && <p className="text-muted-foreground text-xs">{step.extra}</p>}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setResult(null)}>
            Got it
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
