import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"

interface AdminTablePageProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  backLinkHref?: string | null
  backLinkLabel?: string
  stats?: ReactNode
  filters?: ReactNode
  filtersInCard?: boolean
  children: ReactNode
}

export function AdminTablePage({
  title,
  description,
  icon,
  actions,
  backLinkHref = "/admin",
  backLinkLabel = "Back to Admin",
  stats,
  filters,
  filtersInCard = true,
  children,
}: AdminTablePageProps) {
  const backLink = backLinkHref ? { href: backLinkHref, label: backLinkLabel } : undefined

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader title={title} description={description} icon={icon} backLink={backLink} actions={actions} />
      {stats}
      {filters ? (
        filtersInCard ? (
          <Card>
            <CardContent className="pt-6">{filters}</CardContent>
          </Card>
        ) : (
          <>{filters}</>
        )
      ) : null}
      {children}
    </PageWrapper>
  )
}
