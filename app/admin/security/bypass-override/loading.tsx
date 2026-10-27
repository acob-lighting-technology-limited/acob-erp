import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={4}
      columns={4}
      showStats={true}
      actions={2}
      statBadges={4}
      list="responsive"
    />
  )
}
