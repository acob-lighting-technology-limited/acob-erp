import type { Metadata } from "next"
import { History } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RELEASES, releaseMonthLabel } from "@/lib/version-history"

export const metadata: Metadata = {
  title: "Version History | ACOB Lighting Technology Limited",
  description: "What changed in Matrix, month by month.",
}

export default function AdminVersionHistoryPage() {
  return (
    <PageWrapper maxWidth="content" background="gradient">
      <PageHeader
        title="Version History"
        description="What changed in Matrix, month by month, since it began as the Signature Creator."
        icon={History}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />
      <ol className="space-y-6">
        {RELEASES.map((release, index) => (
          <li key={release.version}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    v{release.version}
                  </Badge>
                  <span className="text-muted-foreground text-sm">{releaseMonthLabel(release.version)}</span>
                  {index === 0 ? <Badge>Current</Badge> : null}
                </div>
                <CardTitle className="text-xl">{release.title}</CardTitle>
                <CardDescription>{release.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {release.areas.map((area) => (
                  <section key={area.area}>
                    <h3 className="mb-1 text-sm font-semibold">{area.area}</h3>
                    <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                      {area.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </PageWrapper>
  )
}
