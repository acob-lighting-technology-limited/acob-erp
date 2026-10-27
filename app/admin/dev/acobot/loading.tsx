import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={3}
      rows={8}
      showStats={true}
      tabs={2}
      actions={2}
      statBadges={4}
      list="responsive"
    />
  )
}
