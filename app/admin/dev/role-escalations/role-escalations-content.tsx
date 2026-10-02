"use client"

import { ShieldCheck, ShieldEllipsis, TriangleAlert, UserCog } from "lucide-react"
import { AuditStreamView, type AuditStreamClass, type AuditStreamRow } from "@/components/admin/audit-stream-view"

export type AuditLogRow = AuditStreamRow

function getRoleTier(row: AuditStreamRow) {
  const text = `${JSON.stringify(row.new_values || {})} ${JSON.stringify(row.metadata || {})}`.toLowerCase()
  if (text.includes("super_admin")) return "Super Admin"
  if (text.includes("developer")) return "Developer"
  if (text.includes("admin")) return "Admin"
  if (text.includes("department_lead")) return "Department Lead"
  return "Role Change"
}

const ROLE_TIERS: AuditStreamClass[] = [
  {
    value: "Super Admin",
    tone: "danger",
    stat: { icon: TriangleAlert, iconBgColor: "bg-red-500/10", iconColor: "text-red-500" },
  },
  {
    value: "Developer",
    tone: "warning",
    stat: { icon: UserCog, iconBgColor: "bg-amber-500/10", iconColor: "text-amber-500" },
  },
  {
    value: "Admin",
    tone: "info",
    stat: { icon: ShieldCheck, iconBgColor: "bg-emerald-500/10", iconColor: "text-emerald-500" },
  },
  { value: "Department Lead", tone: "neutral" },
  { value: "Role Change", tone: "neutral" },
]

export function RoleEscalationsContent({ rows, error }: { rows: AuditStreamRow[]; error: string | null }) {
  return (
    <AuditStreamView
      rows={rows}
      error={error}
      title="Role Escalations"
      description="High-sensitivity role elevation and privileged change stream."
      icon={ShieldEllipsis}
      classLabel="Role Tier"
      classify={getRoleTier}
      classes={ROLE_TIERS}
      detail={(row) => row.operation || "No operation"}
      emptyTitle="No role escalations found"
      emptyDescription="No privileged role elevation events were detected in the current log window."
    />
  )
}
