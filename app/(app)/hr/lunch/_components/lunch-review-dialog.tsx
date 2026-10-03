"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, apiJson } from "@/lib/api-client"
import { formatWATDate } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"

interface LunchReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menuId: string | null
  date: string | null
  onSaved?: () => void
}

/**
 * Feedback on a past day's food. HR sees the rating and comment but never who
 * left it, so the dialog says so plainly — people only answer honestly if they
 * believe the anonymity.
 */
export function LunchReviewDialog({ open, onOpenChange, menuId, date, onSaved }: LunchReviewDialogProps) {
  const queryClient = useQueryClient()
  const [hovered, setHovered] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // The caller's own review for this menu, if they left one.
  const { data: existing = null, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.myLunchReview(menuId ?? ""),
    enabled: open && Boolean(menuId),
    queryFn: async () => {
      const payload = await apiJson<{ data?: { rating: number | string; comment: string | null }[] }>(
        `/api/hr/lunch/reviews?menu_id=${encodeURIComponent(menuId!)}`
      )
      const review = payload.data?.[0]
      return review ? { rating: Number(review.rating) || 0, comment: review.comment || "" } : null
    },
  })
  const hasExistingReview = existing !== null

  // Unsaved edits for the current menu; otherwise show the stored review (or a blank one).
  const [draft, setDraft] = useState<{ menuId: string; rating: number; comment: string } | null>(null)
  const current = draft && draft.menuId === menuId ? draft : (existing ?? { rating: 0, comment: "" })
  const { rating, comment } = current
  const setRating = (value: number) => menuId && setDraft({ menuId, rating: value, comment })
  const setComment = (value: string) => menuId && setDraft({ menuId, rating, comment: value })

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft(null)
    onOpenChange(next)
  }

  const finish = () => {
    if (menuId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myLunchReview(menuId) })
    handleOpenChange(false)
    onSaved?.()
  }

  async function handleSubmit() {
    if (!menuId) return
    if (rating < 1) {
      toast.error("Pick a rating from 1 to 5 stars")
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch("/api/hr/lunch/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuId, rating, comment: comment.trim() || null }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || "Failed to save your review")

      toast.success(hasExistingReview ? "Review updated" : "Thanks — your feedback was sent anonymously")
      finish()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save your review")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!menuId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/hr/lunch/reviews?menu_id=${encodeURIComponent(menuId)}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || "Failed to delete your review")

      toast.success("Review deleted")
      finish()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete your review")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasExistingReview ? "Edit your review" : "Review this meal"}</DialogTitle>
          <DialogDescription>
            {date ? formatWATDate(date, { weekday: "long", day: "numeric", month: "long" }) : "Meal"} — your rating and
            comment reach HR <span className="font-medium">without your name</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onMouseEnter={() => setHovered(value)}
                  onClick={() => setRating(value)}
                  disabled={loading || saving || deleting}
                  className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                >
                  <Star
                    className={cn(
                      "h-7 w-7",
                      (hovered || rating) >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lunch-review-comment">Comment (optional)</Label>
            <Textarea
              id="lunch-review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What was good, what could be better?"
              className="min-h-[120px]"
              maxLength={2000}
              disabled={loading || saving || deleting}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {hasExistingReview ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
              disabled={saving || loading}
            >
              Delete review
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={loading || deleting}>
              {hasExistingReview ? "Update review" : "Submit review"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
