import { redirect } from "next/navigation"

export default async function ScorecardSummaryPage() {
  redirect("/admin/corporate-services/scorecard?tab=summary")
}
