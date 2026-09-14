"use client"

import { Briefcase, Inbox, Users } from "lucide-react"
import { EventsWorkspace } from "@/components/events/events-workspace"
import { MdDeskDelegates } from "./md-desk-delegates"
import { WaitingOnMd } from "./waiting-on-md"

/**
 * MD's Desk — the executive view of the company calendar. Engagements are the
 * same events everyone else sees, filtered to the MD's schedule (scope "md"),
 * plus the approvals queue and the delegate list. Rendered from both the admin
 * shell and the staff shell so a PA who is not an admin can still use it.
 */
export function MdDeskWorkspace({ backLink }: { backLink?: { href: string; label: string } }) {
  return (
    <EventsWorkspace
      title="MD's Desk"
      description="The MD's engagements, the approvals waiting on the MD, and who helps manage them."
      icon={Briefcase}
      backLink={backLink}
      scope="md"
      variant="manage"
      tabs={["upcoming", "calendar", "past"]}
      extraTabs={[
        { key: "overview", label: "Waiting on MD", icon: Inbox, render: () => <WaitingOnMd /> },
        { key: "delegates", label: "Delegates", icon: Users, render: () => <MdDeskDelegates /> },
      ]}
      formDefaults={{ md_involvement: "attending" }}
    />
  )
}
