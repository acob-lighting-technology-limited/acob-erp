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
import { Input } from "@/components/ui/input"
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
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("operational")
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium")
  const [likelihood, setLikelihood] = useState(2)
  const [impact, setImpact] = useState(2)
  const [mitigationPlan, setMitigationPlan] = useState("")
  const [contingencyPlan, setContingencyPlan] = useState("")
  const [ownerId, setOwnerId] = useState<string>("unassigned")
  const [status, setStatus] = useState<"open" | "mitigating" | "resolved" | "closed">("open")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (risk) {
      setTitle(risk.title || "")
      setDescription(risk.description || "")
      setCategory(risk.category || "operational")
      setSeverity(risk.severity || "medium")
      setLikelihood(risk.likelihood || 2)
      setImpact(risk.impact || 2)
      setMitigationPlan(risk.mitigation_plan || "")
      setContingencyPlan(risk.contingency_plan || "")
      setOwnerId(risk.owner_id || "unassigned")
      setStatus(risk.status || "open")
    }
  }, [risk])

  // Automatically recalculate severity when likelihood or impact changes
  function handleLikelihoodChange(val: number) {
    setLikelihood(val)
    updateSeverityFromScore(val, impact)
  }

  function handleImpactChange(val: number) {
    setImpact(val)
    updateSeverityFromScore(likelihood, val)
  }

  function updateSeverityFromScore(l: number, i: number) {
    const score = l * i
    if (score >= 15) setSeverity("critical")
    else if (score >= 9) setSeverity("high")
    else if (score >= 4) setSeverity("medium")
    else setSeverity("low")
  }

  async function handleSave() {
    if (!risk) return
    if (!title.trim()) {
      toast.error("Risk title is required")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/corporate-services/risk-register/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          severity,
          likelihood,
          impact,
          mitigation_plan: mitigationPlan.trim() || null,
          contingency_plan: contingencyPlan.trim() || null,
          owner_id: ownerId === "unassigned" ? null : ownerId,
          status,
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

  const riskScore = likelihood * impact

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <DialogTitle>Risk Assessment & Mitigation</DialogTitle>
          </div>
          <DialogDescription>
            Configure risk parameters, assign ownership, and record mitigation actions.
          </DialogDescription>
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

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="risk-title">Risk / Challenge Description</Label>
              <Textarea
                id="risk-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="risk-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="risk-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                    <SelectItem value="compliance">Compliance & Legal</SelectItem>
                    <SelectItem value="technical">Technical / Engineering</SelectItem>
                    <SelectItem value="health_safety">Health & Safety</SelectItem>
                    <SelectItem value="reputational">Reputational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="risk-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger id="risk-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open (Unmitigated)</SelectItem>
                    <SelectItem value="mitigating">Mitigating (In Progress)</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed / Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Matrix: Likelihood & Impact & Severity */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Risk Severity Matrix
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Score: {riskScore}/25</span>
                  <Badge
                    className={
                      severity === "critical"
                        ? "bg-rose-600 text-white"
                        : severity === "high"
                          ? "bg-orange-500 text-white"
                          : severity === "medium"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-500 text-white"
                    }
                  >
                    {severity.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label>Likelihood (1–5)</Label>
                    <span className="font-semibold">{likelihood} / 5</span>
                  </div>
                  <Select value={String(likelihood)} onValueChange={(val) => handleLikelihoodChange(Number(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Rare</SelectItem>
                      <SelectItem value="2">2 - Unlikely</SelectItem>
                      <SelectItem value="3">3 - Possible</SelectItem>
                      <SelectItem value="4">4 - Likely</SelectItem>
                      <SelectItem value="5">5 - Almost Certain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label>Impact / Consequence (1–5)</Label>
                    <span className="font-semibold">{impact} / 5</span>
                  </div>
                  <Select value={String(impact)} onValueChange={(val) => handleImpactChange(Number(val))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Insignificant</SelectItem>
                      <SelectItem value="2">2 - Minor</SelectItem>
                      <SelectItem value="3">3 - Moderate</SelectItem>
                      <SelectItem value="4">4 - Major</SelectItem>
                      <SelectItem value="5">5 - Catastrophic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
