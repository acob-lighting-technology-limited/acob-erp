import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={6}
      rows={8}
      showStats={true}
      tabs={3}
      statBadges={4}
      list="responsive"
    />
  )
}
