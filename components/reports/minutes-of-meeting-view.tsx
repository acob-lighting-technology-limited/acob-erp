"use client"

import { useState } from "react"
import { FileText, ScrollText } from "lucide-react"
import type { DataTableTab } from "@/components/ui/data-table"
import { MeetingDocumentTypeTable } from "@/components/reports/meeting-document-type-table"
import { MinutesSummaryTable } from "@/components/reports/minutes-summary-table"

const TABS: DataTableTab[] = [
  { key: "full", label: "Full Minutes", icon: FileText },
  { key: "summary", label: "Summary", icon: ScrollText },
]

/**
 * Minutes of Meeting page body, shared by the staff and admin routes: the full
 * minutes PDFs (mailed with the meeting records) and the short summaries the
 * agenda deck shows in their place.
 */
export function MinutesOfMeetingView({
  backHref,
  backLabel,
  readOnly = false,
  canOverrideWeekLock = false,
}: {
  backHref: string
  backLabel: string
  readOnly?: boolean
  canOverrideWeekLock?: boolean
}) {
  const [activeTab, setActiveTab] = useState("full")
  const pageTabs = { tabs: TABS, activeTab, onTabChange: setActiveTab }

  return activeTab === "summary" ? (
    <MinutesSummaryTable backHref={backHref} backLabel={backLabel} readOnly={readOnly} pageTabs={pageTabs} />
  ) : (
    <MeetingDocumentTypeTable
      documentType="minutes"
      title="Minutes of Meeting"
      description="Upload and manage Minutes of Meeting PDFs by week."
      backHref={backHref}
      backLabel={backLabel}
      readOnly={readOnly}
      canOverrideWeekLock={canOverrideWeekLock}
      pageTabs={pageTabs}
    />
  )
}
