import { redirect } from "next/navigation"
import { getDocumentationData, type DocumentationDataResult } from "../data"
import { InternalDocumentationContent } from "./internal-documentation-content"

export default async function InternalDocumentationPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as Exclude<DocumentationDataResult, { redirect: "/auth/login" }>

  return <InternalDocumentationContent initialDocs={docsData.docs} userId={docsData.userId} />
}
