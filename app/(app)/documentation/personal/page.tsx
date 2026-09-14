import { redirect } from "next/navigation"
import { getDocumentationData, type DocumentationDataResult } from "../data"
import { PersonalDocumentationContent } from "./personal-documentation-content"

export default async function PersonalDocumentationPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as Exclude<DocumentationDataResult, { redirect: "/auth/login" }>

  return <PersonalDocumentationContent initialDocs={docsData.docs} userId={docsData.userId} />
}
