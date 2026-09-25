"use client"

import { CalendarClock, Pencil, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import type { RiskRow } from "@/lib/risk-register/model"
import { RatingBadge, StatusBadge } from "./risk-badges"
import { TimelineText } from "./risk-timeline"

interface RiskCardProps {
  risk: RiskRow
  reference: string
  today: string
  canEdit: boolean
  onEdit: () => void
}

export function RiskCard({ risk, reference, today, canEdit, onEdit }: RiskCardProps) {
  return (
    <Card className="border-border/80 flex flex-col justify-between transition-shadow hover:shadow-md">
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="font-mono text-[11px]">
            {reference}
          </Badge>
          <div className="flex items-center gap-1.5">
            <RatingBadge rating={risk.rating} score={risk.score} className="text-[11px]" />
            <StatusBadge status={risk.status} className="text-[11px]" />
          </div>
        </div>
        <h4 className="text-foreground line-clamp-2 text-sm leading-snug font-semibold">{risk.risk_name}</h4>
        <p className="text-muted-foreground line-clamp-2 text-xs">{risk.description}</p>
      </CardHeader>

      <CardContent className="space-y-2 p-4 pt-1 pb-3 text-xs">
        <div className="bg-muted/40 rounded-md border p-2">
          <span className="text-muted-foreground mb-0.5 block text-[10px] font-bold tracking-wider uppercase">
            Mitigation Plans
          </span>
          <p className="text-muted-foreground line-clamp-2 text-[11px]">
            {risk.mitigation_plan || <span className="italic opacity-70">No mitigation plan yet</span>}
          </p>
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <TimelineText risk={risk} today={today} />
        </div>
      </CardContent>

      <CardFooter className="border-border/40 mt-auto flex items-center justify-between gap-2 border-t p-4 pt-3">
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{risk.control_owner_departments.join(", ")}</span>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" aria-hidden /> Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
