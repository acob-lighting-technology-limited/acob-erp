import type { Metadata } from "next"
import { MdDeskEngagements } from "@/components/md-desk/md-desk-engagements"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "MD's Activities | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function MdDeskActivitiesPage() {
  await requireMdDeskMember("/profile")
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <MdDeskEngagements section="activities" basePath="/md-desk" />
    </TablePageLayoutProvider>
  )
}
