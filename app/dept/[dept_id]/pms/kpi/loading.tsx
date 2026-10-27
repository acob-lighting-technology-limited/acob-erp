import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={8}
      rows={8}
      showStats={true}
      statBadges={4}
      list="responsive"
    />
  )
}
