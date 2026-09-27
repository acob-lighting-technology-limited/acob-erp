"use client"

import { useState } from "react"
import { Check, EyeOff, Loader2, MessageSquareText, ShieldCheck, Star } from "lucide-react"
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
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import type { SystemSatisfactionSurvey } from "@/types/survey"

const log = logger("system-survey-modal")

const AVAILABLE_MODULES = [
  { id: "leave", label: "Leave" },
  { id: "lunch", label: "Lunch" },
  { id: "kpi", label: "KPI" },
  { id: "cbt", label: "CBT" },
  { id: "projects", label: "Projects" },
  { id: "tasks", label: "Tasks" },
  { id: "correspondence", label: "Correspondence" },
  { id: "documentation", label: "Documentation" },
  { id: "pms", label: "PMS" },
  { id: "profile", label: "Profile" },
  { id: "attendance", label: "Attendance" },
  { id: "directory", label: "Directory" },
  { id: "reports", label: "Reports" },
  { id: "assets", label: "Assets" },
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
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-1">
          <Label className="text-sm font-medium">{label}</Label>
          {description && <p className="text-muted-foreground text-sm leading-5">{description}</p>}
        </div>
        <span className="text-muted-foreground shrink-0 text-xs font-medium sm:pt-0.5" aria-live="polite">
          {displayVal > 0 ? `${displayVal} of 5` : "Select a rating"}
        </span>
      </div>
      <div className="flex items-center gap-2" role="group" aria-label={`Rating for ${label}`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayVal
          const isSelected = star === value
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverVal(star)}
              onMouseLeave={() => setHoverVal(null)}
              className={`focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-md border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                isSelected ? "border-primary bg-primary/10" : "border-input hover:bg-muted"
              }`}
              aria-label={`Rate ${star} out of 5 stars`}
              aria-pressed={isSelected}
            >
              <Star
                className={`h-5 w-5 transition-colors ${
                  isFilled ? "fill-primary text-primary" : "text-muted-foreground/40"
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
  const selectedModules = modulesUsed.filter((modId) => AVAILABLE_MODULES.some((module) => module.id === modId))
  const selectedModuleRatings = Object.fromEntries(
    Object.entries(moduleRatings).filter(([modId]) => selectedModules.includes(modId))
  )

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
        modulesUsed: selectedModules,
        moduleRatings: selectedModuleRatings,
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto p-0 sm:p-0">
        <DialogHeader className="flex flex-row items-start gap-3 space-y-0 p-6 pb-5 text-left">
          <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {existingSurvey ? "Update your Matrix feedback" : "Share your Matrix feedback"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-5">
              Tell us what is working well and what we should improve.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="divide-y">
          <section className="space-y-5 p-6" aria-labelledby="experience-heading">
            <div className="space-y-1">
              <h3 id="experience-heading" className="text-sm font-semibold">
                Your experience
              </h3>
              <p className="text-muted-foreground text-sm">Rate the parts of Matrix you use every day.</p>
            </div>

            <div className="divide-y border-y">
              <div className="py-4 first:pt-0">
                <StarPicker
                  label="Overall experience"
                  description="How satisfied are you with Matrix overall?"
                  value={overallRating}
                  onChange={setOverallRating}
                />
              </div>

              <div className="py-4">
                <StarPicker
                  label="Speed and responsiveness"
                  description="How quickly Matrix loads, searches, and saves your work."
                  value={speedRating}
                  onChange={setSpeedRating}
                />
              </div>

              <div className="py-4 last:pb-0">
                <StarPicker
                  label="Navigation and daily use"
                  description="How easily you can find what you need and complete your work."
                  value={usabilityRating}
                  onChange={setUsabilityRating}
                />
              </div>
            </div>
          </section>

          <section className="space-y-5 p-6" aria-labelledby="modules-heading">
            <div className="space-y-1">
              <h3 id="modules-heading" className="text-sm font-semibold">
                Modules you use
              </h3>
              <p className="text-muted-foreground text-sm">Select the Matrix modules you work in regularly.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {AVAILABLE_MODULES.map((mod) => {
                const isSelected = modulesUsed.includes(mod.id)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleModule(mod.id)}
                    className={`focus-visible:ring-ring inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-left text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                      isSelected ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"
                    }`}
                  >
                    {isSelected && <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                    {mod.label}
                  </button>
                )
              })}
            </div>

            {selectedModules.length > 0 && (
              <div className="space-y-3 border-t pt-5">
                <p className="text-muted-foreground text-sm">Rate the modules you selected.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedModules.map((modId) => {
                    const mod = AVAILABLE_MODULES.find((m) => m.id === modId)
                    const rating = moduleRatings[modId] || 4
                    return (
                      <div
                        key={modId}
                        className="bg-muted/30 flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">{mod?.label}</span>
                        <div
                          className="flex shrink-0 items-center gap-1"
                          role="group"
                          aria-label={`Rating for ${mod?.label}`}
                        >
                          {[1, 2, 3, 4, 5].map((star) => {
                            const isSelected = star === rating
                            return (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatingForModule(modId, star)}
                                aria-label={`Rate ${mod?.label} ${star} out of 5 stars`}
                                aria-pressed={isSelected}
                                className={`focus-visible:ring-ring flex h-7 w-7 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                                  isSelected
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground/40 hover:bg-background hover:text-muted-foreground"
                                }`}
                              >
                                <Star
                                  className={`h-4 w-4 ${star <= rating ? "fill-current" : ""}`}
                                  aria-hidden="true"
                                />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 p-6" aria-labelledby="guidance-heading">
            <div className="space-y-1">
              <h3 id="guidance-heading" className="text-sm font-semibold">
                Guidance and training
              </h3>
              <p className="text-muted-foreground text-sm">
                Did you receive enough guidance to use Matrix comfortably?
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {TRAINING_OPTIONS.map((opt) => {
                const isSelected = trainingRating === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setTrainingRating(opt.value)}
                    className={`focus-visible:ring-ring min-h-11 rounded-md border px-3 py-2 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                      isSelected ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-4 p-6" aria-labelledby="comments-heading">
            <div className="space-y-1">
              <h3 id="comments-heading" className="text-sm font-semibold">
                Tell us more
              </h3>
              <p className="text-muted-foreground text-sm">Optional details give the team the context to act.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="biggest-frustration" className="text-sm font-medium">
                  What is your biggest frustration or blocker in Matrix?
                </Label>
                <Textarea
                  id="biggest-frustration"
                  placeholder="For example: slow file uploads, unclear statuses, or too many approval steps."
                  value={biggestFrustration}
                  onChange={(e) => setBiggestFrustration(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="resize-y text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desired-features" className="text-sm font-medium">
                  What improvement would save you the most time?
                </Label>
                <Textarea
                  id="desired-features"
                  placeholder="For example: bulk approvals, keyboard shortcuts, or clearer reporting."
                  value={desiredFeatures}
                  onChange={(e) => setDesiredFeatures(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="resize-y text-sm"
                />
              </div>
            </div>
          </section>

          <section className="p-6" aria-labelledby="privacy-heading">
            <div className="flex items-start gap-3">
              <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                {isAnonymous ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label id="privacy-heading" htmlFor="anonymous-mode" className="cursor-pointer text-sm font-medium">
                  Submit anonymously
                </Label>
                <p className="text-muted-foreground text-sm leading-5">
                  {isAnonymous
                    ? "Your name and email are hidden in administrative dashboards."
                    : "Your name is recorded, so you can review and update your response later."}
                </p>
              </div>
              <Switch
                id="anonymous-mode"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
                aria-labelledby="privacy-heading"
              />
            </div>
          </section>

          <DialogFooter className="bg-muted/30 flex flex-row items-center justify-end gap-2 px-6 py-4 sm:space-x-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[132px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : existingSurvey ? (
                "Update feedback"
              ) : (
                "Send feedback"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
