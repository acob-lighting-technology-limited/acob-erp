import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={5}
      rows={8}
      showStats={true}
      actions={3}
      statBadges={4}
      list="responsive"
    />
  )
}
