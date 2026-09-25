"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { apiFetch } from "@/lib/api-client"
import {
  IMPACT_LEVELS,
  LIKELIHOOD_LEVELS,
  STATUS_LABELS,
  ratingForScore,
  type RiskRow,
  type RiskStatus,
  type RiskTimelineType,
} from "@/lib/risk-register/model"
import { RatingBadge } from "./risk-badges"

export interface StaffOption {
  id: string
  name: string
  department: string | null
  active: boolean
}

interface RiskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = raise a new risk */
  risk: RiskRow | null
  departments: string[]
  raisableDepartments: string[]
  staff: StaffOption[]
  /** Control owner who is neither admin nor lead: mitigation, timeline and status only. */
  ownerOnly: boolean
  onSaved: (risk: RiskRow) => void
}

const NO_OWNER = "__none__"

interface FormState {
  department: string
  supporting_departments: string[]
  risk_name: string
  description: string
  causes: string
  consequence: string
  impact: string
  likelihood: string
  control_owner_departments: string[]
  control_owner_id: string
  mitigation_plan: string
  timeline_type: RiskTimelineType
  target_date: string
  timeline_note: string
  status: RiskStatus
}

function initialState(risk: RiskRow | null, raisable: string[]): FormState {
  return {
    department: risk?.department ?? (raisable.length === 1 ? raisable[0] : ""),
    supporting_departments: risk?.supporting_departments ?? [],
    risk_name: risk?.risk_name ?? "",
    description: risk?.description ?? "",
    causes: risk?.causes ?? "",
    consequence: risk?.consequence ?? "",
    impact: risk ? String(risk.impact) : "",
    likelihood: risk ? String(risk.likelihood) : "",
    control_owner_departments: risk?.control_owner_departments ?? [],
    control_owner_id: risk?.control_owner_id ?? NO_OWNER,
    mitigation_plan: risk?.mitigation_plan ?? "",
    timeline_type: risk?.timeline_type ?? "by_date",
    target_date: risk?.target_date ?? "",
    timeline_note: risk?.timeline_note ?? "",
    status: risk?.status ?? "open",
  }
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  )
}

export function RiskFormDialog({
  open,
  onOpenChange,
  risk,
  departments,
  raisableDepartments,
  staff,
  ownerOnly,
  onSaved,
}: RiskFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(risk, raisableDepartments))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(initialState(risk, raisableDepartments))
  }, [open, risk, raisableDepartments])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const impact = Number(form.impact)
  const likelihood = Number(form.likelihood)
  const score = impact && likelihood ? impact * likelihood : null
  const locked = ownerOnly

  // Keep a lead department selectable even if it is not in the raisable list (editing an old row).
  const leadOptions = Array.from(new Set([...(risk ? [risk.department] : []), ...raisableDepartments]))
  const deptOptions = departments.map((d) => ({ value: d, label: d }))
  const staffOptions = [
    { value: NO_OWNER, label: "No named person" },
    ...staff
      .filter((s) => s.active || s.id === form.control_owner_id)
      .map((s) => ({ value: s.id, label: s.department ? `${s.name} — ${s.department}` : s.name })),
  ]

  async function handleSave() {
    const ownerFields = {
      mitigation_plan: form.mitigation_plan,
      timeline_type: form.timeline_type,
      target_date: form.timeline_type === "by_date" ? form.target_date || null : null,
      timeline_note: form.timeline_note,
      status: form.status,
    }
    const body = locked
      ? ownerFields
      : {
          ...ownerFields,
          department: form.department,
          supporting_departments: form.supporting_departments.filter((d) => d !== form.department),
          risk_name: form.risk_name,
          description: form.description,
          causes: form.causes,
          consequence: form.consequence,
          impact,
          likelihood,
          control_owner_departments: form.control_owner_departments,
          control_owner_id: form.control_owner_id === NO_OWNER ? null : form.control_owner_id,
        }

    if (!locked) {
      if (!form.department) return toast.error("Select the department or unit")
      if (!impact || !likelihood) return toast.error("Score both inherent impact and likelihood")
      if (form.control_owner_departments.length === 0) return toast.error("Select at least one control owner")
    }

    setIsSaving(true)
    try {
      const res = await apiFetch(
        risk ? `/api/corporate-services/risk-register/${risk.id}` : "/api/corporate-services/risk-register",
        {
          method: risk ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to save the risk")
      toast.success(risk ? "Risk updated" : "Risk added to the register")
      onSaved(json.data as RiskRow)
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save the risk")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" aria-hidden />
            <DialogTitle>{risk ? "Edit Risk" : "Add Risk"}</DialogTitle>
          </div>
          <DialogDescription>
            {locked
              ? "As control owner you can update the mitigation plan, timeline and status."
              : "Fill in the risk as it appears on the ACOB Risk Register template."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">The risk</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Department or Unit" hint="The lead department; the S/N is numbered within it.">
                <Select value={form.department} onValueChange={(v) => set("department", v)} disabled={locked}>
                  <SelectTrigger aria-label="Department or Unit">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Supporting units (optional)" hint="For joint risks such as BGI/TECH.">
                <SearchableMultiSelect
                  values={form.supporting_departments}
                  options={deptOptions.filter((o) => o.value !== form.department)}
                  onChange={(v) => set("supporting_departments", v)}
                  placeholder="None"
                  disabled={locked}
                />
              </Field>
            </div>

            <Field
              label="Risk Name"
              hint='A short name, in the negative (e.g. "Expired compliance documents").'
              htmlFor="risk-name"
            >
              <Input
                id="risk-name"
                value={form.risk_name}
                onChange={(e) => set("risk_name", e.target.value)}
                maxLength={200}
                disabled={locked}
              />
            </Field>

            <Field
              label="Risk Description"
              hint="Summary of the key issues, bringing together the name, cause and effect."
              htmlFor="risk-description"
            >
              <Textarea
                id="risk-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                disabled={locked}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Causes" hint="Internal or external factors, threats and weaknesses." htmlFor="risk-causes">
                <Textarea
                  id="risk-causes"
                  value={form.causes}
                  onChange={(e) => set("causes", e.target.value)}
                  rows={3}
                  disabled={locked}
                />
              </Field>
              <Field
                label="Potential Impact/Consequence"
                hint="Impact on objectives should the risk crystallise."
                htmlFor="risk-consequence"
              >
                <Textarea
                  id="risk-consequence"
                  value={form.consequence}
                  onChange={(e) => set("consequence", e.target.value)}
                  rows={3}
                  disabled={locked}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Inherent rating</h3>
              {score !== null && <RatingBadge rating={ratingForScore(score)} score={score} />}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Inherent Impact">
                <Select value={form.impact} onValueChange={(v) => set("impact", v)} disabled={locked}>
                  <SelectTrigger aria-label="Inherent Impact">
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPACT_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={String(l.value)}>
                        {l.value} - {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Inherent Likelihood">
                <Select value={form.likelihood} onValueChange={(v) => set("likelihood", v)} disabled={locked}>
                  <SelectTrigger aria-label="Inherent Likelihood">
                    <SelectValue placeholder="Select likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIKELIHOOD_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={String(l.value)}>
                        {l.value} - {l.label} ({l.band})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t pt-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Control & mitigation
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Control Owner" hint="The office(s) responsible for mitigating the risk.">
                <SearchableMultiSelect
                  values={form.control_owner_departments}
                  options={deptOptions}
                  onChange={(v) => set("control_owner_departments", v)}
                  placeholder="Select department(s)"
                  disabled={locked}
                />
              </Field>
              <Field label="Accountable person (optional)" hint="Notified when named; can update progress.">
                <SearchableSelect
                  value={form.control_owner_id}
                  onValueChange={(v) => set("control_owner_id", v)}
                  options={staffOptions}
                  placeholder="No named person"
                  searchPlaceholder="Search staff..."
                  disabled={locked}
                />
              </Field>
            </div>

            <Field
              label="Mitigation Plans"
              hint="Actions to take the risk rating to the desired level. These become additional controls."
              htmlFor="risk-mitigation"
            >
              <Textarea
                id="risk-mitigation"
                value={form.mitigation_plan}
                onChange={(e) => set("mitigation_plan", e.target.value)}
                rows={3}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Implementation Timeline">
                <Select value={form.timeline_type} onValueChange={(v) => set("timeline_type", v as RiskTimelineType)}>
                  <SelectTrigger aria-label="Implementation Timeline">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="by_date">By a target date</SelectItem>
                    <SelectItem value="continuous">Continuous</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.timeline_type === "by_date" && (
                <Field label="Target date" htmlFor="risk-target-date">
                  <Input
                    id="risk-target-date"
                    type="date"
                    value={form.target_date}
                    onChange={(e) => set("target_date", e.target.value)}
                  />
                </Field>
              )}
              <Field label="Risk Status">
                <Select value={form.status} onValueChange={(v) => set("status", v as RiskStatus)}>
                  <SelectTrigger aria-label="Risk Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as RiskStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field
              label="Timeline note (optional)"
              hint='e.g. "Monthly", "As soon as the current plan expires".'
              htmlFor="risk-timeline-note"
            >
              <Input
                id="risk-timeline-note"
                value={form.timeline_note}
                onChange={(e) => set("timeline_note", e.target.value)}
                maxLength={500}
              />
            </Field>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {risk ? "Save Changes" : "Add Risk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
