import type { Metadata } from "next"
import { ControlledDocsRegister } from "@/components/documentation/controlled/controlled-docs-register"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "Standard Operating Procedures | Admin",
}

export default function Page() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <ControlledDocsRegister type="sop" backLink={{ href: "/admin/documentation", label: "Back to Documentation" }} />
    </TablePageLayoutProvider>
  )
}
