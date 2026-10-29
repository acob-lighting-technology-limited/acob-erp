import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={2}
      filters={2}
      columns={5}
      rows={8}
      showStats={true}
      actions={0}
      statBadges={2}
      list="responsive"
    />
  )
}
