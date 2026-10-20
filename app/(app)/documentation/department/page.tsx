import { redirect } from "next/navigation"
import { DocumentationContent } from "../documentation-content"
import { getDocumentationData, type DocumentationDataResult } from "../data"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export default async function DepartmentDocumentsPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as Exclude<DocumentationDataResult, { redirect: "/auth/login" }>

  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <DocumentationContent
        initialDocs={docsData.docs}
        userId={docsData.userId}
        departmentDocs={docsData.departmentDocs}
        defaultTab="department-documents"
        hideTabList={true}
        backLinkHref="/documentation"
        backLinkLabel="Back to Documentation"
      />
    </TablePageLayoutProvider>
  )
}
