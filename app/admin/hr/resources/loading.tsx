import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={7}
      rows={8}
      showStats={true}
      tabs={2}
      statBadges={3}
      list="responsive"
    />
  )
}
