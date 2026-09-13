import { redirect } from "next/navigation"

export default async function CorporateScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; department?: string }>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  if (params.tab) query.set("tab", params.tab)
  if (params.department) query.set("department", params.department)
  const qs = query.toString()
  redirect(`/admin/corporate-services/scorecard${qs ? `?${qs}` : ""}`)
}
