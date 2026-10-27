import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={3}
      columns={7}
      rows={8}
      showStats={true}
      actions={4}
      statBadges={3}
      list="responsive"
    />
  )
}
