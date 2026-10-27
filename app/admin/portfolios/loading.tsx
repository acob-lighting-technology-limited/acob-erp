import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={5}
      rows={6}
      showStats={true}
      actions={2}
      statBadges={3}
      list="responsive"
    />
  )
}
