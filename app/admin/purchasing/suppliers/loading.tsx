import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={5}
      rows={8}
      showStats={true}
      showBackLink
      statBadges={4}
      list="responsive"
    />
  )
}
