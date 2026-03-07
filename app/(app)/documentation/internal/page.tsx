import { redirect } from "next/navigation"
import { DocumentationContent } from "../documentation-content"
import { getDocumentationData } from "../data"

export default async function InternalDocumentationPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as any

  return (
    <DocumentationContent
      initialDocs={docsData.docs}
      userId={docsData.userId}
      departmentDocs={docsData.departmentDocs}
      defaultTab="knowledge-docs"
      hideTabList={true}
      backLinkHref="/documentation"
      backLinkLabel="Back to Documentation"
    />
  )
}
