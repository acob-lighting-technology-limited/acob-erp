"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { LeaveBalance, LeaveType } from "@/app/(app)/dashboard/leave/page"

const ELIGIBILITY_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  eligible: "default",
  missing_evidence: "secondary",
  not_eligible: "destructive",
}

function prettyEligibility(status: string) {
  if (status === "eligible") return "Eligible"
  if (status === "missing_evidence") return "Missing Evidence"
  return "Not Eligible"
}

function prettyDocName(name: string) {
  return name.replaceAll("_", " ")
}

interface LeaveTypesCardProps {
  leaveTypes: LeaveType[]
  balanceMap: Map<string, LeaveBalance>
}

export function LeaveTypesCard({ leaveTypes, balanceMap }: LeaveTypesCardProps) {
  const [showLeavePolicy, setShowLeavePolicy] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Leave Types and Balances</CardTitle>
            <CardDescription>Professional governance: policy + evidence + transparent eligibility</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowLeavePolicy((prev) => !prev)}>
            {showLeavePolicy ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
            {showLeavePolicy ? "Hide" : "Show"}
          </Button>
        </div>
      </CardHeader>
      {showLeavePolicy && (
        <CardContent className="space-y-2">
          {leaveTypes.map((leaveType) => {
            const balance = balanceMap.get(leaveType.id)
            const allocatedDays = balance?.allocated_days ?? leaveType.max_days
            const usedDays = balance?.used_days ?? 0
            const leftDays = balance?.balance_days ?? leaveType.max_days

            return (
              <div key={leaveType.id} className="space-y-1 rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{leaveType.name}</p>
                  <Badge variant={ELIGIBILITY_VARIANT[leaveType.eligibility_status] || "outline"}>
                    {prettyEligibility(leaveType.eligibility_status)}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {usedDays} used / {allocatedDays} allocated | {leftDays} days left
                </p>
                {leaveType.eligibility_reason && (
                  <p className="text-muted-foreground text-xs">{leaveType.eligibility_reason}</p>
                )}
                {leaveType.required_documents?.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    Required documents: {leaveType.required_documents.map(prettyDocName).join(", ")}
                  </p>
                )}
              </div>
            )
          })}
        </CardContent>
      )}
    </Card>
  )
}
