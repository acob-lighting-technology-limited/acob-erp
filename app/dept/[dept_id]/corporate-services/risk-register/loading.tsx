import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      rows={10}
      showStats={true}
      tabs={2}
      actions={3}
      statBadges={4}
      list="responsive"
    />
  )
}
