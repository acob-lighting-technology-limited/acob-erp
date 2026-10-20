import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { PortfolioDetail } from "@/components/projects/portfolio-detail"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "Portfolio | Matrix",
  description: "A portfolio's projects, ranked by what needs attention, and its charts.",
}

/** Read-only for staff: both APIs behind it only return what they can see. */
export default async function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")

  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <PortfolioDetail portfolioId={id} isAdmin={false} />
    </TablePageLayoutProvider>
  )
}
