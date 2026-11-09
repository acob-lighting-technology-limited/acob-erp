import { Star } from "lucide-react"
import { formatWATDate } from "@/lib/utils/date"

/** One day's anonymous feedback. No author is returned by the API, by design. */
export type LunchReviewSummary = {
  menu_id: string
  date: string
  review_count: number
  average_rating: number | null
  comments: { id: string; rating: number; comment: string | null; created_at: string }[]
}

export function FeedbackExpandPanel({ entry }: { entry: LunchReviewSummary }) {
  if (entry.comments.length === 0) {
    return (
      <div className="bg-muted/10 text-muted-foreground border-b p-4 text-xs">
        Ratings were submitted without written comments for this day.
      </div>
    )
  }

  return (
    <div className="bg-muted/20 space-y-2.5 border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold uppercase">
          Anonymous Staff Comments ({entry.comments.length})
        </p>
        <span className="text-muted-foreground text-xs">Feedback is submitted anonymously without employee names.</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {entry.comments.map((comment) => (
          <div key={comment.id} className="bg-card space-y-1.5 rounded-lg border p-3 text-xs shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 font-semibold text-amber-500">
                <Star className="h-3 w-3 fill-amber-500" />
                {comment.rating} / 5
              </div>
              <span>
                {formatWATDate(comment.created_at, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{comment.comment}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
