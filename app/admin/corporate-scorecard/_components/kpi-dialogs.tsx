"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api-client"

export const PERSPECTIVES = ["Financial", "Customer", "Internal Process", "Organizational Capacity"] as const

export const STANDARD_PILLARS = [
  "Revenue & Market Growth",
  "Financial Discipline",
  "Operational Excellence",
  "People & Capability",
  "Digital & Data Enablement",
  "Regulatory & Compliance",
] as const

export type RegisterRow = {
  id: string
  source_sn: number
  perspective: string
  strategic_priority: string
  strategic_objective: string
  measure: string
  target_text: string
  measure_type: string
  direction: string
  core_departments: string[]
  support_departments: string[]
}

interface CreateKpiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function CreateKpiDialog({ open, onOpenChange, onChanged }: CreateKpiDialogProps) {
  const [perspective, setPerspective] = useState<string>("Financial")
  const [strategicPriority, setStrategicPriority] = useState<string>(STANDARD_PILLARS[0])
  const [customPillar, setCustomPillar] = useState<string>("")
  const [strategicObjective, setStrategicObjective] = useState<string>("")
  const [measure, setMeasure] = useState<string>("")
  const [targetText, setTargetText] = useState<string>("")
  const [measureType, setMeasureType] = useState<"count" | "percentage" | "currency" | "milestone">("count")
  const [direction, setDirection] = useState<"at_least" | "at_most">("at_least")
  const [coreDepartments, setCoreDepartments] = useState<string[]>([])
  const [supportDepartments, setSupportDepartments] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const { data: deptData } = useQuery<{ data: Array<{ name: string }> }>({
    queryKey: ["departments-all"],
    queryFn: async () => {
      const res = await apiFetch("/api/departments", { cache: "no-store" })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load departments")
      return payload
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const departments = (deptData?.data ?? []).map((d) => d.name).sort((a, b) => a.localeCompare(b))

  function reset() {
    setPerspective("Financial")
    setStrategicPriority(STANDARD_PILLARS[0])
    setCustomPillar("")
    setStrategicObjective("")
    setMeasure("")
    setTargetText("")
    setMeasureType("count")
    setDirection("at_least")
    setCoreDepartments([])
    setSupportDepartments([])
  }

  function toggleCoreDept(dept: string) {
    if (coreDepartments.includes(dept)) {
      setCoreDepartments(coreDepartments.filter((d) => d !== dept))
    } else {
      setCoreDepartments([...coreDepartments, dept])
      setSupportDepartments(supportDepartments.filter((d) => d !== dept))
    }
  }

  function toggleSupportDept(dept: string) {
    if (supportDepartments.includes(dept)) {
      setSupportDepartments(supportDepartments.filter((d) => d !== dept))
    } else {
      setSupportDepartments([...supportDepartments, dept])
      setCoreDepartments(coreDepartments.filter((d) => d !== dept))
    }
  }

  const effectivePillar = strategicPriority === "custom" ? customPillar.trim() : strategicPriority

  async function handleSubmit() {
    if (!effectivePillar || !strategicObjective.trim() || !measure.trim() || !targetText.trim()) {
      toast.error("Please fill in all required fields (Pillar, Objective, Measure, and Target)")
      return
    }

    setIsSaving(true)
    try {
      const res = await apiFetch("/api/corporate-scorecard/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perspective,
          strategic_priority: effectivePillar,
          strategic_objective: strategicObjective.trim(),
          measure: measure.trim(),
          target_text: targetText.trim(),
          measure_type: measureType,
          direction,
          core_departments: coreDepartments,
          support_departments: supportDepartments,
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to create Corporate KPI")

      toast.success("Corporate KPI created successfully")
      reset()
      onOpenChange(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create Corporate KPI")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Add Corporate KPI</DialogTitle>
          <DialogDescription>
            Create a new master Corporate KPI aligned with a Balanced Scorecard Perspective and Strategic Pillar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Perspective *</Label>
              <Select value={perspective} onValueChange={setPerspective}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSPECTIVES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Strategic Pillar (Priority) *</Label>
              <Select value={strategicPriority} onValueChange={setStrategicPriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_PILLARS.map((pillar) => (
                    <SelectItem key={pillar} value={pillar}>
                      {pillar}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Custom Pillar...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {strategicPriority === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Custom Strategic Pillar Name *</Label>
              <Input
                placeholder="e.g. Environmental Sustainability & ESG"
                value={customPillar}
                onChange={(e) => setCustomPillar(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Strategic Objective *</Label>
            <Input
              placeholder="e.g. Increased project size, Improved customer retention"
              value={strategicObjective}
              onChange={(e) => setStrategicObjective(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">KPI Measure Name *</Label>
            <Textarea
              placeholder="e.g. Number of solicited portfolio projects awarded (Mini Grids)"
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="min-h-[64px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Annual Corporate Target *</Label>
            <Input
              placeholder="e.g. At least 5 portfolio projects awarded by 31/12/2026"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Measure Type</Label>
              <Select value={measureType} onValueChange={(v) => setMeasureType(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count (Numeric units)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="currency">Currency (Financial)</SelectItem>
                  <SelectItem value="milestone">Milestone (Stage-based)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="at_least">At least (Higher is better)</SelectItem>
                  <SelectItem value="at_most">At most (Reduction / Cost reduction)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Department Ownership */}
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs font-semibold">Department Ownership (RACI)</Label>
            <p className="text-muted-foreground text-[11px]">
              Click a department to assign as <strong className="text-emerald-600">CORE</strong> (scored owner). Click
              again to switch to <strong className="text-foreground">SUPPORT</strong> (collaborator), or remove.
            </p>

            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
              {departments.map((dept) => {
                const isCore = coreDepartments.includes(dept)
                const isSupport = supportDepartments.includes(dept)

                return (
                  <div key={dept} className="flex items-center gap-1 rounded-md border px-2 py-1">
                    <span className="text-xs">{dept}</span>
                    <button
                      type="button"
                      onClick={() => toggleCoreDept(dept)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        isCore
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-600"
                      }`}
                    >
                      CORE
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSupportDept(dept)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        isSupport
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-blue-500/20 hover:text-blue-600"
                      }`}
                    >
                      SUPPORT
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Creating..." : "Create Corporate KPI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EditKpiDialogProps {
  row: RegisterRow | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function EditKpiDialog({ row, onOpenChange, onChanged }: EditKpiDialogProps) {
  const [perspective, setPerspective] = useState<string>("Financial")
  const [strategicPriority, setStrategicPriority] = useState<string>(STANDARD_PILLARS[0])
  const [customPillar, setCustomPillar] = useState<string>("")
  const [strategicObjective, setStrategicObjective] = useState<string>("")
  const [measure, setMeasure] = useState<string>("")
  const [targetText, setTargetText] = useState<string>("")
  const [measureType, setMeasureType] = useState<"count" | "percentage" | "currency" | "milestone">("count")
  const [direction, setDirection] = useState<"at_least" | "at_most">("at_least")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (row) {
      setPerspective(row.perspective)
      if (STANDARD_PILLARS.includes(row.strategic_priority as any)) {
        setStrategicPriority(row.strategic_priority)
        setCustomPillar("")
      } else {
        setStrategicPriority("custom")
        setCustomPillar(row.strategic_priority)
      }
      setStrategicObjective(row.strategic_objective)
      setMeasure(row.measure)
      setTargetText(row.target_text)
      setMeasureType((row.measure_type as any) || "count")
      setDirection((row.direction as any) || "at_least")
    }
  }, [row])

  const effectivePillar = strategicPriority === "custom" ? customPillar.trim() : strategicPriority

  async function handleSubmit() {
    if (!row || !effectivePillar || !strategicObjective.trim() || !measure.trim() || !targetText.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSaving(true)
    try {
      const res = await apiFetch(`/api/corporate-scorecard/kpis/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perspective,
          strategic_priority: effectivePillar,
          strategic_objective: strategicObjective.trim(),
          measure: measure.trim(),
          target_text: targetText.trim(),
          measure_type: measureType,
          direction,
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to update Corporate KPI")

      toast.success("Corporate KPI updated successfully")
      onOpenChange(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update Corporate KPI")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Edit Corporate KPI</DialogTitle>
          <DialogDescription>
            Modify KPI #{row?.source_sn} details, Strategic Pillar, and annual target.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Perspective *</Label>
              <Select value={perspective} onValueChange={setPerspective}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSPECTIVES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Strategic Pillar (Priority) *</Label>
              <Select value={strategicPriority} onValueChange={setStrategicPriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_PILLARS.map((pillar) => (
                    <SelectItem key={pillar} value={pillar}>
                      {pillar}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Custom Pillar...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {strategicPriority === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Custom Strategic Pillar Name *</Label>
              <Input
                placeholder="e.g. Environmental Sustainability & ESG"
                value={customPillar}
                onChange={(e) => setCustomPillar(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Strategic Objective *</Label>
            <Input value={strategicObjective} onChange={(e) => setStrategicObjective(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">KPI Measure Name *</Label>
            <Textarea
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="min-h-[64px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Annual Corporate Target *</Label>
            <Input value={targetText} onChange={(e) => setTargetText(e.target.value)} className="h-9" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Measure Type</Label>
              <Select value={measureType} onValueChange={(v) => setMeasureType(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count (Numeric units)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="currency">Currency (Financial)</SelectItem>
                  <SelectItem value="milestone">Milestone (Stage-based)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="at_least">At least (Higher is better)</SelectItem>
                  <SelectItem value="at_most">At most (Reduction / Cost reduction)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ArchiveKpiDialogProps {
  row: RegisterRow | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function ArchiveKpiDialog({ row, onOpenChange, onChanged }: ArchiveKpiDialogProps) {
  const [isArchiving, setIsArchiving] = useState(false)

  async function handleArchive() {
    if (!row) return
    setIsArchiving(true)
    try {
      const res = await apiFetch(`/api/corporate-scorecard/kpis/${row.id}`, {
        method: "DELETE",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to archive Corporate KPI")

      toast.success(`KPI #${row.source_sn} archived`)
      onOpenChange(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive Corporate KPI")
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Archive Corporate KPI</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive{" "}
            <strong>
              #{row?.source_sn} - {row?.measure}
            </strong>
            ?
          </DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground text-xs">
          Archiving removes this KPI from new task assignments and the active scorecard register. Existing task links
          and historical records will remain intact.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isArchiving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleArchive()} disabled={isArchiving}>
            {isArchiving ? "Archiving..." : "Archive KPI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
