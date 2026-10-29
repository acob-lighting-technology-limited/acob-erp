import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={8}
      rows={8}
      showStats={true}
      statBadges={3}
      list="responsive"
    />
  )
}
