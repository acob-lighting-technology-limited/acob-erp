"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export interface RiskItem {
  id: string
  title: string
  description: string | null
  department: string | null
  week_number: number | null
  year: number | null
  category: string
  severity: "low" | "medium" | "high" | "critical"
  likelihood: number
  impact: number
  risk_score: number
  mitigation_plan: string | null
  contingency_plan: string | null
  owner_id: string | null
  status: "open" | "mitigating" | "resolved" | "closed"
  report_id: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
  profiles?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

interface EditRiskDialogProps {
  risk: RiskItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>
  onRiskUpdated: (updated: RiskItem) => void
}

export function EditRiskDialog({ risk, open, onOpenChange, employees, onRiskUpdated }: EditRiskDialogProps) {
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium")
  const [status, setStatus] = useState<"open" | "mitigating" | "resolved" | "closed">("open")
  const [ownerId, setOwnerId] = useState<string>("unassigned")
  const [mitigationPlan, setMitigationPlan] = useState("")
  const [contingencyPlan, setContingencyPlan] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (risk) {
      setSeverity(risk.severity || "medium")
      setStatus(risk.status || "open")
      setOwnerId(risk.owner_id || "unassigned")
      setMitigationPlan(risk.mitigation_plan || "")
      setContingencyPlan(risk.contingency_plan || "")
    }
  }, [risk])

  async function handleSave() {
    if (!risk) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/corporate-services/risk-register/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity,
          status,
          owner_id: ownerId === "unassigned" ? null : ownerId,
          mitigation_plan: mitigationPlan.trim() || null,
          contingency_plan: contingencyPlan.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save risk item")
      }

      const { data } = await res.json()
      toast.success("Risk details saved successfully")
      onRiskUpdated(data)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving risk"
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <DialogTitle>Edit Risk Details</DialogTitle>
          </div>
          <DialogDescription>Update risk severity, status, assigned owner, and mitigation actions.</DialogDescription>
        </DialogHeader>

        {risk && (
          <div className="space-y-4 py-2">
            {/* Metadata tags */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 border-b pb-2 text-xs">
              {risk.department && (
                <Badge variant="outline" className="font-semibold">
                  {risk.department}
                </Badge>
              )}
              {risk.week_number && risk.year && (
                <span className="bg-muted rounded px-2 py-0.5">
                  Week {risk.week_number}, {risk.year}
                </span>
              )}
              {risk.report_id && (
                <Link
                  href={`/admin/reports/general-meeting/weekly-reports?week=${risk.week_number}&year=${risk.year}&dept=${risk.department}`}
                  target="_blank"
                  className="text-primary ml-auto inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View Source Weekly Report
                </Link>
              )}
            </div>

            {/* Read-only Challenge / Risk Description */}
            <div className="space-y-1.5">
              <Label>Challenge / Risk Description</Label>
              <div className="bg-muted/40 text-foreground rounded-lg border p-3 text-sm leading-relaxed">
                {risk.title}
              </div>
              <p className="text-muted-foreground text-[11px]">
                This challenge originates directly from weekly reports and cannot be edited here.
              </p>
            </div>

            {/* Severity & Status Direct Selectors */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="risk-severity">Severity</Label>
                <Select
                  value={severity}
                  onValueChange={(val) => setSeverity(val as "low" | "medium" | "high" | "critical")}
                >
                  <SelectTrigger id="risk-severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium (Default)</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="risk-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as "open" | "mitigating" | "resolved" | "closed")}
                >
                  <SelectTrigger id="risk-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="mitigating">Mitigating (In Progress)</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed / Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assigned Owner */}
            <div className="space-y-1.5">
              <Label htmlFor="risk-owner">Assigned Risk Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger id="risk-owner">
                  <SelectValue placeholder="Assign an owner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {employees.map((emp) => {
                    const name = [emp.first_name, emp.last_name].filter(Boolean).join(" ") || emp.email || emp.id
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        {name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Mitigation Plan */}
            <div className="space-y-1.5">
              <Label htmlFor="mitigation-plan">Mitigation Action Plan</Label>
              <Textarea
                id="mitigation-plan"
                placeholder="What preventative or treatment measures are being taken to eliminate or minimize this risk?"
                value={mitigationPlan}
                onChange={(e) => setMitigationPlan(e.target.value)}
                rows={3}
              />
            </div>

            {/* Contingency Plan */}
            <div className="space-y-1.5">
              <Label htmlFor="contingency-plan">Contingency Plan (Optional)</Label>
              <Textarea
                id="contingency-plan"
                placeholder="Fallback measures if the risk materializes..."
                value={contingencyPlan}
                onChange={(e) => setContingencyPlan(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
