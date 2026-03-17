import { TablePage, type TablePageProps } from "@/components/admin/admin-table-page"

export function AppTablePage(
  props: Omit<TablePageProps, "backLinkHref" | "backLinkLabel"> & {
    backLinkHref?: string | null
    backLinkLabel?: string
  }
) {
  return (
    <TablePage
      backLinkHref={props.backLinkHref ?? "/profile"}
      backLinkLabel={props.backLinkLabel ?? "Back to Dashboard"}
      {...props}
    />
  )
}
