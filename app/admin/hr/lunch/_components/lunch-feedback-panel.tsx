import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
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
  return (
    <div className="border-border/80 bg-card overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/40 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-foreground text-sm font-semibold">
            Feedback for{" "}
            {formatWATDate(entry.date, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Submitted anonymously — no comment is linked to a staff member.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-warning/15 text-warning gap-1">
            <Star className="h-3 w-3 fill-current" />
            {entry.average_rating ? `${entry.average_rating.toFixed(1)} / 5` : "No rating"}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {entry.review_count} review{entry.review_count === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {entry.comments.length} comment{entry.comments.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {entry.comments.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm italic">
          Ratings were submitted without written comments for this day.
        </p>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:p-5">
          {entry.comments.map((comment) => (
            <section key={comment.id} className="bg-muted/35 rounded-lg p-4" aria-label="Staff comment">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-warning flex items-center gap-0.5"
                  aria-label={`${comment.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={cn("h-3.5 w-3.5", i < comment.rating ? "fill-current" : "opacity-30")} />
                  ))}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatWATDate(comment.created_at, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-foreground mt-2 text-sm leading-6 whitespace-pre-wrap">{comment.comment}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
