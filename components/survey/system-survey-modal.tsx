"use client"

import { useState } from "react"
import { Star, ShieldCheck, EyeOff, Check, Loader2, ClipboardList } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import type { SystemSatisfactionSurvey } from "@/types/survey"

const log = logger("system-survey-modal")

const AVAILABLE_MODULES = [
  { id: "pms", label: "PMS (Performance)" },
  { id: "correspondence", label: "Correspondence & Memos" },
  { id: "hr", label: "HR, Leave & Attendance" },
  { id: "accounts", label: "Accounts & Payments" },
  { id: "directory", label: "Employee Directory" },
  { id: "projects", label: "Projects & Tasks" },
  { id: "md_desk", label: "MD Desk" },
]

const TRAINING_OPTIONS = [
  { value: "adequate", label: "Yes, fully prepared" },
  { value: "somewhat", label: "Partially, needed more guidance" },
  { value: "inadequate", label: "No, struggled to get started" },
]

interface StarPickerProps {
  value: number
  onChange: (val: number) => void
  label: string
  description?: string
}

function StarPicker({ value, onChange, label, description }: StarPickerProps) {
  const [hoverVal, setHoverVal] = useState<number | null>(null)
  const displayVal = hoverVal ?? value

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="text-muted-foreground text-xs font-medium">
          {displayVal > 0 ? `${displayVal} of 5` : "Select a rating"}
        </span>
      </div>
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
      <div className="flex items-center gap-1.5 pt-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayVal
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverVal(star)}
              onMouseLeave={() => setHoverVal(null)}
              className="hover:bg-muted focus:ring-primary/40 rounded-md p-1 transition focus:ring-2 focus:outline-none"
              aria-label={`Rate ${star} out of 5 stars`}
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  isFilled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-muted-foreground/50"
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface SystemSurveyModalProps {
  isOpen: boolean
  onClose: () => void
  onSnooze?: () => void
  existingSurvey?: SystemSatisfactionSurvey | null
  onSuccess?: (survey: SystemSatisfactionSurvey) => void
}

export function SystemSurveyModal({ isOpen, onClose, onSnooze, existingSurvey, onSuccess }: SystemSurveyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overallRating, setOverallRating] = useState<number>(existingSurvey?.overall_rating || 0)
  const [speedRating, setSpeedRating] = useState<number>(existingSurvey?.speed_rating || 0)
  const [usabilityRating, setUsabilityRating] = useState<number>(existingSurvey?.usability_rating || 0)
  const [modulesUsed, setModulesUsed] = useState<string[]>(existingSurvey?.modules_used || [])
  const [moduleRatings, setModuleRatings] = useState<Record<string, number>>(existingSurvey?.module_ratings || {})
  const [trainingRating, setTrainingRating] = useState<string | null>(existingSurvey?.training_rating || null)
  const [biggestFrustration, setBiggestFrustration] = useState(existingSurvey?.biggest_frustration || "")
  const [desiredFeatures, setDesiredFeatures] = useState(existingSurvey?.desired_features || "")
  const [isAnonymous, setIsAnonymous] = useState<boolean>(existingSurvey?.is_anonymous || false)

  const toggleModule = (modId: string) => {
    if (modulesUsed.includes(modId)) {
      setModulesUsed(modulesUsed.filter((m) => m !== modId))
      const copy = { ...moduleRatings }
      delete copy[modId]
      setModuleRatings(copy)
    } else {
      setModulesUsed([...modulesUsed, modId])
      setModuleRatings({ ...moduleRatings, [modId]: 4 }) // default 4
    }
  }

  const setRatingForModule = (modId: string, rating: number) => {
    setModuleRatings({ ...moduleRatings, [modId]: rating })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (overallRating < 1 || speedRating < 1 || usabilityRating < 1) {
      toast.error("Please provide ratings for Overall Experience, Speed, and Usability.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        overallRating,
        speedRating,
        usabilityRating,
        modulesUsed,
        moduleRatings,
        trainingRating,
        biggestFrustration: biggestFrustration.trim() || null,
        desiredFeatures: desiredFeatures.trim() || null,
        isAnonymous,
      }

      const res = await apiFetch("/api/survey", {
        method: existingSurvey ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit survey")
      }

      // Mark locally so prompt doesn't show again
      try {
        window.localStorage.setItem("acob-survey-submitted", "true")
      } catch {
        // ignore storage error
      }

      toast.success(existingSurvey ? "Your survey response has been updated!" : "Thank you for your valuable feedback!")
      if (onSuccess && data?.data) {
        onSuccess(data.data)
      }
      onClose()
    } catch (err) {
      log.error({ err: String(err) }, "Survey submission failed")
      toast.error(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border/60 bg-card relative max-h-[90vh] max-w-2xl overflow-y-auto p-6 shadow-2xl sm:rounded-2xl">
        {/* Subtle top gradient accent line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        <DialogHeader className="pt-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              <ClipboardList className="h-5 w-5 text-emerald-500" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">
                {existingSurvey ? "Edit Your ERP Satisfaction Survey" : "ACOB Matrix ERP Experience Pulse"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Help us refine and enhance system features, performance, and daily workflow ease.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Section 1: Core Ratings */}
          <div className="bg-card space-y-4 rounded-lg border p-4 shadow-sm">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Core Usability & Performance
            </h4>

            <StarPicker
              label="1. Overall System Satisfaction"
              description="How satisfied are you with ACOB Matrix ERP overall?"
              value={overallRating}
              onChange={setOverallRating}
            />

            <div className="border-t pt-3">
              <StarPicker
                label="2. Speed & Responsiveness"
                description="How fast does the system load pages, search records, and save actions?"
                value={speedRating}
                onChange={setSpeedRating}
              />
            </div>

            <div className="border-t pt-3">
              <StarPicker
                label="3. Ease of Navigation & Daily Use"
                description="How intuitive is it to find what you need and complete your work?"
                value={usabilityRating}
                onChange={setUsabilityRating}
              />
            </div>
          </div>

          {/* Section 2: Modules Used */}
          <div className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Modules You Use Regularly
            </h4>
            <p className="text-muted-foreground text-xs">
              Select the modules you work with and rate your experience with each:
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {AVAILABLE_MODULES.map((mod) => {
                const isSelected = modulesUsed.includes(mod.id)
                return (
                  <Badge
                    key={mod.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1 text-xs transition select-none"
                    onClick={() => toggleModule(mod.id)}
                  >
                    {isSelected && <Check className="mr-1 h-3 w-3" />}
                    {mod.label}
                  </Badge>
                )
              })}
            </div>

            {modulesUsed.length > 0 && (
              <div className="space-y-2.5 border-t pt-3">
                <span className="text-muted-foreground text-xs font-medium">Rate your selected modules (1–5):</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {modulesUsed.map((modId) => {
                    const mod = AVAILABLE_MODULES.find((m) => m.id === modId)
                    const rating = moduleRatings[modId] || 4
                    return (
                      <div
                        key={modId}
                        className="bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                      >
                        <span className="max-w-[140px] truncate font-medium">{mod?.label}</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRatingForModule(modId, star)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Training & Guidance */}
          <div className="bg-card space-y-3 rounded-lg border p-4 shadow-sm">
            <Label className="text-sm font-semibold">Did you receive enough guidance to use the ERP comfortably?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TRAINING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTrainingRating(opt.value)}
                  className={`rounded-lg border p-2.5 text-left text-xs font-medium transition ${
                    trainingRating === opt.value
                      ? "border-primary bg-primary/10 text-primary ring-primary ring-1"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Qualitative Feedback */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="biggest-frustration" className="text-sm font-medium">
                What is your biggest frustration or blocker in the ERP?
              </Label>
              <Textarea
                id="biggest-frustration"
                placeholder="e.g. Navigating between approvals is too many clicks; slow file uploads; unclear status..."
                value={biggestFrustration}
                onChange={(e) => setBiggestFrustration(e.target.value)}
                rows={2}
                maxLength={1000}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desired-features" className="text-sm font-medium">
                What feature or improvement would save you the most time?
              </Label>
              <Textarea
                id="desired-features"
                placeholder="e.g. Quick keyboard shortcuts, bulk approvals, export to Excel..."
                value={desiredFeatures}
                onChange={(e) => setDesiredFeatures(e.target.value)}
                rows={2}
                maxLength={1000}
                className="text-sm"
              />
            </div>
          </div>

          {/* Section 5: Anonymity Toggle */}
          <div className="bg-muted/30 flex items-start justify-between gap-3 rounded-lg border p-3.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                {isAnonymous ? (
                  <EyeOff className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ShieldCheck className="text-primary h-4 w-4" />
                )}
                <Label htmlFor="anonymous-mode" className="cursor-pointer text-xs font-semibold">
                  Submit Anonymously
                </Label>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {isAnonymous
                  ? "Your name and email will be hidden in administrative dashboards. Only your department is aggregated for team sentiment."
                  : "Your name is recorded. You will be able to review and update your answers anytime under Tools > Feedback."}
              </p>
            </div>
            <Switch id="anonymous-mode" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-8 min-w-[120px] text-xs">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : existingSurvey ? (
                "Update Response"
              ) : (
                "Submit Survey"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
