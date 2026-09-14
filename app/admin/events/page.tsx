import type { Metadata } from "next"
import { EventsWorkspace } from "@/components/events/events-workspace"

export const metadata: Metadata = {
  title: "Events | ACOB Lighting Technology Limited",
  description: "Plan company meetings, workshops, webinars and activities.",
}

// Who can see and edit each event is enforced by RLS on public.events; this
// page is gated by the events.main admin route key in middleware.
export default function AdminEventsPage() {
  return (
    <EventsWorkspace
      title="Events"
      description="Plan meetings, workshops, webinars and activities for the company calendar."
      backLink={{ href: "/admin", label: "Back to Admin" }}
      tabs={["upcoming", "calendar", "past"]}
      variant="manage"
    />
  )
}
