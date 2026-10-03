import type { Metadata } from "next"
import { MdDeskEngagements } from "@/components/md-desk/md-desk-engagements"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "MD's Workshops & Webinars | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function MdDeskWorkshopsPage() {
  await requireMdDeskMember("/profile")
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <MdDeskEngagements section="workshops" basePath="/md-desk" />
    </TablePageLayoutProvider>
  )
}
