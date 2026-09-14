"use client"

import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Pencil, ShieldAlert, User } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { RiskItem } from "./edit-risk-dialog"

interface RiskCardProps {
  risk: RiskItem
  onEdit: () => void
}

export function RiskCard({ risk, onEdit }: RiskCardProps) {
  const score = (risk.likelihood || 2) * (risk.impact || 2)

  const severityColors = {
    critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
    low: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
  }

  const statusBadges = {
    open: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
    mitigating: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    resolved:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    closed: "bg-muted text-muted-foreground border-muted-foreground/20",
  }

  const statusLabels = {
    open: "Open",
    mitigating: "Mitigating",
    resolved: "Resolved",
    closed: "Closed",
  }

  const ownerName = risk.profiles ? [risk.profiles.first_name, risk.profiles.last_name].filter(Boolean).join(" ") : null

  return (
    <Card className="border-border/80 flex flex-col justify-between transition-all duration-200 hover:shadow-md">
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-semibold capitalize",
                severityColors[risk.severity] || severityColors.medium
              )}
            >
              {risk.severity || "medium"}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[11px] font-medium capitalize", statusBadges[risk.status] || statusBadges.open)}
            >
              {statusLabels[risk.status] || risk.status}
            </Badge>
          </div>
          <Badge variant="secondary" className="text-[11px] font-normal">
            {risk.department || "Enterprise"}
          </Badge>
        </div>

        <h4 className="text-foreground line-clamp-3 pt-1 text-sm leading-snug font-semibold">{risk.title}</h4>
      </CardHeader>

      <CardContent className="space-y-2 p-4 pt-1 pb-3 text-xs">
        {/* Source metadata */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          {risk.report_id ? (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400">
              Weekly Report {risk.week_number ? `· Week ${risk.week_number}` : ""}
            </span>
          ) : (
            <span className="bg-muted rounded px-1.5 py-0.5">Direct Entry</span>
          )}
          <span className="capitalize">{risk.category}</span>
        </div>

        {/* Mitigation snippet */}
        <div className="bg-muted/40 border-muted rounded-md border p-2">
          <span className="text-muted-foreground mb-0.5 block text-[10px] font-bold tracking-wider uppercase">
            Mitigation Plan
          </span>
          <p className="text-muted-foreground line-clamp-2 text-[11px]">
            {risk.mitigation_plan || <span className="italic opacity-60">Pending action plan...</span>}
          </p>
        </div>
      </CardContent>

      <CardFooter className="border-border/40 mt-auto flex items-center justify-between border-t p-4 pt-0">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <User className="text-muted-foreground/70 h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{ownerName || "Unassigned"}</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      </CardFooter>
    </Card>
  )
}
