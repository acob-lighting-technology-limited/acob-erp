import { AdminPmsPage } from "./view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export default async function AdminPmsPageRoute({ searchParams }: { searchParams: Promise<{ cycle_id?: string }> }) {
  const { cycle_id } = await searchParams
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsPage cycleId={cycle_id} />
    </TablePageLayoutProvider>
  )
}
