import { redirect } from "next/navigation"
import { AdminDocumentationContent } from "../admin-documentation-content"
import { getAdminDocumentationData, type AdminDocumentationDataResult } from "../data"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export default async function AdminDepartmentDocumentsPage() {
  const data = await getAdminDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as Exclude<AdminDocumentationDataResult, { redirect: "/auth/login" | "/profile" }>

  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <AdminDocumentationContent
        initialDocumentation={pageData.documentation}
        initialemployee={pageData.employee}
        userProfile={pageData.userProfile}
        departmentDocs={pageData.departmentDocs}
        defaultTab="department-documents"
        hideTabList={true}
        backLinkHref="/admin/documentation"
        backLinkLabel="Back to Documentation"
      />
    </TablePageLayoutProvider>
  )
}
