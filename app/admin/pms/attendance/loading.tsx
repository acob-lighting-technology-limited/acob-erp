import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={6}
      rows={8}
      showStats={true}
      tabs={3}
      actions={2}
      statBadges={3}
      list="responsive"
    />
  )
}
