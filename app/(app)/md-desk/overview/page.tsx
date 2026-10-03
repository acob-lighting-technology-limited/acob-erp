import type { Metadata } from "next"
import { WaitingOnMd } from "@/components/md-desk/waiting-on-md"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "MD's Desk | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function MdDeskOverviewPage() {
  await requireMdDeskMember("/profile")
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <WaitingOnMd />
    </TablePageLayoutProvider>
  )
}
