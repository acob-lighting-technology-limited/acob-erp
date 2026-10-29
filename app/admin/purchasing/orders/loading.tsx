import { TablePageSkeleton } from "@/components/skeletons"

export default function PurchaseOrdersLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={6}
      rows={8}
      showStats={true}
      showBackLink
      statBadges={4}
      list="responsive"
    />
  )
}
