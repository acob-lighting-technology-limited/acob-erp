import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={5}
      columns={7}
      showStats={true}
      actions={2}
      showBackLink
      spacing="tight"
      list="responsive"
    />
  )
}
