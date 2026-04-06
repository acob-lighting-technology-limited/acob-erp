import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"

export interface TablePageProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  actionsPlacement?: "inline" | "below"
  backLinkHref?: string | null
  backLinkLabel?: string
  stats?: ReactNode
  exportBar?: ReactNode
  filters?: ReactNode
  filtersInCard?: boolean
  children: ReactNode
}

export function TablePage({
  title,
  description,
  icon,
  actions,
  actionsPlacement = "inline",
  backLinkHref,
  backLinkLabel,
  stats,
  exportBar,
  filters,
  filtersInCard = true,
  children,
}: TablePageProps) {
  const backLink = backLinkHref ? { href: backLinkHref, label: backLinkLabel } : undefined

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        backLink={backLink}
        actions={actions}
        actionsPlacement={actionsPlacement}
      />
      {stats}
      {exportBar}
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

export function AdminTablePage(
  props: Omit<TablePageProps, "backLinkHref" | "backLinkLabel"> & {
    backLinkHref?: string | null
    backLinkLabel?: string
  }
) {
  return (
    <TablePage
      backLinkHref={props.backLinkHref ?? "/admin"}
      backLinkLabel={props.backLinkLabel ?? "Back to Admin"}
      {...props}
    />
  )
}
