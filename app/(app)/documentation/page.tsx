import Link from "next/link"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { FileText, FolderOpen } from "lucide-react"
import { getDocumentationData } from "./data"

export interface Documentation {
  id: string
  title: string
  content: string
  category?: string
  tags?: string[]
  is_draft: boolean
  created_at: string
  updated_at: string
}

export default async function DocumentationPage() {
  const data = await getDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const docsData = data as {
    docs: Documentation[]
    departmentDocs: { enabled: boolean }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Documentation"
        description="Access internal knowledge docs and department file repository"
        icon={FileText}
        backLink={{ href: "/dashboard/profile", label: "Back to Dashboard" }}
      />

      <Section title="Documentation Sections">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Internal Documentation
              </CardTitle>
              <CardDescription>Create and manage your internal work documentation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/documentation/internal">
                <Button className="w-full">Open Internal Docs ({docsData.docs.length})</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Department Documents
              </CardTitle>
              <CardDescription>Browse your department's confidential OneDrive files.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/documentation/department-documents">
                <Button className="w-full" disabled={!docsData.departmentDocs.enabled}>
                  {docsData.departmentDocs.enabled ? "Open Department Documents" : "Unavailable"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageWrapper>
  )
}
