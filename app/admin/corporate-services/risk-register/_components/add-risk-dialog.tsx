"use client"

import { useState } from "react"
import { Loader2, Plus, ShieldAlert } from "lucide-react"
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
import type { RiskItem } from "./edit-risk-dialog"

interface AddRiskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: string[]
  employees: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>
  onRiskAdded: (newRisk: RiskItem) => void
}

export function AddRiskDialog({ open, onOpenChange, departments, employees, onRiskAdded }: AddRiskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [department, setDepartment] = useState<string>("all-company")
  const [category, setCategory] = useState("operational")
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium")
  const [likelihood, setLikelihood] = useState(2)
  const [impact, setImpact] = useState(2)
  const [mitigationPlan, setMitigationPlan] = useState("")
  const [ownerId, setOwnerId] = useState<string>("unassigned")
  const [status, setStatus] = useState<"open" | "mitigating" | "resolved" | "closed">("open")
  const [isSaving, setIsSaving] = useState(false)

  function handleLikelihoodChange(val: number) {
    setLikelihood(val)
    updateSeverity(val, impact)
  }

  function handleImpactChange(val: number) {
    setImpact(val)
    updateSeverity(likelihood, val)
  }

  function updateSeverity(l: number, i: number) {
    const score = l * i
    if (score >= 15) setSeverity("critical")
    else if (score >= 9) setSeverity("high")
    else if (score >= 4) setSeverity("medium")
    else setSeverity("low")
  }

  function resetForm() {
    setTitle("")
    setDescription("")
    setDepartment("all-company")
    setCategory("operational")
    setSeverity("medium")
    setLikelihood(2)
    setImpact(2)
    setMitigationPlan("")
    setOwnerId("unassigned")
    setStatus("open")
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Risk title is required")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/corporate-services/risk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          department: department === "all-company" ? null : department,
          category,
          severity,
          likelihood,
          impact,
          mitigation_plan: mitigationPlan.trim() || null,
          owner_id: ownerId === "unassigned" ? null : ownerId,
          status,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to create risk item")
      }

      const { data } = await res.json()
      toast.success("Risk item added to register")
      onRiskAdded(data)
      resetForm()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating risk"
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
            <DialogTitle>Add Risk to Register</DialogTitle>
          </div>
          <DialogDescription>Record a strategic, operational, or departmental risk matrix item.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="new-risk-title">Risk Title / Description *</Label>
            <Textarea
              id="new-risk-title"
              placeholder="Describe the threat, potential vulnerability, or operational challenge..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Department & Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-risk-dept">Department Scope</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="new-risk-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-company">All Company / Enterprise</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-risk-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="new-risk-category">
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
          </div>

          {/* Matrix: Likelihood & Impact & Severity */}
          <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Risk Severity Assessment
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
            <Label htmlFor="new-risk-owner">Assigned Risk Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger id="new-risk-owner">
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
            <Label htmlFor="new-mitigation-plan">Mitigation Action Plan</Label>
            <Textarea
              id="new-mitigation-plan"
              placeholder="What preventative or treatment measures are being taken to eliminate or minimize this risk?"
              value={mitigationPlan}
              onChange={(e) => setMitigationPlan(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
