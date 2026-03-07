import { redirect } from "next/navigation"
import { AdminDocumentationContent } from "../admin-documentation-content"
import { getAdminDocumentationData } from "../data"

export default async function AdminDepartmentDocumentsPage() {
  const data = await getAdminDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as any

  return (
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
  )
}
