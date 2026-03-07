import Link from "next/link"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { FileText, FolderOpen } from "lucide-react"
import { getAdminDocumentationData } from "./data"

export default async function AdminDocumentationPage() {
  const data = await getAdminDocumentationData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    documentation: any[]
    departmentDocs: { enabled: boolean }
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Documentation"
        description="Manage internal writeups and department file repository"
        icon={FileText}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      <Section title="Documentation Sections">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Internal Documentation
              </CardTitle>
              <CardDescription>Knowledge docs, writeups, and employee-created documentation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/documentation/internal">
                <Button className="w-full">Open Internal Docs ({pageData.documentation.length})</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Department Documents
              </CardTitle>
              <CardDescription>Confidential department files stored in OneDrive.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/documentation/department-documents">
                <Button className="w-full" disabled={!pageData.departmentDocs.enabled}>
                  {pageData.departmentDocs.enabled ? "Open Department Documents" : "Unavailable"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageWrapper>
  )
}
