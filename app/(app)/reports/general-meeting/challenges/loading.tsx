import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={4}
      columns={5}
      showStats={true}
      actions={0}
      statBadges={4}
      list="responsive"
    />
  )
}
