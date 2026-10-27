import { TablePageSkeleton } from "@/components/skeletons"

export default function WarehousesLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={5}
      rows={6}
      showStats={true}
      actions={3}
      statBadges={4}
      list="responsive"
    />
  )
}
