import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={4}
      columns={7}
      rows={8}
      showStats={true}
      actions={2}
      showBackLink
      statBadges={4}
      list="responsive"
    />
  )
}
