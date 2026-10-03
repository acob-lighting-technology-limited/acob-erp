import type { Metadata } from "next"
import { ControlledDocsRegister } from "@/components/documentation/controlled/controlled-docs-register"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "Company Policies | Admin",
}

export default function Page() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <ControlledDocsRegister
        type="policy"
        backLink={{ href: "/admin/documentation", label: "Back to Documentation" }}
      />
    </TablePageLayoutProvider>
  )
}
