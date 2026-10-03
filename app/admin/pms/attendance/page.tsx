import { AdminPmsAttendancePage } from "./view"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export default function AdminPmsAttendancePageRoute() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminPmsAttendancePage />
    </TablePageLayoutProvider>
  )
}
