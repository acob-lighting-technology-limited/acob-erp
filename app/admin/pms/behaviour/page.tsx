import { AdminPmsBehaviourPage } from "./view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export default function AdminPmsBehaviourPageRoute() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsBehaviourPage />
    </TablePageLayoutProvider>
  )
}
