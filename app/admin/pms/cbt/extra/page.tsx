import { CbtQuestionManager } from "@/components/pms/cbt-question-manager"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

/** Bonus questions share the CBT question manager; only targeting and copy differ. */
export default function AdminPmsCbtExtraQuestionPage() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <CbtQuestionManager variant="bonus" basePath="/admin/pms/cbt" questionPath="/admin/pms/cbt/extra" />
    </TablePageLayoutProvider>
  )
}
