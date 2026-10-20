import type { Metadata } from "next"
import { ControlledDocsLibrary } from "@/components/documentation/controlled/controlled-docs-library"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "Standard Operating Procedures | ACOB Lighting Technology Limited",
}

export default function Page() {
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <ControlledDocsLibrary type="sop" />
    </TablePageLayoutProvider>
  )
}
