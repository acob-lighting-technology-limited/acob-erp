import { Brain } from "lucide-react"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { getCurrentUserPmsData } from "../_lib"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

type CbtReviewRow = {
  id: string
  review_cycle_id: string | null
  reviewer_id: string | null
  cbt_score: number | null
  status: string | null
  created_at: string
}

type ReviewerRow = {
  id: string
  first_name: string | null
  last_name: string | null
}

type CycleRow = {
  id: string
  name: string
}

function formatReviewerName(reviewer?: ReviewerRow) {
  if (!reviewer) return "System"
  return [reviewer.first_name, reviewer.last_name].filter(Boolean).join(" ") || "System"
}

export default async function PmsCbtPage() {
  const { score } = await getCurrentUserPmsData()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: cbtReviews } = await supabase
    .from("performance_reviews")
    .select("id, review_cycle_id, reviewer_id, cbt_score, status, created_at")
    .eq("user_id", user.id)
    .not("cbt_score", "is", null)
    .order("created_at", { ascending: false })
    .returns<CbtReviewRow[]>()

  const reviewRows = cbtReviews || []
  const reviewerIds = Array.from(
    new Set(reviewRows.map((review) => review.reviewer_id).filter((value): value is string => Boolean(value)))
  )
  const cycleIds = Array.from(
    new Set(reviewRows.map((review) => review.review_cycle_id).filter((value): value is string => Boolean(value)))
  )

  const [{ data: reviewers }, { data: cycles }] = await Promise.all([
    reviewerIds.length > 0
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", reviewerIds).returns<ReviewerRow[]>()
      : Promise.resolve({ data: [] as ReviewerRow[] }),
    cycleIds.length > 0
      ? supabase.from("review_cycles").select("id, name").in("id", cycleIds).returns<CycleRow[]>()
      : Promise.resolve({ data: [] as CycleRow[] }),
  ])

  const reviewerMap = new Map((reviewers || []).map((entry) => [entry.id, entry]))
  const cycleMap = new Map((cycles || []).map((entry) => [entry.id, entry]))

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS CBT"
        description="Track the learning and CBT part of your PMS as training records become available."
        icon={Brain}
        backLink={{ href: "/pms", label: "Back to PMS" }}
      />

      <StatCard title="Current CBT Score" value={`${score.cbt_score}%`} icon={Brain} variant="large" />

      <Section title="CBT History" description="Your CBT score records for each review cycle.">
        <Card>
          <CardHeader>
            <CardTitle>Saved CBT Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium">S/N</th>
                      <th className="px-3 py-2 font-medium">Cycle</th>
                      <th className="px-3 py-2 font-medium">CBT Score</th>
                      <th className="px-3 py-2 font-medium">Reviewed By</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((review, index) => (
                      <tr key={review.id} className="border-b">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2">
                          {review.review_cycle_id ? cycleMap.get(review.review_cycle_id)?.name || "Q2 2026" : "Q2 2026"}
                        </td>
                        <td className="px-3 py-2 font-semibold">{review.cbt_score ?? 0}%</td>
                        <td className="px-3 py-2">
                          {review.reviewer_id ? formatReviewerName(reviewerMap.get(review.reviewer_id)) : "System"}
                        </td>
                        <td className="px-3 py-2 capitalize">{String(review.status || "draft")}</td>
                        <td className="text-muted-foreground px-3 py-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No CBT entries yet for your profile.</p>
            )}
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
