import type { Metadata } from "next"
import { EventsWorkspace } from "@/components/events/events-workspace"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "Calendar | ACOB Lighting Technology Limited",
  description: "Company meetings, workshops, webinars and activities you can attend.",
}

export default function CalendarPage() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <EventsWorkspace
        title="Calendar"
        description="Company meetings, workshops, webinars and activities — and the ones you're invited to."
        tabs={["calendar", "upcoming", "invitations"]}
        variant="staff"
      />
    </TablePageLayoutProvider>
  )
}
