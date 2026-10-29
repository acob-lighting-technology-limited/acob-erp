import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={7}
      showStats={true}
      showBackLink
      statBadges={4}
      list="responsive"
    />
  )
}
