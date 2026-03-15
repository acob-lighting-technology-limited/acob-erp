"use client"

import { Badge } from "@/components/ui/badge"

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-800 border-slate-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  high: "bg-amber-100 text-amber-900 border-amber-200",
  urgent: "bg-red-100 text-red-900 border-red-200",
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-zinc-100 text-zinc-800 border-zinc-200",
  pending_lead_review: "bg-violet-100 text-violet-900 border-violet-200",
  department_queue: "bg-indigo-100 text-indigo-900 border-indigo-200",
  department_assigned: "bg-cyan-100 text-cyan-900 border-cyan-200",
  assigned: "bg-sky-100 text-sky-900 border-sky-200",
  in_progress: "bg-blue-100 text-blue-900 border-blue-200",
  pending_approval: "bg-orange-100 text-orange-900 border-orange-200",
  approved_for_procurement: "bg-emerald-100 text-emerald-900 border-emerald-200",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
  returned: "bg-yellow-100 text-yellow-900 border-yellow-200",
  resolved: "bg-green-100 text-green-900 border-green-200",
  closed: "bg-teal-100 text-teal-900 border-teal-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
}

function formatLabel(value: string | null | undefined) {
  return String(value || "unknown").replaceAll("_", " ")
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const key = String(priority || "").toLowerCase()
  const tone = PRIORITY_STYLES[key] || "bg-slate-100 text-slate-700 border-slate-200"
  return <Badge className={tone}>{formatLabel(priority)}</Badge>
}

export function TicketStatusBadge({ status }: { status: string | null | undefined }) {
  const key = String(status || "").toLowerCase()
  const tone = STATUS_STYLES[key] || "bg-slate-100 text-slate-700 border-slate-200"
  return <Badge className={tone}>{formatLabel(status)}</Badge>
}
