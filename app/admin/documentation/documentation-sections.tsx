import Link from "next/link"
import { FileText, FolderOpen, ListChecks, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { IconFill } from "@/components/ui/icon-fill"

interface DocumentationSectionsProps {
  basePath: string
  documentationCount: number
  departmentDocsEnabled: boolean
  backLink: { href: string; label: string }
}

export function DocumentationSections({
  basePath,
  documentationCount,
  departmentDocsEnabled,
  backLink,
}: DocumentationSectionsProps) {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Documentation"
        description="Manage company policies, SOPs, staff personal docs, and department files"
        icon={FileText}
        backLink={backLink}
      />

      <Section title="Documentation Sections">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={ScrollText}
                  fillColor="bg-violet-500"
                  className="h-8 w-8 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-600 transition-transform duration-200 group-hover:scale-105 dark:text-violet-400"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-violet-500">Company Policies</span>
              </CardTitle>
              <CardDescription>Versioned policies, review dates, and staff acknowledgements.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`${basePath}/policies`}>
                <Button className="w-full">Open Policies</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={ListChecks}
                  fillColor="bg-sky-500"
                  className="h-8 w-8 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-600 transition-transform duration-200 group-hover:scale-105 dark:text-sky-400"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-sky-500">Standard Operating Procedures</span>
              </CardTitle>
              <CardDescription>Company-wide and department SOPs, with versions and review dates.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`${basePath}/sops`}>
                <Button className="w-full">Open SOPs</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={FileText}
                  fillColor="bg-blue-500"
                  className="h-8 w-8 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 transition-transform duration-200 group-hover:scale-105 dark:text-blue-400"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-blue-500">Personal Documentation</span>
              </CardTitle>
              <CardDescription>Knowledge docs, writeups, and employee-created documentation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`${basePath}/personal`}>
                <Button className="w-full">Open Personal Docs ({documentationCount})</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconFill
                  icon={FolderOpen}
                  fillColor="bg-emerald-500"
                  className="h-8 w-8 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 transition-transform duration-200 group-hover:scale-105 dark:text-emerald-400"
                  iconClassName="h-4 w-4"
                />
                <span className="transition-colors group-hover:text-emerald-500">Department Documents</span>
              </CardTitle>
              <CardDescription>Confidential department files stored in OneDrive.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`${basePath}/department`}>
                <Button className="w-full" disabled={!departmentDocsEnabled}>
                  {departmentDocsEnabled ? "Open Department Documents" : "Unavailable"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageWrapper>
  )
}
