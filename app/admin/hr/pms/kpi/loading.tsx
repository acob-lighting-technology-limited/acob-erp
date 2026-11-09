import { TablePageSkeleton } from "@/components/skeletons"

export default function PmsKpiLoading() {
  return (
    <TablePageSkeleton
      statCards={2}
      filters={3}
      columns={5}
      rows={8}
      showStats={true}
      tabs={3}
      actions={2}
      statBadges={2}
      list="responsive"
    />
  )
}
