import type { Metadata } from "next"
import { MdDeskTaskReviews } from "@/components/md-desk/md-desk-task-reviews"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "MD's Task Reviews | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function AdminMdDeskTaskReviewsPage() {
  await requireMdDeskMember("/admin")
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <MdDeskTaskReviews basePath="/admin/md-desk" />
    </TablePageLayoutProvider>
  )
}
