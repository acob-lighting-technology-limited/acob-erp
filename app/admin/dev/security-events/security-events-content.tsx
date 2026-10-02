"use client"

import { AlertTriangle, ShieldAlert, ShieldCheck, Siren } from "lucide-react"
import { AuditStreamView, type AuditStreamClass, type AuditStreamRow } from "@/components/admin/audit-stream-view"

export type AuditLogRow = AuditStreamRow

function getSeverity(row: AuditStreamRow) {
  const text =
    `${row.action || ""} ${row.operation || ""} ${row.status || ""} ${JSON.stringify(row.metadata || {})}`.toLowerCase()
  if (text.includes("super_admin") || text.includes("developer") || text.includes("blocked")) return "Critical"
  if (text.includes("forbidden") || text.includes("unauthorized") || text.includes("failed")) return "High"
  if (text.includes("invalid") || text.includes("suspicious") || text.includes("security")) return "Medium"
  return "Low"
}

// Most severe first, so the cards a phone keeps are the ones that matter.
const SEVERITIES: AuditStreamClass[] = [
  { value: "Critical", tone: "danger", stat: { icon: Siren, iconBgColor: "bg-red-500/10", iconColor: "text-red-500" } },
  {
    value: "High",
    tone: "warning",
    stat: { icon: AlertTriangle, iconBgColor: "bg-amber-500/10", iconColor: "text-amber-500" },
  },
  {
    value: "Medium",
    tone: "info",
    stat: { icon: ShieldCheck, iconBgColor: "bg-emerald-500/10", iconColor: "text-emerald-500" },
  },
  { value: "Low", tone: "neutral" },
]

export function SecurityEventsContent({ rows, error }: { rows: AuditStreamRow[]; error: string | null }) {
  return (
    <AuditStreamView
      rows={rows}
      error={error}
      title="Security Events"
      description="Security-significant audit activity derived from authorization and risk signals."
      icon={ShieldAlert}
      classLabel="Severity"
      classify={getSeverity}
      classes={SEVERITIES}
      detail={(row) => row.status || "No status"}
      emptyTitle="No security events found"
      emptyDescription="No security-significant events were detected in the current log window."
    />
  )
}
